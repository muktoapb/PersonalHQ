// Icons a task group can wear, as stable keys stored in the database.
// components/AppIcon.tsx maps each key to its glyph.
export const GROUP_ICONS = [
  "checklist", "briefcase", "graduation", "house", "family", "heart",
  "fitness", "cart", "travel", "money", "code", "design",
  "book", "rocket", "idea", "calendar", "car", "baby",
  "pet", "plant", "music", "camera", "game", "star",
] as const;
export type GroupIcon = (typeof GROUP_ICONS)[number];

export const GROUP_COLORS = ["#7262ea", "#2a78d6", "#1baf7a", "#eb6834", "#e87ba4", "#eda100", "#64748b"];
