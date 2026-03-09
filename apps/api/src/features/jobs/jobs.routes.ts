import {
  aiRuns,
  intakeDocuments,
  jobDeliverables,
  jobAssignments,
  jobNotes,
  jobScheduleAllocations,
  jobStatusHistory,
  jobs,
  users
} from "@oto/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";
import { getDb } from "../../db/runtime";
import { markRequestCancelled, purgeDeletedIntakesIfDue } from "../../services/maintenance/intake-retention";
import { translateDocumentWithAi } from "../../services/documents/ai-document-translation";
import { resolveSourcePreview } from "../../services/documents/source-preview";
import {
  convertTranslatedDocument,
  listSupportedConvertedFormats
} from "../../services/documents/translated-document-conversion";
import { scheduleJobForSpecificEmployee } from "../../services/scheduling/job-scheduler";

const router = Router();
const db = getDb();
const deliverablesDir = path.resolve(env.LOCAL_STORAGE_PATH, "deliverables");
const aiTranslationsDir = path.resolve(env.LOCAL_STORAGE_PATH, "ai-translations");
await mkdir(deliverablesDir, { recursive: true });
await mkdir(aiTranslationsDir, { recursive: true });
const deliverableUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, deliverablesDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext.toLowerCase()}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const VALID_STATUSES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "REVIEW",
  "WAITING_CUSTOMER",
  "BLOCKED",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "ARCHIVED",
  "REFUSED"
] as const;

const VALID_AI_ACTIONS = [
  "draft-translation",
  "extract-terms",
  "quality-check",
  "detect-untranslated",
  "revision-suggestions"
] as const;

router.get("/", async (req, res) => {
  const authUser = req.authUser!;
  const statusFilter = String(req.query.status ?? "").trim();

  if (authUser.role === "ADMIN") {
    const rows = await db
      .select()
      .from(jobs)
      .where(statusFilter ? eq(jobs.status, statusFilter) : sql`1 = 1`)
      .orderBy(asc(jobs.dueAt), desc(jobs.createdAt));

    return res.json({
      items: rows,
      total: rows.length
    });
  }

  const assignments = await db
    .select({ jobId: jobAssignments.jobId })
    .from(jobAssignments)
    .where(and(eq(jobAssignments.userId, authUser.id), eq(jobAssignments.active, true)));

  const assignedJobIds = assignments.map((item) => item.jobId);
  if (assignedJobIds.length === 0) {
    return res.json({ items: [], total: 0 });
  }

  const rows = await db
    .select()
    .from(jobs)
    .where(
      and(
        inArray(jobs.id, assignedJobIds),
        statusFilter ? eq(jobs.status, statusFilter) : sql`1 = 1`
      )
    )
    .orderBy(asc(jobs.dueAt), desc(jobs.createdAt));

  return res.json({
    items: rows,
    total: rows.length
  });
});

router.get("/assignable-users", async (req, res) => {
  const authUser = req.authUser!;
  if (authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role
    })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.role, "EMPLOYEE")))
    .orderBy(asc(users.fullName));

  return res.json({ items: rows });
});

router.get("/:id", async (req, res) => {
  const authUser = req.authUser!;
  const jobId = req.params.id;

  const assignment = await db
    .select({ id: jobAssignments.id })
    .from(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.userId, authUser.id),
        eq(jobAssignments.active, true)
      )
    )
    .limit(1);

  if (assignment.length === 0 && authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = row[0];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const [notes, statusHistory, runs, deliverables, sourceDocuments, activeAssignments] = await Promise.all([
    db
      .select({
        id: jobNotes.id,
        jobId: jobNotes.jobId,
        content: jobNotes.content,
        visibility: jobNotes.visibility,
        createdAt: jobNotes.createdAt,
        authorId: jobNotes.authorId,
        authorName: users.fullName
      })
      .from(jobNotes)
      .leftJoin(users, eq(users.id, jobNotes.authorId))
      .where(eq(jobNotes.jobId, jobId))
      .orderBy(desc(jobNotes.createdAt)),
    db
      .select()
      .from(jobStatusHistory)
      .where(eq(jobStatusHistory.jobId, jobId))
      .orderBy(desc(jobStatusHistory.changedAt)),
    db
      .select()
      .from(aiRuns)
      .where(eq(aiRuns.jobId, jobId))
      .orderBy(desc(aiRuns.createdAt)),
    db
      .select()
      .from(jobDeliverables)
      .where(eq(jobDeliverables.jobId, jobId))
      .orderBy(desc(jobDeliverables.createdAt)),
    job.sourceRequestId
      ? db
          .select()
          .from(intakeDocuments)
          .where(eq(intakeDocuments.sessionId, job.sourceRequestId))
          .orderBy(asc(intakeDocuments.createdAt))
      : Promise.resolve([]),
    db
      .select({
        id: jobAssignments.id,
        userId: jobAssignments.userId,
        fullName: users.fullName,
        email: users.email,
        role: users.role
      })
      .from(jobAssignments)
      .leftJoin(users, eq(users.id, jobAssignments.userId))
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.active, true)))
      .orderBy(desc(jobAssignments.assignedAt))
  ]);

  return res.json({
    job,
    notes,
    statusHistory,
    aiRuns: runs,
    deliverables,
    sourceDocuments,
    activeAssignments
  });
});

