import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const intakeChatSessions = sqliteTable(
  "intake_chat_sessions",
  {
    id: text("id").primaryKey(),
    channel: text("channel").notNull().default("CHAT"),
    status: text("status").notNull().default("IN_PROGRESS"),
    requestNumber: text("request_number"),
    portalPasswordPlain: text("portal_password_plain"),
    extractedJson: text("extracted_json").notNull().default("{}"),
    missingJson: text("missing_json").notNull().default("[]"),
    completenessScore: integer("completeness_score").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    statusUpdatedIdx: index("intake_chat_sessions_status_updated_idx").on(
      table.status,
      table.updatedAt
    )
  })
);
