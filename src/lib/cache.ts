import fs from "node:fs";
import path from "node:path";
import { getStore, type Store } from "@netlify/blobs";

/**
 * Ingestion cache — so scraper/API providers don't re-request the same page
 * or endpoint on every request, and the merged dataset survives across
 * server restarts.
 *
 * Two backends, chosen automatically at runtime:
 *  - Netlify Blobs, when deployed on Netlify. Serverless functions there run
 *    in a read-only filesystem with no guarantee the same instance handles
 *    the next request, so a local file (or in-memory variable) never
 *    persists — every request would otherwise re-scrape all 5 chains from
 *    scratch, which is what made things slow after deploying.
 *  - A local `.cache/*.json` file per key, for local development, where
 *    there's no Blobs context and a persistent process/filesystem already
 *    works fine.
 */

const CACHE_DIR = path.join(process.cwd(), ".cache");
const STORE_NAME = "ingestion-cache";

interface CacheEnvelope<T> {
  cachedAt: number;
  ttlMs: number;
  value: T;
}

function safeKey(key: string): string {
  return key.replace(/[^a-z0-9_-]/gi, "_");
}

function keyToFile(key: string): string {
  return path.join(CACHE_DIR, `${safeKey(key)}.json`);
}

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    // best-effort; if the filesystem is read-only, callers just always miss cache
  }
}

// Netlify injects Blobs context into the function environment automatically
// when the site is deployed there — that's how we detect "can we actually use
// Blobs right now" without needing separate NETLIFY-vs-local configuration.
function blobsAvailable(): boolean {
  return Boolean(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY);
}

let store: Store | null = null;
function getBlobStore(): Store | null {
  if (store) return store;
  try {
    store = getStore(STORE_NAME);
    return store;
  } catch {
    return null;
  }
}

function isFresh(envelope: CacheEnvelope<unknown>, ttlMs: number): boolean {
  return Date.now() - envelope.cachedAt <= (envelope.ttlMs ?? ttlMs);
}

export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  if (blobsAvailable()) {
    const s = getBlobStore();
    if (s) {
      try {
        const raw = await s.get(safeKey(key), { type: "text" });
        if (raw) {
          const envelope: CacheEnvelope<T> = JSON.parse(raw);
          return isFresh(envelope, ttlMs) ? envelope.value : null;
        }
      } catch {
        // fall through to the local-file path as a last resort
      }
    }
  }

  ensureCacheDir();
  const file = keyToFile(key);
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf-8");
    const envelope: CacheEnvelope<T> = JSON.parse(raw);
    return isFresh(envelope, ttlMs) ? envelope.value : null;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const envelope: CacheEnvelope<T> = { cachedAt: Date.now(), ttlMs, value };
  const json = JSON.stringify(envelope);

  if (blobsAvailable()) {
    const s = getBlobStore();
    if (s) {
      try {
        await s.set(safeKey(key), json);
        return;
      } catch {
        // fall through and try local disk as a best-effort backup
      }
    }
  }

  ensureCacheDir();
  try {
    fs.writeFileSync(keyToFile(key), json, "utf-8");
  } catch {
    // best-effort cache write; ingestion should still succeed without it
  }
}

export async function cacheAgeLabel(key: string): Promise<string | null> {
  if (blobsAvailable()) {
    const s = getBlobStore();
    if (s) {
      try {
        const raw = await s.get(safeKey(key), { type: "text" });
        if (raw) {
          const envelope: CacheEnvelope<unknown> = JSON.parse(raw);
          return new Date(envelope.cachedAt).toISOString();
        }
      } catch {
        // fall through
      }
    }
  }

  const file = keyToFile(key);
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf-8");
    const envelope: CacheEnvelope<unknown> = JSON.parse(raw);
    return new Date(envelope.cachedAt).toISOString();
  } catch {
    return null;
  }
}
