import type { IconName } from "@/components/AppIcon";
import type { Settings, TransactionKind } from "@/db/schema";
import { KIND_META } from "./money";

// Finance sub-pages; investments and donations only when tracked.
export function financePages(s: Pick<Settings, "manageInvestment" | "manageDonation">) {
  const kinds = (["income", "expense", "investment", "donation"] as const).filter(
    (k) => (k !== "investment" || s.manageInvestment) && (k !== "donation" || s.manageDonation),
  );
  return [
    { href: "/finance", label: "Summary", icon: "summary" as IconName },
    { href: "/finance/wallets", label: "Wallets", icon: "wallets" as IconName },
    ...kinds.map((k) => ({ href: `/finance/${KIND_META[k].slug}`, label: KIND_META[k].plural, icon: KIND_META[k].icon as IconName, kind: k as TransactionKind })),
    { href: "/finance/analytics", label: "Analytics", icon: "analytics" as IconName },
  ];
}

// Settings pages, grouped (headings on the phone list and the desktop panel).
export const SETTINGS_PAGES: { href: string; label: string; icon: IconName; group: string; hint: string }[] = [
  { href: "/settings/profile", label: "Profile", icon: "profile", group: "Account", hint: "Name, theme, app, password, devices" },
  { href: "/settings/finance", label: "Finance", icon: "finance", group: "Modules", hint: "Currency, kinds, categories" },
  { href: "/settings/tasks", label: "Tasks", icon: "tasks", group: "Modules", hint: "Labels, reminders" },
  { href: "/settings/notes", label: "Notes", icon: "notes", group: "Modules", hint: "Categories, archive" },
  { href: "/settings/trackers", label: "Trackers", icon: "trackers", group: "Modules", hint: "Week start" },
  { href: "/settings/data", label: "Data", icon: "data", group: "Data & AI", hint: "Export and import" },
  { href: "/settings/mcp", label: "MCP", icon: "mcp", group: "Data & AI", hint: "AI assistant access" },
];
