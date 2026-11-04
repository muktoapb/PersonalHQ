import { CaretRight, Check } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { AppIcon, type IconName } from "./AppIcon";

export type MenuItem = { href: string; label: string; icon: IconName; hint?: string; value?: string; group?: string; color?: string };

// A native-style grouped list (rows with icon, label, hint and a chevron),
// used where phones drill into sub-pages (Settings, Finance) and in the
// section switcher sheet. `current` marks the open page with a tick.
export function MenuList({ items, current, className = "" }: { items: MenuItem[]; current?: string; className?: string }) {
  const groups: { name?: string; items: MenuItem[] }[] = [];
  for (const it of items) {
    const last = groups.at(-1);
    if (last && last.name === it.group) last.items.push(it);
    else groups.push({ name: it.group, items: [it] });
  }
  return (
    <div className={`space-y-5 ${className}`}>
      {groups.map((g, i) => (
        <section key={g.name ?? i} aria-label={g.name}>
          {g.name && <h2 className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wider text-ink-3">{g.name}</h2>}
          <ul className="divide-y divide-rule overflow-hidden rounded-3xl border border-rule bg-surface">
            {g.items.map((it) => (
              <li key={it.href}>
                <Link href={it.href} aria-current={current === it.href ? "page" : undefined} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                  <AppIcon name={it.icon} size={34} active={current === it.href} color={it.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{it.label}</span>
                    {it.hint && <span className="block truncate text-xs text-ink-3">{it.hint}</span>}
                  </span>
                  {it.value && <span className="shrink-0 text-sm tabular-nums text-ink-2">{it.value}</span>}
                  {current === undefined ? (
                    <CaretRight size={16} weight="bold" className="shrink-0 text-ink-3" />
                  ) : (
                    current === it.href && <Check size={18} weight="bold" className="shrink-0 text-accent-text" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
