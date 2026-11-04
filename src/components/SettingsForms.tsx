"use client";

import { Bell, Check, Copy, Desktop, Moon, Sun, Trash, UploadSimple, X } from "@phosphor-icons/react/ssr";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { Label, Settings } from "@/db/schema";
import { financePrefsAction, passwordAction, profileAction, signOutOthersAction, weekStartAction } from "@/lib/actions/auth";
import { createMcpTokenAction, importBackupAction, revokeMcpTokenAction } from "@/lib/actions/data";
import { disconnectAppAction } from "@/lib/actions/oauth";
import type { Connection } from "@/lib/mcp/oauth";
import { emptyArchiveAction } from "@/lib/actions/notes";
import { deleteLabelAction, updateLabelAction } from "@/lib/actions/tasks";
import { setPaletteAction, setThemeAction } from "@/lib/actions/theme";
import { PALETTES, type PaletteKey } from "@/lib/palettes";
import { GROUP_COLORS } from "@/lib/group-icons";
import { MoneyFields } from "./MoneyFields";

// Forms for the settings pages. Each saves only its own fields.

const Status = ({ state }: { state: { error?: string; ok?: boolean } }) =>
  state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : state.ok ? <p role="status" className="text-sm text-income">Saved.</p> : null;

// ---------- profile ----------

export function ProfileForm({ name, space }: { name: string | null; space: string | null }) {
  const [state, action, pending] = useActionState(profileAction, {});
  const [typedName, setTypedName] = useState(name ?? "");
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label className="label" htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" maxLength={80} value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Shown in greetings" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="spaceName">Space name</label>
        <input
          id="spaceName" name="spaceName" maxLength={40} defaultValue={space ?? ""}
          placeholder={typedName.trim() ? `${typedName.trim()}'s HQ` : "PersonalHQ"} className="input"
        />
      </div>
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
      <p className="text-xs text-ink-3 sm:col-span-3">The space name is the title at the top of the sidebar. Leave it empty to use the one shown.</p>
      <div className="empty:hidden sm:col-span-3"><Status state={state} /></div>
    </form>
  );
}

export function ThemeChoice({ current }: { current?: "light" | "dark" }) {
  const [value, setValue] = useState<"light" | "dark" | "system">(current ?? "system");
  const [, start] = useTransition();
  const options = [
    ["light", "Light", Sun],
    ["dark", "Dark", Moon],
    ["system", "Same as device", Desktop],
  ] as const;
  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-3">
      {options.map(([v, label, Icon]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => { setValue(v); start(async () => { await setThemeAction(v); }); }}
          className={`flex items-center gap-2.5 rounded-2xl border p-3 text-sm transition ${value === v ? "border-accent bg-accent-soft font-medium" : "border-rule hover:border-accent/40"}`}
        >
          <Icon size={20} weight={value === v ? "fill" : "regular"} /> {label}
          {value === v && <Check size={14} weight="bold" className="ml-auto text-accent-text" />}
        </button>
      ))}
    </div>
  );
}

// Paint the new theme straight away (the cookie then keeps it for next time).
function applyPalette(key: PaletteKey) {
  const root = document.documentElement;
  if (key === "lavender") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", key);
}

