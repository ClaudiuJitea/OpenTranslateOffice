import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobAssignments = sqliteTable(
  "job_assignments",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    userId: text("user_id").notNull(),
    assignedBy: text("assigned_by").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    assigneeIdx: index("job_assignments_assignee_idx").on(table.userId, table.active),
    jobIdx: index("job_assignments_job_idx").on(table.jobId, table.active)
  })
);

export const jobStatusHistory = sqliteTable(
  "job_status_history",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedBy: text("changed_by").notNull(),
    reason: text("reason"),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    jobTimeIdx: index("job_status_history_job_time_idx").on(table.jobId, table.changedAt)
  })
);

export const jobNotes = sqliteTable(
  "job_notes",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    authorId: text("author_id").notNull(),
    visibility: text("visibility").notNull().default("INTERNAL"),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    jobTimeIdx: index("job_notes_job_time_idx").on(table.jobId, table.createdAt)
  })
);

export const aiRuns = sqliteTable(
  "ai_runs",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    runType: text("run_type").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("COMPLETED"),
    outputSummary: text("output_summary"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    jobTimeIdx: index("ai_runs_job_time_idx").on(table.jobId, table.createdAt)
  })
);

export const jobDeliverables = sqliteTable(
  "job_deliverables",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    jobTimeIdx: index("job_deliverables_job_time_idx").on(table.jobId, table.createdAt)
  })
);
