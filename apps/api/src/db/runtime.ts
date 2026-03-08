import {
  bootstrapDatabase,
  getDbClient,
  jobAssignments,
  jobs,
  users
} from "@oto/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

const db = getDbClient(env.DATABASE_URL);
let initialized = false;

export function getDb() {
  return db;
}

export async function initDatabase() {
  if (initialized) {
    return;
  }

  await bootstrapDatabase(db);
  const adminId = await ensureDefaultAdmin();
  await ensureSeedJobs(adminId);
  initialized = true;
}

async function ensureDefaultAdmin() {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@oto.local"))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const passwordHash = await bcrypt.hash("change-this-admin-password", 10);
  const adminId = randomUUID();
  await db.insert(users).values({
    id: adminId,
    email: "admin@oto.local",
    fullName: "System Admin",
    passwordHash,
    role: "ADMIN",
    isActive: true,
    createdAt: new Date()
  });

  return adminId;
}

async function ensureSeedJobs(adminId: string) {
  const existingJobs = await db.select({ id: jobs.id }).from(jobs).limit(1);
  if (existingJobs.length > 0) {
    return;
  }

  const now = Date.now();
  const seedJobs = [
    {
      id: randomUUID(),
      customerId: "cust_demo_1",
      title: "Merger Agreement Translation",
      sourceLang: "German",
      targetLang: "English",
      status: "IN_PROGRESS",
      priority: "HIGH",
      certificationRequired: true,
      dueAt: new Date(now + 1000 * 60 * 60 * 36),
      createdAt: new Date(now)
    },
    {
      id: randomUUID(),
      customerId: "cust_demo_2",
      title: "Birth Certificate Certified Translation",
      sourceLang: "Spanish",
      targetLang: "English",
      status: "NEW",
      priority: "URGENT",
      certificationRequired: true,
      dueAt: new Date(now + 1000 * 60 * 60 * 18),
      createdAt: new Date(now)
    },
    {
      id: randomUUID(),
      customerId: "cust_demo_3",
      title: "Product Manual Localization",
      sourceLang: "English",
      targetLang: "French",
      status: "REVIEW",
      priority: "MEDIUM",
      certificationRequired: false,
      dueAt: new Date(now + 1000 * 60 * 60 * 72),
      createdAt: new Date(now)
    }
  ];

  await db.insert(jobs).values(seedJobs);
  await db.insert(jobAssignments).values(
    seedJobs.map((job) => ({
      id: randomUUID(),
      jobId: job.id,
      userId: adminId,
      assignedBy: adminId,
      active: true,
      assignedAt: new Date(now)
    }))
  );
}
