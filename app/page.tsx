"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef, useState } from "react";
import { JourneyMap } from "@/app/components/journey-map";
import { DailyTotalEditor } from "@/app/components/daily-total-editor";
import { ActivityHistory } from "@/app/components/activity-history";
import { CityPicker } from "@/app/components/city-picker";
import { Arrival } from "@/app/components/arrival";
import { Passport } from "@/app/components/passport";
import { passportCollection } from "@/lib/passport";
import { getCityCatalog, getJourneySample } from "@/lib/data";
import { discoverNearby } from "@/lib/cities";
import { placeKey } from "@/lib/places";
import { readDemoHealth } from "@/lib/health";
import { checkpointCarry, routeForOrigin, routeMeters, effectiveMeters, initialJourney, journeyReducer, nextCity, totalMeters } from "@/lib/journey";
import { formatDistance, type DistanceUnit } from "@/lib/distance";

const sample = getJourneySample();
const catalog = getCityCatalog();

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <Image className={`icon ${className}`} src={`/journey/icons/${name}.svg`} width={24} height={24} alt="" />;
}

export default function Page() {
  const [state, dispatch] = useReducer(journeyReducer, undefined, () => initialJourney(sample.days, sample.route, catalog));
  const [syncing, setSyncing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [unit, setUnit] = useState<DistanceUnit>("metric");
  const [editing, setEditing] = useState(false);
  const [choosingCity, setChoosingCity] = useState(false);
  const syncButton = useRef<HTMLButtonElement>(null);
  const syncInFlight = useRef(false);
  const meters = routeMeters(state);
  const next = nextCity(state.route, meters);
  const collection = passportCollection(state);
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

  async function syncHealth() {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true);
    try {
      const reading = await readDemoHealth(sample.healthImport);
      dispatch({ type: "import", reading });
      setHasSynced(true);
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }

  return (
    <main className="home">
      <header className="home-header">
        <div className="brand-mark" aria-hidden="true"><Icon name="passport" /></div>
        <h1>Your journey</h1>
        <div className="unit-switch" role="group" aria-label="Distance units">
          <button type="button" aria-label="Kilometers" aria-pressed={unit === "metric"} onClick={() => setUnit("metric")}>km</button>
          <button type="button" aria-label="Miles" aria-pressed={unit === "miles"} onClick={() => setUnit("miles")}>mi</button>
        </div>
      </header>

      <button type="button" className="origin" aria-label="Change starting city" aria-describedby="origin-name" onClick={() => setChoosingCity(true)}><Icon name="location" /><span id="origin-name" className="origin-name">{[state.route[0].name, state.route[0].region].filter(Boolean).join(", ")}</span><Icon name="chevron-down" className="origin-chevron" /></button>

      <section className="journey-section" aria-labelledby="next-stop-title">
        <div className="destination-heading">
          <div><p className="eyebrow">Next stop</p><h2 id="next-stop-title">{next?.name ?? "More cities ahead"}</h2></div>
          {next && <p className="remaining"><strong>{formatDistance(next.cumulativeMeters - meters, unit)}</strong><span>to go</span></p>}
        </div>
        {frontier && !next && <p className="route-status" role="status">{discovering ? "Finding nearby cities…" : "Choose a city to explore another route."}</p>}
        <div className="map-container">
          <JourneyMap route={state.route} meters={meters} />
          <p className="traveled"><Icon name="footsteps" />{formatDistance(totalMeters(state.days), unit)} traveled</p>
        </div>
        <p className="city-credit map-credit">City data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></p>
      </section>

      <section className="today-card" aria-labelledby="today-title">
        <h2 id="today-title">Today</h2>
        <button type="button" className="icon-button light-icon edit-total" aria-label="Edit today's total" onClick={() => setEditing(true)}><Icon name="edit" /></button>
        <p className="today-distance" aria-live="polite" aria-atomic="true">{formatDistance(today ? effectiveMeters(today) : 0, unit)}</p>
        <Icon name="footsteps" className="today-footsteps" />
        <div className="health-row">
          <p role="status"><span className="status-dot" />{syncing ? "Syncing · Demo" : today?.manualOverrideMeters !== undefined ? "Manual total · Demo" : "Health Connect · Demo"}</p>
          <button ref={syncButton} className="icon-button light-icon" disabled={syncing} aria-label="Sync health activity" onClick={syncHealth}>
            <Icon name="sync" className={syncing ? "spinning" : ""} />
          </button>
        </div>
      </section>

      <ActivityHistory days={state.days} today={sample.today} unit={unit} />

      <Passport collection={collection} />

      {choosingCity && <CityPicker catalog={catalog} carryLabel={`${formatDistance(checkpointCarry(state), unit)} carries over · stamps kept`}
        onSelect={(origin, candidates) => {
          if (placeKey(origin) !== placeKey(state.route[0]) && routeForOrigin(state, origin, candidates).length < 3) return false;
          dispatch({ type: "change-origin", origin, candidates }); setChoosingCity(false); return true;
        }} onClose={() => setChoosingCity(false)} />}
      {editing && <DailyTotalEditor meters={today ? effectiveMeters(today) : 0} importedMeters={hasSynced ? today?.importedMeters : undefined} hasCorrection={today?.manualOverrideMeters !== undefined} unit={unit}
        onSave={(meters) => { dispatch({ type: "correct-day", date: sample.today, meters }); setEditing(false); }}
        onUseImported={() => { dispatch({ type: "use-imported", date: sample.today }); setEditing(false); }}
        onClose={() => setEditing(false)} />}
      {!editing && !choosingCity && state.arrivals[0] && <Arrival key={state.arrivals[0].id} city={state.arrivals[0]} next={next} arrivalCount={collection.arrivalCount} fallbackFocus={syncButton} onContinue={() => dispatch({ type: "dismiss-arrival" })} />}
    </main>
  );
}
