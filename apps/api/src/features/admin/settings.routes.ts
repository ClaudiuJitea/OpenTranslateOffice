import { users } from "@oto/db";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
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

const integrationSettingsUpdateSchema = z.object({
  llmProvider: z.enum(["openrouter"]).optional(),
  openrouterBaseUrl: z.string().url().optional(),
  openrouterModel: z.string().min(1).optional(),
  openrouterApiKey: z.string().min(1).optional(),
  voiceProvider: z.enum(["elevenlabs"]).optional(),
  elevenlabsBaseUrl: z.string().url().optional(),
  elevenlabsApiKey: z.string().min(1).optional(),
  elevenlabsAgentId: z.string().min(1).optional(),
  elevenlabsWebhookSecret: z.string().min(1).optional()
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
