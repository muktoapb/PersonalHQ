import { redirect } from "next/navigation";
import { SecureAccountForm } from "@/components/AccountForms";
import { Logo } from "@/components/Logo";
import { hasValidSession } from "@/lib/auth";
import { getSettings } from "@/lib/core/settings";

export const metadata = { title: "Account security" };

// One step for dashboards set up before usernames and recovery keys.
export default async function SecureAccountPage() {
  const s = await getSettings();
  if (!s) redirect("/setup");
  if (!(await hasValidSession())) redirect("/login");
  if (s.username && s.recoveryHash) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Logo size={56} />
      <h1 className="mt-5 text-3xl font-semibold">Secure your account</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Sign-in now uses a username with your password, and a recovery key lets you reset a forgotten password.</p>
      <div className="card"><SecureAccountForm /></div>
    </main>
  );
}
