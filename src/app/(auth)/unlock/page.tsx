import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { UnlockForm } from "@/components/LockForms";
import { hasValidSession, isUnlocked } from "@/lib/auth";
import { getSettings } from "@/lib/core/settings";

export const metadata = { title: "Locked" };

type Props = { searchParams: Promise<{ next?: string }> };

// The app lock screen: shown once the PIN lock period has passed.
export default async function UnlockPage({ searchParams }: Props) {
  const s = await getSettings();
  if (!s) redirect("/setup");
  if (!(await hasValidSession())) redirect("/login");
  const { next } = await searchParams;
  const to = next && /^\/(?![/\\])/.test(next) ? next : "/";
  if (await isUnlocked(s)) redirect(to);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col items-center justify-center px-4 text-center">
      <Logo size={56} />
      <h1 className="mt-5 text-2xl font-semibold">{s.displayName ? `Hi, ${s.displayName}` : "Locked"}</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Enter your PIN to continue.</p>
      <UnlockForm next={to} />
    </main>
  );
}
