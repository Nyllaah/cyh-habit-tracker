import { isMunicipality } from "./municipalities.ts";
import { distinctPlaces, extendRoute, nearbyPlaces, placeKey, regionCode, searchLocalPlaces, type City, type Place } from "./places.ts";

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function normalizeCities(data: unknown, catalog: Place[]): Place[] {
  const features = object(data)?.features;
  if (!Array.isArray(features)) return [];
  const places: Place[] = [];
  for (const feature of features) {
    const record = object(feature);
    const properties = object(record?.properties);
    if (!properties) continue;
    const geometry = object(record?.geometry);
    const coordinates = geometry?.coordinates;
    const country = String(properties?.countrycode).toUpperCase();
    const registryCountry = country === "BR" || country === "US";
    const municipalRecord = registryCountry && properties?.type === "city"
      && ((properties.osm_key === "place" && properties.osm_value === "municipality")
        || (properties.osm_key === "boundary" && properties.osm_value === "administrative"));
    const settlementTypes = String(properties.countrycode).toUpperCase() === "US" ? ["city", "town", "village"] : ["city", "town"];
    if (!municipalRecord && (properties?.osm_key !== "place" || !settlementTypes.includes(String(properties.osm_value)))) continue;
    if (typeof properties.name !== "string" || !properties.name.trim() || geometry?.type !== "Point" || !Array.isArray(coordinates)) continue;
    const [longitude, latitude] = coordinates;
    if (typeof longitude !== "number" || typeof latitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const place: Place = {
      id: `osm-${properties.osm_type}-${properties.osm_id}`,
      name: properties.name.trim(),
      region: regionCode(typeof properties.state === "string" ? properties.state : typeof properties.country === "string" ? properties.country : ""),
      country: typeof properties.countrycode === "string" ? properties.countrycode.toUpperCase() : "",
      latitude, longitude,
    };
    if (!isMunicipality(place)) continue;
    if (properties.osm_id === undefined || properties.osm_type === undefined) place.id = `place-${placeKey(place)}`;
    // Reuse sample identity and artwork when the provider returns a known place.
    places.push(catalog.find((known) => placeKey(known) === placeKey(place)) ?? place);
  }
  return distinctPlaces(places);
}

async function requestCities(url: URL, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 4000);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error("City service unavailable");
    return await response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function cityUrl(path: string): URL {
  const url = new URL(path, "https://photon.komoot.io");
  url.searchParams.set("layer", "city");
  url.searchParams.set("lang", "en");
  return url;
}

export async function searchCities(query: string, catalog: Place[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ places: Place[]; saved: boolean }> {
  const local = searchLocalPlaces(catalog, query);
  if (query.trim().length < 2) return { places: local, saved: true };
  const url = cityUrl("/api/");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "8");
  try {
    const places = normalizeCities(await requestCities(url, signal, fetcher), catalog);
    return { places: distinctPlaces([...places, ...local]), saved: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { places: local, saved: true };
  }
}

export async function discoverNearby(origin: Place, catalog: Place[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<Place[]> {
  const local = nearbyPlaces(origin, catalog);
  const url = cityUrl("/reverse");
  url.searchParams.set("lat", String(origin.latitude));
  url.searchParams.set("lon", String(origin.longitude));
  url.searchParams.set("radius", "100");
  url.searchParams.set("limit", "20");
  try {
    const places = normalizeCities(await requestCities(url, signal, fetcher), catalog);
    return nearbyPlaces(origin, [...places, ...local]);
  } catch (error) {
    if (signal?.aborted) throw error;
    return local;
  }
}

// Explore from the itinerary end as well as the visible map. A larger bounded
// result set helps avoid returning only cities already in the route.
async function routeCityResult(origin: Place, catalog: Place[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<MapCityResult> {
  const url = cityUrl("/reverse");
  url.searchParams.set("lat", String(origin.latitude));
  url.searchParams.set("lon", String(origin.longitude));
  url.searchParams.set("radius", "250");
  url.searchParams.set("limit", "100");
  try {
    return { places: nearbyPlaces(origin, [...normalizeCities(await requestCities(url, signal, fetcher), catalog), ...catalog]), source: "network" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { places: nearbyPlaces(origin, catalog), source: "local" };
  }
}

export async function discoverRouteCities(origin: Place, catalog: Place[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<Place[]> {
  return (await routeCityResult(origin, catalog, signal, fetcher)).places;
}

// Photon caps nearest results; a larger radius alone may repeat the same
// visited cities. Only when a successful lookup cannot extend this route,
// probe four nearby centers once. Do not fan out after a service failure.
export async function discoverNextCities(route: City[], catalog: Place[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<Place[]> {
  const tail = route.at(-1);
  if (!tail) return [];
  const found = await routeCityResult(tail, catalog, signal, fetcher);
  if (found.source === "local" || extendRoute(route, found.places, 0, route.length).length > route.length) return found.places;
  const latitudeStep = 60 / 111.2;
  const longitudeStep = latitudeStep / Math.max(.1, Math.cos(tail.latitude * Math.PI / 180));
  const centers = [[latitudeStep, 0], [-latitudeStep, 0], [0, longitudeStep], [0, -longitudeStep]];
  const results = await Promise.all(centers.map(([latitude, longitude]) => routeCityResult({ ...tail,
    latitude: Math.max(-89.9, Math.min(89.9, tail.latitude + latitude)),
    longitude: ((tail.longitude + longitude + 540) % 360) - 180,
  }, catalog, signal, fetcher)));
  return nearbyPlaces(tail, [...found.places, ...results.flatMap((result) => result.places)]);
}

export function readStartingLocation(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation || !window.isSecureContext) {
      reject(new Error("Location unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve({
      id: `location-${coords.latitude.toFixed(4)}-${coords.longitude.toFixed(4)}`,
      name: "Current location", region: "", country: "",
      latitude: coords.latitude, longitude: coords.longitude,
    }), reject, { timeout: 8000, maximumAge: 300000 });
  });
}

export type MapCityView = {
  latitude: number;
  longitude: number;
  south: number;
  west: number;
  north: number;
  east: number;
  radiusKm: number;
  country: string;
};

export function citiesInView(places: Place[], view: MapCityView): Place[] {
  const width = view.east - view.west;
  const west = ((view.west + 180) % 360 + 360) % 360 - 180;
  return distinctPlaces(places).filter((place) => place.country === view.country
    && place.latitude >= view.south && place.latitude <= view.north
    && (width >= 360 || (place.longitude - west + 360) % 360 <= width));
}

export type MapCityResult = { places: Place[]; source: "network" | "local" };

export async function discoverMapCities(view: MapCityView, catalog: Place[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<MapCityResult> {
  const local = citiesInView(catalog, view);
  const url = cityUrl("/reverse");
  url.searchParams.set("lat", String(view.latitude));
  url.searchParams.set("lon", String(((view.longitude + 180) % 360 + 360) % 360 - 180));
  url.searchParams.set("radius", String(Math.min(500, Math.max(5, view.radiusKm))));
  url.searchParams.set("limit", "40");
  try {
    return { places: citiesInView([...normalizeCities(await requestCities(url, signal, fetcher), catalog), ...local], view), source: "network" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { places: local, source: "local" };
  }
}
