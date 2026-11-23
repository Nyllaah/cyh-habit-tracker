import countries from "../data/country-maps.json" with { type: "json" };
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Place } from "./places.ts";

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
  const known = countryMaps.features.find((feature) => feature.properties.code === code)?.properties.name;
  if (known) return known;
  return /^[A-Z]{2}$/.test(code) ? new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code : code || "Other places";
}

// Ray casting lets coordinate-only GPS origins pick an offline country outline.
export function insideRing(longitude: number, latitude: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > latitude) !== (yj > latitude) && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