router.post("/:id/status", async (req, res) => {
  const authUser = req.authUser!;
  const jobId = req.params.id;
  const toStatus = String(req.body?.toStatus ?? "").trim();
  const reason = String(req.body?.reason ?? "").trim();

  if (!VALID_STATUSES.includes(toStatus as (typeof VALID_STATUSES)[number])) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = row[0];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  await db.update(jobs).set({ status: toStatus }).where(eq(jobs.id, jobId));
  await db.insert(jobStatusHistory).values({
    id: randomUUID(),
    jobId,
    fromStatus: job.status,
    toStatus,
    changedBy: authUser.id,
    reason: reason || null,
    changedAt: new Date()
  });

  return res.json({ ok: true });
});

router.post("/:id/assign", async (req, res) => {
  const authUser = req.authUser!;
  if (authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const jobId = String(req.params.id);
  const assigneeUserId = String(req.body?.assigneeUserId ?? "").trim();
  if (!assigneeUserId) {
    return res.status(400).json({ error: "assigneeUserId is required" });
  }

  const userRows = await db
    .select({ id: users.id, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, assigneeUserId))
    .limit(1);
  const assignee = userRows[0];
  if (!assignee || !assignee.isActive || assignee.role !== "EMPLOYEE") {
    return res.status(400).json({ error: "Invalid assignee" });
  }

  const jobRows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = jobRows[0];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const estimatedMinutes = job.estimatedMinutes ?? 60;
  const schedule = await scheduleJobForSpecificEmployee({
    jobId,
    userId: assigneeUserId,
    priority: job.priority,
    explicitDeadlineAt: job.dueAt,
    estimatedMinutes,
    assignedBy: authUser.id,
    now: new Date()
  });

  if (schedule) {
    await db.update(jobs).set({
      scheduledStartAt: schedule.scheduledStartAt,
      scheduledEndAt: schedule.scheduledEndAt,
      dueAt: schedule.effectiveDeadlineAt
    }).where(eq(jobs.id, jobId));
  }

  if (!schedule) {
    await db
      .update(jobAssignments)
      .set({ active: false })
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.active, true)));
    await db.delete(jobScheduleAllocations).where(eq(jobScheduleAllocations.jobId, jobId));

    await db.insert(jobAssignments).values({
      id: randomUUID(),
      jobId,
      userId: assigneeUserId,
      assignedBy: authUser.id,
      active: true,
      assignedAt: new Date()
    });
  }

  return res.json({ ok: true });
});

