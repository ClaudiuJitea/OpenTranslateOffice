import {
  intakeDocuments,
  intakeMessages,
  intakeSessions,
  jobs,
  users
} from "@oto/db";
import { eq } from "drizzle-orm";
import { intakeRequestSchema } from "@oto/shared";
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";
import { getDb } from "../../db/runtime";
import {
  generatePortalPassword,
  generateRequestNumber,
  hashPortalPassword
} from "../../services/portal/request-access";
import { allocateRequestJob } from "../../services/scheduling/request-allocation";
import intakeChatRoutes from "./intake-chat.routes";

const router = Router();
const db = getDb();

const uploadDir = path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads");
await mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${randomUUID()}${ext.toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: 25 * 1024 * 1024
  }
});

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".rtf",
  ".odt"
]);

router.use("/chat", intakeChatRoutes);

router.post("/requests", upload.array("files", 10), async (req, res) => {
  const parsed = intakeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten()
    });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: "At least one file is required" });
  }

  const unsupported = files
    .map((file) => ({
      name: file.originalname,
      ext: path.extname(file.originalname).toLowerCase()
    }))
    .filter((file) => !SUPPORTED_EXTENSIONS.has(file.ext));

  if (unsupported.length > 0) {
    await Promise.all(files.map((file) => unlink(file.path).catch(() => null)));
    return res.status(415).json({
      error: "Unsupported file type",
      unsupported
    });
  }

  const now = new Date();
  const payload = parsed.data;
  const sessionId = randomUUID();
  const requestNumber = generateRequestNumber();
  const portalPassword = generatePortalPassword();
  const portalPasswordHash = await hashPortalPassword(portalPassword);

  await db.insert(intakeSessions).values({
    id: sessionId,
    requestNumber,
    portalPasswordHash,
    fullName: payload.fullName,
    companyName: payload.companyName,
    email: payload.email,
    phone: payload.phone,
    sourceLanguage: payload.sourceLanguage,
    targetLanguage: payload.targetLanguage,
    documentType: payload.documentType,
    fileType: payload.fileType,
    declaredPageCount: payload.pageCountDeclared ?? null,
    certificationRequired: payload.certificationRequired,
    deadlineAt: payload.deadlineIso ? new Date(payload.deadlineIso) : null,
    urgency: payload.urgency,
    deliveryMethod: payload.deliveryMethod,
    appointmentType: payload.appointmentType,
    appointmentAt: payload.appointmentDateTimeIso
      ? new Date(payload.appointmentDateTimeIso)
      : null,
    notes: payload.notes,
    status: "SUBMITTED",
    completenessScore: 100,
    createdAt: now,
    updatedAt: now
  });

  await db.insert(intakeMessages).values({
    id: randomUUID(),
    sessionId,
    speaker: "SYSTEM",
    content: buildSummary(payload),
    createdAt: now
  });

  await db.insert(intakeDocuments).values(
    files.map((file) => ({
      id: randomUUID(),
      sessionId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      extension: path.extname(file.originalname).toLowerCase() || "unknown",
      storageKey: file.filename,
      sizeBytes: file.size,
      createdAt: now
    }))
  );

  const admin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@oto.local"))
    .limit(1);

  const adminId = admin[0]?.id ?? "unassigned";
  const jobId = randomUUID();
  await db.insert(jobs).values({
    id: jobId,
    sourceRequestId: sessionId,
    customerId: payload.email.toLowerCase(),
    title: `${payload.documentType} Translation`,
    sourceLang: payload.sourceLanguage,
    targetLang: payload.targetLanguage,
    status: "NEW",
    priority: payload.urgency ?? "MEDIUM",
    declaredPageCount: payload.pageCountDeclared ?? null,
    certificationRequired: payload.certificationRequired,
    dueAt: payload.deadlineIso ? new Date(payload.deadlineIso) : null,
    createdAt: now
  });

  if (adminId !== "unassigned") {
    await allocateRequestJob({
      sessionId,
      jobId,
      declaredPageCount: payload.pageCountDeclared,
      priority: payload.urgency,
      explicitDeadlineAt: payload.deadlineIso ? new Date(payload.deadlineIso) : null,
      assignedBy: adminId,
      now
    });
  }

  return res.status(201).json({
    intakeSessionId: sessionId,
    requestNumber,
    portalPassword,
    status: "SUBMITTED",
    files: files.map((file) => ({
      name: file.originalname,
      sizeBytes: file.size
    }))
  });
});

export default router;

function buildSummary(payload: ReturnType<typeof intakeRequestSchema.parse>) {
  return [
    `Customer: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Language pair: ${payload.sourceLanguage} -> ${payload.targetLanguage}`,
    `Document type: ${payload.documentType}`,
    payload.pageCountDeclared ? `Declared pages: ${payload.pageCountDeclared}` : null,
    `Certification required: ${payload.certificationRequired ? "Yes" : "No"}`,
    payload.deadlineIso ? `Deadline: ${payload.deadlineIso}` : "Deadline: not provided"
  ]
    .filter(Boolean)
    .join(" | ");
}