// Colour theme picker: applies at once (on <html>), then remembers it.
export function PaletteChoice({ current }: { current: PaletteKey }) {
  const [value, setValue] = useState<PaletteKey>(current);
  const [, start] = useTransition();
  const pick = (key: PaletteKey) => {
    setValue(key);
    applyPalette(key);
    start(async () => { await setPaletteAction(key); });
  };
  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PALETTES.map((p) => {
        const on = value === p.key;
        const glass = p.key === "glass";
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(p.key)}
            className={`group rounded-2xl border p-2 text-left text-sm transition ${on ? "border-accent bg-accent-soft font-medium" : "border-rule hover:border-accent/40"}`}
          >
            {/* a tiny preview: background, card, accent */}
            <span
              className="relative mb-2 block h-14 overflow-hidden rounded-xl"
              style={{ background: glass ? `radial-gradient(70% 90% at 0% 0%, ${p.swatch[0]}, transparent), radial-gradient(70% 90% at 100% 0%, ${p.swatch[1]}, transparent), radial-gradient(80% 90% at 60% 100%, ${p.swatch[2]}, transparent), #eef1fb` : p.swatch[0] }}
            >
              <span
                className="absolute inset-x-2 bottom-2 top-3 rounded-lg"
                style={glass ? { background: "rgb(255 255 255 / 0.5)", backdropFilter: "blur(6px)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.9)" } : { background: "#fff" }}
              />
              <span className="absolute bottom-4 left-4 h-2.5 w-10 rounded-full" style={{ background: glass ? "oklch(0.6 0.19 258)" : p.swatch[1] }} />
              <span className="absolute right-4 top-5 size-3.5 rounded-full" style={{ background: glass ? "oklch(0.5 0.21 262)" : p.swatch[2] }} />
            </span>
            <span className="flex items-center justify-between gap-1 px-1">
              {p.label}
              {on && <Check size={14} weight="bold" className="text-accent-text" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(passwordAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor="current">Current</label>
        <input id="current" name="current" type="password" required className="input" autoComplete="current-password" />
      </div>
      <div>
        <label className="label" htmlFor="next">New</label>
        <input id="next" name="next" type="password" required minLength={10} className="input" autoComplete="new-password" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new</label>
        <input id="confirm" name="confirm" type="password" required minLength={10} className="input" autoComplete="new-password" />
      </div>
      <div className="space-y-2 sm:col-span-3">
        <Status state={state} />
        <p className="text-xs text-ink-3">Changing your password signs out every other device.</p>
        <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Change password"}</button>
      </div>
    </form>
  );
}

export function SignOutOthers() {
  const [state, setState] = useState<{ error?: string; ok?: boolean }>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-2">Sign out every other phone, tablet and browser?</span>
          <button disabled={pending} onClick={() => start(async () => { setState(await signOutOthersAction()); setConfirming(false); })} className="btn btn-danger px-3 py-1.5">Sign them out</button>
          <button onClick={() => setConfirming(false)} className="btn btn-ghost px-3 py-1.5">Cancel</button>
        </div>
      ) : (
        <button onClick={() => { setState({}); setConfirming(true); }} className="btn btn-ghost">Sign out other devices</button>
      )}
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-income">Other devices are signed out. This one stays signed in.</p>}
    </div>
  );
}

// ---------- finance ----------

