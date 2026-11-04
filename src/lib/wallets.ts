import type { IconName } from "@/components/AppIcon";
import type { WalletType } from "@/db/schema";

// Wallet types as shown in the app (shared by server pages and client forms).
export const WALLET_TYPE_META: Record<WalletType, { label: string; icon: IconName; hint: string }> = {
  bank: { label: "Bank account", icon: "bank", hint: "e.g. DBBL, City Bank" },
  cash: { label: "Cash", icon: "money", hint: "Wallet, drawer" },
  mobile: { label: "Mobile wallet", icon: "mobile", hint: "e.g. bKash, Nagad" },
  card: { label: "Card", icon: "card", hint: "Credit or prepaid card" },
  savings: { label: "Savings", icon: "savings", hint: "DPS, fixed deposit" },
  other: { label: "Other", icon: "finance", hint: "Anything else" },
};

export type WalletOption = { id: string; name: string; type: WalletType; color: string; isDefault: boolean; archived: boolean };
