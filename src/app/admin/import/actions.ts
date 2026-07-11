"use server";

import { forceRefresh } from "@/lib/repository";

export async function refreshDataAction() {
  await forceRefresh();
}
