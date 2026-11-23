import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { discoverNearby, readStartingLocation, searchCities } from "@/lib/cities";
import { searchLocalPlaces, type Place } from "@/lib/places";

type Props = {
  catalog: Place[];
  carryLabel: string;
  onSelect: (origin: Place, candidates: Place[]) => boolean;
  onClose: () => void;
};

export function CityPicker({ catalog, carryLabel, onSelect, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requests = useRef({ id: 0, controller: null as AbortController | null });
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; places: Place[]; saved: boolean } | null>(null);
  const [busy, setBusy] = useState<"search" | "location" | "route" | null>(null);
  const [message, setMessage] = useState("");
  const featured = catalog.filter((place) => ["Washington", "New York", "Boston", "Seattle", "San Francisco"].includes(place.name));
  const local = query.trim() ? searchLocalPlaces(catalog, query) : featured;
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

  function begin() {
    requests.current.controller?.abort();
    requests.current.controller = new AbortController();
    setMessage("");
    return { id: ++requests.current.id, signal: requests.current.controller.signal };
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const { id, signal } = begin();
    setBusy("search");
    try {
      const found = await searchCities(query, catalog, signal);
      if (id !== requests.current.id) return;
      setResult({ query, ...found });
      setMessage(found.saved ? "Showing saved cities" : found.places.length ? "" : "No matches. Try another city.");
    } catch {
      // A newer request or closing the sheet cancels this one.
    } finally {
      if (id === requests.current.id) setBusy(null);
    }
  }

  async function choose(origin?: Place) {
    const { id, signal } = begin();
    setBusy(origin ? "route" : "location");
    try {
      const place = origin ?? await readStartingLocation();
      if (id !== requests.current.id) return;
      const candidates = await discoverNearby(place, catalog, signal);
      if (id === requests.current.id && !onSelect(place, candidates)) setMessage("Nearby cities unavailable. Choose a saved city.");
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
    <dialog ref={dialog} className="total-sheet city-sheet" aria-labelledby="city-picker-title" onCancel={onClose} onKeyDown={containTab} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sheet-handle" aria-hidden="true" />
      <div className="sheet-heading"><h2 id="city-picker-title">Start somewhere</h2><button type="button" className="icon-button" aria-label="Close city picker" onClick={onClose}><Image src="/journey/icons/close.svg" width={24} height={24} alt="" /></button></div>
      <p className="city-status">{carryLabel}</p>
      <button type="button" className="primary-button locate-button" disabled={busy === "location" || busy === "route"} onClick={() => choose()}><Image src="/journey/icons/locate.svg" width={22} height={22} alt="" />{busy === "location" ? "Finding your location…" : "Use my location"}</button>
      <form className="city-search" role="search" onSubmit={search}>
        <label className="sr-only" htmlFor="city-search">City, state</label>
        <input id="city-search" type="search" value={query} placeholder="City, state" autoComplete="off" onChange={(event) => { requests.current.controller?.abort(); requests.current.id++; setQuery(event.target.value); setBusy(null); setMessage(""); }} />
        <button type="submit" className="icon-button" aria-label="Search cities"><Image src="/journey/icons/search.svg" width={22} height={22} alt="" /></button>
      </form>
      <p className="city-status" role="status">{busy === "search" ? "Searching…" : busy === "route" ? "Finding nearby cities…" : message}</p>
      <p className="eyebrow city-results-label">{query.trim() ? "Cities" : "Saved cities"}</p>
      <ul className="city-results">
        {(matches.length ? matches : featured).slice(0, 8).map((place) => <li key={place.id}>
          <button type="button" disabled={busy === "route" || busy === "location"} onClick={() => choose(place)}>
            <span className="city-result-icon"><Image src="/journey/icons/city.svg" width={22} height={22} alt="" /></span>
            <span><strong>{place.name}</strong><span className="city-region">{[place.region, place.country].filter(Boolean).join(", ")}</span></span>
            <Image className="city-result-arrow" src="/journey/icons/chevron-right.svg" width={20} height={20} alt="" />
          </button>
        </li>)}
      </ul>
      <p className="city-credit">City data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> / <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">Photon</a></p>
    </dialog>
  );
}
