import { earnedCompletions, type CompletionBadge } from "./completion.ts";
import { distinctPlaces, extendRoute, placeKey, routeFromOrigin, type City, type Place } from "./places.ts";
export type { City, Place } from "./places.ts";

export type Day = {
  date: string;
  importedMeters: number;
  manualOverrideMeters?: number;
};

export function effectiveMeters(day: Day): number {
  return day.manualOverrideMeters ?? day.importedMeters;
}

export function totalMeters(days: Day[]): number {
  return days.reduce((sum, day) => sum + effectiveMeters(day), 0);
}

// A health reading is the total for a day, not an extra activity to append.
export function mergeImport(days: Day[], reading: Day): Day[] {
  const existing = days.find((day) => day.date === reading.date);
  if (!existing) return [...days, reading].sort((a, b) => a.date.localeCompare(b.date));
  return days.map((day) => day.date === reading.date
    ? { ...day, importedMeters: reading.importedMeters }
    : day);
}

export function arrivedCities(route: City[], meters: number): City[] {
  return route.slice(1).filter((city) => meters >= city.cumulativeMeters);
}

export function nextCity(route: City[], meters: number): City | undefined {
  return route.slice(1).find((city) => city.cumulativeMeters > meters);
}

export function legProgress(route: City[], meters: number, endIndex: number): number {
  const start = route[endIndex - 1].cumulativeMeters;
  const end = route[endIndex].cumulativeMeters;
  return Math.min(1, Math.max(0, (meters - start) / (end - start)));
}

export type JourneyState = {
  days: Day[];
  route: City[];
  announcedCityIds: string[];
  announcedCompletionIds: string[];
  completionArrivals: CompletionBadge[];
  arrivals: City[];
  candidates: Place[];
  routeOffsetMeters: number;
  previousJourneys: { route: City[]; meters: number }[];
  demoHistoryLoaded: boolean;
};

export type PastJourney = { days: Day[]; route: City[] };

export function initialJourney(days: Day[], route: City[], candidates: Place[] = route, history: PastJourney[] = []): JourneyState {
  const previousJourneys = history.map((journey) => ({ route: journey.route, meters: totalMeters(journey.days) }));
  // Older journeys populate the same history without spending their distance twice.
  const allDays = [...history.flatMap((journey) => journey.days), ...days].sort((a, b) => a.date.localeCompare(b.date));
  const state: JourneyState = { days: allDays, route, candidates, announcedCompletionIds: [], completionArrivals: [], routeOffsetMeters: previousJourneys.reduce((sum, journey) => sum + journey.meters, 0), previousJourneys, demoHistoryLoaded: history.length > 0, announcedCityIds: arrivedCities(route, totalMeters(days)).map((city) => city.id), arrivals: [] };
  return { ...state, announcedCompletionIds: earnedCompletions(collectedStamps(state).map((stamp) => stamp.city)).map((badge) => badge.id) };
}

// The active journey counts activity added after its starting offset.
export function routeMeters(state: JourneyState): number {
  if (!state.route.length) return 0;
  return Math.max(0, totalMeters(state.days) - state.routeOffsetMeters);
}

export function collectedStamps(state: JourneyState): { city: City; origin: boolean }[] {
  const stamps = new Map<string, { city: City; origin: boolean }>();
  for (const journey of [...state.previousJourneys, { route: state.route, meters: routeMeters(state) }]) {
    if (!journey.route.length) continue;
    for (const city of [journey.route[0], ...arrivedCities(journey.route, journey.meters)]) {
      const key = placeKey(city);
      const origin = city === journey.route[0];
      // A destination stamp takes precedence if this city was also an origin.
      if (!stamps.has(key) || !origin) stamps.set(key, { city, origin });
    }
  }
  return [...stamps.values()];
}

function availableCandidates(state: JourneyState, candidates: Place[]): Place[] {
  const archived = new Set(state.previousJourneys.flatMap((journey) =>
    [journey.route[0], ...arrivedCities(journey.route, journey.meters)].map(placeKey)));
  return candidates.filter((place) => !archived.has(placeKey(place)));
}

export function routeForOrigin(state: JourneyState, origin: Place, candidates: Place[]): City[] {
  const previousJourneys = state.route.length ? [...state.previousJourneys, { route: state.route, meters: routeMeters(state) }] : state.previousJourneys;
  return routeFromOrigin(origin, availableCandidates({ ...state, previousJourneys }, distinctPlaces([...state.candidates, ...candidates])), 0);
}

