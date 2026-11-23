import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { citiesInView, discoverMapCities, discoverRouteCities, type MapCityView } from "@/lib/cities";
import { distinctPlaces, type Place } from "@/lib/places";

type Props = {
  api: { map: Leaflet.Map; library: typeof Leaflet } | null;
  country: string;
  frontier: Place;
  catalog: Place[];
  onDiscover: (places: Place[]) => void;
};

// One batch per settled movement. Route updates must not trigger another lookup.
export function MapCityDiscovery({ api, country, frontier, catalog, onDiscover }: Props) {
  const cache = useRef(new Map<string, Place[]>());
  const latestFrontier = useRef(frontier);
  useEffect(() => { latestFrontier.current = frontier; }, [frontier]);
  useEffect(() => {
    if (!api) return;
    const { map } = api;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let version = 0;
    let popupOpen = false;

    function cancel() { version++; clearTimeout(timer); controller?.abort(); }
    async function cached(key: string, load: () => Promise<Place[]>, request: number) {
      const saved = cache.current.get(key);
      if (saved) return saved;
      const places = await load();
      if (request === version) {
        if (cache.current.size >= 32) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, places);
      }
      return places;
    }
    function refresh() {
      cancel();
      if (popupOpen) return;
      const center = map.getCenter(), bounds = map.getBounds();
      const view: MapCityView = { latitude: center.lat, longitude: center.lng, south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast(), radiusKm: center.distanceTo(bounds.getNorthEast()) / 1000, country };
      const viewKey = [country, view.south, view.west, view.north, view.east].map((value) => typeof value === "number" ? value.toFixed(2) : value).join("|");
      const request = version;
      const zoom = map.getZoom();
      timer = setTimeout(async () => {
        controller = new AbortController();
        const signal = controller.signal;
        const tail = latestFrontier.current;
        try {
          const [visible, onward] = await Promise.all([
            zoom < 5 ? Promise.resolve(citiesInView(catalog, view))
              : cached(`view|${viewKey}`, () => discoverMapCities(view, catalog, signal), request),
            discoverRouteCities(tail, catalog, signal),
          ]);
          if (request !== version || signal.aborted || popupOpen) return;
          // Merge both results once: cached views still allow a fresh tail to grow.
          onDiscover(distinctPlaces([...visible, ...onward]));
        } catch { /* New movement or unmount cancels obsolete results. */ }
      }, 650);
    }

    function openPopup() { popupOpen = true; cancel(); }
    function closePopup() { popupOpen = false; }
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
