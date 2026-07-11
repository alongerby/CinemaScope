import type { Amenity, AccessibilityFeature } from "@/lib/types";

export const AMENITIES: Amenity[] = [
  { id: "parking", label: "Parking on site", labelHe: "חניה במקום", icon: "🅿️" },
  { id: "food-court", label: "Food court", labelHe: "פודקורט", icon: "🍔" },
  { id: "bar", label: "Bar", labelHe: "בר", icon: "🍹" },
  { id: "recliner-seats", label: "Recliner seats", labelHe: "כורסאות הרפיה", icon: "🛋️" },
  { id: "dolby-atmos", label: "Dolby Atmos sound", labelHe: "סאונד דולבי אטמוס", icon: "🔊" },
  { id: "mall-access", label: "Inside a shopping mall", labelHe: "בתוך קניון", icon: "🛍️" },
  { id: "kids-area", label: "Kids play area", labelHe: "אזור משחקים לילדים", icon: "🧸" },
  { id: "vip-lounge", label: "VIP lounge", labelHe: "טרקלין VIP", icon: "🥂" },
];

export const ACCESSIBILITY_FEATURES: AccessibilityFeature[] = [
  { id: "wheelchair", label: "Wheelchair accessible", labelHe: "נגיש לכיסאות גלגלים" },
  { id: "hearing-assist", label: "Hearing assistance devices", labelHe: "מכשירי סיוע לשמיעה" },
  { id: "audio-description", label: "Audio description available", labelHe: "תיאור קולי זמין" },
  { id: "subtitles-assist", label: "Closed captions available", labelHe: "כתוביות סגורות זמינות" },
  { id: "accessible-parking", label: "Accessible parking spots", labelHe: "חניית נכים" },
  { id: "accessible-restroom", label: "Accessible restrooms", labelHe: "שירותים נגישים" },
];

export function getAmenityById(id: string) {
  return AMENITIES.find((a) => a.id === id);
}

export function getAccessibilityById(id: string) {
  return ACCESSIBILITY_FEATURES.find((a) => a.id === id);
}
