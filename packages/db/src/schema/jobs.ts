import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    sourceRequestId: text("source_request_id"),
    customerId: text("customer_id").notNull(),
    title: text("title").notNull(),
    sourceLang: text("source_lang").notNull(),
    targetLang: text("target_lang").notNull(),
    status: text("status").notNull(),
    priority: text("priority").notNull().default("MEDIUM"),
    declaredPageCount: integer("declared_page_count"),
    verifiedPageCount: integer("verified_page_count"),
    estimatedMinutes: integer("estimated_minutes"),
    scheduledStartAt: integer("scheduled_start_at", { mode: "timestamp_ms" }),
    scheduledEndAt: integer("scheduled_end_at", { mode: "timestamp_ms" }),
    certificationRequired: integer("certification_required", {
      mode: "boolean"
    })
      .notNull()
      .default(false),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    sourceRequestIdx: index("jobs_source_request_idx").on(table.sourceRequestId),
    statusDueIdx: index("jobs_status_due_idx").on(table.status, table.dueAt)
  })
);
