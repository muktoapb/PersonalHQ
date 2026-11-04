"use client";

import { useEffect } from "react";

// Keeps the phone's system bars (status bar, home-indicator area) the same
// colour as the app background. The <meta name="theme-color"> tags from the
// root layout only know light/dark of the *device*; this follows the app's own
// light/dark choice and colour theme, and updates the moment either changes.
function sync() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const app = getComputedStyle(root).getPropertyValue("--app").trim();
  if (!app) return;
  // Resolve any CSS colour (oklch, translucent glass…) to an opaque hex.
  const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!c) return;
  c.fillStyle = dark ? "#0b0d1a" : "#eef1fb"; // under translucent (glass) backgrounds
  c.fillRect(0, 0, 1, 1);
  c.fillStyle = app;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = hex;
}

export function ThemeColor() {
  useEffect(() => {
    sync();
    const o = new MutationObserver(sync);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => { o.disconnect(); mq.removeEventListener("change", sync); };
  }, []);
  return null;
}
