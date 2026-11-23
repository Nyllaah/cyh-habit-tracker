import { test } from 'node:test';
import assert from 'node:assert/strict';
import brazil from '../data/brazil-municipalities.json' with { type: 'json' };
import us from '../data/us-municipalities.json' with { type: 'json' };
import { countryCompletion, earnedCompletions } from '../lib/completion.ts';
import { initialJourney, journeyReducer, collectedStamps } from '../lib/journey.ts';
import { routeFromOrigin } from '../lib/places.ts';

const place = (name, region, country = 'BR', latitude = -9, longitude = -67) => ({ id: `${country}-${region}-${name}`, name, region, country, latitude, longitude });
const region = (result, code) => result.regions.find(badge => badge.region === code);

test('state completion requires every registered municipality, not every visible map stop', () => {
  const acre = brazil.municipalitiesByState.AC.map(name => place(name, 'AC'));
  assert.equal(region(countryCompletion(acre.slice(1), 'BR'), 'AC').earned, false);
  const complete = countryCompletion([...acre, ...acre, place('Invented city', 'AC')], 'BR');
  assert.equal(region(complete, 'AC').total, 22);
  assert.equal(region(complete, 'AC').completed, 22);
  assert.equal(region(complete, 'AC').earned, true);
  assert.equal(complete.country.completed, 1);
  assert.equal(complete.country.total, 27);
  assert.equal(complete.country.earned, false);
});

test('a country needs all regions, including its federal district', () => {
  const all = Object.entries(brazil.municipalitiesByState).flatMap(([code, names]) => names.map(name => place(name, code)));
  assert.equal(countryCompletion(all.filter(city => city.region !== 'DF'), 'BR').country.earned, false);
  assert.equal(countryCompletion(all, 'BR').country.earned, true);
  assert.equal(countryCompletion(all, 'BR').country.completed, 27);
  assert.equal(countryCompletion([], 'FR'), undefined);
});

test('US completion excludes CDPs, deduplicates MA Town-city aliases, and includes DC', () => {
  const names = us.municipalitiesByState.MA;
  const aliasCount = names.filter(name => name.endsWith(' Town') && names.includes(name.slice(0, -5))).length;
  const result = countryCompletion([place('Winthrop', 'MA', 'US'), place('Winthrop Town', 'MA', 'US'), place('White Center', 'WA', 'US'), place('Washington', 'DC', 'US')], 'US');
  assert.equal(region(result, 'MA').total, names.length - aliasCount);
  assert.equal(region(result, 'MA').completed, 1);
  assert.equal(region(result, 'WA').completed, 0);
  assert.equal(region(result, 'DC').earned, true);
  assert.equal(result.country.total, 51);
  assert.equal(region(result, 'HI').earned, false);
  assert.equal(result.country.supported, false);
});

test('starting city counts silently, fresh accounts have no rewards, and setup notices do not replay', () => {
  const origin = place('Brasília', 'DF', 'BR', -15.79, -47.88);
  const candidates = [place('Formosa', 'GO', 'BR', -15.5, -47.3), place('Luziânia', 'GO', 'BR', -16.2, -47.9)];
  let state = initialJourney([], [], candidates);
  assert.deepEqual(earnedCompletions(collectedStamps(state).map(stamp => stamp.city)), []);
  state = journeyReducer(state, { type: 'change-origin', origin, candidates });
  assert.deepEqual(state.completionArrivals, []);
  assert.equal(earnedCompletions(collectedStamps(state).map(stamp => stamp.city))[0].id, 'BR:DF');
  assert(state.announcedCompletionIds.includes('BR:DF'));
  state = journeyReducer(state, { type: 'extend-route', candidates, appendCount: 6 });
  assert.deepEqual(state.completionArrivals, []);
  assert.equal(state.days.length, 0);
  state = journeyReducer(state, { type: 'dismiss-completion' });
  state = journeyReducer(state, { type: 'correct-day', date: '2026-11-22', meters: 0 });
  assert.equal(state.completionArrivals.length, 0);
});

test('corrections revoke active completion but preserve archived completion', () => {
  const origin = place('Guajará', 'AM', 'BR', -10, -67);
  const candidates = brazil.municipalitiesByState.AC.map(name => place(name, 'AC'));
  const route = [{ ...origin, cumulativeMeters: 0 }, ...candidates.map((city, index) => ({ ...city, cumulativeMeters: (index + 1) * 1000 }))];
  let state = initialJourney([], route, candidates);
  state = journeyReducer(state, { type: 'correct-day', date: '2026-11-22', meters: 200000 });
  assert.equal(state.completionArrivals[0].id, 'BR:AC');
  const archived = { route: state.route, meters: 200000 };
  const corrected = journeyReducer(state, { type: 'correct-day', date: '2026-11-22', meters: 0 });
  assert.equal(corrected.completionArrivals.length, 0);
  assert.equal(earnedCompletions(collectedStamps(corrected).map(stamp => stamp.city)).length, 0);
  const restored = journeyReducer(corrected, { type: 'correct-day', date: '2026-11-22', meters: 200000 });
  assert.equal(restored.completionArrivals.length, 0); // announced only once
  const kept = journeyReducer({ ...state, previousJourneys: [archived] }, { type: 'correct-day', date: '2026-11-22', meters: 0 });
  assert.equal(earnedCompletions(collectedStamps(kept).map(stamp => stamp.city))[0].id, 'BR:AC');
});

test('historical backfill exposes old completion without replaying its celebration', () => {
  const brasilia = place('Brasília', 'DF', 'BR', -15.79, -47.88);
  const origin = place('New York', 'NY', 'US', 40.71, -74);
  const candidates = [place('Jersey City', 'NJ', 'US', 40.72, -74.07), place('Newark', 'NJ', 'US', 40.73, -74.17)];
  let state = initialJourney([], routeFromOrigin(origin, candidates), candidates);
  state = journeyReducer(state, { type: 'demo-sync', reading: { date: '2026-11-22', importedMeters: 0 }, history: [{ days: [], route: [{ ...brasilia, cumulativeMeters: 0 }] }] });
  assert.equal(earnedCompletions(collectedStamps(state).map(stamp => stamp.city))[0].id, 'BR:DF');
  assert.equal(state.completionArrivals.length, 0);
});


test('loading an existing district journey never announces its origin reward', () => {
  const origin = place('Washington', 'DC', 'US', 38.9072, -77.0369);
  const candidates = [place('Alexandria', 'VA', 'US', 38.8048, -77.0469), place('Occoquan', 'VA', 'US', 38.6839, -77.2603)];
  for (let state of [initialJourney([], routeFromOrigin(origin, candidates), candidates), journeyReducer(initialJourney([], [], candidates), { type: 'change-origin', origin, candidates })]) {
    assert.deepEqual(state.completionArrivals, []);
    assert(state.announcedCompletionIds.includes('US:DC'));
    state = journeyReducer(state, { type: 'extend-route', candidates, appendCount: 6 });
    assert.deepEqual(state.completionArrivals, []);
    state = journeyReducer(state, { type: 'import', reading: { date: '2026-11-22', importedMeters: 12500 } });
    assert.equal(state.arrivals[0].name, 'Alexandria');
    assert.deepEqual(state.completionArrivals, []);
  }
});
