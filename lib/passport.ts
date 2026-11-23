import { collectedStamps, routeMeters, type City, type JourneyState } from "./journey.ts";
import { placeKey } from "./places.ts";
import { countryName, placeCountry } from "./countries.ts";

export type PassportStamp = { city: City; origin: boolean; earned: boolean };
export type PassportCollection = { preview: PassportStamp[]; moreCollected: PassportStamp[]; moreUpcoming: PassportStamp[]; arrivalCount: number };
export type CountryPassport = { country: string; name: string; collection: PassportCollection };

export function countryPassports(state: JourneyState): CountryPassport[] {
  const countries = new Set([...collectedStamps(state).map((stamp) => placeCountry(stamp.city)), ...state.route.map(placeCountry)]);
  return [...countries].sort().map((country) => ({ country, name: countryName(country), collection: passportCollection(state, country) }));
}

// Preview the current journey without losing access to archived stamps.
export function passportCollection(state: JourneyState, country?: string): PassportCollection {
  const collected: PassportStamp[] = collectedStamps(state)
    .filter((stamp) => country === undefined || placeCountry(stamp.city) === country)
    .map((stamp) => ({ ...stamp, earned: true }));
  const collectedKeys = new Set(collected.map((stamp) => placeKey(stamp.city)));
  const meters = routeMeters(state);
  const upcoming: PassportStamp[] = state.route.slice(1)
    .filter((city) => (country === undefined || placeCountry(city) === country) && city.distanceFromOriginMeters > meters && !collectedKeys.has(placeKey(city)))
    .map((city) => ({ city, origin: false, earned: false }));
  const focusRoute = state.route[0] && (country === undefined || placeCountry(state.route[0]) === country)
    ? state.route
    : state.previousJourneys.findLast((journey) => placeCountry(journey.route[0]) === country)?.route;
  const originKey = focusRoute ? placeKey(focusRoute[0]) : "";
  const origin = collected.find((stamp) => placeKey(stamp.city) === originKey);
  const latest = collected.filter((stamp) => !stamp.origin && placeKey(stamp.city) !== originKey).at(-1);
  const choices = [origin, latest, ...upcoming, ...collected.slice().reverse()];
  const unique = new Map<string, PassportStamp>();
  for (const stamp of choices) {
    if (stamp && !unique.has(placeKey(stamp.city))) unique.set(placeKey(stamp.city), stamp);
  }
  const preview = [...unique.values()].slice(0, 3);
  const previewKeys = new Set(preview.map((stamp) => placeKey(stamp.city)));
  return {
    preview,
    moreCollected: collected.filter((stamp) => !previewKeys.has(placeKey(stamp.city))),
    moreUpcoming: upcoming.filter((stamp) => !previewKeys.has(placeKey(stamp.city))),
    arrivalCount: collected.filter((stamp) => !stamp.origin).length,
  };
}
