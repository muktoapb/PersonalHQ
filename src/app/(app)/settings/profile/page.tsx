import { cookies } from "next/headers";
import { RecoveryKeyForm, UsernameForm } from "@/components/AccountForms";
import { AppLockSettings } from "@/components/LockForms";
import { InstallApp } from "@/components/Pwa";
import { PaletteChoice, PasswordForm, ProfileForm, SignOutOthers, ThemeChoice } from "@/components/SettingsForms";
import { isPalette } from "@/lib/palettes";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Profile · Settings" };

export default async function ProfileSettings() {
  const s = await requireSession();
  const jar = await cookies();
  const theme = jar.get("theme")?.value;
  const palette = jar.get("palette")?.value;
  return (
    <>
      <h1 className="text-3xl font-semibold">Profile</h1>
      <section className="card space-y-4">
        <h2 className="font-semibold">You</h2>
        <ProfileForm name={s.displayName} space={s.spaceName} />
      </section>
      <section className="card space-y-4">
        <h2 className="font-semibold">Theme</h2>
        <ThemeChoice current={theme === "light" || theme === "dark" ? theme : undefined} />
        <div className="space-y-2 border-t border-rule pt-4">
          <h3 className="text-sm font-medium">Colour theme</h3>
          <PaletteChoice current={isPalette(palette) ? palette : "lavender"} />
        </div>
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">App</h2>
        <InstallApp />
      </section>
      <section className="card space-y-4">
        <h2 className="font-semibold">Change username</h2>
        <UsernameForm current={s.username ?? ""} />
      </section>
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">App lock</h2>
          <p className="text-sm text-ink-2">
            {s.pinHash
              ? "On. After a while without use, the app asks for your PIN."
              : "Ask for a PIN after a while without use, like a banking app. You stay signed in; forgot the PIN? Sign in with your password."}
          </p>
        </div>
        <AppLockSettings hasPin={!!s.pinHash} minutes={s.pinLockMinutes} />
      </section>
      <section className="card space-y-4">
        <h2 className="font-semibold">Change password</h2>
        <PasswordForm />
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Recovery key</h2>
        <RecoveryKeyForm />
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Devices</h2>
        <p className="text-sm text-ink-3">Lost a phone or signed in on a shared computer? Sign out everywhere except here.</p>
        <SignOutOthers />
      </section>
    </>
  );
}
