import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotForm } from "@/components/AccountForms";
import { Logo } from "@/components/Logo";
import { getSettings } from "@/lib/core/settings";

export const metadata = { title: "Forgot password" };

// No email on a self-hosted dashboard: the recovery key from setup resets the
// password; failing that, whoever runs the server can. (No redirect when a
// session exists: a successful reset signs in and must stay on the key.)
export default async function ForgotPage() {
  if (!(await getSettings())) redirect("/setup");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Logo size={56} />
      <h1 className="mt-5 text-3xl font-semibold">Forgot password</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Use the recovery key you saved when you set up the dashboard.</p>
      <div className="card"><ForgotForm /></div>
      <details className="mt-5 text-sm text-ink-2">
        <summary className="cursor-pointer text-ink-3">Lost the recovery key too?</summary>
        <p className="mt-2">Whoever runs the server can set a new password from the app&apos;s folder:</p>
        <pre className="mt-2 rounded-xl border border-rule bg-surface p-3 text-xs">pnpm reset-password</pre>
      </details>
      <Link href="/login" className="mt-4 text-sm text-accent-text hover:underline">← Back to sign in</Link>
    </main>
  );
}
