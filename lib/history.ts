import { effectiveMeters, type Day } from "./journey.ts";

export const distanceColors = ["#C9E9D9", "#9ED5BA", "#CFDF95", "#EDCD7B", "#EF9A59", "#E87C3B"];
export type ActivityCell = { date: string; status: "recorded" | "unrecorded" | "future"; meters: number | null; band: number | null };

// Records already carry local calendar dates. UTC arithmetic keeps date-only
// navigation independent of the browser timezone and daylight-saving changes.
function dateObject(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

function dateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(date: string, count: number): string {
  const value = dateObject(date);
  value.setUTCDate(value.getUTCDate() + count);
  return dateKey(value);
}

export function shiftMonth(date: string, count: number): string {
  const value = dateObject(date);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + count);
  const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, last));
  return dateKey(value);
}

export function weekdayIndex(date: string): number {
  return (dateObject(date).getUTCDay() + 6) % 7; // Monday first, matching the design.
}

export function monthDates(date: string): string[] {
  const first = `${date.slice(0, 7)}-01`;
  const length = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate();
  return Array.from({ length }, (_, index) => addDays(first, index));
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(dateObject(date));
}

export function distanceBand(meters: number, maximum: number): number | null {
  if (meters <= 0 || maximum <= 0) return null;
  return Math.min(distanceColors.length - 1, Math.ceil(meters / maximum * distanceColors.length) - 1);
}

export function periodActivity(dates: string[], days: Day[], today: string): ActivityCell[] {
  const records = new Map(days.map((day) => [day.date, effectiveMeters(day)]));
  const maximum = Math.max(0, ...dates.filter((date) => date <= today).map((date) => records.get(date) ?? 0));
  return dates.map((date) => {
    const meters = records.get(date);
    if (date > today) return { date, status: "future", meters: null, band: null };
    if (meters === undefined) return { date, status: "unrecorded", meters: null, band: null };
    return { date, status: "recorded", meters, band: distanceBand(meters, maximum) };
  });
}

export type HistoryView = "month" | "year";

export function yearDates(date: string): string[] {
  const year = date.slice(0, 4);
  const length = monthDates(`${year}-02-01`).length === 29 ? 366 : 365;
  return Array.from({ length }, (_, index) => addDays(`${year}-01-01`, index));
}

// Only year-boundary padding is empty; month boundaries never restart a week.
export function yearColumns(date: string): (string | null)[][] {
  const dates = yearDates(date);
  const offset = weekdayIndex(dates[0]);
  return Array.from({ length: Math.ceil((offset + dates.length) / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => dates[week * 7 + weekday - offset] ?? null));
}

export function navigateHistory(date: string, key: string, view: HistoryView): string | null {
  switch (key) {
    case "ArrowLeft": return addDays(date, -1);
    case "ArrowRight": return addDays(date, 1);
    case "ArrowUp": return addDays(date, -7);
    case "ArrowDown": return addDays(date, 7);
    case "Home": return addDays(date, -weekdayIndex(date));
    case "End": return addDays(date, 6 - weekdayIndex(date));
    case "PageUp": return shiftMonth(date, view === "year" ? -12 : -1);
    case "PageDown": return shiftMonth(date, view === "year" ? 12 : 1);
    default: return null;
  }
}
