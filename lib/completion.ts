import brazil from "../data/brazil-municipalities.json" with { type: "json" };
import unitedStates from "../data/us-municipalities.json" with { type: "json" };
import capitals from "../data/capitals.json" with { type: "json" };
import { isMunicipality } from "./municipalities.ts";
import { regionCode, type Place } from "./places.ts";
import { placeCountry, countryName } from "./countries.ts";

export type CompletionBadge = {
  id: string;
  kind: "state" | "district" | "country";
  country: string;
  region?: string;
  name: string;
  completed: number;
  total: number;
  earned: boolean;
  supported: boolean;
};
export type CountryCompletion = { country: CompletionBadge; regions: CompletionBadge[] };

const registries: Record<string, Record<string, string[]>> = {
  BR: brazil.municipalitiesByState,
  US: unitedStates.municipalitiesByState,
};
function normalized(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
const massachusettsNames = new Set(unitedStates.municipalitiesByState.MA.map(normalized));
function cityIdentity(country: string, region: string, name: string): string {
  // Census Town-city names retain short aliases in the search registry. They
  // describe one municipality and must not create two completion requirements.
  const shortName = name.replace(/ Town$/, "");
  if (country === "US" && region === "MA" && massachusettsNames.has(normalized(shortName))) return normalized(shortName);
  return normalized(name);
}
const targets = Object.fromEntries(Object.entries(registries).map(([country, regions]) => [country,
  capitals.capitals.filter((capital) => capital.country === country).map(({ region }) => ({ region, identities: new Set((regions[region] ?? []).map((name) => cityIdentity(country, region, name))) })),
]));

// Count against the full bundled registry, never the partial map/API results.
// Version: IBGE/Census snapshots retrieved 2026-11-23; no persistence migration.
export function countryCompletion(places: Place[], country: string): CountryCompletion | undefined {
  const registry = targets[country];
  if (!registry) return undefined;
  const visited = new Map<string, Set<string>>();
  for (const place of places) {
    if (placeCountry(place) !== country || !isMunicipality(place)) continue;
    const region = regionCode(place.region);
    const identities = visited.get(region) ?? new Set<string>();
    identities.add(cityIdentity(country, region, place.name));
    visited.set(region, identities);
  }
  const regions: CompletionBadge[] = registry.map(({ region, identities }) => {
    const completed = [...(visited.get(region) ?? [])].filter((identity) => identities.has(identity)).length;
    const kind = region === "DC" || region === "DF" ? "district" : "state";
    const name = capitals.capitals.find((capital) => capital.country === country && capital.region === region)?.regionName ?? region;
    return { id: `${country}:${region}`, kind, country, region, name, completed, total: identities.size, supported: identities.size > 0, earned: identities.size > 0 && completed === identities.size };
  });
  const completed = regions.filter((region) => region.earned).length;
  return { regions, country: { id: country, kind: "country", country, name: countryName(country), completed, total: regions.length, supported: regions.every((region) => region.supported), earned: regions.every((region) => region.supported) && completed === regions.length } };
}

export function earnedCompletions(places: Place[]): CompletionBadge[] {
  return [...new Set(places.map(placeCountry))].flatMap((country) => {
    const completion = countryCompletion(places, country);
    return completion ? [...completion.regions, completion.country].filter((badge) => badge.earned) : [];
  });
}
