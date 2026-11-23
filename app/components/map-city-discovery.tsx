import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { citiesInView, discoverMapCities, type MapCityView } from "@/lib/cities";
import { type Place } from "@/lib/places";

type Props = {
  api: { map: Leaflet.Map; library: typeof Leaflet } | null;
  country: string;
  catalog: Place[];
  onDiscover: (places: Place[]) => void;
};

// Discovery supplies candidates; the reducer preserves and extends the itinerary.
export function MapCityDiscovery({ api, country, catalog, onDiscover }: Props) {
  const cache = useRef(new Map<string, Place[]>());
  useEffect(() => {
    if (!api) return;
    const { map } = api;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let version = 0;
    let popupOpen = false;

    function cancel() { version++; clearTimeout(timer); controller?.abort(); }
    function refresh() {
      cancel();
      if (popupOpen) return;
      const center = map.getCenter(), bounds = map.getBounds();
      const view: MapCityView = { latitude: center.lat, longitude: center.lng, south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast(), radiusKm: center.distanceTo(bounds.getNorthEast()) / 1000, country };
      const key = [country, view.south, view.west, view.north, view.east].map((value) => typeof value === "number" ? value.toFixed(2) : value).join("|");
      const saved = cache.current.get(key);
      onDiscover(saved ?? citiesInView(catalog, view));
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
          if (!popupOpen) onDiscover(places);
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
    return () => { cancel(); map.off("popupopen", openPopup); map.off("popupclose", closePopup); map.off("dragstart zoomstart", closeForNavigation); map.off("load", refresh); map.off("movestart", cancel); map.off("moveend", refresh); };
  }, [api, country, catalog, onDiscover]);
  return null;
}
