import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SetupForm } from "@/components/SetupForm";
import { getSettings } from "@/lib/core/settings";

export const metadata = { title: "Set up" };

export default async function SetupPage() {
  if (await getSettings()) redirect("/login");
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <Logo size={56} />
      <h1 className="mt-5 text-3xl font-semibold">Welcome</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Set up your personal dashboard. This only happens once.</p>
      <div className="card"><SetupForm /></div>
    </main>
  );
}
