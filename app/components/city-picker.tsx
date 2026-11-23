import Image from "next/image";
import { useCallback, useMemo, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { discoverNearby, readStartingLocation, searchCities } from "@/lib/cities";
import { distinctPlaces, searchLocalPlaces, type Place } from "@/lib/places";
import { useSheetMotion } from "./use-sheet-motion";

type Props = {
  catalog: Place[];
  savedCities: Place[];
  onSelect: (origin: Place, candidates: Place[]) => boolean;
  onClose: () => void;
};

export function CityPicker({ catalog, savedCities, onSelect, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { closing, finish } = useSheetMotion();
  const requests = useRef({ id: 0, controller: null as AbortController | null });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; places: Place[]; saved: boolean } | null>(null);
  const [busy, setBusy] = useState<"search" | "location" | "route" | null>(null);
  const [message, setMessage] = useState("");
  const searchCatalog = useMemo(() => distinctPlaces([...savedCities, ...catalog]), [savedCities, catalog]);
  const local = query.trim() ? searchLocalPlaces(searchCatalog, query) : savedCities;
  const matches = result?.query === query ? result.places : local;

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeRequests = requests.current;
    element?.showModal();
    return () => {
      activeRequests.id++;
      activeRequests.controller?.abort();
      element?.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  const begin = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    requests.current.controller?.abort();
    requests.current.controller = new AbortController();
    setMessage("");
    return { id: ++requests.current.id, signal: requests.current.controller.signal };
  }, []);

  const runSearch = useCallback(async (searchQuery: string) => {
    const { id, signal } = begin();
    setBusy("search");
    try {
      const found = await searchCities(searchQuery, searchCatalog, signal);
      if (id !== requests.current.id) return;
      setResult({ query: searchQuery, ...found });
      setMessage(found.saved ? (found.places.length ? "Offline results" : "Search unavailable. Try again.") : found.places.length ? "" : "No matches. Try another city.");
    } catch {
      // A newer request or closing the sheet cancels this one.
    } finally {
      if (id === requests.current.id) setBusy(null);
    }
  }, [begin, searchCatalog]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    searchTimer.current = setTimeout(() => { void runSearch(query); }, 600);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, runSearch]);

  function close() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    requests.current.id++;
    requests.current.controller?.abort();
    finish(onClose);
  }

  function search(event: FormEvent) {
    event.preventDefault();
    void runSearch(query);
  }

  const searching = busy === "search" || (query.trim().length >= 2 && result?.query !== query && busy === null);

  async function choose(origin?: Place) {
    const { id, signal } = begin();
    setBusy(origin ? "route" : "location");
    try {
      const place = origin ?? await readStartingLocation();
      if (id !== requests.current.id) return;
      const candidates = await discoverNearby(place, searchCatalog, signal);
      if (id === requests.current.id) finish(() => {
        const accepted = onSelect(place, candidates);
        if (!accepted) setMessage("Nearby cities unavailable. Choose a saved city.");
        return accepted;
      });
    } catch {
      if (id === requests.current.id) setMessage("Location unavailable. Choose a city.");
    } finally {
      if (id === requests.current.id) setBusy(null);
    }
  }

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input, a");
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <dialog ref={dialog} className={`total-sheet city-sheet${closing ? " is-closing" : ""}`} inert={closing} aria-labelledby="city-picker-title" onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={containTab} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
      <div className="sheet-handle" aria-hidden="true" />
      <div className="sheet-heading"><h2 id="city-picker-title">Start somewhere</h2><button type="button" className="icon-button" aria-label="Close city picker" onClick={close}><Image src="/journey/icons/close.svg" width={24} height={24} alt="" /></button></div>
      <p className="city-status">New journey · history and stamps kept</p>
      <button type="button" className="primary-button locate-button" disabled={busy === "location" || busy === "route"} onClick={() => choose()}><Image src="/journey/icons/locate.svg" width={22} height={22} alt="" />{busy === "location" ? "Finding your location…" : "Use my location"}</button>
      <form className="city-search" role="search" onSubmit={search}>
        <label className="sr-only" htmlFor="city-search">City, state</label>
        <input id="city-search" type="search" enterKeyHint="search" value={query} placeholder="City, state" autoComplete="off" onChange={(event) => { if (searchTimer.current) clearTimeout(searchTimer.current); requests.current.controller?.abort(); requests.current.id++; setQuery(event.target.value); setResult(null); setBusy(null); setMessage(""); }} />
        <button type="submit" className="icon-button" aria-label="Search cities"><Image src="/journey/icons/search.svg" width={22} height={22} alt="" /></button>
      </form>
      <p className="city-status city-search-status" role="status">{searching ? "Searching…" : busy === "route" ? "Finding nearby cities…" : message}</p>
      <p className={`eyebrow city-results-label${!query.trim() && savedCities.length === 0 ? " is-empty" : ""}`} aria-hidden={!query.trim() && savedCities.length === 0}>{query.trim() ? "Cities" : "Saved cities"}</p>
      <ul className="city-results" aria-busy={searching}>
        {(query.trim() ? matches.slice(0, 8) : matches).map((place) => <li key={place.id}>
          <button type="button" disabled={busy === "route" || busy === "location"} onClick={() => choose(place)}>
            <span className="city-result-icon"><Image src="/journey/icons/city.svg" width={22} height={22} alt="" /></span>
            <span><strong>{place.name}</strong><span className="city-region">{[place.region, place.country].filter(Boolean).join(", ")}</span></span>
            <Image className="city-result-arrow" src="/journey/icons/chevron-right.svg" width={20} height={20} alt="" />
          </button>
        </li>)}
      </ul>
      <p className="city-credit">City data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> / <a href="https://github.com/komoot/photon" target="_blank" rel="noreferrer" aria-label="Photon project (opens in a new tab)">Photon</a></p>
    </dialog>
  );
}
