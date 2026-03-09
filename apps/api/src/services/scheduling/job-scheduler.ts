import { appSettings, jobAssignments, jobScheduleAllocations, users } from "@oto/db";
import { and, asc, eq, gte, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../../db/runtime";

const db = getDb();
const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 18;
const MINUTES_PER_PAGE = 20;
const FALLBACK_LOOKAHEAD_DAYS = 7;

interface AllocationSegment {
  startAt: Date;
  endAt: Date;
}

export async function scheduleJobForEmployeeRota(input: {
  jobId: string;
  priority?: string | null;
  explicitDeadlineAt?: Date | null;
  estimatedMinutes: number;
  assignedBy: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const employees = await db
    .select({
      id: users.id,
      createdAt: users.createdAt
    })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.role, "EMPLOYEE")))
    .orderBy(asc(users.createdAt));

  if (employees.length === 0) {
    await clearExistingJobSchedule(input.jobId);
    return null;
  }

  const lastAssigned = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "scheduling.lastEmployeeId"))
    .limit(1);

  const employeeOrder = rotateEmployees(employees, lastAssigned[0]?.value ?? null);
  const preferredDeadline = computeRequestedDeadline(now, input.priority, input.explicitDeadlineAt ?? null);

  let selected:
    | {
        userId: string;
        segments: AllocationSegment[];
      }
    | null = null;

  for (const employee of employeeOrder) {
    const segments = await buildScheduleSegmentsForUser(
      employee.id,
      input.estimatedMinutes,
      now,
      preferredDeadline
    );
    if (segments) {
      selected = { userId: employee.id, segments };
      break;
    }
  }

  if (!selected) {
    for (const employee of employeeOrder) {
      const fallbackDeadline = addDays(preferredDeadline, FALLBACK_LOOKAHEAD_DAYS);
      const segments = await buildScheduleSegmentsForUser(
        employee.id,
        input.estimatedMinutes,
        now,
        fallbackDeadline
      );
      if (segments) {
        selected = { userId: employee.id, segments };
        break;
      }
    }
  }

  if (!selected) {
    return null;
  }

  await clearExistingJobSchedule(input.jobId);
  await db.insert(jobAssignments).values({
    id: randomUUID(),
    jobId: input.jobId,
    userId: selected.userId,
    assignedBy: input.assignedBy,
    active: true,
    assignedAt: now
  });
  await db.insert(jobScheduleAllocations).values(
    selected.segments.map((segment) => ({
      id: randomUUID(),
      jobId: input.jobId,
      userId: selected!.userId,
      startAt: segment.startAt,
      endAt: segment.endAt,
      createdAt: now
    }))
  );
  await db
    .insert(appSettings)
    .values({
      key: "scheduling.lastEmployeeId",
      value: selected.userId,
      updatedAt: now,
      updatedBy: input.assignedBy
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: selected.userId,
        updatedAt: now,
        updatedBy: input.assignedBy
      }
    });

  return {
    assignedUserId: selected.userId,
    scheduledStartAt: selected.segments[0]?.startAt ?? null,
    scheduledEndAt: selected.segments[selected.segments.length - 1]?.endAt ?? null,
    effectiveDeadlineAt: preferredDeadline
  };
}

export async function scheduleJobForSpecificEmployee(input: {
  jobId: string;
  userId: string;
  priority?: string | null;
  explicitDeadlineAt?: Date | null;
  estimatedMinutes: number;
  assignedBy: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const deadline = computeRequestedDeadline(now, input.priority, input.explicitDeadlineAt ?? null);
  const segments =
    (await buildScheduleSegmentsForUser(
      input.userId,
      input.estimatedMinutes,
      now,
      deadline
    )) ??
    (await buildScheduleSegmentsForUser(
      input.userId,
      input.estimatedMinutes,
      now,
      addDays(deadline, FALLBACK_LOOKAHEAD_DAYS)
    ));

  if (!segments) {
    return null;
  }

  await clearExistingJobSchedule(input.jobId);
  await db.insert(jobAssignments).values({
    id: randomUUID(),
    jobId: input.jobId,
    userId: input.userId,
    assignedBy: input.assignedBy,
    active: true,
    assignedAt: now
  });
  await db.insert(jobScheduleAllocations).values(
    segments.map((segment) => ({
      id: randomUUID(),
      jobId: input.jobId,
      userId: input.userId,
      startAt: segment.startAt,
      endAt: segment.endAt,
      createdAt: now
    }))
  );

  return {
    assignedUserId: input.userId,
    scheduledStartAt: segments[0]?.startAt ?? null,
    scheduledEndAt: segments[segments.length - 1]?.endAt ?? null,
    effectiveDeadlineAt: deadline
  };
}

export function estimateMinutesFromPages(pageCount: number) {
  return Math.max(MINUTES_PER_PAGE, pageCount * MINUTES_PER_PAGE);
}

async function clearExistingJobSchedule(jobId: string) {
  await db
    .update(jobAssignments)
    .set({ active: false })
    .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.active, true)));
  await db.delete(jobScheduleAllocations).where(eq(jobScheduleAllocations.jobId, jobId));
}

