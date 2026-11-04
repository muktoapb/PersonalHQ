"use client";

import { useId } from "react";

// The PersonalHQ logo (sidebar, top bar, sign-in screens): a block over a
// rounded square on a rounded tile, coloured by the theme (--logo-* in
// globals.css).
//
// Drawn at its real pixel size with straight edges snapped to whole pixels:
// scaling the 1024-unit artwork down to ~40px put every edge between pixels
// and looked jagged. The blocks are a bit larger at small sizes and always
// keep at least a 2px gap. Each copy gets its own gradient ids (browsers
// won't paint a gradient defined in another, hidden copy).
export function Logo({ size = 36 }: { size?: number }) {
  const id = `phq-${useId().replace(/:/g, "")}`;
  const s = size;
  // artwork units (tile 64–960, centre 512) -> pixels, enlarged when small
  const k = (s / 896) * (s <= 48 ? 1.12 : 1);
  const X = (u: number) => Math.round(s / 2 + (u - 512) * k);

  // Vertical: keep the mark centred once the 2px gap is enforced.
  const top0 = X(258), gap = Math.max(X(558) - X(542), 2);
  const markH = X(542) - top0 + gap + Math.round(232 * k);
  const dy = Math.round((s - markH) / 2) - top0;

  // upper block: rounded on the left, a half-round on the right
  const bx0 = X(378), bx1 = X(762), by0 = X(258) + dy, by1 = X(542) + dy;
  const bh = by1 - by0, half = bh / 2, rl = Math.max(1.5, 60 * k);
  const bowl = `M${bx0 + rl} ${by0}H${bx1 - half}A${half} ${half} 0 0 1 ${bx1 - half} ${by1}H${bx0 + rl}A${rl} ${rl} 0 0 1 ${bx0} ${by1 - rl}V${by0 + rl}A${rl} ${rl} 0 0 1 ${bx0 + rl} ${by0}Z`;

  // lower square, at least 2px below the block
  const side = Math.round(232 * k);
  const sx = X(280);
  const sy = by1 + gap;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--logo-tile-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--logo-tile-b)" }} />
        </linearGradient>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--logo-mark-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--logo-mark-b)" }} />
        </linearGradient>
      </defs>
      {/* tile, with a 1px edge drawn on the pixel grid */}
      <rect x={0.5} y={0.5} width={s - 1} height={s - 1} rx={s * 0.232} fill={`url(#${id}-t)`} style={{ stroke: "var(--logo-edge)" }} strokeWidth={1} />
      <path d={bowl} style={{ fill: "var(--logo-bowl)" }} />
      <rect x={sx} y={sy} width={side} height={side} rx={Math.max(1.5, 54 * k)} fill={`url(#${id}-m)`} />
    </svg>
  );
}
