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
