import countries from "../data/country-maps.json" with { type: "json" };
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Place } from "./places.ts";
import { insideRing } from "./map.ts";

export const countryMaps = countries as FeatureCollection<Polygon | MultiPolygon, { code: string; name: string }>;

export function placeCountry(place: Place): string {
  if (place.country) return place.country.toUpperCase();
  // GPS origins may have coordinates without a country name.
  return countryMaps.features.find((feature) => {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return polygons.some((rings) => insideRing(place.longitude, place.latitude, rings[0]) && !rings.slice(1).some((ring) => insideRing(place.longitude, place.latitude, ring)));
  })?.properties.code ?? "";
}

export function countryName(code: string): string {
  return countryMaps.features.find((feature) => feature.properties.code === code)?.properties.name ?? (code || "Other places");
}
