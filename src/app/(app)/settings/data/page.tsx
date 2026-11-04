import { DownloadSimple } from "@phosphor-icons/react/ssr";
import { ImportBackup } from "@/components/SettingsForms";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Data · Settings" };

export default async function DataSettings() {
  await requireSession();
  return (
    <>
      <h1 className="text-3xl font-semibold">Data</h1>
      <section className="card space-y-3">
        <h2 className="font-semibold">Export</h2>
        <p className="text-sm text-ink-2">
          Download everything — tasks, notes, trackers, finance and your preferences — as one JSON file. Your password and tokens are not included.
        </p>
        {/* A plain link: the route handler sends the file as a download. */}
        <a href="/api/export" download className="btn btn-primary"><DownloadSimple size={16} /> Download backup</a>
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Import</h2>
        <p className="text-sm text-ink-2">
          Restore a backup file made here. It replaces all current data; if anything in the file is wrong, nothing is changed. Export first if you might want today&apos;s data back.
        </p>
        <ImportBackup />
      </section>
    </>
  );
}
