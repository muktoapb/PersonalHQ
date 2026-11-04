// Colour themes for <html data-palette> (styles in globals.css). "lavender"
// is the default and sets no attribute. Swatches are for the picker.
export const PALETTES = [
  { key: "lavender", label: "Lavender", swatch: ["#e7e5fd", "#7262ea", "#3f2e9c"] },
  { key: "ocean", label: "Ocean", swatch: ["#dfeafb", "#3b7ae0", "#1f4a9c"] },
  { key: "teal", label: "Teal", swatch: ["#dcf1f3", "#1f9aa8", "#0f5c66"] },
  { key: "forest", label: "Forest", swatch: ["#e0f0e3", "#3a9a5b", "#1f5e36"] },
  { key: "sunset", label: "Sunset", swatch: ["#fbe6da", "#e0663a", "#9a3a19"] },
  { key: "rose", label: "Rose", swatch: ["#fbe2e8", "#d9487a", "#951f4b"] },
  { key: "graphite", label: "Graphite", swatch: ["#ececf0", "#7a7a86", "#34343c"] },
  { key: "glass", label: "Liquid Glass", swatch: ["#a9c7ff", "#f6b8e4", "#9ee6d6"] },
] as const;
export type PaletteKey = (typeof PALETTES)[number]["key"];
export const isPalette = (v: unknown): v is PaletteKey => PALETTES.some((p) => p.key === v);
