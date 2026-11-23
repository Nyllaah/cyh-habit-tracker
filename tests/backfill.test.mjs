import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectedStamps, initialJourney, journeyReducer, routeMeters, totalMeters } from '../lib/journey.ts';
import { distanceMeters, routeFromOrigin, placeKey } from '../lib/places.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../data/cities.json', import.meta.url))).places;
const account = () => initialJourney(sample.days, sample.route, catalog, sample.previousJourneys);

test('backfilled account shares older records across history and lifetime distance, preserving the Alexandria demo', () => {
  const state = account();
  const older = sample.previousJourneys.flatMap(journey => journey.days);
  assert.ok(older.length >= 90);
  assert.equal(older[0].date, '2026-08-01');
  assert.equal(older.at(-1).date, '2026-11-18');
  assert.equal(new Set(state.days.map(day => day.date)).size, state.days.length);
  assert.ok(state.days.every(day => day.date < sample.today && Number.isSafeInteger(day.importedMeters) && day.importedMeters >= 0));
  assert.ok(older.some(day => day.importedMeters === 0));
  assert.equal(totalMeters(state.days), totalMeters(older) + 10000);
  assert.equal(routeMeters(state), 10000);
  assert.deepEqual(state.arrivals, []);
  const synced = journeyReducer(state, { type: 'import', reading: sample.healthImport });
  assert.equal(routeMeters(synced), 12400);
  assert.equal(totalMeters(synced.days), totalMeters(state.days) + 2400);
  assert.deepEqual(synced.arrivals.map(city => city.id), ['alexandria']);
  assert.equal(routeMeters(journeyReducer(synced, { type: 'import', reading: sample.healthImport })), 12400);
});

test('completed Brazil distance matches geographic checkpoints and yields retained stamps', () => {
  const state = account();
  for (const journey of state.previousJourneys) {
    assert.equal(journey.meters, journey.route.at(-1).cumulativeMeters);
    journey.route.slice(1).forEach((city, index) => {
      assert.equal(city.cumulativeMeters - journey.route[index].cumulativeMeters, distanceMeters(journey.route[index], city));
    });
    for (const city of journey.route) assert.ok(collectedStamps(state).some(stamp => placeKey(stamp.city) === placeKey(city)));
  }
  const brasilia = catalog.find(city => city.name === 'Brasília');
  assert.ok(routeFromOrigin(brasilia, catalog, 10000).length >= 3);
  const moved = journeyReducer(state, { type: 'change-origin', origin: brasilia, candidates: catalog });
  assert.equal(routeMeters(moved), 10000);
  assert.strictEqual(moved.days, state.days);
  assert.ok(moved.route.length >= 3);
  assert.ok(collectedStamps(moved).some(stamp => stamp.city.name === 'Goiânia'));
});
