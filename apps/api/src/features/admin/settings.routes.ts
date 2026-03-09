import { jobScheduleAllocations, jobs, users } from "@oto/db";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getDb } from "../../db/runtime";
import {
  getIntegrationSettings,
  redactSecrets,
  updateIntegrationSettings
} from "../../services/settings/integration-settings";

const router = Router();
const db = getDb();

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional()
);

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional()
);

const integrationSettingsUpdateSchema = z.object({
  llmProvider: z.enum(["openrouter"]).optional(),
  openrouterBaseUrl: optionalUrl,
  openrouterModel: optionalNonEmptyString,
  openrouterApiKey: optionalNonEmptyString,
  voiceProvider: z.enum(["elevenlabs"]).optional(),
  elevenlabsBaseUrl: optionalUrl,
  elevenlabsApiKey: optionalNonEmptyString,
  elevenlabsAgentId: optionalNonEmptyString,
  elevenlabsWebhookSecret: optionalNonEmptyString
});

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["EMPLOYEE", "ADMIN"]).default("EMPLOYEE"),
  password: z.string().min(8).optional()
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(["EMPLOYEE", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional()
});

router.get("/settings/integrations", async (_req, res) => {
  const settings = await getIntegrationSettings();
  return res.json({ settings: redactSecrets(settings) });
});

router.put("/settings/integrations", async (req, res) => {
  const parsed = integrationSettingsUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten()
    });
  }

  const sanitizedInput = sanitizeIntegrationSecrets(parsed.data);
  const settings = await updateIntegrationSettings(sanitizedInput, req.authUser?.id);
  return res.json({ settings: redactSecrets(settings) });
});

router.get("/users", async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return res.json({ items: rows });
});

router.get("/users/:id/jobs", async (req, res) => {
  const userId = req.params.id;
  const from = String(req.query.from ?? "").trim();
  const to = String(req.query.to ?? "").trim();

  if (!from || !to) {
    return res.status(400).json({ error: "from and to are required" });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const userRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const targetUser = userRows[0];
  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const rows = await db
    .select({
      id: jobScheduleAllocations.id,
      jobId: jobs.id,
      title: jobs.title,
      sourceLang: jobs.sourceLang,
      targetLang: jobs.targetLang,
      status: jobs.status,
      priority: jobs.priority,
      scheduledStartAt: jobScheduleAllocations.startAt,
      scheduledEndAt: jobScheduleAllocations.endAt,
      estimatedMinutes: jobs.estimatedMinutes,
      verifiedPageCount: jobs.verifiedPageCount,
      createdAt: jobs.createdAt
    })
    .from(jobScheduleAllocations)
    .innerJoin(jobs, eq(jobs.id, jobScheduleAllocations.jobId))
    .where(
      and(
        eq(jobScheduleAllocations.userId, userId),
        gte(jobScheduleAllocations.startAt, fromDate),
        lte(jobScheduleAllocations.startAt, toDate)
      )
    )
    .orderBy(asc(jobScheduleAllocations.startAt), desc(jobs.createdAt));

  return res.json({
    user: targetUser,
    items: rows
  });
});

router.post("/users", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten()
    });
  }

  const payload = parsed.data;
  const email = payload.email.toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(payload.password ?? "change-me-now-1234", 10);
  await db.insert(users).values({
    id: randomUUID(),
    fullName: payload.fullName,
    email,
    role: payload.role,
    passwordHash,
    isActive: true,
    createdAt: new Date()
  });

  return res.status(201).json({ ok: true });
});

router.patch("/users/:id", async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten()
    });
  }

  const userId = req.params.id;
  const payload = parsed.data;
  const setValues: {
    fullName?: string;
    role?: "EMPLOYEE" | "ADMIN";
    isActive?: boolean;
    passwordHash?: string;
  } = {};

  if (payload.fullName !== undefined) setValues.fullName = payload.fullName;
  if (payload.role !== undefined) setValues.role = payload.role;
  if (payload.isActive !== undefined) setValues.isActive = payload.isActive;
  if (payload.password) {
    setValues.passwordHash = await bcrypt.hash(payload.password, 10);
  }

  if (Object.keys(setValues).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  await db.update(users).set(setValues).where(eq(users.id, userId));
  return res.json({ ok: true });
});

router.delete("/users/:id", async (req, res) => {
  const userId = req.params.id;

  if (req.authUser?.id === userId) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const existing = await db
    .select({
      id: users.id,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const targetUser = existing[0];

  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }

  if (targetUser.isActive) {
    return res.status(400).json({ error: "Deactivate the user before deleting" });
  }

  await db.delete(users).where(eq(users.id, userId));
  return res.json({ ok: true });
});

export default router;

function sanitizeIntegrationSecrets(
  input: z.infer<typeof integrationSettingsUpdateSchema>
) {
  const next = { ...input };

  if (next.openrouterApiKey && isMaskedSecret(next.openrouterApiKey)) {
    delete next.openrouterApiKey;
  }
  if (next.elevenlabsApiKey && isMaskedSecret(next.elevenlabsApiKey)) {
    delete next.elevenlabsApiKey;
  }
  if (next.elevenlabsWebhookSecret && isMaskedSecret(next.elevenlabsWebhookSecret)) {
    delete next.elevenlabsWebhookSecret;
  }

  return next;
}

function isMaskedSecret(value: string) {
  return value.includes("...") && value.length <= 24;
}
