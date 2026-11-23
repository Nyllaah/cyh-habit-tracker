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
  arrivals: City[];
  candidates: Place[];
  routeOffsetMeters: number;
  previousJourneys: { route: City[]; meters: number }[];
};

export type PastJourney = { days: Day[]; route: City[] };

export function initialJourney(days: Day[], route: City[], candidates: Place[] = route, history: PastJourney[] = []): JourneyState {
  const previousJourneys = history.map((journey) => ({ route: journey.route, meters: totalMeters(journey.days) }));
  // Older journeys populate the same history without spending their distance twice.
  const allDays = [...history.flatMap((journey) => journey.days), ...days].sort((a, b) => a.date.localeCompare(b.date));
  return { days: allDays, route, candidates, routeOffsetMeters: previousJourneys.reduce((sum, journey) => sum + journey.meters, 0), previousJourneys, announcedCityIds: arrivedCities(route, totalMeters(days)).map((city) => city.id), arrivals: [] };
}

// Completed checkpoints consume distance; only the unfinished leg moves to a new origin.
export function routeMeters(state: JourneyState): number {
  return Math.max(0, totalMeters(state.days) - state.routeOffsetMeters);
}

export function checkpointCarry(state: JourneyState): number {
  const meters = routeMeters(state);
  const reached = arrivedCities(state.route, meters);
  return meters - (reached.at(-1)?.cumulativeMeters ?? 0);
}

export function collectedStamps(state: JourneyState): { city: City; origin: boolean }[] {
  const stamps = new Map<string, { city: City; origin: boolean }>();
  for (const journey of [...state.previousJourneys, { route: state.route, meters: routeMeters(state) }]) {
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
  const archivedState = { ...state, previousJourneys: [...state.previousJourneys, { route: state.route, meters: routeMeters(state) }] };
  return routeFromOrigin(origin, availableCandidates(archivedState, distinctPlaces([...state.candidates, ...candidates])), checkpointCarry(state));
}

export type JourneyAction =
  | { type: "import"; reading: Day }
  | { type: "correct-day"; date: string; meters: number }
  | { type: "use-imported"; date: string }
  | { type: "extend-route"; candidates: Place[] }
  | { type: "change-origin"; origin: Place; candidates: Place[] }
  | { type: "dismiss-arrival" };

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  if (action.type === "dismiss-arrival") return { ...state, arrivals: state.arrivals.slice(1) };
  if (action.type === "change-origin") {
    if (placeKey(action.origin) === placeKey(state.route[0])) return state;
    const route = routeForOrigin(state, action.origin, action.candidates);
    if (route.length < 3) return state;
    const carry = checkpointCarry(state);
    const moved = {
      ...state,
      routeOffsetMeters: totalMeters(state.days) - carry,
      previousJourneys: [...state.previousJourneys, { route: state.route, meters: routeMeters(state) }],
      arrivals: [],
    };
    return reconcileJourney(moved, state.days, route, distinctPlaces([...state.candidates, ...action.candidates]));
  }
  if (action.type === "extend-route") {
    const candidates = distinctPlaces([...state.candidates, ...action.candidates]);
    const route = extendRoute(state.route, availableCandidates(state, candidates), routeMeters(state));
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
  return {
    ...state,
    days,
    route,
    candidates,
    announcedCityIds: [...state.announcedCityIds, ...newArrivals.map((city) => city.id)],
    arrivals: [...state.arrivals.filter((city) => reached.some((current) => current.id === city.id)), ...newArrivals],
  };
}
