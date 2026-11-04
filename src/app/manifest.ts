import type { MetadataRoute } from "next";

// Lets phones install the dashboard to the home screen and open it full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PersonalHQ",
    short_name: "PersonalHQ",
    description: "Your tasks, notes, trackers and money in one place.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    categories: ["productivity", "lifestyle", "finance"],
    background_color: "#f3f3fb",
    theme_color: "#f3f3fb",
    // Long-press the home-screen icon to jump straight in.
    shortcuts: [
      { name: "Add task", short_name: "Task", url: "/tasks", icons: [{ src: "/icon1", sizes: "512x512" }] },
      { name: "Write a note", short_name: "Note", url: "/notes", icons: [{ src: "/icon1", sizes: "512x512" }] },
      { name: "Trackers", url: "/trackers", icons: [{ src: "/icon1", sizes: "512x512" }] },
      { name: "Add expense", short_name: "Expense", url: "/finance/expenses", icons: [{ src: "/icon1", sizes: "512x512" }] },
    ],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon1", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
