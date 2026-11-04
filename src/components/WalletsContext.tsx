"use client";

import { createContext, useContext } from "react";
import type { WalletOption } from "@/lib/wallets";

// The wallets list for every transaction form, provided once by the app
// layout instead of being passed through each page.
const Wallets = createContext<WalletOption[]>([]);
export const WalletsProvider = ({ wallets, children }: { wallets: WalletOption[]; children: React.ReactNode }) => (
  <Wallets value={wallets}>{children}</Wallets>
);
export const useWallets = () => useContext(Wallets);
