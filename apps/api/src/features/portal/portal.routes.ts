import {
  intakeSessions,
  jobDeliverables,
  jobs
} from "@oto/db";
import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import jwt from "jsonwebtoken";
import path from "node:path";
import { env } from "../../config/env";
import { getDb } from "../../db/runtime";
import { purgeDeletedIntakesIfDue } from "../../services/maintenance/intake-retention";
import { verifyPortalPassword } from "../../services/portal/request-access";

const router = Router();
const db = getDb();

router.post("/login", async (req, res) => {
  await purgeDeletedIntakesIfDue();
  const requestNumber = String(req.body?.requestNumber ?? "").trim().toUpperCase();
  const password = String(req.body?.password ?? "").trim();

  if (!requestNumber || !password) {
    return res.status(400).json({ error: "requestNumber and password are required" });
  }

  const row = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.requestNumber, requestNumber))
    .limit(1);

  const request = row[0];
  if (!request || !request.portalPasswordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await verifyPortalPassword(password, request.portalPasswordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ requestId: request.id }, env.JWT_SECRET, { expiresIn: "12h" });
  return res.json({ token });
});

router.get("/request", async (req, res) => {
  await purgeDeletedIntakesIfDue();
  const payload = verifyPortalToken(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const requestRows = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.id, payload.requestId))
    .limit(1);
  const request = requestRows[0];
  if (!request) {
    return res.status(404).json({ error: "Request not found" });
  }

  const jobRows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.sourceRequestId, request.id))
    .limit(1);
  const job = jobRows[0] ?? null;

  const deliverables = job
    ? await db
        .select()
        .from(jobDeliverables)
        .where(eq(jobDeliverables.jobId, job.id))
        .orderBy(desc(jobDeliverables.createdAt))
    : [];

  return res.json({
    request: {
      requestNumber: request.requestNumber,
      fullName: request.fullName,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      status: job?.status ?? request.status,
      dueAt: job?.dueAt ?? request.deadlineAt,
      createdAt: request.createdAt
    },
    deliverables: deliverables.map((item) => ({
      id: item.id,
      originalName: item.originalName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt
    }))
  });
});

router.get("/request/files/:fileId/download", async (req, res) => {
  await purgeDeletedIntakesIfDue();
  const payload = verifyPortalToken(req.headers.authorization, String(req.query.token ?? ""));
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const requestRows = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.id, payload.requestId))
    .limit(1);
  const request = requestRows[0];
  if (!request) {
    return res.status(404).json({ error: "Request not found" });
  }

  const jobRows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.sourceRequestId, request.id))
    .limit(1);
  const job = jobRows[0];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const fileRows = await db
    .select()
    .from(jobDeliverables)
    .where(and(eq(jobDeliverables.id, req.params.fileId), eq(jobDeliverables.jobId, job.id)))
    .limit(1);
  const file = fileRows[0];

  if (!file) {
    return res.status(404).json({ error: "File not found" });
  }

  const fullPath = path.resolve(env.LOCAL_STORAGE_PATH, "deliverables", file.storageKey);
  return res.download(fullPath, file.originalName);
});

export default router;

function verifyPortalToken(header: string | undefined, queryToken?: string) {
  const raw = String(header ?? "");
  const token = raw.startsWith("Bearer ") ? raw.slice("Bearer ".length) : queryToken;
  if (!token) return null;
  try {
    return jwt.verify(token, env.JWT_SECRET) as { requestId: string };
  } catch {
    return null;
  }
}
