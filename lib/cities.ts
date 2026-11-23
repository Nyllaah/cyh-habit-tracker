import municipalities from "../data/brazil-municipalities.json" with { type: "json" };
import { placeCountry } from "./countries.ts";
import { distinctPlaces, nearbyPlaces, placeKey, regionCode, searchLocalPlaces, type Place } from "./places.ts";

function municipalityKey(name: string, state: string): string {
  return `${state}|${name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}|]/gu, "");
}

// Photon also labels DF administrative regions as city/town. Match municipality
// name AND state so Cruzeiro, SP remains valid while Cruzeiro, DF is rejected.
const brazilianMunicipalities = new Set(Object.entries(municipalities.municipalitiesByState)
  .flatMap(([state, names]) => names.map((name) => municipalityKey(name, state))));

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
    const geometry = object(record?.geometry);
    const coordinates = geometry?.coordinates;
    if (properties?.osm_key !== "place" || !["city", "town"].includes(String(properties.osm_value))) continue;
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
    if (placeCountry(place) === "BR" && !brazilianMunicipalities.has(municipalityKey(place.name, place.region))) continue;
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
