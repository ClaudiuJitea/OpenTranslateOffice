import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const intakeSessions = sqliteTable(
  "intake_sessions",
  {
    id: text("id").primaryKey(),
    requestNumber: text("request_number").unique(),
    portalPasswordHash: text("portal_password_hash"),
    fullName: text("full_name").notNull(),
    companyName: text("company_name"),
    email: text("email").notNull(),
    phone: text("phone"),
    sourceLanguage: text("source_language").notNull(),
    targetLanguage: text("target_language").notNull(),
    documentType: text("document_type").notNull(),
    fileType: text("file_type").notNull(),
    certificationRequired: integer("certification_required", {
      mode: "boolean"
    })
      .notNull()
      .default(false),
    deadlineAt: integer("deadline_at", { mode: "timestamp_ms" }),
    urgency: text("urgency"),
    deliveryMethod: text("delivery_method"),
    appointmentType: text("appointment_type"),
    appointmentAt: integer("appointment_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    status: text("status").notNull().default("SUBMITTED"),
    completenessScore: integer("completeness_score").notNull().default(100),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    requestNumberIdx: index("intake_sessions_request_number_idx").on(table.requestNumber),
    emailIdx: index("intake_sessions_email_idx").on(table.email),
    statusCreatedIdx: index("intake_sessions_status_created_idx").on(
      table.status,
      table.createdAt
    )
  })
);

export const intakeMessages = sqliteTable(
  "intake_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    speaker: text("speaker").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    sessionTimeIdx: index("intake_messages_session_time_idx").on(
      table.sessionId,
      table.createdAt
    )
  })
);

export const intakeDocuments = sqliteTable(
  "intake_documents",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    extension: text("extension").notNull(),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    sessionIdx: index("intake_documents_session_idx").on(table.sessionId)
  })
);
