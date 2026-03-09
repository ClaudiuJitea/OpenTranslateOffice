import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const callRequests = sqliteTable(
  "call_requests",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    projectSummary: text("project_summary").notNull(),
    declaredPageCount: integer("declared_page_count").notNull(),
    requestedCallAt: integer("requested_call_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("PENDING"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    callTimeIdx: index("call_requests_requested_call_at_idx").on(table.requestedCallAt),
    statusTimeIdx: index("call_requests_status_requested_call_at_idx").on(
      table.status,
      table.requestedCallAt
    )
  })
);
