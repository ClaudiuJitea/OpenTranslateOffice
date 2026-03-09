import { intakeDocuments, intakeSessions, jobs } from "@oto/db";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/runtime";
import { countRequestPages } from "../documents/page-count";
import { estimateMinutesFromPages, scheduleJobForEmployeeRota } from "./job-scheduler";

const db = getDb();

export async function allocateRequestJob(input: {
  sessionId: string;
  jobId: string;
  declaredPageCount?: number | null;
  priority?: string | null;
  explicitDeadlineAt?: Date | null;
  assignedBy: string;
  now?: Date;
}) {
  const docs = await db
    .select()
    .from(intakeDocuments)
    .where(eq(intakeDocuments.sessionId, input.sessionId));

  const verifiedPageCount = await countRequestPages(docs);
  const effectivePageCount = Math.max(
    1,
    verifiedPageCount || input.declaredPageCount || 1
  );
  const estimatedMinutes = estimateMinutesFromPages(effectivePageCount);
  const now = input.now ?? new Date();

  const schedule = await scheduleJobForEmployeeRota({
    jobId: input.jobId,
    priority: input.priority,
    explicitDeadlineAt: input.explicitDeadlineAt,
    estimatedMinutes,
    assignedBy: input.assignedBy,
    now
  });

  await db
    .update(intakeSessions)
    .set({
      declaredPageCount: input.declaredPageCount ?? null,
      verifiedPageCount
    })
    .where(eq(intakeSessions.id, input.sessionId));

  await db
    .update(jobs)
    .set({
      declaredPageCount: input.declaredPageCount ?? null,
      verifiedPageCount,
      estimatedMinutes,
      scheduledStartAt: schedule?.scheduledStartAt ?? null,
      scheduledEndAt: schedule?.scheduledEndAt ?? null,
      dueAt: schedule?.effectiveDeadlineAt ?? input.explicitDeadlineAt ?? null
    })
    .where(eq(jobs.id, input.jobId));

  return {
    verifiedPageCount,
    estimatedMinutes,
    assignedUserId: schedule?.assignedUserId ?? null,
    scheduledStartAt: schedule?.scheduledStartAt ?? null,
    scheduledEndAt: schedule?.scheduledEndAt ?? null
  };
}
