// The address people and AI apps reach this dashboard at, e.g.
// "https://hq.example.com", as seen through the reverse proxy.
export function publicOrigin(h: Headers) {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.|\[::1\])/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

export const mcpUrl = (h: Headers) => `${publicOrigin(h)}/api/mcp`;
