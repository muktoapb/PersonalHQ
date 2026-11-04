import { type ListParams, TransactionsView } from "@/components/TransactionsView";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Income" };

export default async function Page({ searchParams }: { searchParams: Promise<ListParams> }) {
  const s = await requireSession();
  return <TransactionsView kind="income" params={await searchParams} s={s} />;
}
