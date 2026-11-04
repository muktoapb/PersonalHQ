// Client- and server-safe number formatting.

// A number with up to 2 decimals and an optional unit; "—" for nothing.
export const fmtNum = (v: number | null | undefined, locale: string, unit = "") =>
  v == null ? "—" : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(v)}${unit ? ` ${unit}` : ""}`;

// Mood ratings 1–5 as faces (the rating picker and the mood tracker's numbers).
export const MOODS = ["😞", "🙁", "😐", "🙂", "😄"];
export const moodFace = (v: number | null) => (v == null ? "—" : MOODS[Math.min(4, Math.max(0, Math.round(v) - 1))]);
