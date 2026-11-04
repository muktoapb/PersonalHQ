import { hasValidSession } from "@/lib/auth";
import { exportAll } from "@/lib/core/backup";
import { today } from "@/lib/dates";

// Downloads a full JSON backup (Settings → Data). Signed-in browsers only.
export async function GET() {
  if (!(await hasValidSession())) return new Response("Sign in first.", { status: 401 });
  return new Response(JSON.stringify(await exportAll(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="personalhq-backup-${today()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
