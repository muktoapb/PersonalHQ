// On lg+ the sub-pages live in the side panel; phones and tablets drill in from the
// Summary page's list and go back from the top bar.
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