export type JourneyAction =
  | { type: "import"; reading: Day }
  | { type: "demo-sync"; reading: Day; history: PastJourney[] }
  | { type: "correct-day"; date: string; meters: number }
  | { type: "use-imported"; date: string }
  | { type: "extend-route"; candidates: Place[]; upcomingCount?: number; appendCount?: number }
  | { type: "change-origin"; origin: Place; candidates: Place[] }
  | { type: "dismiss-arrival" }
  | { type: "dismiss-completion" };

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  if (action.type === "demo-sync") {
    if (!state.route.length) return state;
    if (state.demoHistoryLoaded) return journeyReducer(state, { type: "import", reading: action.reading });
    // Load source values while preserving corrections entered before first sync.
    const byDate = new Map(action.history.flatMap((journey) => journey.days).map((day) => [day.date, day]));
    for (const day of state.days) {
      const historical = byDate.get(day.date);
      byDate.set(day.date, historical ? { ...day, importedMeters: historical.importedMeters } : day);
    }
    const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const historicalMeters = totalMeters(days) - totalMeters(state.days);
    const populated = {
      ...state, days, demoHistoryLoaded: true,
      routeOffsetMeters: state.routeOffsetMeters + historicalMeters,
      previousJourneys: [...action.history.map((journey) => ({ route: journey.route, meters: totalMeters(journey.days) })), ...state.previousJourneys],
    };
    // Historical awards are visible without replaying old celebrations.
    const historicalAwards = earnedCompletions(collectedStamps(populated).map((stamp) => stamp.city)).map((badge) => badge.id);
    return journeyReducer({ ...populated, announcedCompletionIds: [...new Set([...state.announcedCompletionIds, ...historicalAwards])] }, { type: "import", reading: action.reading });
  }
  if (action.type === "dismiss-completion") return { ...state, completionArrivals: state.completionArrivals.slice(1) };
  if (action.type === "dismiss-arrival") return { ...state, arrivals: state.arrivals.slice(1) };
  if (action.type === "change-origin") {
    if (state.route[0] && placeKey(action.origin) === placeKey(state.route[0])) return state;
    const route = routeForOrigin(state, action.origin, action.candidates);
    if (route.length < 3) return state;
    const moved = {
      ...state,
      routeOffsetMeters: totalMeters(state.days),
      previousJourneys: state.route.length ? [...state.previousJourneys, { route: state.route, meters: routeMeters(state) }] : state.previousJourneys,
      arrivals: [],
      completionArrivals: [],
    };
    return reconcileJourney(moved, state.days, route, distinctPlaces([...state.candidates, ...action.candidates]));
  }
  if (action.type === "extend-route") {
    const candidates = distinctPlaces([...state.candidates, ...action.candidates]);
    const meters = routeMeters(state);
    const target = action.appendCount === undefined ? action.upcomingCount
      : state.route.filter((city) => city.cumulativeMeters > meters).length + Math.max(0, Math.min(12, Math.floor(action.appendCount)));
    const route = extendRoute(state.route, availableCandidates(state, candidates), meters, target);
    if (route.length === state.route.length && candidates.length === state.candidates.length) return state;
    return reconcileJourney(state, state.days, route, candidates);
  }
  let days: Day[];
  if (action.type === "import") {
    days = mergeImport(state.days, action.reading);
  } else if (action.type === "correct-day") {
    if (!Number.isSafeInteger(action.meters) || action.meters < 0) return state;
    const existing = state.days.find((day) => day.date === action.date);
    days = existing
      ? state.days.map((day) => day.date === action.date ? { ...day, manualOverrideMeters: action.meters } : day)
      : [...state.days, { date: action.date, importedMeters: 0, manualOverrideMeters: action.meters }];
  } else {
    days = state.days.map((day) => {
      if (day.date !== action.date) return day;
      const imported = { ...day };
      delete imported.manualOverrideMeters;
      return imported;
    });
  }
  const route = extendRoute(state.route, availableCandidates(state, state.candidates), Math.max(0, totalMeters(days) - state.routeOffsetMeters));
  return reconcileJourney(state, days, route, state.candidates);
}

function reconcileJourney(state: JourneyState, days: Day[], route: City[], candidates: Place[]): JourneyState {
  const reached = arrivedCities(route, Math.max(0, totalMeters(days) - state.routeOffsetMeters));
  const newArrivals = reached
    .filter((city) => !state.announcedCityIds.includes(city.id));
  const updated = {
    ...state,
    days,
    route,
    candidates,
    announcedCityIds: [...state.announcedCityIds, ...newArrivals.map((city) => city.id)],
    arrivals: [...state.arrivals.filter((city) => reached.some((current) => current.id === city.id)), ...newArrivals],
  };
  const earned = earnedCompletions(collectedStamps(updated).map((stamp) => stamp.city));
  const newAwards = earned.filter((badge) => !state.announcedCompletionIds.includes(badge.id));
  return { ...updated,
    announcedCompletionIds: [...state.announcedCompletionIds, ...newAwards.map((badge) => badge.id)],
    completionArrivals: [...state.completionArrivals.filter((badge) => earned.some((current) => current.id === badge.id)), ...newAwards],
  };
}
