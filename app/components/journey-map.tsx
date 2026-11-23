import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { countryMaps, placeCountry } from "@/lib/countries";
import { type City } from "@/lib/journey";
import { cityArtwork, routeWindow } from "@/lib/places";
import { journeyPosition } from "@/lib/map";

type MapApi = { map: Leaflet.Map; library: typeof Leaflet };

export function JourneyMap({ route: fullRoute, meters }: { route: City[]; meters: number }) {
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
      library.geoJSON(countryMaps, { pane: "country", interactive: false, style: { color: "#69A99B", weight: 1.5, fillColor: "#CDE5CD", fillOpacity: 1 } }).addTo(map);
      const tiles = library.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, minZoom: 2, keepBuffer: 0, updateWhenIdle: true,
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
    const points = route.map((city): Leaflet.LatLngTuple => [city.latitude, city.longitude]);
    L.polyline(points, { color: "#FEFFFD", weight: 9, interactive: false }).addTo(layers);
    L.polyline(points, { color: "#12786F", weight: 4, dashArray: "5 8", interactive: false }).addTo(layers);
    const position = journeyPosition(fullRoute, meters);
    const reached = route.filter((city) => city.cumulativeMeters <= meters).map((city): Leaflet.LatLngTuple => [city.latitude, city.longitude]);
    L.polyline([...reached, [position.latitude, position.longitude]], { color: "#12786F", weight: 5, interactive: false }).addTo(layers);
    route.forEach((city) => {
      const earned = city.cumulativeMeters <= meters;
      const icon = L.divIcon({ className: "map-city-marker", html: `<img src="/journey/game/cities/${cityArtwork(city)}.svg" width="48" height="48" alt="">`, iconSize: [48, 48], iconAnchor: [24, 43] });
      const marker = L.marker([city.latitude, city.longitude], { icon, title: city.name, alt: city.name, keyboard: true }).addTo(layers);
      const label = document.createElement("span");
      label.textContent = city.name;
      marker.bindTooltip(label, { permanent: true, direction: "bottom", offset: [0, 1], className: earned ? "map-city-label" : "map-city-label map-city-upcoming" });
      const content = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = city.name;
      const status = document.createElement("p"); status.textContent = city.cumulativeMeters === 0 ? "Origin" : earned ? "Collected" : "Up next";
      content.append(title, status); marker.bindPopup(content);
    });
    L.circleMarker([position.latitude, position.longitude], { radius: 7, color: "#FEFFFD", weight: 3, fillColor: "#E87C3B", fillOpacity: 1, interactive: false }).addTo(layers);
    const key = `${fullRoute[0].id}|${route.map((city) => city.id).join("|")}`;
    if (viewKey.current !== key) {
      map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [50, 75], paddingBottomRight: [50, 85], maxZoom: 12, animate: false });
      viewKey.current = key;
    }
    return () => { map.removeLayer(layers); };
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
