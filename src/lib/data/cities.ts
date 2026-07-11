import type { City } from "@/lib/types";

// Every city that hosts a real cinema branch we ingest. Coordinates are the
// city center (used only for grouping/labels — the app no longer does distance
// or precise mapping). Kept broad so no real theater is ever orphaned.
export const CITIES: City[] = [
  { id: "tel-aviv", name: "Tel Aviv", nameHe: "תל אביב", lat: 32.0853, lng: 34.7818, region: "center" },
  { id: "jerusalem", name: "Jerusalem", nameHe: "ירושלים", lat: 31.7683, lng: 35.2137, region: "jerusalem" },
  { id: "haifa", name: "Haifa", nameHe: "חיפה", lat: 32.794, lng: 34.9896, region: "north" },
  { id: "rishon-lezion", name: "Rishon LeZion", nameHe: "ראשון לציון", lat: 31.9635, lng: 34.8044, region: "center" },
  { id: "beer-sheva", name: "Be'er Sheva", nameHe: "באר שבע", lat: 31.2518, lng: 34.7913, region: "south" },
  { id: "herzliya", name: "Herzliya", nameHe: "הרצליה", lat: 32.1624, lng: 34.8447, region: "center" },
  { id: "ramat-gan", name: "Ramat Gan", nameHe: "רמת גן", lat: 32.0684, lng: 34.8248, region: "center" },
  { id: "ramat-hasharon", name: "Ramat HaSharon", nameHe: "רמת השרון", lat: 32.1462, lng: 34.8394, region: "center" },
  { id: "petah-tikva", name: "Petah Tikva", nameHe: "פתח תקווה", lat: 32.0917, lng: 34.8878, region: "center" },
  { id: "netanya", name: "Netanya", nameHe: "נתניה", lat: 32.3215, lng: 34.8532, region: "sharon" },
  { id: "hadera", name: "Hadera", nameHe: "חדרה", lat: 32.4340, lng: 34.9196, region: "north" },
  { id: "zichron-yaakov", name: "Zichron Ya'akov", nameHe: "זכרון יעקב", lat: 32.5717, lng: 34.9515, region: "north" },
  { id: "karmiel", name: "Karmiel", nameHe: "כרמיאל", lat: 32.9186, lng: 35.2952, region: "north" },
  { id: "afula", name: "Afula", nameHe: "עפולה", lat: 32.6078, lng: 35.2897, region: "north" },
  { id: "nahariya", name: "Nahariya", nameHe: "נהריה", lat: 33.0085, lng: 35.0980, region: "north" },
  { id: "kiryat-bialik", name: "Kiryat Bialik", nameHe: "קרית ביאליק", lat: 32.8300, lng: 35.0870, region: "north" },
  { id: "ashkelon", name: "Ashkelon", nameHe: "אשקלון", lat: 31.6688, lng: 34.5743, region: "south" },
  { id: "rehovot", name: "Rehovot", nameHe: "רחובות", lat: 31.8942, lng: 34.8092, region: "center" },
  { id: "ashdod", name: "Ashdod", nameHe: "אשדוד", lat: 31.8014, lng: 34.6435, region: "south" },
  { id: "holon", name: "Holon", nameHe: "חולון", lat: 32.0158, lng: 34.7874, region: "center" },
  { id: "kfar-saba", name: "Kfar Saba", nameHe: "כפר סבא", lat: 32.175, lng: 34.9069, region: "sharon" },
  { id: "modiin", name: "Modi'in", nameHe: "מודיעין", lat: 31.8969, lng: 35.0095, region: "center" },
  { id: "givatayim", name: "Givatayim", nameHe: "גבעתיים", lat: 32.0684, lng: 34.8125, region: "center" },
  { id: "kiryat-ono", name: "Kiryat Ono", nameHe: "קרית אונו", lat: 32.0554, lng: 34.859, region: "center" },
];

export function getCityById(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}

/** Match an API-provided Hebrew city name to a known city id. */
export function cityIdByHebrewName(nameHe: string): string | undefined {
  const trimmed = nameHe.trim();
  return CITIES.find((c) => c.nameHe === trimmed)?.id;
}
