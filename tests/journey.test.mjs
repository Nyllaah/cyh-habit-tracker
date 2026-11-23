import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arrivedCities, initialJourney, journeyReducer, cityProgress, mergeImport, nextCity, totalMeters } from '../lib/journey.ts';

const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));

test('a daily import advances the journey from 10,000 to 12,400 meters (S1.1)', () => {
  assert.equal(totalMeters(sample.days), 10000);
  const days = mergeImport(sample.days, sample.healthImport);
  assert.equal(totalMeters(days), 12400);
  assert.equal(nextCity(sample.route, 12400).id, 'occoquan');
  assert.equal(nextCity(sample.route, 12400).distanceFromOriginMeters - 12400, 20223);
});

test('reimporting a daily total replaces it and cannot duplicate distance (S1.2)', () => {
  const first = mergeImport(sample.days, sample.healthImport);
  const second = mergeImport(first, sample.healthImport);
  assert.equal(totalMeters(second), 12400);
  assert.equal(second.filter(day => day.date === sample.today).length, 1);
  assert.equal(totalMeters(mergeImport(second, { date: sample.today, importedMeters: 3200 })), 13200);
});

test('arrival begins exactly at the threshold; origin is not an arrival (S1.3)', () => {
  assert.deepEqual(arrivedCities(sample.route, 11116), []);
  assert.deepEqual(arrivedCities(sample.route, 11117).map(city => city.id), ['alexandria']);
  assert.equal(cityProgress(sample.route, 11117, 1), 1);
  assert.equal(cityProgress(sample.route, 11117, 2), 11117 / sample.route[2].distanceFromOriginMeters);
});

test('sync announces a new city once, including after dismissal (S1.2-3)', () => {
  let state = initialJourney(sample.days, sample.route);
  state = journeyReducer(state, { type: 'import', reading: sample.healthImport });
  assert.deepEqual(state.arrivals.map(city => city.id), ['alexandria']);
  state = journeyReducer(state, { type: 'dismiss-arrival' });
  state = journeyReducer(state, { type: 'import', reading: sample.healthImport });
  assert.deepEqual(state.arrivals, []);
});

test('a lower effective distance recalculates stamps without changing origin', () => {
  assert.equal(arrivedCities(sample.route, 12400).length, 1);
  assert.equal(arrivedCities(sample.route, 10500).length, 0);
  assert.equal(sample.route[0].id, 'washington');
});
