import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local SQLite file by default; a Turso URL works the same way.
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/dashboard.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
