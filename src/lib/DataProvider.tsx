"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Movie, Screening, Theater } from "@/lib/types";
import { LoadingState } from "@/components/states/LoadingState";
import { ErrorState } from "@/components/states/ErrorState";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// After this long, swap to a "still working" message — reassurance for the
// rare cold-start case where ingestion actually takes the full ~15s.
const SLOW_LOAD_THRESHOLD_MS = 5000;

/**
 * The whole dataset (movies, theaters, screenings) is fetched from
 * /api/dataset ONCE per browser tab session and cached in a module-level
 * variable — every page reads it from this context instead of fetching its
 * own data, so switching tabs is instant and a given tab never re-fetches
 * until it's fully reloaded. The one-time fetch itself still costs whatever
 * the first real ingestion takes; after that, /api/dataset is served from
 * the server's own 24h cache, so re-opening a new tab is fast too.
 */

export interface AppData {
  movies: Movie[];
  theaters: Theater[];
  screenings: Screening[];
}

const DataContext = createContext<AppData | null>(null);

// Module-level — persists for the lifetime of the tab's JS runtime (i.e. the
// "session"), shared across every mount of DataProvider (there's only one,
// but this also protects against React StrictMode's double-invoke in dev).
let sessionFetch: Promise<AppData> | null = null;

function fetchDataset(): Promise<AppData> {
  if (!sessionFetch) {
    sessionFetch = fetch("/api/dataset")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/dataset returned ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        sessionFetch = null; // allow retry on failure instead of caching the rejection forever
        throw err;
      });
  }
  return sessionFetch;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDataset()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (data || error) return;
    const timer = setTimeout(() => setSlow(true), SLOW_LOAD_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, [data, error]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <ErrorState
          onRetry={() => {
            sessionFetch = null;
            setError(false);
            setData(null);
            setSlow(false);
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <LoadingState
          rows={6}
          title={t("common.loadingDataTitle")}
          description={slow ? t("common.loadingDataSlowDescription") : t("common.loadingDataDescription")}
        />
      </div>
    );
  }

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

export function useData(): AppData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
