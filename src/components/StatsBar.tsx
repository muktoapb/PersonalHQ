import { Balance } from "./Balance";

// A page's key numbers, in a tab cut into the bottom edge of the board (lg+).
// Render it anywhere in a page; it pins to the board (see app/(app)/layout.tsx).
export function StatsBar({ items, note }: { items: { label: string; value: string; private?: boolean }[]; note?: string }) {
  return (
    <div className="cut-b left-1/2 hidden -translate-x-1/2 px-3 pt-3 lg:block">
      <dl className="flex items-center gap-8 whitespace-nowrap rounded-t-[20px] border border-b-0 border-rule bg-board px-7 py-4 text-sm lg:gap-12">
        {items.map((it) => (
          <div key={it.label} className="flex items-baseline gap-2">
            <dt className="text-ink-3">{it.label}</dt>
            <dd className="text-base font-medium tabular-nums">{it.private ? <Balance>{it.value}</Balance> : it.value}</dd>
          </div>
        ))}
        {note && <p className="text-xs text-ink-3">{note}</p>}
      </dl>
    </div>
  );
}
