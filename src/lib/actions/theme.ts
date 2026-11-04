"use server";

import { cookies } from "next/headers";
import { isPalette } from "@/lib/palettes";

// Read by app/layout.tsx; setting it re-renders the page with the new theme.
// "system" removes the choice, so the device's light/dark setting applies.
export async function setThemeAction(theme: string) {
  const jar = await cookies();
  if (theme === "system") jar.delete("theme");
  else if (theme === "light" || theme === "dark") jar.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

// Colour theme (Lavender, Ocean… or Liquid Glass); "lavender" is the default.
export async function setPaletteAction(palette: string) {
  const jar = await cookies();
  if (palette === "lavender" || !isPalette(palette)) jar.delete("palette");
  else jar.set("palette", palette, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
