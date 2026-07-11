import type { ProviderImportResult, ProviderStatusSnapshot, SourceType } from "@/lib/types";

/**
 * In-memory registry of provider health, used by the /admin/import page.
 * Resets on server restart — acceptable for a local MVP with no database.
 */

const statusMap = new Map<string, ProviderStatusSnapshot>();

export function ensureProviderStatus(providerId: string, providerName: string, sourceType: SourceType, priority: number): void {
  if (!statusMap.has(providerId)) {
    statusMap.set(providerId, {
      providerId,
      providerName,
      sourceType,
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastResult: null,
      isEnabled: true,
      priority,
    });
  }
}

export function recordProviderResult(result: ProviderImportResult): void {
  const existing = statusMap.get(result.providerId);
  const snapshot: ProviderStatusSnapshot = {
    providerId: result.providerId,
    providerName: result.providerName,
    sourceType: result.sourceType,
    lastAttemptAt: result.finishedAt,
    lastSuccessAt: result.success ? result.finishedAt : existing?.lastSuccessAt ?? null,
    lastResult: result,
    isEnabled: existing?.isEnabled ?? true,
    priority: existing?.priority ?? 0,
  };
  statusMap.set(result.providerId, snapshot);
}

export function getAllProviderStatuses(): ProviderStatusSnapshot[] {
  return Array.from(statusMap.values()).sort((a, b) => a.priority - b.priority);
}

export function getProviderStatus(providerId: string): ProviderStatusSnapshot | undefined {
  return statusMap.get(providerId);
}