router.post("/:id/refuse", async (req, res) => {
  const authUser = req.authUser!;
  if (authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const jobId = String(req.params.id);
  const reason = String(req.body?.reason ?? "").trim();
  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = row[0];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  await db.update(jobs).set({ status: "REFUSED" }).where(eq(jobs.id, jobId));
  await db.insert(jobStatusHistory).values({
    id: randomUUID(),
    jobId,
    fromStatus: job.status,
    toStatus: "REFUSED",
    changedBy: authUser.id,
    reason: reason || "Refused by admin",
    changedAt: new Date()
  });

  return res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  const authUser = req.authUser!;
  if (authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const jobId = String(req.params.id);
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = rows[0];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (job.sourceRequestId) {
    await markRequestCancelled(job.sourceRequestId, new Date());
  }

  await db.delete(jobAssignments).where(eq(jobAssignments.jobId, jobId));
  await db.delete(jobStatusHistory).where(eq(jobStatusHistory.jobId, jobId));
  await db.delete(jobNotes).where(eq(jobNotes.jobId, jobId));
  await db.delete(aiRuns).where(eq(aiRuns.jobId, jobId));
  await db.delete(jobDeliverables).where(eq(jobDeliverables.jobId, jobId));
  await db.delete(jobs).where(eq(jobs.id, jobId));
  await purgeDeletedIntakesIfDue();

  return res.json({ ok: true });
});

router.get("/:id/notes", async (req, res) => {
  const notes = await db
    .select({
      id: jobNotes.id,
      jobId: jobNotes.jobId,
      content: jobNotes.content,
      visibility: jobNotes.visibility,
      createdAt: jobNotes.createdAt,
      authorId: jobNotes.authorId,
      authorName: users.fullName
    })
    .from(jobNotes)
    .leftJoin(users, eq(users.id, jobNotes.authorId))
    .where(eq(jobNotes.jobId, req.params.id))
    .orderBy(desc(jobNotes.createdAt));

  return res.json({ items: notes });
});

router.post("/:id/notes", async (req, res) => {
  const authUser = req.authUser!;
  const content = String(req.body?.content ?? "").trim();

  if (!content) {
    return res.status(400).json({ error: "content is required" });
  }

  await db.insert(jobNotes).values({
    id: randomUUID(),
    jobId: req.params.id,
    authorId: authUser.id,
    visibility: "INTERNAL",
    content,
    createdAt: new Date()
  });

  return res.status(201).json({ ok: true });
});

router.post("/:id/ai/:action", async (req, res) => {
  const authUser = req.authUser!;
  const action = String(req.params.action ?? "").trim();

  if (!VALID_AI_ACTIONS.includes(action as (typeof VALID_AI_ACTIONS)[number])) {
    return res.status(400).json({ error: "Unsupported AI action" });
  }

  await db.insert(aiRuns).values({
    id: randomUUID(),
    jobId: req.params.id,
    runType: action,
    provider: env.LLM_PROVIDER,
    model: env.OPENROUTER_MODEL,
    status: "COMPLETED",
    outputSummary: `Completed ${action} with ${env.LLM_PROVIDER}/${env.OPENROUTER_MODEL}`,
    createdBy: authUser.id,
    createdAt: new Date()
  });

  return res.status(201).json({ ok: true });
});

router.get("/:id/deliverables", async (req, res) => {
  const jobId = String(req.params.id);
  const rows = await db
    .select()
    .from(jobDeliverables)
    .where(eq(jobDeliverables.jobId, jobId))
    .orderBy(desc(jobDeliverables.createdAt));

  return res.json({ items: rows });
});

router.get("/:id/source-documents", async (req, res) => {
  const authUser = req.authUser!;
  const jobId = String(req.params.id);

  const assignment = await db
    .select({ id: jobAssignments.id })
    .from(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.userId, authUser.id),
        eq(jobAssignments.active, true)
      )
    )
    .limit(1);

  if (assignment.length === 0 && authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = row[0];
  if (!job || !job.sourceRequestId) {
    return res.json({ items: [] });
  }

  const docs = await db
    .select()
    .from(intakeDocuments)
    .where(eq(intakeDocuments.sessionId, job.sourceRequestId))
    .orderBy(asc(intakeDocuments.createdAt));

  return res.json({ items: docs });
});

router.get("/:id/source-documents/:docId/view", async (req, res) => {
  const authUser = req.authUser!;
  const jobId = String(req.params.id);
  const docId = String(req.params.docId);

  const assignment = await db
    .select({ id: jobAssignments.id })
    .from(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.userId, authUser.id),
        eq(jobAssignments.active, true)
      )
    )
    .limit(1);

  if (assignment.length === 0 && authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = row[0];
  if (!job || !job.sourceRequestId) {
    return res.status(404).json({ error: "Document not found" });
  }

  const docs = await db
    .select()
    .from(intakeDocuments)
    .where(and(eq(intakeDocuments.id, docId), eq(intakeDocuments.sessionId, job.sourceRequestId)))
    .limit(1);
  const doc = docs[0];
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  const preview = await resolveSourcePreview(doc);
  res.type(preview.mimeType);
  res.setHeader("Content-Disposition", `inline; filename=\"${encodeURIComponent(preview.fileName)}\"`);
  res.setHeader("X-Preview-Converted", preview.wasConverted ? "true" : "false");
  return res.sendFile(preview.filePath);
});

