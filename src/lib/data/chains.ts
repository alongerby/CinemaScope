import type { CinemaChain } from "@/lib/types";

// Only chains we ingest real, live data for (real theaters, showtimes, and
// per-showtime booking links via each chain's own public ticketing API).
export const CINEMA_CHAINS: CinemaChain[] = [
  { id: "cinema-city", name: "Cinema City", nameHe: "סינמה סיטי", website: "https://www.cinema-city.co.il", color: "#e02020" },
  { id: "yes-planet", name: "Yes Planet", nameHe: "יס פלאנט", website: "https://www.planetcinema.co.il", color: "#0057b8" },
  { id: "rav-hen", name: "Rav-Hen", nameHe: "רב חן", website: "https://www.rav-hen.co.il", color: "#7b2ff7" },
  { id: "movieland", name: "Movieland", nameHe: "מובילנד", website: "https://www.movieland.co.il", color: "#c9932a" },
  { id: "hot-cinema", name: "Hot Cinema", nameHe: "הוט סינמה", website: "https://www.hotcinema.co.il", color: "#e6007e" },
];

export function getChainById(id: string) {
  return CINEMA_CHAINS.find((c) => c.id === id);
}
