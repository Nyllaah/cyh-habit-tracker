export type DistanceUnit = "metric" | "miles";
export const METERS_PER_MILE = 1609.344;

export function formatDistance(meters: number, unit: DistanceUnit): string {
  const value = unit === "metric" ? meters / 1000 : meters / METERS_PER_MILE;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} ${unit === "metric" ? "km" : "mi"}`;
}

export function entryValue(meters: number, unit: DistanceUnit): string {
  return unit === "metric" ? String(meters) : (meters / METERS_PER_MILE).toFixed(3).replace(/\.?0+$/, "");
}

export function formatImportedDistance(meters: number, unit: DistanceUnit): string {
  return unit === "metric"
    ? `${new Intl.NumberFormat("en-US").format(meters)} m`
    : `${entryValue(meters, unit)} mi`;
}

export function parseDistanceEntry(value: string, unit: DistanceUnit, originalMeters: number): number | null {
  const normalized = value.trim().replace(",", ".");
  const valid = unit === "metric" ? /^\d+$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!valid.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  // Preserve the exact stored value when a rounded miles entry is unchanged.
  if (amount === Number(entryValue(originalMeters, unit))) return originalMeters;
  const meters = Math.round(amount * (unit === "miles" ? METERS_PER_MILE : 1));
  return Number.isSafeInteger(meters) ? meters : null;
}
