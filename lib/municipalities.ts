import brazil from "../data/brazil-municipalities.json" with { type: "json" };
import unitedStates from "../data/us-municipalities.json" with { type: "json" };
import { placeCountry } from "./countries.ts";
import { distanceMeters, regionCode, type Place } from "./places.ts";

function municipalityKey(name: string, state: string): string {
  return `${state}|${name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}|]/gu, "");
}

function nameIndex(states: Record<string, string[]>): Set<string> {
  return new Set(Object.entries(states).flatMap(([state, names]) => names.map((name) => municipalityKey(name, state))));
}

const brazilianMunicipalities = nameIndex(brazil.municipalitiesByState);
const usMunicipalities = nameIndex(unitedStates.municipalitiesByState);
type Reference = (typeof unitedStates.ambiguousPlaces)[number];
const ambiguousUSNames = new Map<string, Reference[]>();
for (const place of unitedStates.ambiguousPlaces) {
  const key = municipalityKey(place.name, place.state);
  ambiguousUSNames.set(key, [...(ambiguousUSNames.get(key) ?? []), place]);
}

export function isMunicipality(place: Place): boolean {
  const key = municipalityKey(place.name, regionCode(place.region));
  const country = placeCountry(place);
  if (country === "BR") return brazilianMunicipalities.has(key);
  if (country !== "US") return true; // Other countries still use the provider city/town filter.
  if (!usMunicipalities.has(key)) return false;
  const references = ambiguousUSNames.get(key);
  if (!references) return true;
  // Same-state names can describe both a municipality and an unrelated CDP.
  // Prefer the nearest Census reference; municipal entries win exact ties.
  return references.reduce((nearest, candidate) => distanceMeters(place, candidate) < distanceMeters(place, nearest) ? candidate : nearest).municipality;
}
