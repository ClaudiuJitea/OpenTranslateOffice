import { callRequests } from "@oto/db";
import { callRequestSchema } from "@oto/shared";
import { asc, desc } from "drizzle-orm";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getDb } from "../../db/runtime";

const publicRouter = Router();
const staffRouter = Router();
const db = getDb();

staffRouter.get("/", async (_req, res) => {
  const items = await db
    .select()
    .from(callRequests)
    .orderBy(asc(callRequests.requestedCallAt), desc(callRequests.createdAt));

  return res.json({
    items: items.map((item) => ({
      id: item.id,
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
