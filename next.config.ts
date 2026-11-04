import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships native bindings for local SQLite files; keep it out of the bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Restoring a backup (Settings → Data) uploads the whole JSON file.
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
    // React <ViewTransition> for page animations on phones (see AppShell).
    viewTransition: true,
  },
  // The service worker must never be served stale.
  async headers() {
    return [
      // No framing (clickjacking), no MIME sniffing, no leaking full URLs,
      // and no camera/mic/location for this app.
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
