import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

// Page links for a server-rendered list: previous/next, the first and last
// pages, and the pages around the current one. `params` are kept in links.
export function Pagination({ page, pages, total, perPage, params = {} }: {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  params?: Record<string, string | undefined>;
}) {
  if (total === 0) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `?${s}` : "?";
  };
  const near = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const first = (page - 1) * perPage + 1;
  const arrow = "grid size-9 place-items-center rounded-xl border border-rule text-ink-2";

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-xs text-ink-3">
        {first}–{Math.min(page * perPage, total)} of {total}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label="Previous page" className={`${arrow} hover:bg-surface-2`}><CaretLeft size={14} weight="bold" /></Link>
          ) : (
            <span aria-hidden className={`${arrow} opacity-40`}><CaretLeft size={14} weight="bold" /></span>
          )}
          {near.map((p, i) => (
            <span key={p} className="flex items-center gap-1">
              {i > 0 && p - near[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm tabular-nums ${p === page ? "bg-accent-strong font-medium text-white" : "text-ink-2 hover:bg-surface-2"}`}
              >
                {p}
              </Link>
            </span>
          ))}
          {page < pages ? (
            <Link href={href(page + 1)} aria-label="Next page" className={`${arrow} hover:bg-surface-2`}><CaretRight size={14} weight="bold" /></Link>
          ) : (
            <span aria-hidden className={`${arrow} opacity-40`}><CaretRight size={14} weight="bold" /></span>
          )}
        </div>
      )}
    </nav>
  );
}
