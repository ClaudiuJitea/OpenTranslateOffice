import {
  intakeChatSessions,
  intakeDocuments,
  intakeMessages,
  intakeSessions,
  jobs,
  users
} from "@oto/db";
import {
  createIntakeChatSessionSchema,
  postIntakeChatMessageSchema,
  type IntakeChatSessionDTO,
  type IntakeChatExtracted,
  type IntakeFieldKey
} from "@oto/shared";
import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";
import { getDb } from "../../db/runtime";
import { OpenRouterClient } from "../../services/ai/openrouter-client";
import { RuleBasedIntakeAssistant } from "../../services/ai/intake-assistant";
import {
  generatePortalPassword,
  generateRequestNumber,
  hashPortalPassword
} from "../../services/portal/request-access";
import { allocateRequestJob } from "../../services/scheduling/request-allocation";

const router = Router();
const db = getDb();
const assistant = new RuleBasedIntakeAssistant();
const openrouter = new OpenRouterClient();
const uploadDir = path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads");
await mkdir(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext.toLowerCase()}`);
    }
  }),
  limits: { files: 10, fileSize: 25 * 1024 * 1024 }
});

router.post("/sessions", async (req, res) => {
  const parsed = createIntakeChatSessionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten()
    });
  }

  const sessionId = randomUUID();
  const now = new Date();
  const extracted: IntakeChatExtracted = {};
  const missing = assistant.missingFields(extracted, 0);
  const greeting =
    parsed.data.initialMessage ??
    (parsed.data.locale === "pl"
      ? "Witamy w Open Translate Office. Pomoge Ci krok po kroku zebrac informacje do zlecenia tlumaczenia. Zaczniemy od kilku podstawowych danych, a jesli cos bedzie niejasne, pytaj smialo."
      : "Welcome to Open Translate Office. I will help gather the details for your translation request step by step. We will start with a few basics, and if anything is unclear you can ask me at any time.");

  await db.insert(intakeChatSessions).values({
    id: sessionId,
    channel: "CHAT",
    status: "IN_PROGRESS",
    extractedJson: JSON.stringify(extracted),
    missingJson: JSON.stringify(missing),
    completenessScore: assistant.completeness(extracted, 0),
    createdAt: now,
    updatedAt: now
  });

  await db.insert(intakeMessages).values({
    id: randomUUID(),
    sessionId,
    speaker: "ASSISTANT",
    content: greeting,
    createdAt: now
  });

  const session = await readSession(sessionId);
  return res.status(201).json(session);
});

router.get("/sessions/:id", async (req, res) => {
  const session = await readSession(String(req.params.id));
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  return res.json(session);
});

router.post("/sessions/:id/messages", async (req, res) => {
  const parsed = postIntakeChatMessageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten()
    });
  }

  const sessionId = String(req.params.id);
  const row = await db
    .select()
    .from(intakeChatSessions)
    .where(eq(intakeChatSessions.id, sessionId))
    .limit(1);

  const session = row[0];
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const now = new Date();
  const locale = parsed.data.locale ?? "en";
  const currentExtracted = parseExtracted(session.extractedJson);
  const uploadedFilesCount = await getUploadedFilesCount(session.id);

  await db.insert(intakeMessages).values({
    id: randomUUID(),
    sessionId: session.id,
    speaker: "USER",
    content: parsed.data.content,
    createdAt: now
  });

  const currentMissing = assistant.missingFields(currentExtracted, uploadedFilesCount);
  const llm = await openrouter.extractAndReply({
    userMessage: parsed.data.content,
    current: currentExtracted,
    missing: currentMissing,
    uploadedFilesCount,
    locale
  });

  const mergedExtracted = {
    ...currentExtracted,
    ...(llm?.extracted ?? {}),
    ...assistant.extract(parsed.data.content, currentExtracted)
  };
  const missing = assistant.missingFields(mergedExtracted, uploadedFilesCount);
  const completeness = assistant.completeness(mergedExtracted, uploadedFilesCount);
  let nextMessage = selectAssistantReply(
    llm?.assistantReply,
    missing,
    mergedExtracted,
    locale
  );
  const providerUsed = llm ? "openrouter" : "fallback";

  if (missing.length === 0) {
    const creds = await upsertJobReadyIntake(session.id, mergedExtracted, now);
    if (creds) {
      nextMessage = buildCompletionMessage(creds.requestNumber, creds.portalPassword, locale);
    }
  }

  await db.insert(intakeMessages).values({
    id: randomUUID(),
    sessionId: session.id,
    speaker: "ASSISTANT",
    content: nextMessage,
    createdAt: now
  });

  await db
    .update(intakeChatSessions)
    .set({
      extractedJson: JSON.stringify(mergedExtracted),
      missingJson: JSON.stringify(missing),
      completenessScore: completeness,
      status: missing.length === 0 ? "READY_FOR_REVIEW" : "IN_PROGRESS",
      updatedAt: now
    })
    .where(and(eq(intakeChatSessions.id, session.id)));

  const updated = await readSession(session.id, providerUsed);
  return res.json(updated ? { ...updated, providerUsed } : updated);
});

router.post("/sessions/:id/files", upload.array("files", 10), async (req, res) => {
  const sessionId = String(req.params.id);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: "At least one file is required" });
  }

  const now = new Date();
  const locale = String(req.body?.locale ?? "en") === "pl" ? "pl" : "en";
  const row = await db
    .select()
    .from(intakeChatSessions)
    .where(eq(intakeChatSessions.id, sessionId))
    .limit(1);
  const chat = row[0];
  if (!chat) {
    return res.status(404).json({ error: "Session not found" });
  }

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

  const extracted = parseExtracted(chat.extractedJson);
  const uploadedFilesCount = await getUploadedFilesCount(sessionId);
  const missing = assistant.missingFields(extracted, uploadedFilesCount);
  const completeness = assistant.completeness(extracted, uploadedFilesCount);

  await db
    .update(intakeChatSessions)
    .set({
      missingJson: JSON.stringify(missing),
      completenessScore: completeness,
      status: missing.length === 0 ? "READY_FOR_REVIEW" : "IN_PROGRESS",
      updatedAt: now
    })
    .where(eq(intakeChatSessions.id, sessionId));

  if (missing.length === 0) {
    const creds = await upsertJobReadyIntake(sessionId, extracted, now);
    if (creds) {
      await db.insert(intakeMessages).values({
        id: randomUUID(),
        sessionId,
        speaker: "ASSISTANT",
        content: buildCompletionMessage(creds.requestNumber, creds.portalPassword, locale),
        createdAt: now
      });
    }
  } else {
    await db.insert(intakeMessages).values({
      id: randomUUID(),
      sessionId,
      speaker: "ASSISTANT",
      content: assistant.nextPrompt(missing, extracted, locale),
      createdAt: now
    });
  }

  const updated = await readSession(sessionId, "system");
  return res.status(201).json(updated);
});

export default router;

async function readSession(
  sessionId: string,
  providerUsed: "openrouter" | "fallback" | "system" = "system"
): Promise<IntakeChatSessionDTO | null> {
  const sessionRows = await db
    .select()
    .from(intakeChatSessions)
    .where(eq(intakeChatSessions.id, sessionId))
    .limit(1);

  const row = sessionRows[0];
  if (!row) {
    return null;
  }

  const messages = await db
    .select()
    .from(intakeMessages)
    .where(eq(intakeMessages.sessionId, sessionId))
    .orderBy(asc(intakeMessages.createdAt));

  const uploadedFilesCount = await getUploadedFilesCount(sessionId);

  return {
    id: row.id,
    status: row.status as "IN_PROGRESS" | "READY_FOR_REVIEW",
    providerUsed,
    completenessScore: row.completenessScore,
    uploadedFilesCount,
    missing: parseMissing(row.missingJson),
    extracted: parseExtracted(row.extractedJson),
    portalCredentials:
      row.requestNumber && row.portalPasswordPlain
        ? {
            requestNumber: row.requestNumber,
            portalPassword: row.portalPasswordPlain
          }
        : undefined,
    messages: messages.map((message) => ({
      id: message.id,
      speaker: message.speaker as "USER" | "ASSISTANT" | "SYSTEM",
      content: message.content,
      createdAt: message.createdAt.toISOString()
    }))
  };
}

function parseExtracted(value: string): IntakeChatExtracted {
  try {
    const parsed = JSON.parse(value) as IntakeChatExtracted;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function parseMissing(value: string): IntakeFieldKey[] {
  try {
    const parsed = JSON.parse(value) as IntakeFieldKey[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function upsertJobReadyIntake(
  sessionId: string,
  extracted: IntakeChatExtracted,
  now: Date
): Promise<{ requestNumber: string; portalPassword: string } | null> {
  if (
    !extracted.fullName ||
    !extracted.email ||
    !extracted.sourceLanguage ||
    !extracted.targetLanguage ||
    !extracted.documentType ||
    !extracted.fileType ||
    !extracted.pageCountDeclared ||
    extracted.certificationRequired === undefined
  ) {
    return null;
  }

  const existing = await db
    .select({
      requestNumber: intakeSessions.requestNumber,
      portalPasswordHash: intakeSessions.portalPasswordHash
    })
    .from(intakeSessions)
    .where(eq(intakeSessions.id, sessionId))
    .limit(1);

  const chatExisting = await db
    .select({
      portalPasswordPlain: intakeChatSessions.portalPasswordPlain
    })
    .from(intakeChatSessions)
    .where(eq(intakeChatSessions.id, sessionId))
    .limit(1);

  const requestNumber = existing[0]?.requestNumber ?? generateRequestNumber();
  const portalPassword = chatExisting[0]?.portalPasswordPlain ?? generatePortalPassword();
  const portalPasswordHash = await hashPortalPassword(portalPassword);

  await db
    .insert(intakeSessions)
    .values({
      id: sessionId,
      requestNumber,
      portalPasswordHash,
      fullName: extracted.fullName,
      companyName: extracted.companyName,
      email: extracted.email,
      phone: extracted.phone,
      sourceLanguage: extracted.sourceLanguage,
      targetLanguage: extracted.targetLanguage,
      documentType: extracted.documentType,
      fileType: extracted.fileType,
      declaredPageCount: extracted.pageCountDeclared ?? null,
      certificationRequired: extracted.certificationRequired,
      deadlineAt: extracted.deadlineIso ? new Date(extracted.deadlineIso) : null,
      urgency: extracted.urgency,
      deliveryMethod: extracted.deliveryMethod,
      appointmentType: extracted.appointmentType,
      appointmentAt: extracted.appointmentDateTimeIso
        ? new Date(extracted.appointmentDateTimeIso)
        : null,
      notes: extracted.notes,
      status: "CHAT_READY",
      completenessScore: 100,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: intakeSessions.id,
      set: {
        fullName: extracted.fullName,
        companyName: extracted.companyName,
        email: extracted.email,
        phone: extracted.phone,
        sourceLanguage: extracted.sourceLanguage,
        targetLanguage: extracted.targetLanguage,
        documentType: extracted.documentType,
        fileType: extracted.fileType,
        declaredPageCount: extracted.pageCountDeclared ?? null,
        certificationRequired: extracted.certificationRequired,
        deadlineAt: extracted.deadlineIso ? new Date(extracted.deadlineIso) : null,
        urgency: extracted.urgency,
        deliveryMethod: extracted.deliveryMethod,
        appointmentType: extracted.appointmentType,
        appointmentAt: extracted.appointmentDateTimeIso
          ? new Date(extracted.appointmentDateTimeIso)
          : null,
        notes: extracted.notes,
        status: "CHAT_READY",
        completenessScore: 100,
        updatedAt: now
      }
    });

  await db
    .update(intakeChatSessions)
    .set({
      requestNumber,
      portalPasswordPlain: portalPassword
    })
    .where(eq(intakeChatSessions.id, sessionId));

  const jobExisting = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.sourceRequestId, sessionId))
    .limit(1);

  let jobId = jobExisting[0]?.id;
  if (!jobId) {
    jobId = randomUUID();
    await db.insert(jobs).values({
      id: jobId,
      sourceRequestId: sessionId,
      customerId: extracted.email.toLowerCase(),
      title: `${extracted.documentType} Translation`,
      sourceLang: extracted.sourceLanguage,
      targetLang: extracted.targetLanguage,
      status: "NEW",
      priority: extracted.urgency ?? "MEDIUM",
      declaredPageCount: extracted.pageCountDeclared ?? null,
      certificationRequired: extracted.certificationRequired,
      dueAt: extracted.deadlineIso ? new Date(extracted.deadlineIso) : null,
      createdAt: now
    });
  }

  const admin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@oto.local"))
    .limit(1);

  const adminId = admin[0]?.id;
  if (adminId && jobId) {
    await allocateRequestJob({
      sessionId,
      jobId,
      declaredPageCount: extracted.pageCountDeclared,
      priority: extracted.urgency,
      explicitDeadlineAt: extracted.deadlineIso ? new Date(extracted.deadlineIso) : null,
      assignedBy: adminId,
      now
    });
  }

  return { requestNumber, portalPassword };
}

async function getUploadedFilesCount(sessionId: string) {
  const rows = await db
    .select({ id: intakeDocuments.id })
    .from(intakeDocuments)
    .where(eq(intakeDocuments.sessionId, sessionId));
  return rows.length;
}

function buildCompletionMessage(
  requestNumber: string,
  portalPassword: string,
  locale: "en" | "pl" = "en"
) {
  if (locale === "pl") {
    return [
      "Twoje zgloszenie zostalo zarejestrowane i jest gotowe do realizacji.",
      `Numer zgloszenia: ${requestNumber}.`,
      `Haslo portalu: ${portalPassword}.`,
      "Uzyj tych danych na /portal/login, aby sledzic status i pobrac tlumaczenie po dostarczeniu.",
      "Zapisz te dane teraz."
    ].join(" ");
  }

  return [
    "Your request is now registered and job-ready.",
    `Request number: ${requestNumber}.`,
    `Portal password: ${portalPassword}.`,
    "Use these credentials at /portal/login to track status and download the translated file once delivered.",
    "Please save these credentials now."
  ].join(" ");
}

function selectAssistantReply(
  llmReply: string | undefined,
  missing: IntakeFieldKey[],
  extracted: IntakeChatExtracted,
  locale: "en" | "pl"
) {
  if (isUsableAssistantReply(llmReply)) {
    return llmReply!.trim();
  }

  return assistant.nextPrompt(missing, extracted, locale);
}

function isUsableAssistantReply(value: string | undefined) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > 500) {
    return false;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }

  if (/^assistant\s*:/i.test(trimmed)) {
    return false;
  }

  // Reject checklist-style prompts that dump most of the intake in one message.
  if (asksForTooMuchAtOnce(trimmed)) {
    return false;
  }

  return true;
}

function asksForTooMuchAtOnce(value: string) {
  const lower = value.toLowerCase();
  const signals = [
    "full name",
    "email",
    "source language",
    "target language",
    "document type",
    "file format",
    "page count",
    "certification",
    "urgency",
    "imie i nazwisko",
    "adres email",
    "jezyk zrodlowy",
    "jezyk docelowy",
    "typ dokumentu",
    "format pliku",
    "liczbe stron",
    "tlumaczenia certyfikowanego",
    "termin realizacji"
  ];

  const matches = signals.filter((signal) => lower.includes(signal)).length;
  return matches >= 4;
}