export function FinancePrefsForm({ s }: { s: Pick<Settings, "currency" | "currencySymbol" | "locale" | "manageDonation" | "manageInvestment"> }) {
  const [state, action, pending] = useActionState(financePrefsAction, {});
  return (
    <form action={action} className="space-y-4">
      <MoneyFields d={s} />
      <Status state={state} />
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

// ---------- tasks ----------

// Rename, recolour or delete the labels used on tasks.
export function LabelsManager({ labels }: { labels: Label[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => { const r = await fn(); setError(r.error); if (!r.error) after?.(); });
  if (!labels.length) return <p className="text-sm text-ink-3">No labels yet — add them from a task&apos;s panel.</p>;
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {labels.map((l) =>
          editing === l.id ? (
            <li key={l.id}>
              <form
                action={(fd) => run(() => updateLabelAction(l.id, { name: String(fd.get("name") ?? ""), color: String(fd.get("color") ?? l.color) }), () => setEditing(null))}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-accent/50 p-2.5"
              >
                <input name="name" defaultValue={l.name} required maxLength={30} autoFocus aria-label="Label name" className="input min-w-0 flex-1 basis-40 py-1.5" />
                <div className="flex gap-1.5" role="radiogroup" aria-label="Colour">
                  {GROUP_COLORS.map((c) => (
                    <label key={c} className="cursor-pointer">
                      <input type="radio" name="color" value={c} defaultChecked={c === l.color} className="peer sr-only" />
                      <span className="block size-6 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-ink" style={{ background: c }} />
                    </label>
                  ))}
                </div>
                <button disabled={pending} className="btn btn-primary px-3 py-1.5 text-xs">Save</button>
                <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2"><X size={16} /></button>
              </form>
            </li>
          ) : (
            <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-rule px-3.5 py-2">
              <span className="size-3 rounded-full" style={{ background: l.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
              {confirming === l.id ? (
                <>
                  <span className="text-xs text-ink-3">Remove from all tasks?</span>
                  <button disabled={pending} onClick={() => run(() => deleteLabelAction(l.id), () => setConfirming(null))} className="btn btn-danger px-3 py-1 text-xs">Delete</button>
                  <button onClick={() => setConfirming(null)} className="btn btn-ghost px-3 py-1 text-xs">Keep</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(l.id)} className="btn px-3 py-1 text-xs text-ink-2 hover:bg-surface-2">Edit</button>
                  <button onClick={() => setConfirming(l.id)} aria-label={`Delete ${l.name}`} className="rounded-full p-1.5 text-ink-3 hover:bg-danger/10 hover:text-danger"><Trash size={16} /></button>
                </>
              )}
            </li>
          ),
        )}
      </ul>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// Whether this browser may show task reminders, and a way to try one.
export function RemindersCard() {
  const [permission, setPermission] = useState<string>(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const [sent, setSent] = useState(false);
  const test = () => {
    try {
      new Notification("Test reminder", { body: "Reminders will look like this.", icon: "/icon1" });
      setSent(true);
    } catch {
      setPermission("unsupported");
    }
  };
  const text: Record<string, string> = {
    granted: "Allowed — reminders show as notifications while the app is open in any tab.",
    default: "Not decided yet — allow notifications to get reminders outside the app window.",
    denied: "Blocked in this browser — reminders still appear as cards inside the app. Allow them in the browser's site settings to get notifications.",
    unsupported: "This browser can't show notifications from the page — reminders appear as cards inside the app.",
  };
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm text-ink-2"><Bell size={18} className="mt-0.5 shrink-0" /> {text[permission] ?? text.unsupported}</p>
      <div className="flex flex-wrap gap-2">
        {permission === "default" && (
          <button onClick={() => Notification.requestPermission().then(setPermission)} className="btn btn-primary">Allow notifications</button>
        )}
        {permission === "granted" && <button onClick={test} className="btn btn-ghost">{sent ? "Sent — check your notifications" : "Send a test notification"}</button>}
      </div>
      <p className="text-xs text-ink-3">Reminders when the app is fully closed need push notifications, which are on the plan.</p>
    </div>
  );
}

// ---------- notes ----------

export function EmptyArchive({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (!count) return <p className="text-sm text-ink-3">{done ? "Archive emptied." : "The archive is empty."}</p>;
  return confirming ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-2">Permanently delete {count} archived note{count === 1 ? "" : "s"}? This can&apos;t be undone.</span>
      <button disabled={pending} onClick={() => start(async () => { await emptyArchiveAction(); setDone(true); setConfirming(false); })} className="btn btn-danger px-3 py-1.5">Delete forever</button>
      <button onClick={() => setConfirming(false)} className="btn btn-ghost px-3 py-1.5">Cancel</button>
    </div>
  ) : (
    <button onClick={() => setConfirming(true)} className="btn btn-danger -ml-3"><Trash size={16} /> Empty archive ({count})</button>
  );
}

// ---------- trackers ----------

export function WeekStartForm({ value }: { value: number }) {
  const [state, action, pending] = useActionState(weekStartAction, {});
  return (
    <form action={action} className="space-y-3">
      <div role="radiogroup" aria-label="Week starts on" className="grid gap-2 sm:grid-cols-3">
        {([[6, "Saturday"], [0, "Sunday"], [1, "Monday"]] as const).map(([v, label]) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name="weekStart" value={v} defaultChecked={value === v} className="peer sr-only" />
            <span className="block rounded-2xl border border-rule p-3 text-sm peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-accent">{label}</span>
          </label>
        ))}
      </div>
      <Status state={state} />
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

// ---------- data ----------

const TABLE_LABELS: Record<string, string> = {
  transactions: "transactions", tasks: "tasks", notes: "notes", trackers: "trackers", trackerEntries: "tracker entries",
  taskGroups: "task groups", categories: "finance categories", noteCategories: "note categories", labels: "labels", wallets: "wallets", walletTransfers: "transfers",
};

// Restore a backup. Replaces everything, so it asks for a tick first.
export function ImportBackup() {
  const [state, action, pending] = useActionState(importBackupAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.counts) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="space-y-3">
      <input name="file" type="file" accept="application/json,.json" required aria-label="Backup file"
        className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-accent-soft" />
      <label className="flex items-start gap-2 text-sm text-ink-2">
        <input type="checkbox" required className="mt-1 accent-accent" />
        Replace everything in this dashboard with the backup. Your password and devices stay as they are.
      </label>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.counts && (
        <p role="status" className="text-sm text-income">
          Restored {Object.entries(state.counts).filter(([k]) => TABLE_LABELS[k]).map(([k, n]) => `${n} ${TABLE_LABELS[k]}`).join(", ")}.
        </p>
      )}
      <button disabled={pending} className="btn btn-danger"><UploadSimple size={16} /> {pending ? "Restoring…" : "Restore backup"}</button>
    </form>
  );
}

// ---------- MCP ----------

export function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-3">{label}</span>
        <button type="button" onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-ink-3 hover:bg-surface-2">
          {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre rounded-2xl border border-rule bg-surface-2 p-3 text-xs leading-relaxed">{value}</pre>
    </div>
  );
}

// Apps connected by signing in (OAuth), each with its own disconnect.
export function ConnectedApps({ apps, locale }: { apps: Connection[]; locale: string }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const date = (d: string | number) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  if (!apps.length) return <p className="rounded-2xl border border-dashed border-rule px-3 py-4 text-center text-sm text-ink-3">No apps connected yet.</p>;
  return (
    <ul className="divide-y divide-rule rounded-2xl border border-rule">
      {apps.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{a.name}</p>
            <p className="truncate text-xs text-ink-3">
              {a.redirectHost && `${a.redirectHost} · `}connected {date(a.approvedAt)}{a.lastUsedAt ? ` · last used ${date(a.lastUsedAt)}` : ""}
            </p>
          </div>
          {confirm === a.id ? (
            <span className="flex gap-1.5">
              <button disabled={pending} onClick={() => start(async () => { await disconnectAppAction(a.id); setConfirm(null); })} className="btn btn-danger px-3 py-1.5 text-xs">Disconnect</button>
              <button onClick={() => setConfirm(null)} className="btn btn-ghost px-3 py-1.5 text-xs">Cancel</button>
            </span>
          ) : (
            <button onClick={() => setConfirm(a.id)} className="btn btn-ghost px-3 py-1.5 text-xs text-danger">Disconnect</button>
          )}
        </li>
      ))}
    </ul>
  );
}

// Create, replace or revoke the access token. A new token is shown once,
// filled into the setup snippets; afterwards they show a placeholder.
export function McpAccess({ endpoint, hasToken }: { endpoint: string; hasToken: boolean }) {
  const [token, setToken] = useState<string>();
  const [confirming, setConfirming] = useState<"create" | "replace" | "revoke" | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const create = () =>
    start(async () => {
      const res = await createMcpTokenAction(password);
      setError(res.error);
      if (res.token) { setToken(res.token); setConfirming(null); setPassword(""); }
    });
  const revoke = () => start(async () => { await revokeMcpTokenAction(); setToken(undefined); setConfirming(null); });
  const shown = token ?? "YOUR_TOKEN";
  const json = JSON.stringify({ mcpServers: { personalhq: { type: "http", url: endpoint, headers: { Authorization: `Bearer ${shown}` } } } }, null, 2);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm">
          <span className={`size-2.5 rounded-full ${hasToken || token ? "bg-income" : "bg-ink-3"}`} aria-hidden />
          {hasToken || token ? "Access is on — assistants with the token can read and change your data." : "Access is off. Create a token to connect an assistant."}
        </p>
        {token && (
          <div className="space-y-2 rounded-2xl border border-accent/50 bg-accent-soft p-3">
            <CopyBlock label="Your token — copy it now, it won’t be shown again" value={token} />
          </div>
        )}
        {confirming === "revoke" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-2">Disconnect every assistant using the token?</span>
            <button disabled={pending} onClick={revoke} className="btn btn-danger px-3 py-1.5">Revoke</button>
            <button onClick={() => setConfirming(null)} className="btn btn-ghost px-3 py-1.5">Cancel</button>
          </div>
        ) : confirming ? (
          // Creating or replacing a token asks for the password.
          <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-2">
            {confirming === "replace" && <p className="text-sm text-ink-2">The old token stops working.</p>}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor="mcp-password">Your password</label>
                <input id="mcp-password" type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="current-password" />
              </div>
              <button disabled={pending} className="btn btn-primary">{pending ? "Creating…" : confirming === "replace" ? "New token" : "Create token"}</button>
              <button type="button" onClick={() => { setConfirming(null); setError(undefined); setPassword(""); }} className="btn btn-ghost">Cancel</button>
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </form>
        ) : hasToken || token ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setConfirming("replace")} className="btn btn-ghost">New token</button>
            <button onClick={() => setConfirming("revoke")} className="btn btn-ghost text-danger">Revoke access</button>
          </div>
        ) : (
          <button onClick={() => setConfirming("create")} className="btn btn-primary">Create token</button>
        )}
      </div>

      <div className="space-y-3 border-t border-rule pt-5">
        <h3 className="text-sm font-semibold">Connect</h3>
        <CopyBlock label="Claude Code" value={`claude mcp add --transport http personalhq ${endpoint} \\\n  --header "Authorization: Bearer ${shown}"`} />
        <CopyBlock label="Other clients (.mcp.json style)" value={json} />
        <p className="text-xs text-ink-3">The assistant must be able to reach this address. A localhost address only works on this computer; use your server&apos;s HTTPS address elsewhere.</p>
      </div>
    </div>
  );
}