async function buildScheduleSegmentsForUser(
  userId: string,
  estimatedMinutes: number,
  startFrom: Date,
  deadline: Date
) {
  const existing = await db
    .select({
      startAt: jobScheduleAllocations.startAt,
      endAt: jobScheduleAllocations.endAt
    })
    .from(jobScheduleAllocations)
    .where(
      and(
        eq(jobScheduleAllocations.userId, userId),
        lte(jobScheduleAllocations.startAt, deadline),
        gte(jobScheduleAllocations.endAt, startFrom)
      )
    )
    .orderBy(asc(jobScheduleAllocations.startAt));

  return allocateAcrossWorkdays(
    existing.map((row) => ({
      startAt: row.startAt,
      endAt: row.endAt
    })),
    startFrom,
    deadline,
    estimatedMinutes
  );
}

function allocateAcrossWorkdays(
  existing: AllocationSegment[],
  startFrom: Date,
  deadline: Date,
  estimatedMinutes: number
) {
  let remainingMinutes = estimatedMinutes;
  const segments: AllocationSegment[] = [];
  let dayCursor = startOfDay(startFrom);

  while (dayCursor <= deadline && remainingMinutes > 0) {
    const workdayStart = maxDate(setTime(dayCursor, WORKDAY_START_HOUR, 0), startFrom);
    const workdayEnd = minDate(setTime(dayCursor, WORKDAY_END_HOUR, 0), deadline);

    if (workdayStart < workdayEnd) {
      const dayIntervals = existing
        .filter((segment) => segment.endAt > workdayStart && segment.startAt < workdayEnd)
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

      let cursor = roundUpToTwentyMinutes(workdayStart);

      for (const interval of dayIntervals) {
        const intervalStart = maxDate(interval.startAt, workdayStart);
        const intervalEnd = minDate(interval.endAt, workdayEnd);
        if (cursor < intervalStart) {
          const freeMinutes = diffMinutes(cursor, intervalStart);
          if (freeMinutes > 0) {
            const allocationMinutes = Math.min(remainingMinutes, freeMinutes);
            const endAt = addMinutes(cursor, allocationMinutes);
            segments.push({ startAt: cursor, endAt });
            remainingMinutes -= allocationMinutes;
            cursor = endAt;
            if (remainingMinutes <= 0) {
              return segments;
            }
          }
        }

        if (cursor < intervalEnd) {
          cursor = roundUpToTwentyMinutes(intervalEnd);
        }
      }

      if (cursor < workdayEnd && remainingMinutes > 0) {
        const freeMinutes = diffMinutes(cursor, workdayEnd);
        const allocationMinutes = Math.min(remainingMinutes, freeMinutes);
        if (allocationMinutes > 0) {
          const endAt = addMinutes(cursor, allocationMinutes);
          segments.push({ startAt: cursor, endAt });
          remainingMinutes -= allocationMinutes;
          if (remainingMinutes <= 0) {
            return segments;
          }
        }
      }
    }

    dayCursor = addDays(dayCursor, 1);
  }

  return remainingMinutes <= 0 ? segments : null;
}

function computeRequestedDeadline(now: Date, priority?: string | null, explicitDeadlineAt?: Date | null) {
  const normalized = String(priority ?? "").toUpperCase();
  const slaDeadline =
    normalized === "URGENT"
      ? setTime(now, WORKDAY_END_HOUR, 0)
      : normalized === "HIGH"
        ? setTime(addDays(now, 1), WORKDAY_END_HOUR, 0)
        : setTime(addDays(now, 2), WORKDAY_END_HOUR, 0);

  if (!explicitDeadlineAt) {
    return slaDeadline;
  }

  return explicitDeadlineAt < slaDeadline ? explicitDeadlineAt : slaDeadline;
}

function rotateEmployees<T extends { id: string }>(employees: T[], lastEmployeeId: string | null) {
  if (!lastEmployeeId) {
    return employees;
  }

  const lastIndex = employees.findIndex((employee) => employee.id === lastEmployeeId);
  if (lastIndex === -1) {
    return employees;
  }

  return [...employees.slice(lastIndex + 1), ...employees.slice(0, lastIndex + 1)];
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function setTime(date: Date, hour: number, minute: number) {
  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function addMinutes(date: Date, minutes: number) {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() + minutes);
  return value;
}

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function roundUpToTwentyMinutes(date: Date) {
  const value = new Date(date);
  const minutes = value.getMinutes();
  const rounded = minutes % 20 === 0 ? minutes : minutes + (20 - (minutes % 20));
  const carryHours = Math.floor(rounded / 60);
  value.setHours(value.getHours() + carryHours, rounded % 60, 0, 0);
  return value;
}

function maxDate(left: Date, right: Date) {
  return left > right ? left : right;
}

function minDate(left: Date, right: Date) {
  return left < right ? left : right;
}
