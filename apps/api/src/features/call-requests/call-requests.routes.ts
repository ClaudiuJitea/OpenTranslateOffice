import { callRequests, intakeMessages } from "@oto/db";
import { callRequestSchema } from "@oto/shared";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "../../db/runtime";

const publicRouter = Router();
const staffRouter = Router();
const db = getDb();
const callRequestStatusSchema = z.object({
  status: z.enum(["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"])
});

staffRouter.get("/", async (_req, res) => {
  await backfillLegacyElevenLabsSources();

  const items = await db
    .select()
    .from(callRequests)
    .orderBy(desc(callRequests.createdAt), desc(callRequests.requestedCallAt));

  return res.json({
    items: items.map((item) => ({
      id: item.id,
      source: item.source,
      fullName: item.fullName,
      phone: item.phone,
      projectSummary: item.projectSummary,
      declaredPageCount: item.declaredPageCount,
      requestedCallAt: item.requestedCallAt?.toISOString() ?? null,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }))
  });
});

staffRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    return res.status(400).json({ error: "Call request id is required" });
  }

  const deleted = await db
    .delete(callRequests)
    .where(eq(callRequests.id, id))
    .returning({ id: callRequests.id });

  if (!deleted[0]) {
    return res.status(404).json({ error: "Call request not found" });
  }

  return res.status(204).send();
});

staffRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    return res.status(400).json({ error: "Call request id is required" });
  }

  const parsed = callRequestStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten()
    });
  }

  const now = new Date();
  const result = await db
    .update(callRequests)
    .set({
      status: parsed.data.status,
      updatedAt: now
    })
    .where(eq(callRequests.id, id))
    .returning();

  const item = result[0];
  if (!item) {
    return res.status(404).json({ error: "Call request not found" });
  }

  return res.json({
    item: {
      id: item.id,
      source: item.source,
      fullName: item.fullName,
      phone: item.phone,
      projectSummary: item.projectSummary,
      declaredPageCount: item.declaredPageCount,
      requestedCallAt: item.requestedCallAt?.toISOString() ?? null,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }
  });
});

publicRouter.post("/", async (req, res) => {
  const parsed = callRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten()
    });
  }

  const now = new Date();
  const item = parsed.data;
  const id = randomUUID();

  await db.insert(callRequests).values({
    id,
    source: "WEB",
    fullName: item.fullName,
    phone: item.phone,
    projectSummary: item.projectSummary,
    declaredPageCount: item.declaredPageCount,
    requestedCallAt: new Date(item.requestedCallAtIso),
    status: "PENDING",
    createdAt: now,
    updatedAt: now
  });

  return res.status(201).json({
    item: {
      id,
      source: "WEB",
      fullName: item.fullName,
      phone: item.phone,
      projectSummary: item.projectSummary,
      declaredPageCount: item.declaredPageCount,
      requestedCallAt: item.requestedCallAtIso,
      status: "PENDING",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  });
});

export { publicRouter as publicCallRequestsRouter, staffRouter as staffCallRequestsRouter };

async function backfillLegacyElevenLabsSources() {
  const transcriptSessions = await db
    .selectDistinct({ sessionId: intakeMessages.sessionId })
    .from(intakeMessages)
    .where(sql`${intakeMessages.sessionId} in (select ${callRequests.id} from ${callRequests} where ${callRequests.source} = 'WEB')`);

  const sessionIds = transcriptSessions
    .map((row) => row.sessionId)
    .filter((value): value is string => Boolean(value));

  if (sessionIds.length === 0) {
    return;
  }

  await db
    .update(callRequests)
    .set({
      source: "ELEVENLABS",
      updatedAt: new Date()
    })
    .where(inArray(callRequests.id, sessionIds));
}
