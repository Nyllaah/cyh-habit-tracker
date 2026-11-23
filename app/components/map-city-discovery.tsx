import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { citiesInView, discoverMapCities, type MapCityView } from "@/lib/cities";
import { journeyPosition } from "@/lib/map";
import { distanceMeters, placeKey, type City, type Place } from "@/lib/places";

type Props = {
  api: { map: Leaflet.Map; library: typeof Leaflet } | null;
  route: City[];
  meters: number;
  country: string;
  catalog: Place[];
};

// Exploration has its own layers/cache: browsing never dispatches journey actions.
export function MapCityDiscovery({ api, route, meters, country, catalog }: Props) {
  const cache = useRef(new Map<string, Place[]>());
  useEffect(() => {
    if (!api) return;
    const { map, library: L } = api;
    const layers = L.layerGroup().addTo(map);
    const routeKeys = new Set(route.map(placeKey));
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let version = 0;
    let popupOpen = false;

    function draw(places: Place[], view: MapCityView) {
      layers.clearLayers();
      const occupied = route.map((city) => map.latLngToContainerPoint([city.latitude, city.longitude]));
      const position = journeyPosition(route, meters);
      let count = 0;
      for (const city of citiesInView(places, view)) {
        if (routeKeys.has(placeKey(city))) continue;
        const point = map.latLngToContainerPoint([city.latitude, city.longitude]);
        if (occupied.some((other) => other.distanceTo(point) < 38)) continue;
        occupied.push(point);
        const icon = L.divIcon({ className: "map-discovery-marker", html: '<span aria-hidden="true"></span>', iconSize: [44, 44], iconAnchor: [22, 22] });
        const marker = L.marker([city.latitude, city.longitude], { icon, title: `Explore ${city.name}`, alt: city.name, zIndexOffset: -500 }).addTo(layers);
        const content = document.createElement("div");
        const name = document.createElement("strong"); name.textContent = city.name;
        const status = document.createElement("p"); status.textContent = "Nearby city";
        const distance = document.createElement("p"); distance.className = "map-city-distance";
        distance.textContent = `${(distanceMeters(position, city) / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} km away · straight line`;
        content.append(name, status, distance);
        marker.bindPopup(content);
        if (++count >= 24) break;
      }
    }

    function cancel() { version++; clearTimeout(timer); controller?.abort(); }
    function refresh() {
      cancel();
      if (popupOpen) return;
      const center = map.getCenter(), bounds = map.getBounds();
      const view: MapCityView = { latitude: center.lat, longitude: center.lng, south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast(), radiusKm: center.distanceTo(bounds.getNorthEast()) / 1000, country };
      const key = [country, view.south, view.west, view.north, view.east].map((value) => typeof value === "number" ? value.toFixed(2) : value).join("|");
      const saved = cache.current.get(key);
      draw(saved ?? catalog, view);
      // Country/world views use saved markers; zoom in for bounded public lookups.
      if (saved || map.getZoom() < 5) return;
      const request = version;
      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          const places = await discoverMapCities(view, catalog, controller.signal);
          if (request !== version || controller.signal.aborted) return;
          if (cache.current.size >= 16) cache.current.delete(cache.current.keys().next().value!);
          cache.current.set(key, places);
          if (!popupOpen) draw(places, view);
        } catch { /* New movement or unmount cancels obsolete results. */ }
      }, 650);
    }

    function openPopup() { popupOpen = true; cancel(); }
    function closePopup() { popupOpen = false; refresh(); }
    function closeForNavigation() { map.closePopup(); }
    map.on("popupopen", openPopup);
    map.on("popupclose", closePopup);
    map.on("dragstart zoomstart", closeForNavigation);
    map.on("movestart", cancel);
    map.on("moveend", refresh);
    map.whenReady(refresh);
    return () => { cancel(); map.off("popupopen", openPopup); map.off("popupclose", closePopup); map.off("dragstart zoomstart", closeForNavigation); map.off("load", refresh); map.off("movestart", cancel); map.off("moveend", refresh); map.removeLayer(layers); };
  }, [api, route, meters, country, catalog]);
  return null;
}
