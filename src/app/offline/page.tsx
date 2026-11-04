import { Logo } from "@/components/Logo";
import { RetryButton } from "@/components/Pwa";

export const metadata = { title: "Offline" };

// Shown by the service worker when a page can't be reached. No data here:
// it is cached and must work signed out.
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
      <div className="max-w-xs space-y-4">
        <div className="flex justify-center"><Logo size={56} /></div>
        <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
        <p className="text-sm text-ink-2">Your dashboard lives on your server, so it needs a connection. It will be right here when you&apos;re back online.</p>
        <RetryButton />
      </div>
    </main>
  );
}
