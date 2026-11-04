import { AppIcon, type IconName } from "./AppIcon";
import { Notched } from "./Notched";

type Props = { label: string; value: string; hint?: string; color?: string; icon?: IconName };

// With an icon, the card carries it in a notch cut into the corner.
export function StatCard(p: Props) {
  const body = (
    <>
      <p className="pr-10 text-[13px] text-ink-3">{p.label}</p>
      <p className="mt-3 text-lg font-medium leading-none tracking-tight tabular-nums sm:mt-4 sm:text-[26px]" style={p.color ? { color: p.color } : undefined}>{p.value}</p>
      {p.hint && <p className="mt-2 text-xs text-ink-3">{p.hint}</p>}
    </>
  );
  if (!p.icon) return <div className="card">{body}</div>;
  return (
    <Notched badge={<AppIcon name={p.icon} size={36} />} className="h-full border border-rule bg-surface p-4 sm:p-6">
      {body}
    </Notched>
  );
}
