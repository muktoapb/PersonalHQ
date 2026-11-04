// On lg+ the pages are listed in the side panel; phones and tablets drill in from the
// Settings list (/settings) and go back from the top bar.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-6">{children}</div>;
}
