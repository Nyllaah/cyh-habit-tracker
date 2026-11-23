import type { Day } from "./journey";

// Local simulation: no device permissions or health records are accessed.
export async function readDemoHealth(reading: Day): Promise<Day> {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return { ...reading };
}
