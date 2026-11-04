"use client";

import { CaretLeft, SignOut, X } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, useEffect, useRef } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { SECTION_MENU_EVENT, useScrolledPast } from "./AppShell";
import { AppIcon, type IconName } from "./AppIcon";
import { Logo } from "./Logo";
import { MenuList } from "./MenuList";
import { Notched } from "./Notched";
import { ThemeToggle } from "./ThemeToggle";

// `group` starts a headed group in the panel when it changes.
export type SubItem = { href: string; label: string; icon: IconName; hint?: string; color?: string; group?: string };
// `short` is the label used in the phone tab bar when `label` is too long.
// `action` sits at the bottom of the panel list (e.g. "Add group").
// `compact`: one-line panel rows (hint on the right), for fixed menus.
// `desktopHref`: where the rail goes when that differs from `href`.
// `drill`: on phones, sub-pages show a back button to `href` in the top bar.
export type NavItem = {
  href: string;
  label: string;
  short?: string;
  icon: IconName;
  blurb: string;
  children?: SubItem[];
  action?: React.ReactNode;
  compact?: boolean;
  desktopHref?: string;
  drill?: boolean;
};

type Props = { items: NavItem[]; name: string; theme?: "light" | "dark" };

// Rail geometry (px): 48px buttons, 6px apart, 6px pill padding, 12px bite padding.
const railHeight = (n: number) => n * 48 + (n - 1) * 6 + 12 + 24;
const BITE_RIGHT = 70; // the bite's right edge, from the panel's left edge
const GAP = 14; // board-coloured gap between the bite and the panel

