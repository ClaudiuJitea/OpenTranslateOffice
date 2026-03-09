import {
  appSettings,
  intakeChatSessions,
  intakeDocuments,
  intakeMessages,
  intakeSessions,
  jobs
} from "@oto/db";
import { and, eq, lt } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";
import { getDb } from "../../db/runtime";

const RETENTION_DAYS = 30;
const RUN_INTERVAL_MS = 12 * 60 * 60 * 1000;
const LAST_RUN_KEY = "maintenance.deletedIntakePurge.lastRunAt";

export async function markRequestCancelled(sessionId: string, now = new Date()) {
  const db = getDb();
  await db
    .update(intakeSessions)
    .set({
      status: "CANCELLED",
      deletedAt: now,
      updatedAt: now
    })
    .where(eq(intakeSessions.id, sessionId));
}

export async function purgeDeletedIntakesIfDue(now = new Date()) {
  const db = getDb();
  const lastRun = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, LAST_RUN_KEY))
    .limit(1);

  const lastRunAt = Number(lastRun[0]?.value ?? 0);
  if (Number.isFinite(lastRunAt) && lastRunAt > 0 && now.getTime() - lastRunAt < RUN_INTERVAL_MS) {
    return;
  }

  await purgeDeletedIntakes(now);

  await db
    .insert(appSettings)
    .values({
      key: LAST_RUN_KEY,
      value: String(now.getTime()),
      updatedAt: now,
      updatedBy: "system"
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: String(now.getTime()),
        updatedAt: now,
        updatedBy: "system"
      }
    });
}

async function purgeDeletedIntakes(now: Date) {
  const db = getDb();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expiredSessions = await db
    .select({
      id: intakeSessions.id
    })
    .from(intakeSessions)
    .where(and(lt(intakeSessions.deletedAt, cutoff), eq(intakeSessions.status, "CANCELLED")));

  for (const session of expiredSessions) {
    const docs = await db
      .select({
        storageKey: intakeDocuments.storageKey,
        id: intakeDocuments.id
      })
      .from(intakeDocuments)
      .where(eq(intakeDocuments.sessionId, session.id));

    await Promise.all(
      docs.flatMap((doc) => [
        unlink(path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads", doc.storageKey)).catch(() => null),
        unlink(path.resolve(env.LOCAL_STORAGE_PATH, "derived-previews", `${doc.id}.pdf`)).catch(() => null)
      ])
    );

    await db.delete(intakeDocuments).where(eq(intakeDocuments.sessionId, session.id));
    await db.delete(intakeMessages).where(eq(intakeMessages.sessionId, session.id));
    await db.delete(intakeChatSessions).where(eq(intakeChatSessions.id, session.id));
    await db.delete(jobs).where(eq(jobs.sourceRequestId, session.id));
    await db.delete(intakeSessions).where(eq(intakeSessions.id, session.id));
  }
}
