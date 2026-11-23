"use client";

import Image from "next/image";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { JourneyMap } from "@/app/components/journey-map";
import { DailyTotalEditor } from "@/app/components/daily-total-editor";
import { ActivityHistory } from "@/app/components/activity-history";
import { CityPicker } from "@/app/components/city-picker";
import { Arrival } from "@/app/components/arrival";
import { SegmentedControl } from "@/app/components/segmented-control";
import { Passport } from "@/app/components/passport";
import { countryPassports, passportCollection } from "@/lib/passport";
import { placeCountry } from "@/lib/countries";
import { getCityCatalog, getJourneySample } from "@/lib/data";
import { discoverNearby, readStartingLocation } from "@/lib/cities";
import { capitalKind, placeKey, type Place } from "@/lib/places";
import { demoReadingForJourney, readDemoHealth } from "@/lib/health";
import { routeMeters, effectiveMeters, initialJourney, journeyReducer, nextCity, totalMeters, type Day } from "@/lib/journey";
import { formatDistance, type DistanceUnit } from "@/lib/distance";

const sample = getJourneySample();
const catalog = getCityCatalog();
const demoHistory = [...sample.previousJourneys, { days: sample.days, route: sample.route }];
const importedHistoryDates = new Set(demoHistory.flatMap((journey) => journey.days.map((day) => day.date)));

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <Image className={`icon ${className}`} src={`/journey/icons/${name}.svg`} width={24} height={24} alt="" />;
}

