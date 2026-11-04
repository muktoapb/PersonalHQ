// Runs once when the server starts: bring the SQLite schema up to date, so a
// fresh install only needs `pnpm dev` / `pnpm start` and the setup screen.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const { db } = await import("@/db/client");
  await migrate(db, { migrationsFolder: "drizzle" });
}