router.get("/:id/source-documents/:docId/download", async (req, res) => {
  const authUser = req.authUser!;
  const jobId = String(req.params.id);
  const docId = String(req.params.docId);

  const assignment = await db
    .select({ id: jobAssignments.id })
    .from(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.userId, authUser.id),
        eq(jobAssignments.active, true)
      )
    )
    .limit(1);

  if (assignment.length === 0 && authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = row[0];
  if (!job || !job.sourceRequestId) {
    return res.status(404).json({ error: "Document not found" });
  }

  const docs = await db
    .select()
    .from(intakeDocuments)
    .where(and(eq(intakeDocuments.id, docId), eq(intakeDocuments.sessionId, job.sourceRequestId)))
    .limit(1);
  const doc = docs[0];
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  const fullPath = path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads", doc.storageKey);
  return res.download(fullPath, doc.originalName);
});

router.post("/:id/source-documents/:docId/translate-ai", async (req, res) => {
  const authUser = req.authUser!;
  const jobId = String(req.params.id);
  const docId = String(req.params.docId);

  const assignment = await db
    .select({ id: jobAssignments.id })
    .from(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.userId, authUser.id),
        eq(jobAssignments.active, true)
      )
    )
    .limit(1);

  if (assignment.length === 0 && authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = rows[0];
  if (!job || !job.sourceRequestId) {
    return res.status(404).json({ error: "Job not found" });
  }

  const docs = await db
    .select()
    .from(intakeDocuments)
    .where(and(eq(intakeDocuments.id, docId), eq(intakeDocuments.sessionId, job.sourceRequestId)))
    .limit(1);
  const doc = docs[0];
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  const runId = randomUUID();
  await db.insert(aiRuns).values({
    id: runId,
    jobId,
    runType: "document-translation",
    provider: env.LLM_PROVIDER,
    model: env.OPENROUTER_MODEL,
    status: "RUNNING",
    outputSummary: null,
    createdBy: authUser.id,
    createdAt: new Date()
  });

  try {
    const sourcePath = path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads", doc.storageKey);
    const result = await translateDocumentWithAi({
      sourcePath,
      sourceFileName: doc.originalName,
      sourceExtension: doc.extension || path.extname(doc.originalName).toLowerCase(),
      sourceLanguage: job.sourceLang,
      targetLanguage: job.targetLang
    });

    const summary = JSON.stringify({
      sourceDocumentId: doc.id,
      sourceOriginalName: doc.originalName,
      translatedStorageKey: result.storageKey,
      translatedOriginalName: result.originalName,
      translatedMimeType: result.mimeType,
      translatedSizeBytes: result.sizeBytes,
      supportedConversions: listSupportedConvertedFormats(result.storageKey),
      sourceFamily: result.sourceFamily,
      publishedDeliverableId: null
    });

    await db
      .update(aiRuns)
      .set({
        status: "COMPLETED",
        outputSummary: summary
      })
      .where(eq(aiRuns.id, runId));

    return res.status(201).json({
      runId,
      status: "COMPLETED"
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI document translation failed";

    await db
      .update(aiRuns)
      .set({
        status: "FAILED",
        outputSummary: JSON.stringify({
          sourceDocumentId: doc.id,
          error: message
        })
      })
      .where(eq(aiRuns.id, runId));

    return res.status(message.includes("settings are incomplete") ? 400 : 500).json({
      error: message
    });
  }
});

router.get("/:id/ai-translations/:runId/download", async (req, res) => {
  const authUser = req.authUser!;
  const jobId = String(req.params.id);
  const runId = String(req.params.runId);

  const assignment = await db
    .select({ id: jobAssignments.id })
    .from(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.userId, authUser.id),
        eq(jobAssignments.active, true)
      )
    )
    .limit(1);

  if (assignment.length === 0 && authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const runs = await db
    .select()
    .from(aiRuns)
    .where(and(eq(aiRuns.id, runId), eq(aiRuns.jobId, jobId), eq(aiRuns.runType, "document-translation")))
    .limit(1);
  const run = runs[0];
  if (!run || !run.outputSummary) {
    return res.status(404).json({ error: "Translation run not found" });
  }

  const summary = parseTranslationSummary(run.outputSummary);
  if (!summary?.translatedStorageKey) {
    return res.status(404).json({ error: "Translation output not found" });
  }

  const requestedFormat = String(req.query.format ?? "").trim().toLowerCase();
  if (requestedFormat) {
    try {
      const converted = await convertTranslatedDocument({
        storageKey: summary.translatedStorageKey,
        originalName: summary.translatedOriginalName ?? `translated-${runId}`,
        targetFormat: requestedFormat
      });
      return res.type(converted.mimeType).download(converted.filePath, converted.fileName);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unable to convert translated file"
      });
    }
  }

  const fullPath = path.resolve(aiTranslationsDir, summary.translatedStorageKey);
  return res.download(fullPath, summary.translatedOriginalName ?? `translated-${runId}`);
});

