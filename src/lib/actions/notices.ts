"use server";

import { requireSession } from "@/lib/auth";
import { markNoticesSeen } from "@/lib/core/today";

export async function markNoticesSeenAction() {
  await requireSession();
  await markNoticesSeen();
}
