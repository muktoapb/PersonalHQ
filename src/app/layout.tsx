import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import { cookies } from "next/headers";
import { ServiceWorker } from "@/components/Pwa";
import { ThemeColor } from "@/components/ThemeColor";
import { isPalette } from "@/lib/palettes";
import "./globals.css";

const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" });

export const metadata: Metadata = {
  title: { default: "PersonalHQ", template: "%s · PersonalHQ" },
  description: "PersonalHQ: your tasks, notes, trackers and money in one place.",
  appleWebApp: { capable: true, title: "PersonalHQ", statusBarStyle: "default" },
};

// viewportFit "cover" lets the phone app bars reach under the notch/home bar
// (they pad themselves with env(safe-area-inset-*)).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    // phones: the app background (--app) behind the status bar; ThemeColor
    // then follows the app's own light/dark and colour theme
    { media: "(prefers-color-scheme: light)", color: "#f3f3fb" },
    { media: "(prefers-color-scheme: dark)", color: "#13122a" },
  ],
};

// The theme cookie is set by ThemeToggle; without it the OS setting decides.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = jar.get("theme")?.value;
  const palette = jar.get("palette")?.value;
  return (
    <html lang="en" className={lexend.variable} data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      data-palette={isPalette(palette) && palette !== "lavender" ? palette : undefined}
    >
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorker />
        <ThemeColor />
      </body>
    </html>
  );
}
