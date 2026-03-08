import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | undefined;

export function getDbClient(databaseUrl = process.env.DATABASE_URL ?? "./dev.sqlite") {
  if (!dbInstance) {
    const sqlite = new Database(databaseUrl);
    dbInstance = drizzle(sqlite, { schema });
  }

  return dbInstance;
}
