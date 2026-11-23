import { placeKey, type Place } from "./places.ts";

export function rememberCity(saved: Place[], city: Place): Place[] {
  // Raw GPS positions are not named city choices and are not saved.
  if (city.id.startsWith("location-")) return saved;
  return [city, ...saved.filter((previous) => placeKey(previous) !== placeKey(city))];
}
