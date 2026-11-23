import { nextCity, type City } from "./journey.ts";

// Walking expands a radius; the center never advances to an unlocked city.
export function reachGeometry(route: City[], meters: number): { center: [number, number]; radius: number; nextLine: [number, number][] } {
  const origin = route[0];
  const center: [number, number] = [origin.latitude, origin.longitude];
  const next = nextCity(route, meters);
  return { center, radius: Math.max(0, meters), nextLine: next ? [center, [next.latitude, next.longitude]] : [] };
}
