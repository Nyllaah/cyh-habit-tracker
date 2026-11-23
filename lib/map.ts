import { legProgress, type City } from "./journey.ts";

// The route is virtual: interpolate between city centers, not along roads.
export function journeyPosition(route: City[], meters: number): { latitude: number; longitude: number } {
  const end = route.findIndex((city, index) => index > 0 && city.cumulativeMeters > meters);
  if (end === -1) return route[route.length - 1];
  const start = route[end - 1];
  const progress = legProgress(route, meters, end);
  return {
    latitude: start.latitude + (route[end].latitude - start.latitude) * progress,
    longitude: start.longitude + (route[end].longitude - start.longitude) * progress,
  };
}

// Ray casting lets coordinate-only GPS origins pick an offline country outline.
export function insideRing(longitude: number, latitude: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > latitude) !== (yj > latitude) && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
