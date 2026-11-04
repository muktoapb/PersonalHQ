"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { timeZoneAction } from "@/lib/actions/auth";

// First use: no time zone saved yet, so take this browser's and redraw the
// page with the right "today". (Afterwards it only changes in Settings › Profile,
// so travelling doesn't quietly move your days.)
export function TimeZoneSync({ saved }: { saved: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (saved) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) timeZoneAction(tz).then((r) => !r.error && router.refresh(), () => {});
  }, [saved, router]);
  return null;
}
