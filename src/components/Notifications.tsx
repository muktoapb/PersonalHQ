"use client";

import { Bell, BellRinging, Clock, Warning } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { markNoticesSeenAction } from "@/lib/actions/notices";
import { haptic } from "@/lib/haptics";
import type { Notice } from "@/lib/core/today";

export type NoticeData = { overdue: Notice[]; dueToday: Notice[]; upcoming: Notice[]; fired: Notice[] };

// When a notice started needing attention (local time): overdue from the day
// after it was due, due-today from midnight, a reminder when it went off.
const localDay = (d: string, plus = 0) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd + plus).getTime();
};
const since = {
  overdue: (n: Notice) => localDay(n.due!, 1),
  dueToday: (n: Notice) => localDay(n.due!),
  fired: (n: Notice) => new Date(n.remindedAt ?? n.remindAt ?? 0).getTime(),
};
const noop = () => () => {};
// The phone and desktop bells are two copies; reading in one clears both.
const SEEN_EVENT = "notices-seen";

// A bell (badge = unread: anything that needed attention since the list was
// last opened, on any device) in the phone top bar and the desktop
// sidebar's bottom tab. It opens a sheet (from the bottom on phones, centred
// on wider screens) of what needs attention: overdue, due today, reminders that
// just went off, and reminders coming up.
export function Notifications({ data, locale, seenAt }: { data: NoticeData; locale: string; seenAt: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [permission, setPermission] = useState<string>("unsupported");
  const [seen, setSeen] = useState(() => (seenAt ? new Date(seenAt).getTime() : 0));
  const [seenBefore, setSeenBefore] = useState(seen); // for "New" marks while the list is open
  // Local dates need the browser's time zone: count only after hydration.
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const isNew = (n: Notice, kind: keyof typeof since, at: number) => since[kind](n) > at;
  const unread = !ready ? 0 : new Set(
    (["overdue", "dueToday", "fired"] as const).flatMap((k) => data[k].filter((n) => isNew(n, k, seen)).map((n) => n.id)),
  ).size;
  useEffect(() => {
    const onSeen = (e: Event) => setSeen((e as CustomEvent<number>).detail);
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => window.removeEventListener(SEEN_EVENT, onSeen);
  }, []);
  const open = () => {
    haptic();
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    setSeenBefore(seen);
    window.dispatchEvent(new CustomEvent(SEEN_EVENT, { detail: Date.now() })); // read now (both bells)
    markNoticesSeenAction().catch(() => {}); // …and on every device
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const day = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(locale, { day: "numeric", month: "short" });
  };
  const time = (iso: string) => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return d.toLocaleString(locale, { ...(sameDay ? {} : { weekday: "short" }), hour: "2-digit", minute: "2-digit" });
  };
  const sections: { title: string; tone: string; icon: typeof Bell; rows: Notice[]; kind?: keyof typeof since; when: (n: Notice) => string }[] = [
    { title: "Overdue", tone: "text-danger", icon: Warning, rows: data.overdue, kind: "overdue", when: (n) => `Was due ${day(n.due!)}${n.dueTime ? ` at ${n.dueTime}` : ""}` },
    { title: "Due today", tone: "text-accent-text", icon: Clock, rows: data.dueToday, kind: "dueToday", when: (n) => (n.dueTime ? `Today at ${n.dueTime}` : "Today") },
    { title: "Reminders", tone: "text-ink-2", icon: BellRinging, rows: data.fired, kind: "fired", when: (n) => (n.remindAt ? `Reminded ${time(n.remindAt)}` : "Reminder") },
    { title: "Coming up", tone: "text-ink-2", icon: Bell, rows: data.upcoming, when: (n) => (n.remindAt ? `Reminder ${time(n.remindAt)}` : "") },
  ];
  // A task shows once, in the first section it belongs to.
  const listed = new Set<string>();
  for (const s of sections) s.rows = s.rows.filter((n) => !listed.has(n.id) && listed.add(n.id));
  const empty = sections.every((s) => !s.rows.length);

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid size-9 shrink-0 place-items-center rounded-full border border-rule bg-surface text-ink-2"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        aria-label="Notifications"
        onClick={(e) => e.target === dialog.current && close()}
        className="sheet mx-0 mb-0 mt-auto max-h-[85dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] bg-app px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-md sm:rounded-[28px]"
      >
        <h2 className="mb-3 px-1 pt-2 text-lg font-semibold">Notifications</h2>
        {permission === "default" && (
          <button
            type="button"
            onClick={() => Notification.requestPermission().then(setPermission)}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-3 py-2.5 text-left text-sm"
          >
            <BellRinging size={20} className="shrink-0 text-accent-text" />
            <span className="flex-1">Get reminder alerts on this device</span>
            <span className="font-medium text-accent-text">Turn on</span>
          </button>
        )}
        {empty ? (
          <p className="py-10 text-center text-sm text-ink-3">You&apos;re all caught up.</p>
        ) : (
          <div className="space-y-5">
            {sections.map((s) =>
              s.rows.length ? (
                <section key={s.title} aria-label={s.title}>
                  <h3 className={`mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider ${s.tone}`}>
                    <s.icon size={14} weight="bold" /> {s.title} <span className="text-ink-3">· {s.rows.length}</span>
                  </h3>
                  <ul className="divide-y divide-rule overflow-hidden rounded-3xl border border-rule bg-surface">
                    {s.rows.map((n) => (
                      <li key={n.id}>
                        <Link href={`/tasks/${n.groupId}`} onClick={close} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: n.groupColor }} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[15px] font-medium">{n.title}</span>
                              {s.kind && isNew(n, s.kind, seenBefore) && (
                                <span className="shrink-0 rounded-full bg-accent-strong px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-ink-3">{n.groupName} · {s.when(n)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