router.post("/:id/ai-translations/:runId/send-to-customer", async (req, res) => {
  const authUser = req.authUser!;
  const jobId = String(req.params.id);
  const runId = String(req.params.runId);

  const assignment = await db
    .select({ id: jobAssignments.id })
    .from(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.userId, authUser.id),
        eq(jobAssignments.active, true)
      )
    )
    .limit(1);

  if (assignment.length === 0 && authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const runs = await db
    .select()
    .from(aiRuns)
    .where(and(eq(aiRuns.id, runId), eq(aiRuns.jobId, jobId), eq(aiRuns.runType, "document-translation")))
    .limit(1);
  const run = runs[0];
  if (!run || !run.outputSummary) {
    return res.status(404).json({ error: "Translation run not found" });
  }

  const summary = parseTranslationSummary(run.outputSummary);
  if (!summary?.translatedStorageKey) {
    return res.status(400).json({ error: "Translation output is not available" });
  }

  if (summary.publishedDeliverableId) {
    return res.json({ ok: true, deliverableId: summary.publishedDeliverableId });
  }

  const sourcePath = path.resolve(aiTranslationsDir, summary.translatedStorageKey);
  await stat(sourcePath);

  const deliverableStorageKey = `${randomUUID()}${path.extname(summary.translatedStorageKey)}`;
  const deliverablePath = path.resolve(deliverablesDir, deliverableStorageKey);
  await copyFile(sourcePath, deliverablePath);

  const deliverableId = randomUUID();
  await db.insert(jobDeliverables).values({
    id: deliverableId,
    jobId,
    originalName: summary.translatedOriginalName ?? `translated-${runId}`,
    mimeType: summary.translatedMimeType ?? "application/octet-stream",
    storageKey: deliverableStorageKey,
    sizeBytes: Number(summary.translatedSizeBytes ?? 0),
    uploadedBy: authUser.id,
    createdAt: new Date()
  });

  await db
    .update(jobs)
    .set({ status: "DELIVERED" })
    .where(eq(jobs.id, jobId));

  await db
    .update(aiRuns)
    .set({
      outputSummary: JSON.stringify({
        ...summary,
        publishedDeliverableId: deliverableId
      })
    })
    .where(eq(aiRuns.id, runId));

  return res.json({ ok: true, deliverableId });
});

router.post("/:id/deliverables", deliverableUpload.single("file"), async (req, res) => {
  const authUser = req.authUser!;
  const jobId = String(req.params.id);
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "file is required" });
  }

  await db.insert(jobDeliverables).values({
    id: randomUUID(),
    jobId,
    originalName: file.originalname,
    mimeType: file.mimetype,
    storageKey: file.filename,
    sizeBytes: file.size,
    uploadedBy: authUser.id,
    createdAt: new Date()
  });

  await db
    .update(jobs)
    .set({ status: "DELIVERED" })
    .where(eq(jobs.id, jobId));

  return res.status(201).json({ ok: true });
});

export default router;

function parseTranslationSummary(value: string): {
  sourceDocumentId?: string;
  translatedStorageKey?: string;
  translatedOriginalName?: string;
  translatedMimeType?: string;
  translatedSizeBytes?: number;
  publishedDeliverableId?: string | null;
  supportedConversions?: string[];
} | null {
  try {
    const parsed = JSON.parse(value) as {
      sourceDocumentId?: string;
      translatedStorageKey?: string;
      translatedOriginalName?: string;
      translatedMimeType?: string;
      translatedSizeBytes?: number;
      publishedDeliverableId?: string | null;
    };
    return parsed.translatedStorageKey
      ? {
          ...parsed,
          supportedConversions: listSupportedConvertedFormats(parsed.translatedStorageKey)
        }
      : parsed;
  } catch {
    return null;
  }
}