export default function Page() {
  const [state, dispatch] = useReducer(journeyReducer, undefined, () => initialJourney([], [], catalog));
  const [syncing, setSyncing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [unit, setUnit] = useState<DistanceUnit>("metric");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const editing = editingDate !== null;
  const [choosingCity, setChoosingCity] = useState(false);
  const [demoReading, setDemoReading] = useState<Day | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const locationRequest = useRef(0);
  const syncButton = useRef<HTMLButtonElement>(null);
  const syncInFlight = useRef(false);
  const syncRequest = useRef(0);
  const meters = routeMeters(state);
  const next = nextCity(state.route, meters);
  const currentCountry = state.route[0] ? placeCountry(state.route[0]) : undefined;
  const collection = passportCollection(state, currentCountry);
  const editingDay = state.days.find((day) => day.date === editingDate);
  const editingHasImport = editingDate === sample.today ? hasSynced : state.demoHistoryLoaded && importedHistoryDates.has(editingDate ?? "");
  const today = state.days.find((day) => day.date === sample.today);
  const needsDestinations = state.route.filter((city) => city.cumulativeMeters > meters).length < 2;
  const frontier = needsDestinations ? state.route[state.route.length - 1] : null;
  const frontierKey = frontier ? `${state.route[0].id}|${frontier.id}` : "";
  const [completedFrontier, setCompletedFrontier] = useState("");
  const discovering = !!frontier && completedFrontier !== frontierKey;

  useEffect(() => {
    if (!frontier) return;
    const controller = new AbortController();
    discoverNearby(frontier, catalog, controller.signal).then((candidates) => {
      if (!controller.signal.aborted) dispatch({ type: "extend-route", candidates });
    }).catch(() => {}).finally(() => {
      if (!controller.signal.aborted) setCompletedFrontier(frontierKey);
    });
    return () => controller.abort();
  }, [frontier, frontierKey]);

  const discoverRoute = useCallback((candidates: Place[]) => dispatch({ type: "extend-route", candidates, upcomingCount: 12 }), []);

  async function syncHealth() {
    if (syncInFlight.current || !demoReading) return;
    const request = ++syncRequest.current;
    syncInFlight.current = true;
    setSyncing(true);
    try {
      const reading = await readDemoHealth(demoReading);
      if (request !== syncRequest.current) return;
      dispatch({ type: "demo-sync", reading, history: demoHistory });
      setHasSynced(true);
    } finally {
      if (request === syncRequest.current) {
        syncInFlight.current = false;
        setSyncing(false);
      }
    }
  }

  function openCityPicker() {
    locationRequest.current++;
    setLocating(false);
    setLocationMessage("");
    setChoosingCity(true);
  }

  function startJourney(origin: Place, candidates: Place[]): boolean {
    if (state.route[0] && placeKey(origin) === placeKey(state.route[0])) { setChoosingCity(false); return true; }
    const action = { type: "change-origin" as const, origin, candidates };
    const started = journeyReducer(state, action);
    if (started === state) return false;
    syncRequest.current++;
    syncInFlight.current = false;
    setSyncing(false);
    setDemoReading(demoReadingForJourney(started, sample.today));
    dispatch(action);
    setChoosingCity(false);
    return true;
  }

  async function useLocation() {
    const request = ++locationRequest.current;
    setLocating(true);
    setLocationMessage("");
    try {
      const origin = await readStartingLocation();
      if (request !== locationRequest.current) return;
      const candidates = await discoverNearby(origin, catalog);
      if (request === locationRequest.current && !startJourney(origin, candidates)) setLocationMessage("Nearby cities unavailable. Choose a city.");
    } catch {
      if (request === locationRequest.current) setLocationMessage("Location unavailable. Choose a city.");
    } finally {
      if (request === locationRequest.current) setLocating(false);
    }
  }

  return (
    <main className="home">
      <header className="home-header">
        <div className="brand-mark" aria-hidden="true"><Icon name="passport" /></div>
        <h1>Your journey</h1>
        <SegmentedControl<DistanceUnit> label="Distance units" value={unit} onChange={setUnit} compact options={[
          { value: "metric", label: "km", ariaLabel: "Kilometers" },
          { value: "miles", label: "mi", ariaLabel: "Miles" },
        ]} />
      </header>

      {!state.route.length ? <section className="journey-start view-reveal" aria-labelledby="journey-start-title">
        <div className="journey-start-art" aria-hidden="true">
          <svg viewBox="0 0 300 120"><path d="M38 96C10 42 100 32 123 76S215 112 251 45" fill="none" stroke="#69A99B" strokeWidth="3" strokeDasharray="4 8" strokeLinecap="round" /><circle cx="38" cy="96" r="7" fill="#E87C3B" stroke="#FEFFFD" strokeWidth="3" /></svg>
          <Image src="/journey/game/cities/generic-city.svg" width={108} height={108} alt="" />
        </div>
        <h2 id="journey-start-title">Choose your start</h2>
        <button type="button" className="primary-button" onClick={openCityPicker}>Choose a city</button>
        <button type="button" className="start-location" disabled={locating} onClick={useLocation}><Icon name="locate" />{locating ? "Finding your location…" : "Use my location"}</button>
        {locationMessage && <p className="location-message" role="status">{locationMessage}</p>}
      </section> : <div className="journey-view view-reveal" key={`journey-${state.route[0].id}`}>
      <button type="button" className="origin" aria-label="Change starting city" aria-describedby="origin-name" onClick={openCityPicker}><Icon name="location" /><span id="origin-name" className="origin-name">{[state.route[0].name, state.route[0].region].filter(Boolean).join(", ")}</span><Icon name="chevron-down" className="origin-chevron" /></button>

      <section className="journey-section" aria-labelledby="next-stop-title">
        <div className="destination-heading">
          <div><p className="eyebrow">{next && capitalKind(next) ? "Capital milestone" : "Next stop"}</p><h2 id="next-stop-title">{next?.name ?? "More cities ahead"}</h2></div>
          {next && <p className="remaining"><strong>{formatDistance(next.cumulativeMeters - meters, unit)}</strong><span>to go</span></p>}
        </div>
        {frontier && !next && <p className="route-status" role="status">{discovering ? "Finding nearby cities…" : "Choose a city to explore another route."}</p>}
        <div className="map-container">
          <JourneyMap route={state.route} meters={meters} onDiscoverCities={discoverRoute} />
          <p className="traveled"><Icon name="footsteps" />{formatDistance(meters, unit)} this journey</p>
        </div>
        <p className="city-credit map-credit">{formatDistance(totalMeters(state.days), unit)} total · Virtual journey</p>
      </section>
      </div>}

      <section className="today-card" aria-labelledby="today-title">
        <h2 id="today-title">Today</h2>
        <button type="button" className="icon-button light-icon edit-total" aria-label="Edit today's total" onClick={() => setEditingDate(sample.today)}><Icon name="edit" /></button>
        <div className="today-distance-row">
          <p className="today-distance" aria-live="polite" aria-atomic="true">{formatDistance(today ? effectiveMeters(today) : 0, unit)}</p>
          <Icon name="footsteps" className="today-footsteps" />
        </div>
        <div className="health-row">
          <p role="status"><span className="status-dot" />{syncing ? "Syncing · Demo" : today?.manualOverrideMeters !== undefined ? "Manual total · Demo" : "Health Connect · Demo"}</p>
          <button ref={syncButton} className="icon-button light-icon" disabled={syncing || !demoReading} aria-label="Sync health activity" title={!demoReading ? "Choose a starting city first" : "Sync health activity"} onClick={syncHealth}>
            <Icon name="sync" className={syncing ? "spinning" : ""} />
          </button>
        </div>
      </section>

      <ActivityHistory days={state.days} today={sample.today} unit={unit} onEdit={setEditingDate} />

      <Passport key={`passport-${state.route[0]?.id ?? "unselected"}`} countries={countryPassports(state)} currentCountry={currentCountry} />

      {choosingCity && <CityPicker catalog={catalog} onSelect={startJourney} onClose={() => setChoosingCity(false)} />}
      {editingDate && <DailyTotalEditor key={`editor-${editingDate}`} date={editingDate} today={sample.today} meters={editingDay ? effectiveMeters(editingDay) : 0} importedMeters={editingHasImport ? editingDay?.importedMeters : undefined} hasCorrection={editingDay?.manualOverrideMeters !== undefined} unit={unit}
        onSave={(meters) => { dispatch({ type: "correct-day", date: editingDate, meters }); setEditingDate(null); }}
        onUseImported={() => { dispatch({ type: "use-imported", date: editingDate }); setEditingDate(null); }}
        onClose={() => setEditingDate(null)} />}
      {!editing && !choosingCity && state.arrivals[0] && <Arrival key={state.arrivals[0].id} city={state.arrivals[0]} next={next} arrivalCount={collection.arrivalCount} fallbackFocus={syncButton} onContinue={() => dispatch({ type: "dismiss-arrival" })} />}
    </main>
  );
}
