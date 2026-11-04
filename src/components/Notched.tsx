import type { ReactNode } from "react";

// A card whose top-right corner is cut out, with `badge` (an icon or small
// button) sitting in the cut. `rounded` sets the corner radius of the card.
export function Notched(p: { badge: ReactNode; children: ReactNode; className?: string; rounded?: string; size?: "sm" | "md" }) {
  return (
    <div className={`notched ${p.size === "sm" ? "notched-sm" : ""} ${p.rounded ?? "rounded-[28px]"}`}>
      <div className={`notch-body ${p.className ?? ""}`}>{p.children}</div>
      <span className="notch-ring" aria-hidden />
      <span className="notch-badge">{p.badge}</span>
    </div>
  );
}
