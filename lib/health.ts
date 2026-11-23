import { nextCity, routeMeters, type Day, type JourneyState } from "./journey.ts";

// Freeze one new reading per chosen route; repeat syncs reuse that total.
export function demoReadingForJourney(state: JourneyState, date: string): Day | null {
  const meters = routeMeters(state);
  const next = nextCity(state.route, meters);
  if (!next) return null;
  const following = state.route[state.route.indexOf(next) + 1];
  const extra = following ? Math.min(800, Math.floor((following.cumulativeMeters - next.cumulativeMeters) / 4)) : 800;
  const previous = state.days.find((day) => day.date === date)?.importedMeters ?? 0;
  return { date, importedMeters: previous + next.cumulativeMeters - meters + extra };
}

// Local simulation: no device permissions or health records are accessed.
export async function readDemoHealth(reading: Day): Promise<Day> {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return { ...reading };
}
