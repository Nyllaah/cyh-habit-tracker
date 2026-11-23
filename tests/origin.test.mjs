import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkpointCarry, collectedStamps, initialJourney, journeyReducer, routeForOrigin, routeMeters, totalMeters } from '../lib/journey.ts';
import { placeKey } from '../lib/places.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../data/cities.json', import.meta.url))).places;
const city = name => catalog.find(place => place.name === name);
const imported = () => journeyReducer(initialJourney(sample.days, sample.route, catalog), { type: 'import', reading: sample.healthImport });
const move = (state, name) => journeyReducer(state, { type: 'change-origin', origin: city(name), candidates: catalog });

test('S3.28: changing origin keeps daily history and stamps, carrying only the unfinished checkpoint distance', () => {
  const before = imported();
  const state = move(before, 'New York');
  assert.strictEqual(state.days, before.days);
  assert.equal(totalMeters(state.days), 12400);
  assert.equal(routeMeters(state), 1283);
  assert.equal(state.routeOffsetMeters, 11117);
  assert.deepEqual(state.previousJourneys[0], { route: before.route, meters: 12400 });
  const stamps = collectedStamps(state);
  assert.ok(stamps.some(stamp => stamp.city.id === 'alexandria' && !stamp.origin));
  assert.ok(stamps.some(stamp => stamp.city.id === 'washington' && stamp.origin));
  assert.ok(stamps.some(stamp => stamp.city.name === 'New York' && stamp.origin));
  assert.equal(new Set(stamps.map(stamp => placeKey(stamp.city))).size, stamps.length);
  assert.deepEqual(state.arrivals, []);
});

test('S3.28: moving again without activity preserves the same carry; new activity adds once', () => {
  let state = move(move(imported(), 'New York'), 'Seattle');
  assert.equal(routeMeters(state), 1283);
  state = journeyReducer(state, { type: 'import', reading: { ...sample.healthImport, importedMeters: 3400 } });
  assert.equal(routeMeters(state), 2283);
  state = journeyReducer(state, { type: 'import', reading: { ...sample.healthImport, importedMeters: 3400 } });
  assert.equal(routeMeters(state), 2283);
  assert.ok(collectedStamps(state).some(stamp => stamp.city.id === 'alexandria'));
});

test('S3.28: an exact checkpoint carries zero and a subsequent route consumes only its completed checkpoints', () => {
  let state = journeyReducer(imported(), { type: 'correct-day', date: sample.today, meters: 1117 });
  assert.equal(checkpointCarry(state), 0);
  state = move(state, 'New York');
  assert.equal(routeMeters(state), 0);
  const checkpoint = state.route[1].cumulativeMeters;
  state = journeyReducer(state, { type: 'correct-day', date: sample.today, meters: 1117 + checkpoint + 700 });
  assert.equal(checkpointCarry(state), 700);
  const earned = state.route[1];
  state = move(state, 'Boston');
  assert.equal(routeMeters(state), 700);
  assert.equal(state.routeOffsetMeters, 11117 + checkpoint);
  assert.ok(collectedStamps(state).some(stamp => placeKey(stamp.city) === placeKey(earned)));
});

test('S2/S3.28: corrections recalculate active stamps but retain archived rewards and never create negative progress', () => {
  let state = move(imported(), 'New York');
  const checkpoint = state.route[1].cumulativeMeters;
  state = journeyReducer(state, { type: 'correct-day', date: sample.today, meters: 1117 + checkpoint });
  const activeStamp = state.route[1];
  assert.ok(collectedStamps(state).some(stamp => placeKey(stamp.city) === placeKey(activeStamp)));
  state = journeyReducer(state, { type: 'correct-day', date: sample.today, meters: 0 });
  assert.equal(routeMeters(state), 0);
  assert.ok(!collectedStamps(state).some(stamp => placeKey(stamp.city) === placeKey(activeStamp)));
  assert.ok(collectedStamps(state).some(stamp => stamp.city.id === 'alexandria'));
  const days = state.days;
  state = move(state, 'Seattle');
  assert.strictEqual(state.days, days);
  assert.equal(routeMeters(state), 0);
});

test('S3: same city is a no-op and an unsupported origin cannot replace a usable journey', () => {
  const state = imported();
  assert.strictEqual(journeyReducer(state, { type: 'change-origin', origin: state.route[0], candidates: catalog }), state);
  const remote = { id: 'remote', name: 'Remote', region: '', latitude: 0, longitude: 0 };
  assert.equal(routeForOrigin(state, remote, []).length, 1);
  assert.strictEqual(journeyReducer(state, { type: 'change-origin', origin: remote, candidates: [] }), state);
});


test('S3.15: unnamed GPS origins use coordinates for identity, so moving location is not mistaken for the same city', () => {
  const a = { id: 'location-a', name: 'Current location', region: '', country: '', latitude: 40.7, longitude: -74 };
  const b = { ...a, id: 'location-b', latitude: 47.6, longitude: -122.3 };
  assert.notEqual(placeKey(a), placeKey(b));
  assert.equal(placeKey(a), placeKey({ ...a, id: 'location-alias' }));
});
