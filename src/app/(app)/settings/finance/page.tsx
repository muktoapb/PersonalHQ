import { AppIcon } from "@/components/AppIcon";
import { KindCategories } from "@/components/FinanceCategories";
import { FinancePrefsForm } from "@/components/SettingsForms";
import { requireSession } from "@/lib/auth";
import { listCategories } from "@/lib/core/finance";
import { financePages } from "@/lib/nav";

export const metadata = { title: "Finance · Settings" };

export default async function FinanceSettings() {
  const s = await requireSession();
  const cats = await listCategories();
  // One block per kind you track (investments/donations only when switched on).
  const kinds = financePages(s).flatMap((p) => ("kind" in p ? [{ kind: p.kind, label: p.label, icon: p.icon }] : []));
  return (
    <>
      <h1 className="text-3xl font-semibold">Finance</h1>
      <section className="card space-y-4">
        <h2 className="font-semibold">Money</h2>
        <FinancePrefsForm s={{ currency: s.currency, currencySymbol: s.currencySymbol, locale: s.locale, manageDonation: s.manageDonation, manageInvestment: s.manageInvestment }} />
      </section>
      <section className="card space-y-5">
        <div>
          <h2 className="font-semibold">Categories</h2>
          <p className="text-sm text-ink-3">You can also create one while adding a transaction — pick “+ New category…” in its category menu.</p>
        </div>
        {kinds.map((k) => (
          <div key={k.kind} className="space-y-4 border-t border-rule pt-5 first-of-type:border-t-0 first-of-type:pt-0">
            <h3 className="flex items-center gap-2 text-sm font-medium"><AppIcon name={k.icon} size={28} /> {k.label}</h3>
            <KindCategories kind={k.kind} categories={cats.filter((c) => c.kind === k.kind).map((c) => ({ id: c.id, name: c.name, color: c.color }))} />
          </div>
        ))}
      </section>
    </>
  );
}