// lg+: a column on the board's left — logo tab, an icon rail in a bite of the
// board's edge, and the current section's panel wrapped around the rail (an L
// shape: cards beside the rail are narrower), with the theme toggle in a tab
// at the bottom. Phones and portrait tablets: an app-style top bar and bottom tab bar.
export function SideNav({ items, name, theme }: Props) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  const section = items.find((it) => active(it.href));
  // Phones: once the page's big title scrolls away, the top bar shows it.
  const scrolled = useScrolledPast(56);
  const subPage = section?.children?.find((c) => c.href === path && c.href !== section.href);
  const title = subPage?.label ?? section?.label ?? "";
  const back = section?.drill && path !== section.href ? section : null;
  // Phones: sections with a list of their own (task groups, note categories)
  // open it in a bottom sheet from the filter button beside the page title.
  const switcher = section && !section.drill && section.href !== "/" && section.children?.length ? section : null;
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => sheet.current?.close(), [path]); // picked a page: close
  useEffect(() => {
    const open = () => sheet.current?.showModal();
    window.addEventListener(SECTION_MENU_EVENT, open);
    return () => window.removeEventListener(SECTION_MENU_EVENT, open);
  }, []);
  const notch = { width: BITE_RIGHT + GAP, height: railHeight(items.length) + GAP };
  const signOut = (
    <form action={logoutAction}>
      <button aria-label="Sign out" title="Sign out" className="rounded-full border border-rule bg-surface p-2.5 text-ink-3 transition hover:text-ink">
        <SignOut size={18} />
      </button>
    </form>
  );

  return (
    <>
      {/* phones: app-style top bar (theme and sign out live in Settings), and a
          floating tab bar where the current section expands to show its name.
          Both stay clear of the notch/home bar. */}
      <header
        style={{ viewTransitionName: "app-header" }}
        className={`sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-app/85 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-xl transition-colors lg:hidden ${scrolled ? "border-rule" : "border-transparent"}`}
      >
        <p aria-hidden className={`pointer-events-none absolute bottom-2 ${back ? "left-[3.25rem]" : "left-4"} right-4 flex h-8 items-center truncate text-[17px] font-semibold transition duration-200 ${scrolled ? "opacity-100" : "translate-y-1 opacity-0"}`}>
          {title}
        </p>
        {back ? (
          // Drill-down page: back to the section, labelled with the section
          // until the page title scrolls away, then with the page title.
          <Link href={back.href} aria-label={`Back to ${back.label}`} className="relative z-10 flex min-w-0 items-center gap-1.5 font-medium text-accent-text">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-rule bg-surface"><CaretLeft size={16} weight="bold" /></span>
            <span className={`truncate transition-opacity duration-200 ${scrolled ? "opacity-0" : ""}`}>{back.label}</span>
          </Link>
        ) : (
          <Link href="/" className={`flex h-8 min-w-0 items-center gap-2 font-medium transition-opacity duration-200 ${scrolled ? "opacity-0" : ""}`}>
            <Logo size={28} /> <span className="truncate">{name}</span>
          </Link>
        )}
      </header>
      {switcher && (
        <dialog
          ref={sheet}
          aria-label={switcher.label}
          onClick={(e) => e.target === sheet.current && sheet.current?.close()}
          className="sheet mx-0 mb-0 mt-auto max-h-[85dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] bg-app px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-md sm:rounded-[28px] lg:hidden"
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-xl font-semibold">{switcher.label}</h2>
            <button type="button" onClick={() => sheet.current?.close()} aria-label="Close" className="rounded-full bg-surface-2 p-1.5 text-ink-3"><X size={16} weight="bold" /></button>
          </div>
          <MenuList current={path} items={switcher.children!} />
          {switcher.action && <div className="mt-3 flow-root">{switcher.action}</div>}
        </dialog>
      )}
      <nav aria-label="Main" style={{ viewTransitionName: "app-tabs" }} className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 sm:inset-x-auto sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 lg:hidden">
        <ul className="flex items-center gap-1 rounded-full border border-rule bg-surface/80 p-1.5 shadow-xl shadow-ink/10 backdrop-blur-xl">
          {items.map((it) => {
            const on = active(it.href);
            return (
              <li key={it.href} className={on ? "shrink-0" : "min-w-0 flex-1"}>
                <Link
                  href={it.href}
                  aria-label={it.label}
                  aria-current={path === it.href ? "page" : undefined}
                  className={`flex h-11 select-none items-center justify-center gap-1.5 rounded-full transition-all duration-300 ${
                    on ? "bg-accent-strong px-4 text-white shadow-md shadow-accent-strong/30" : "text-ink-3 active:bg-surface-2"
                  }`}
                >
                  <AppIcon.Glyph name={it.icon} size={20} weight={on ? "fill" : "regular"} />
                  {on && <span className="text-[13px] font-medium">{it.short ?? it.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* lg+ */}
      <div className="relative hidden w-80 shrink-0 flex-col lg:flex">
        <Link href="/" className="cut-tl z-10 flex h-[84px] w-56 items-center gap-3 pl-4 pr-2">
          <Logo size={42} />
          <span className="truncate text-xl font-medium tracking-tight">{name}</span>
        </Link>

        <div className="relative mx-4 mb-[92px] mt-[136px] min-h-0 flex-1">
          {/* the current section's panel; its top-left is notched around the rail */}
          {section && (
            <div className="max-h-full overflow-y-auto rounded-[28px] bg-surface-2 p-3" style={{ minHeight: notch.height + 24 }}>
              <div aria-hidden className="float-left" style={notch} />
              <div className="mb-2.5 flex items-center gap-2 overflow-hidden rounded-[20px] bg-accent-soft py-3.5 pl-4 pr-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-medium tracking-tight">{section.label}</p>
                  <p className="truncate text-sm text-ink-2">{section.blurb}</p>
                </div>
              </div>
              {section.children && (
                <ul aria-label={section.label} className="contents">
                  {section.children.map((c, i) => {
                    const on = path === c.href;
                    const heading = c.group && c.group !== section.children![i - 1]?.group;
                    return [
                      heading && (
                        <li key={`g-${c.group}`} aria-hidden className="flow-root px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                          {c.group}
                        </li>
                      ),
                      <li key={c.href} className={`${section.compact ? "mb-2" : "mb-2.5"} flow-root`}>
                        <Link href={c.href} aria-current={on ? "page" : undefined} className="group block rounded-[20px]">
                          {section.compact ? (
                            <Notched
                              size="sm"
                              rounded="rounded-[16px]"
                              badge={<AppIcon name={c.icon} size={26} active={on} color={c.color} />}
                              className={`flex items-baseline gap-2 border py-2.5 pl-3.5 pr-10 transition ${
                                on ? "border-accent/50 bg-accent-soft" : "border-rule bg-surface group-hover:border-accent/40"
                              }`}
                            >
                              <span className={`shrink-0 text-sm text-ink ${on ? "font-medium" : ""}`}>{c.label}</span>
                              {c.hint && <span className="ml-auto min-w-0 truncate text-xs tabular-nums text-ink-3">{c.hint}</span>}
                            </Notched>
                          ) : (
                            <Notched
                              rounded="rounded-[20px]"
                              badge={<AppIcon name={c.icon} size={36} active={on} color={c.color} />}
                              className={`border py-3 pl-4 pr-12 transition ${
                                on ? "border-accent/50 bg-accent-soft" : "border-rule bg-surface group-hover:border-accent/40"
                              }`}
                            >
                              <span className={`block truncate text-[15px] text-ink ${on ? "font-medium" : ""}`}>{c.label}</span>
                              {c.hint && <span className="block truncate text-xs text-ink-3">{c.hint}</span>}
                            </Notched>
                          )}
                        </Link>
                      </li>,
                    ];
                  })}
                </ul>
              )}
              {section.action && <div className="flow-root">{section.action}</div>}
            </div>
          )}
          <span aria-hidden className="cut-tl" style={{ ...notch, "--cut-bg": "var(--board)", "--cut-paint": "var(--board-paint)" } as CSSProperties} />

          <nav aria-label="Main" className="cut-l top-0 py-3 pl-3 pr-3.5" style={{ left: -16 }}>
            <ul className="flex flex-col gap-1.5 rounded-full bg-accent p-1.5 shadow-lg shadow-accent/30">
              {items.map((it) => {
                const on = active(it.href);
                return (
                  <li key={it.href} className="group relative">
                    <Link
                      href={it.desktopHref ?? it.href}
                      aria-label={it.label}
                      aria-current={path === it.href ? "page" : undefined}
                      className={`flex size-12 items-center justify-center rounded-full border text-white transition ${
                        on ? "border-black/25 bg-accent-strong shadow-md" : "border-white/30 hover:bg-white/15"
                      }`}
                    >
                      <AppIcon.Glyph name={it.icon} size={22} weight={on ? "fill" : "regular"} />
                    </Link>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-full top-1/2 z-20 ml-4 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-medium text-ink-inverse shadow-lg group-focus-within:block group-hover:block"
                    >
                      {it.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="cut-bl flex items-center gap-3 px-4 py-3.5">
          <ThemeToggle initial={theme} />
          {signOut}
        </div>
      </div>
    </>
  );
}
