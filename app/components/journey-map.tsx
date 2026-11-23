import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { MapCityDiscovery } from "@/app/components/map-city-discovery";
import { getCityCatalog } from "@/lib/data";
import { countryMaps, placeCountry } from "@/lib/countries";
import { nextCity, type City, type Place } from "@/lib/journey";
import { capitalKind, cityArtwork, routeWindow } from "@/lib/places";
import { journeyPosition } from "@/lib/map";

const catalog = getCityCatalog();

type MapApi = { map: Leaflet.Map; library: typeof Leaflet };

export function JourneyMap({ route: fullRoute, meters, onDiscoverCities }: { route: City[]; meters: number; onDiscoverCities: (places: Place[]) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<MapApi | null>(null);
  const [tileStatus, setTileStatus] = useState<"loading" | "ready" | "offline">("loading");
  const viewKey = useRef("");
  const route = useMemo(() => routeWindow(fullRoute, meters), [fullRoute, meters]);
  const country = countryMaps.features.find((feature) => feature.properties.code === placeCountry(fullRoute[0]));

  useEffect(() => {
    let disposed = false;
    let map: Leaflet.Map | undefined;
    let observer: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    import("leaflet").then((library) => {
      if (disposed || !container.current) return;
      viewKey.current = "";
      map = library.map(container.current, { zoomSnap: 0.25, zoomControl: false, scrollWheelZoom: false, attributionControl: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
      const showOverviewMarkers = () => container.current?.classList.toggle("map-overview", (map?.getZoom() ?? 0) < 7);
      map.on("zoomend", showOverviewMarkers);
      map.attributionControl.setPrefix(false);
      map.createPane("country").style.zIndex = "150";
      library.geoJSON(countryMaps, { pane: "country", interactive: false, style: { color: "#9CBFAF", weight: 1.5, fillColor: "#E8F0E7", fillOpacity: 1 } }).addTo(map);
      const tiles = library.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, minZoom: 2, keepBuffer: 0, updateWhenIdle: true,
        // Soften street detail beneath the fully opaque journey layers.
        opacity: 0.5,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.naturalearthdata.com/">Natural Earth</a>',
      }).addTo(map);
      let loaded = false;
      const awaitTiles = () => {
        loaded = false;
        clearTimeout(timeout);
        timeout = setTimeout(() => { if (!disposed && !loaded) setTileStatus("offline"); }, 5000);
      };
      tiles.on("loading", awaitTiles);
      tiles.on("tileload", () => {
        if (disposed) return;
        loaded = true;
        clearTimeout(timeout);
        setTileStatus("ready");
      });
      tiles.on("tileerror", () => { if (!disposed && !loaded) setTileStatus("offline"); });
      awaitTiles();
      observer = new ResizeObserver(() => map?.invalidateSize({ animate: false }));
      observer.observe(container.current);
      setApi({ map, library });
    });
    return () => { disposed = true; clearTimeout(timeout); observer?.disconnect(); map?.remove(); };
  }, []);

  useEffect(() => {
    if (!api) return;
    const { map, library: L } = api;
    const layers = L.layerGroup().addTo(map);
    const points = fullRoute.map((city): Leaflet.LatLngTuple => [city.latitude, city.longitude]);
    L.polyline(points, { color: "#FEFFFD", weight: 9, interactive: false }).addTo(layers);
    L.polyline(points, { className: "map-route-line", color: "#12786F", weight: 4, dashArray: "5 8", interactive: false }).addTo(layers);
    const position = journeyPosition(fullRoute, meters);
    const reached = fullRoute.filter((city) => city.cumulativeMeters <= meters).map((city): Leaflet.LatLngTuple => [city.latitude, city.longitude]);
    L.polyline([...reached, [position.latitude, position.longitude]], { color: "#12786F", weight: 5, interactive: false }).addTo(layers);
    const next = nextCity(fullRoute, meters);
    const landmarks: { marker: Leaflet.Marker; city: City; size: number; priority: number }[] = [];
    fullRoute.forEach((city) => {
      const earned = city.cumulativeMeters <= meters;
      const capital = capitalKind(city);
      const isNext = city === next;
      const icon = L.divIcon({
        className: `map-city-marker${isNext ? " map-city-next" : ""}${capital ? " map-capital-marker" : ""}${earned ? " is-collected" : ""}`,
        html: `<span class="map-landmark-card"><img src="/journey/game/cities/${cityArtwork(city)}.svg" width="48" height="48" alt=""></span>${capital ? '<span class="map-capital-emblem" aria-hidden="true">★</span>' : ""}<span class="route-city-dot" aria-hidden="true"></span>`,
        iconSize: isNext ? [56, 56] : [44, 44], iconAnchor: isNext ? [28, 28] : [22, 22],
        popupAnchor: isNext ? [0, -28] : [0, -22],
      });
      const marker = L.marker([city.latitude, city.longitude], { icon, title: `${city.name}${capital ? ", capital milestone" : ""}`, alt: city.name, keyboard: true, zIndexOffset: isNext ? 1000 : 0 }).addTo(layers);
      landmarks.push({ marker, city, size: isNext ? 56 : 44, priority: isNext ? 0 : earned ? 1 : capital ? 2 : 3 });
      const label = document.createElement("span");
      label.textContent = city.name;
      label.addEventListener("click", () => marker.openPopup());
      marker.bindTooltip(label, { interactive: true, permanent: isNext, direction: "bottom", offset: [0, isNext ? 28 : 22], className: earned ? "map-city-label" : "map-city-label map-city-upcoming" });
      const content = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = city.name;
      const status = document.createElement("p"); status.textContent = `${capital ? "Capital · " : ""}${city.cumulativeMeters === 0 ? "Origin" : earned ? "Collected" : isNext ? "Up next" : "Later stop"}`;
      content.append(title, status);
      if (!earned) {
        const distance = document.createElement("p");
        distance.className = "map-city-distance";
        distance.textContent = `${((city.cumulativeMeters - meters) / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} km to go`;
        content.append(distance);
      }
      marker.bindPopup(content);
    });
    L.circleMarker([position.latitude, position.longitude], { radius: 7, color: "#FEFFFD", weight: 3, fillColor: "#E87C3B", fillOpacity: 1, interactive: false }).addTo(layers);
    // Keep the next stop and earned landmarks prominent. Nearby illustrations
    // become dots until zooming gives each badge enough screen space.
    const ranked = landmarks.slice().sort((a, b) => a.priority - b.priority);
    function spaceLandmarks() {
      const occupied: { point: Leaflet.Point; size: number }[] = [];
      const view = map.getSize();
      for (const { marker, city, size } of ranked) {
        const point = map.latLngToContainerPoint([city.latitude, city.longitude]);
        const visible = point.x >= -size && point.x <= view.x + size && point.y >= -size && point.y <= view.y + size;
        const overlaps = occupied.some((other) => Math.abs(point.x - other.point.x) < (size + other.size) / 2 + 8
          && Math.abs(point.y - other.point.y) < (size + other.size) / 2 + 8);
        marker.getElement()?.classList.toggle("map-landmark-compact", visible && overlaps);
        if (visible && !overlaps) occupied.push({ point, size });
      }
    }
    map.on("moveend zoomend resize", spaceLandmarks);
    const key = `${fullRoute[0].id}|${route.map((city) => city.id).join("|")}`;
    if (viewKey.current !== key) {
      map.fitBounds(L.latLngBounds(route.map((city): Leaflet.LatLngTuple => [city.latitude, city.longitude])), { paddingTopLeft: [50, 75], paddingBottomRight: [50, 85], maxZoom: 12, animate: false });
      viewKey.current = key;
    }
    spaceLandmarks();
    return () => { map.off("moveend zoomend resize", spaceLandmarks); map.removeLayer(layers); };
  }, [api, fullRoute, meters, route]);

  function showRoute() {
    if (!api) return;
    api.map.fitBounds(api.library.latLngBounds(route.map((city) => [city.latitude, city.longitude])), { paddingTopLeft: [50, 75], paddingBottomRight: [50, 85], maxZoom: 12, animate: false });
  }

  function showCountry() {
    if (!api || !country) return;
    // Frame the contiguous US; Alaska and Hawaii remain available by panning.
    const bounds: Leaflet.LatLngBoundsExpression = country.properties.code === "US" ? [[24, -125], [50, -66]] : [[-34, -74], [6, -34]];
    api.map.fitBounds(bounds, { padding: [15, 45], animate: false });
  }

  return (
    <div className="interactive-map">
      <MapCityDiscovery api={api} country={placeCountry(fullRoute[0])} frontier={fullRoute[fullRoute.length - 1]} catalog={catalog} onDiscover={onDiscoverCities} />
      <div ref={container} className="journey-map" role="region" aria-label={`Interactive journey map, ${country?.properties.name ?? fullRoute[0].name}. Drag to explore; use zoom controls or pinch to zoom.`} />
      <div className="map-framing">
        {country && <button type="button" onClick={showCountry} disabled={!api} aria-label={`Show ${country.properties.name} map`}>{country.properties.name}<span aria-hidden="true">↗</span></button>}
        <button type="button" onClick={showRoute} disabled={!api} aria-label="Show current route"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" stroke="currentColor" strokeWidth="2" /></svg></button>
      </div>
      <div className="map-zoom" role="group" aria-label="Map zoom">
        <button type="button" aria-label="Zoom in" disabled={!api} onClick={() => api?.map.zoomIn(undefined, { animate: false })}>+</button>
        <button type="button" aria-label="Zoom out" disabled={!api} onClick={() => api?.map.zoomOut(undefined, { animate: false })}>−</button>
      </div>
      {tileStatus !== "ready" && <p className="map-network-status" role="status">{tileStatus === "loading" ? "Loading streets…" : "Offline · country outline"}</p>}
    </div>
  );
}
