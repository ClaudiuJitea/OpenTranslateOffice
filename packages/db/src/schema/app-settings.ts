import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appSettings = sqliteTable(
  "app_settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    updatedBy: text("updated_by")
  },
  (table) => ({
    updatedAtIdx: index("app_settings_updated_at_idx").on(table.updatedAt)
  })
);
