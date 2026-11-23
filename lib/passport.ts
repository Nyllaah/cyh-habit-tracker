import { collectedStamps, routeMeters, type City, type JourneyState } from "./journey.ts";
import { placeKey } from "./places.ts";

export type PassportStamp = { city: City; origin: boolean; earned: boolean };
export type PassportCollection = { preview: PassportStamp[]; moreCollected: PassportStamp[]; moreUpcoming: PassportStamp[]; arrivalCount: number };

// Preview the current journey without losing access to archived stamps.
export function passportCollection(state: JourneyState): PassportCollection {
  const collected: PassportStamp[] = collectedStamps(state).map((stamp) => ({ ...stamp, earned: true }));
  const collectedKeys = new Set(collected.map((stamp) => placeKey(stamp.city)));
  const meters = routeMeters(state);
  const upcoming: PassportStamp[] = state.route.slice(1)
    .filter((city) => city.cumulativeMeters > meters && !collectedKeys.has(placeKey(city)))
    .map((city) => ({ city, origin: false, earned: false }));
  const originKey = placeKey(state.route[0]);
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
