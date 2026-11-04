import { type ListParams, TransactionsView } from "@/components/TransactionsView";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Donations" };

export default async function Page({ searchParams }: { searchParams: Promise<ListParams> }) {
  const s = await requireSession();
  return <TransactionsView kind="donation" params={await searchParams} s={s} />;
}
