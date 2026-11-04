import { spaceTitle } from "@/lib/brand";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Only what the prompt needs: this goes to the browser, so never the whole
// settings row (it holds password and session hashes).
export type PromptPrefs = {
  displayName: string | null;
  spaceName: string | null;
  currency: string;
  currencySymbol: string | null;
  weekStart: number;
  manageInvestment: boolean;
  manageDonation: boolean;
};

export const promptPrefs = (s: PromptPrefs): PromptPrefs => ({
  displayName: s.displayName,
  spaceName: s.spaceName,
  currency: s.currency,
  currencySymbol: s.currencySymbol,
  weekStart: s.weekStart,
  manageInvestment: s.manageInvestment,
  manageDonation: s.manageDonation,
});

// A message to paste into an AI agent's chat: it connects the agent to this
// dashboard's MCP server, checks the connection, and sets how to use it.
export function agentPrompt(s: PromptPrefs, endpoint: string, token: string) {
  const who = s.displayName ?? "me";
  const money = s.currencySymbol ? `${s.currency} (${s.currencySymbol})` : s.currency;
  const finance = ["income", "expenses", s.manageInvestment && "investments", s.manageDonation && "donations"].filter(Boolean).join(", ");
  const config = JSON.stringify({ mcpServers: { personalhq: { type: "http", url: endpoint, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
  return `Please connect to my PersonalHQ dashboard ("${spaceTitle(s)}") over MCP.

Server
- Name: personalhq
- Transport: Streamable HTTP
- URL: ${endpoint}
- Header: Authorization: Bearer ${token}

If you are Claude Code, run:
claude mcp add --transport http personalhq ${endpoint} --header "Authorization: Bearer ${token}"

Otherwise add this to your MCP configuration:
${config}

Then call list_task_groups to check the connection and tell me whether it worked. Treat the token like a password: don't repeat it back or save it anywhere else.

When using it
- The dashboard holds ${who === "me" ? "my" : `${who}'s`} tasks, notes, trackers and money (${finance}, across wallets).
- Look ids up with the list_* and get_* tools before changing anything; never guess one.
- Dates are YYYY-MM-DD in my local time; weeks start on ${DAYS[s.weekStart] ?? "Monday"}.
- Money is in ${money}; give amounts as normal numbers (12.5), not cents.
- Use existing categories, wallets and task groups; ask if it's unclear.
- Ask before deleting anything or changing many items at once.
- After a change, confirm it in one line.`;
}
