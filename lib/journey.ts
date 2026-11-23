export type Day = {
  date: string;
  importedMeters: number;
  manualOverrideMeters?: number;
};

export type City = {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  cumulativeMeters: number;
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

export function formatKilometers(meters: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

export type JourneyState = {
  days: Day[];
  route: City[];
  announcedCityIds: string[];
  arrivals: City[];
};

export function initialJourney(days: Day[], route: City[]): JourneyState {
  return { days, route, announcedCityIds: arrivedCities(route, totalMeters(days)).map((city) => city.id), arrivals: [] };
}

export function journeyReducer(state: JourneyState, action: { type: "import"; reading: Day } | { type: "dismiss-arrival" }): JourneyState {
  if (action.type === "dismiss-arrival") return { ...state, arrivals: state.arrivals.slice(1) };
  const days = mergeImport(state.days, action.reading);
  const newArrivals = arrivedCities(state.route, totalMeters(days))
    .filter((city) => !state.announcedCityIds.includes(city.id));
  return {
    ...state,
    days,
    announcedCityIds: [...state.announcedCityIds, ...newArrivals.map((city) => city.id)],
    arrivals: [...state.arrivals, ...newArrivals],
  };
}
