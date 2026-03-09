import { sql, type SQLWrapper } from "drizzle-orm";

export async function bootstrapDatabase(db: {
  run: (query: string | SQLWrapper) => unknown;
}) {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CUSTOMER',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      source_request_id TEXT,
      customer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      declared_page_count INTEGER,
      verified_page_count INTEGER,
      estimated_minutes INTEGER,
      scheduled_start_at INTEGER,
      scheduled_end_at INTEGER,
      certification_required INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);

  try {
    db.run(sql`ALTER TABLE intake_sessions ADD COLUMN request_number TEXT;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE intake_sessions ADD COLUMN portal_password_hash TEXT;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN source_request_id TEXT;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN declared_page_count INTEGER;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN verified_page_count INTEGER;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN estimated_minutes INTEGER;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN scheduled_start_at INTEGER;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN scheduled_end_at INTEGER;`);
  } catch {}

  db.run(sql`
    CREATE TABLE IF NOT EXISTS intake_sessions (
      id TEXT PRIMARY KEY,
      request_number TEXT,
      portal_password_hash TEXT,
      full_name TEXT NOT NULL,
      company_name TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      source_language TEXT NOT NULL,
      target_language TEXT NOT NULL,
      document_type TEXT NOT NULL,
      file_type TEXT NOT NULL,
      declared_page_count INTEGER,
      verified_page_count INTEGER,
      certification_required INTEGER NOT NULL DEFAULT 0,
      deadline_at INTEGER,
      urgency TEXT,
      delivery_method TEXT,
      appointment_type TEXT,
      appointment_at INTEGER,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      deleted_at INTEGER,
      completeness_score INTEGER NOT NULL DEFAULT 100,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS intake_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      speaker TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS intake_documents (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      extension TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS call_requests (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      project_summary TEXT NOT NULL,
      declared_page_count INTEGER NOT NULL,
      requested_call_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS intake_chat_sessions (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL DEFAULT 'CHAT',
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      request_number TEXT,
      portal_password_plain TEXT,
      extracted_json TEXT NOT NULL DEFAULT '{}',
      missing_json TEXT NOT NULL DEFAULT '[]',
      completeness_score INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  try {
    db.run(sql`ALTER TABLE intake_chat_sessions ADD COLUMN request_number TEXT;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE intake_chat_sessions ADD COLUMN portal_password_plain TEXT;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE intake_sessions ADD COLUMN declared_page_count INTEGER;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE intake_sessions ADD COLUMN verified_page_count INTEGER;`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE intake_sessions ADD COLUMN deleted_at INTEGER;`);
  } catch {}

  db.run(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      updated_by TEXT
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS job_assignments (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      assigned_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS job_schedule_allocations (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      start_at INTEGER NOT NULL,
      end_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS job_status_history (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      reason TEXT,
      changed_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS job_notes (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'INTERNAL',
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS ai_runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      run_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      output_summary TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS job_deliverables (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}
