import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialJourney, journeyReducer, routeMeters, totalMeters, collectedStamps } from '../lib/journey.ts';
import { demoReadingForJourney } from '../lib/health.ts';
import { countryPassports } from '../lib/passport.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../data/cities.json', import.meta.url))).places;
const account = () => initialJourney([], [], catalog, [...sample.previousJourneys, {days:sample.days,route:sample.route}]);
const start = (state,name) => journeyReducer(state, {type:'change-origin',origin:catalog.find(city=>city.name===name),candidates:catalog});

test('an archived account can retain history and country stamps without a selected city', () => {
  const state = account();
  assert.deepEqual(state.route, []);
  assert.equal(routeMeters(state), 0);
  assert.equal(demoReadingForJourney(state, sample.today), null);
  assert.equal(totalMeters(state.days), 319652);
  assert.deepEqual(state.arrivals, []);
  assert.deepEqual(countryPassports(state).map(group=>group.country), ['BR','US']);
  assert.ok(collectedStamps(state).some(stamp=>stamp.city.name==='Goiânia'));
});

test('each saved demonstration city starts at zero and sync reaches its own first checkpoint exactly once', () => {
  for (const name of ['Washington','New York','Boston','Seattle','San Francisco','Brasília','Goiânia']) {
    const state = start(account(),name);
    assert.equal(state.route[0].name, name);
    assert.equal(routeMeters(state), 0);
    assert.deepEqual(state.arrivals, []);
    const reading = demoReadingForJourney(state, sample.today);
    assert.ok(reading);
    const synced = journeyReducer(state,{type:'import',reading});
    assert.equal(synced.arrivals.length,1,name);
    assert.equal(synced.arrivals[0].id,state.route[1].id,name);
    assert.ok(routeMeters(synced)>state.route[1].cumulativeMeters);
    assert.ok(routeMeters(synced)<state.route[2].cumulativeMeters);
    const dismissed = journeyReducer(synced,{type:'dismiss-arrival'});
    const repeated = journeyReducer(dismissed,{type:'import',reading});
    assert.equal(totalMeters(repeated.days),totalMeters(synced.days));
    assert.deepEqual(repeated.arrivals,[]);
  }
});

test('changing city after a sync preserves the daily total and prepares only new activity for the next route', () => {
  let state=start(account(),'New York');
  state=journeyReducer(state,{type:'import',reading:demoReadingForJourney(state,sample.today)});
  const before=totalMeters(state.days), stamps=collectedStamps(state).length;
  state=start(state,'Boston');
  assert.equal(totalMeters(state.days),before);
  assert.equal(routeMeters(state),0);
  assert.deepEqual(state.arrivals,[]);
  assert.ok(collectedStamps(state).length>=stamps);
  const reading=demoReadingForJourney(state,sample.today);
  const previousToday=state.days.find(day=>day.date===sample.today).importedMeters;
  assert.ok(reading.importedMeters>previousToday);
  const synced=journeyReducer(state,{type:'import',reading});
  assert.equal(routeMeters(synced),reading.importedMeters-previousToday);
  assert.equal(synced.arrivals[0].id,state.route[1].id);
});

test('manual daily corrections still replace the route-specific demo import', () => {
  let state=start(account(),'New York');
  const reading=demoReadingForJourney(state,sample.today);
  state=journeyReducer(state,{type:'correct-day',date:sample.today,meters:0});
  state=journeyReducer(state,{type:'import',reading});
  assert.equal(routeMeters(state),0);
  assert.deepEqual(state.arrivals,[]);
  state=journeyReducer(state,{type:'use-imported',date:sample.today});
  assert.equal(state.arrivals[0].id,state.route[1].id);
});
