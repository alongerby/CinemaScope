"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Favorite cinemas, persisted in localStorage and shared across every
 * component in the tab via a tiny external store (so toggling a star in one
 * place updates all the others instantly).
 */

const KEY = "cinemascope.favorites";
const EMPTY: string[] = [];

let favorites: string[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    favorites = raw ? (JSON.parse(raw) as string[]) : EMPTY;
  } catch {
    favorites = EMPTY;
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  // First subscriber loads from storage and notifies, so SSR/first render
  // shows the empty (server) snapshot and hydration stays consistent.
  load();
  emit();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      try {
        favorites = e.newValue ? (JSON.parse(e.newValue) as string[]) : EMPTY;
      } catch {
        favorites = EMPTY;
      }
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function toggleFavorite(id: string) {
  load();
  favorites = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(favorites));
  } catch {
    // ignore quota/storage errors
  }
  emit();
}

export function useFavorites() {
  const list = useSyncExternalStore(
    subscribe,
    () => favorites,
    () => EMPTY,
  );
  const isFavorite = useCallback((id: string) => list.includes(id), [list]);
  return { favorites: list, isFavorite, toggle: toggleFavorite };
}
