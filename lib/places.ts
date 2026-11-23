export type Place = {
  id: string;
  name: string;
  region: string;
  country?: string;
  latitude: number;
  longitude: number;
  artwork?: string;
};

export type City = Place & { cumulativeMeters: number };

const regionCodes: Record<string, string> = {
  "District of Columbia": "DC", Virginia: "VA", "New York": "NY",
  "New Jersey": "NJ", Massachusetts: "MA", Washington: "WA", California: "CA",
  "Federal District": "DF", "Distrito Federal": "DF", Goiás: "GO",
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
  return distinctPlaces(candidates).filter((place) => placeKey(place) !== placeKey(origin))
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
    const fullRegion = Object.keys(regionCodes).find((name) => regionCodes[name] === place.region) ?? "";
    const searchable = normalized(`${place.name} ${place.region} ${fullRegion} ${place.country ?? ""}`);
    return tokens.every((token) => searchable.includes(token));
  });
}

// Preserve the route prefix; add the nearest unvisited place only when needed.
export function extendRoute(route: City[], candidates: Place[], meters: number): City[] {
  const extended = [...route];
  const visited = new Set(route.map(placeKey));
  while (extended.filter((city) => city.cumulativeMeters > meters).length < 2) {
    const last = extended[extended.length - 1];
    if (!last) break;
    const next = nearbyPlaces(last, candidates.filter((place) => !visited.has(placeKey(place))))[0];
    if (!next) break;
    extended.push({ ...next, cumulativeMeters: last.cumulativeMeters + distanceMeters(last, next) });
    visited.add(placeKey(next));
  }
  return extended;
}

export function routeFromOrigin(origin: Place, candidates: Place[], meters: number): City[] {
  return extendRoute([{ ...origin, cumulativeMeters: 0 }], candidates, meters);
}

export function routeWindow(route: City[], meters: number): City[] {
  const next = route.findIndex((city, index) => index > 0 && city.cumulativeMeters > meters);
  const start = Math.max(0, Math.min(route.length - 3, (next === -1 ? route.length - 1 : next) - 2));
  return route.slice(start, start + 3);
}

export function passportPreview(route: City[], meters: number): City[] {
  const reached = route.slice(1).filter((city) => city.cumulativeMeters <= meters);
  const future = route.slice(1).filter((city) => city.cumulativeMeters > meters);
  return [route[0], ...reached.slice(-1), ...future].filter(Boolean).slice(0, 3);
}

export function cityArtwork(place: Place): string {
  const known = ["washington", "alexandria", "occoquan", "fredericksburg", "richmond", "brasilia", "goiania"];
  return known.includes(place.artwork ?? place.id) ? (place.artwork ?? place.id) : "generic-city";
}
