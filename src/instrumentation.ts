// Runs once when the server starts: bring the SQLite schema up to date, so a
// fresh install only needs `pnpm dev` / `pnpm start` and the setup screen.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const { db } = await import("@/db/client");
  await migrate(db, { migrationsFolder: "drizzle" });
  // Start on the owner's time zone (MCP calls don't always read settings first).
  const { settings } = await import("@/db/schema");
  const { applyTimeZone } = await import("@/lib/timezone");
  const [row] = await db.select({ timeZone: settings.timeZone }).from(settings).limit(1);
  applyTimeZone(row?.timeZone);
}
