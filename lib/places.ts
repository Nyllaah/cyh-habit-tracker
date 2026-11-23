import { placeCountry } from "./countries.ts";
import capitals from "../data/capitals.json" with { type: "json" };

export type Place = {
  id: string;
  name: string;
  region: string;
  country?: string;
  latitude: number;
  longitude: number;
  artwork?: string;
};

export type City = Place & { distanceFromOriginMeters: number };

const regionCodes: Record<string, string> = {
  ...Object.fromEntries(capitals.capitals.map((capital) => [capital.regionName, capital.region])),
  "Federal District": "DF",
};

export function regionCode(region: string): string {
  return Object.hasOwn(regionCodes, region) ? regionCodes[region] : region;
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function placeKey(place: Place): string {
  if (place.id.startsWith("location-")) return `coordinates|${place.latitude.toFixed(4)}|${place.longitude.toFixed(4)}`;
  return [place.name, regionCode(place.region), place.country ?? "US"].map(normalized).join("|");
}

export function capitalKind(place: Place): "national" | "state" | null {
  const country = placeCountry(place);
  const region = normalized(regionCode(place.region));
  const name = normalized(place.name);
  const capital = capitals.capitals.find((capital) => capital.country === country && normalized(capital.region) === region
    && [capital.name, ...(capital.aliases ?? [])].some((alias) => normalized(alias) === name));
  return capital?.kind === "national" ? "national" : capital ? "state" : null;
}

export function distinctPlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = placeKey(place);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function distanceMeters(a: Pick<Place, "latitude" | "longitude">, b: Pick<Place, "latitude" | "longitude">): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}

export function nearbyPlaces(origin: Place, candidates: Place[]): Place[] {
  const country = placeCountry(origin);
  return distinctPlaces(candidates).filter((place) => placeKey(place) !== placeKey(origin) && placeCountry(place) === country)
    .map((place) => ({ place, distance: distanceMeters(origin, place) }))
    .filter(({ distance }) => distance >= 1000 && distance <= 250000)
    .sort((a, b) => a.distance - b.distance || placeKey(a.place).localeCompare(placeKey(b.place)))
    .map(({ place }) => place);
}

export function searchLocalPlaces(places: Place[], query: string): Place[] {
  const words = normalized(query.replace(/,/g, " "));
  if (!words) return places;
  // Match each word independently so city/state queries work with short codes.
  const tokens = query.toLowerCase().split(/[\s,]+/).filter(Boolean).map(normalized);
  return places.filter((place) => {
    const fullRegion = capitals.capitals.find((capital) => capital.region === place.region && capital.country === placeCountry(place))?.regionName ?? "";
    const searchable = normalized(`${place.name} ${place.region} ${fullRegion} ${place.country ?? ""}`);
    return tokens.every((token) => searchable.includes(token));
  });
}

// Every checkpoint is measured independently from the chosen origin. Adding a
// closer city can change display order, but never another city's threshold.
export function extendRoute(route: City[], candidates: Place[], meters = 0, upcomingCount = 2): City[] {
  const origin = route[0];
  if (!origin) return [];
  const country = placeCountry(origin);
  const ranked = distinctPlaces([...route.slice(1), ...candidates])
    .filter((place) => placeKey(place) !== placeKey(origin) && placeCountry(place) === country)
    .map((place) => ({ ...place, distanceFromOriginMeters: distanceMeters(origin, place) }))
    .filter((place) => place.distanceFromOriginMeters >= 1000)
    .sort((a, b) => a.distanceFromOriginMeters - b.distanceFromOriginMeters || placeKey(a).localeCompare(placeKey(b)));
  const known = new Set(route.slice(1).map(placeKey));
  // All discovered cities inside the radius unlock, even if they were not in
  // the preview. Only future suggestions are limited to incremental batches.
  const chosen = ranked.filter((city) => known.has(placeKey(city)) || city.distanceFromOriginMeters <= meters);
  const futureCount = chosen.filter((city) => city.distanceFromOriginMeters > meters).length;
  const target = Math.max(2, Math.min(futureCount + 12, Math.floor(upcomingCount)));
  const remaining = ranked.filter((city) => !known.has(placeKey(city)) && city.distanceFromOriginMeters > meters);
  chosen.push(...remaining.slice(0, Math.max(0, target - futureCount)));
  chosen.sort((a, b) => a.distanceFromOriginMeters - b.distanceFromOriginMeters || placeKey(a).localeCompare(placeKey(b)));
  return [{ ...origin, distanceFromOriginMeters: 0 }, ...chosen];
}

export function routeFromOrigin(origin: Place, candidates: Place[], meters = 0): City[] {
  return extendRoute([{ ...origin, distanceFromOriginMeters: 0 }], candidates, meters);
}

// Keep the origin in the frame even after several cities have been unlocked.
export function routeWindow(route: City[], meters: number): City[] {
  if (!route.length) return [];
  const upcoming = route.slice(1).filter((city) => city.distanceFromOriginMeters > meters);
  return [route[0], ...(upcoming.length ? upcoming.slice(0, 2) : route.slice(-2).filter((city) => city !== route[0]))];
}

export function passportPreview(route: City[], meters: number): City[] {
  const reached = route.slice(1).filter((city) => city.distanceFromOriginMeters <= meters);
  const future = route.slice(1).filter((city) => city.distanceFromOriginMeters > meters);
  return [route[0], ...reached.slice(-1), ...future].filter(Boolean).slice(0, 3);
}

export function cityArtwork(place: Place): string {
  const known = ["washington", "alexandria", "occoquan", "fredericksburg", "richmond", "brasilia", "goiania"];
  return known.includes(place.artwork ?? place.id) ? (place.artwork ?? place.id) : "generic-city";
}
