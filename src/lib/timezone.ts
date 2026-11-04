// The owner's time zone runs the server's clock. This is a single-user app,
// so the whole Node process follows it: every "today", local date and time
// formatted on the server (pages, server actions, MCP tools) uses it, instead
// of the host's zone (UTC in most containers). Node applies a change to
// process.env.TZ immediately.

export const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export function applyTimeZone(tz: string | null | undefined) {
  if (tz && process.env.TZ !== tz && isTimeZone(tz)) process.env.TZ = tz;
}
