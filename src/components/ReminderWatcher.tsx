"use client";

import { Bell, X } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { claimRemindersAction } from "@/lib/actions/tasks";

type Reminder = Awaited<ReturnType<typeof claimRemindersAction>>[number];

// While the app is open (any page), checks once a minute for task reminders
// that are due. Each one shows as a system notification when allowed, and
// always as a card in the app until dismissed. Reminders while the app is
// closed need Web Push (not built yet).
export function ReminderWatcher() {
  const [shown, setShown] = useState<Reminder[]>([]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const due = await claimRemindersAction().catch(() => []);
      if (!alive || !due.length) return;
      for (const r of due) {
        try {
          if (Notification.permission === "granted") {
            const n = new Notification(r.title, { body: when(r), tag: r.id, icon: "/icon1" });
            n.onclick = () => { window.focus(); location.href = `/tasks/${r.groupId}`; };
          }
        } catch {
          // Some browsers (Android, iOS) only notify through a service worker; the in-app card still shows.
        }
      }
      setShown((s) => [...s, ...due]);
    };
    check();
    const timer = setInterval(check, 60_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  if (!shown.length) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-50 flex flex-col gap-2 md:inset-x-auto md:right-6 md:top-6 md:w-80">
      {shown.map((r) => (
        <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-rule bg-surface p-3.5 shadow-xl shadow-ink/10">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-strong text-white"><Bell size={18} weight="fill" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{r.title}</p>
            <p className="text-xs text-ink-3">{when(r)}</p>
            <Link href={`/tasks/${r.groupId}`} onClick={() => setShown((s) => s.filter((x) => x.id !== r.id))} className="mt-1 inline-block text-xs font-medium text-accent-text">Open task</Link>
          </div>
          <button onClick={() => setShown((s) => s.filter((x) => x.id !== r.id))} aria-label="Dismiss" className="rounded-full p-1 text-ink-3 hover:bg-surface-2"><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}

const when = (r: Reminder) => (r.due ? `Due ${r.due}${r.dueTime ? ` at ${r.dueTime}` : ""}` : "Reminder");
