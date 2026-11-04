import { BRAND } from "@/lib/brand";

// The app icon for next/og's ImageResponse, in the light Liquid Glass look:
// a frosted full-bleed square (the OS rounds or masks it) with a soft top
// highlight, and the mark scaled into the maskable safe zone. `size` is the
// square's edge in px.
export function IconArt({ size }: { size: number }) {
  const { tile, square: sq } = BRAND;
  const mark = Math.round(size * 0.86);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 45%), linear-gradient(135deg, ${BRAND.tileFrom}, ${BRAND.tileTo})`,
      }}
    >
      <svg width={mark} height={mark} viewBox={`${tile.x} ${tile.y} ${tile.size} ${tile.size}`}>
        <defs>
          <linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={BRAND.markFrom} />
            <stop offset="1" stopColor={BRAND.markTo} />
          </linearGradient>
        </defs>
        <path d={BRAND.bowl} fill={BRAND.bowlColor} />
        <rect x={sq.x} y={sq.y} width={sq.size} height={sq.size} rx={sq.r} fill="url(#m)" />
      </svg>
    </div>
  );
}
