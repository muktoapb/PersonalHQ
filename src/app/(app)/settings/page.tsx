import { SignOut } from "@phosphor-icons/react/ssr";
import { MenuList } from "@/components/MenuList";
import { logoutAction } from "@/lib/actions/auth";
import { requireSession } from "@/lib/auth";
import { SETTINGS_PAGES } from "@/lib/nav";

export const metadata = { title: "Settings" };

// The Settings home on phones: a grouped list to drill into. (Desktop goes
// straight to Profile; the side panel lists the pages.)
export default async function SettingsPage() {
  await requireSession();
  return (
    <>
      <h1 className="text-3xl font-semibold">Settings</h1>
      <MenuList items={SETTINGS_PAGES} />
      <form action={logoutAction}>
        <button className="flex w-full items-center gap-3 rounded-3xl border border-rule bg-surface px-4 py-3 text-left text-[15px] font-medium text-danger active:bg-surface-2">
          <span className="grid size-[34px] place-items-center rounded-full bg-danger/10"><SignOut size={18} /></span>
          Sign out
        </button>
      </form>
    </>
  );
}
