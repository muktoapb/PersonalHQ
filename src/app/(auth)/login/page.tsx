import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { hasValidSession } from "@/lib/auth";
import { getSettings } from "@/lib/core/settings";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const settings = await getSettings();
  if (!settings) redirect("/setup");
  if (await hasValidSession()) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <Logo size={56} />
      <h1 className="mt-5 text-3xl font-semibold">{settings.displayName ? `Hi, ${settings.displayName}` : "Welcome back"}</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Sign in to your dashboard.</p>
      <div className="card"><LoginForm withUsername={!!settings.username} /></div>
    </main>
  );
}
