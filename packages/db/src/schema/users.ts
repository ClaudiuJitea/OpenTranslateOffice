import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["CUSTOMER", "EMPLOYEE", "ADMIN"] })
      .notNull()
      .default("CUSTOMER"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => ({
    roleActiveIdx: index("users_role_active_idx").on(table.role, table.isActive)
  })
);
