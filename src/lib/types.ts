/**
 * Core domain types shared across providers, API routes, and UI.
 * Every provider normalizes its raw output into these shapes before it
 * enters the app. All screening data is real/live — pulled from each chain's
 * own public ticketing API — so fields the source doesn't expose are left
 * optional and simply not shown, rather than guessed.
 */

export type SourceType = "live" | "scraped" | "cached" | "demo";

export type ScreenFormat = "2D" | "3D" | "IMAX" | "VIP" | "4DX";

export type AudioTrack = "hebrew" | "english" | "russian" | "arabic" | "other";

export type SubtitleTrack = "hebrew" | "english" | "none" | "arabic" | "russian";

export type PrintKind = "dubbed" | "subtitled" | "original";

export type CinemaChainId = "cinema-city" | "yes-planet" | "rav-hen" | "movieland" | "hot-cinema";

export interface CinemaChain {
  id: CinemaChainId;
  name: string;
  nameHe: string;
  website?: string;
  color: string; // brand accent used for badges
}

export interface City {
  id: string;
  name: string;
  nameHe: string;
  lat: number;
  lng: number;
  region: string;
}

export interface Amenity {
  id: string;
  label: string;
  labelHe: string;
  icon: string; // simple keyword mapped to an emoji/icon in UI
}

export interface AccessibilityFeature {
  id: string;
  label: string;
  labelHe: string;
}

export interface Theater {
  id: string;
  name: string;
  nameHe: string;
  chainId: CinemaChainId;
  cityId: string;
  /** Display city name from the source, used as a fallback if cityId isn't in the static city list. */
  cityNameHe?: string;
  address: string;
  addressHe: string;
  lat: number;
  lng: number;
  amenities: string[]; // Amenity ids
  accessibility: string[]; // AccessibilityFeature ids
  parkingNotes?: string;
  parkingNotesHe?: string;
  transitNotes?: string;
  transitNotesHe?: string;
  openingHours: { day: string; hours: string }[];
  phone?: string;
  screenCount: number;
  /** Real per-branch page on the chain's official site, when known (falls back to the chain's homepage otherwise). */
  officialUrl?: string;
  sourceType: SourceType;
  lastUpdated: string; // ISO date
}

export interface Movie {
  id: string;
  title: string; // English/Latin title when available, else same as titleHe
  titleHe: string;
  genre: string[];
  genreHe: string[];
  runtimeMinutes: number;
  ageRating: string; // e.g. "PG", "16+"
  synopsis: string;
  synopsisHe: string;
  posterColor: string; // used for the placeholder poster gradient
  posterUrl?: string; // real poster image, when a provider actually has one
  releaseYear: number;
  familyFriendly: boolean;
  trailerUrl?: string;
  popularityScore: number; // 0-100, used for "most popular" sort
  originalLanguage: AudioTrack;
  sourceType: SourceType;
}

export interface Screening {
  id: string;
  movieId: string;
  theaterId: string;
  chainId: CinemaChainId;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm 24h
  // Optional: only present when the source actually exposes them. Never guessed.
  format?: ScreenFormat;
  audio?: AudioTrack;
  subtitles?: SubtitleTrack;
  printKind?: PrintKind;
  bookingUrl: string; // real per-showtime booking link on the chain's own ticketing system
  sourceType: SourceType;
  lastUpdated: string; // ISO date
}

/** Enriched screening with joined theater/movie data + computed distance, for UI consumption. */
export interface EnrichedScreening extends Screening {
  movie: Movie;
  theater: Theater;
  chain: CinemaChain;
  city: City;
  distanceKm?: number;
}

export interface ProviderImportResult {
  providerId: string;
  providerName: string;
  sourceType: SourceType;
  success: boolean;
  moviesImported: number;
  theatersImported: number;
  screeningsImported: number;
  warnings: string[];
  errors: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface ProviderStatusSnapshot {
  providerId: string;
  providerName: string;
  sourceType: SourceType;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastResult: ProviderImportResult | null;
  isEnabled: boolean;
  priority: number;
}

export interface NormalizedDataset {
  movies: Movie[];
  theaters: Theater[];
  screenings: Screening[];
}

export interface GeoPoint {
  lat: number;
  lng: number;
}
