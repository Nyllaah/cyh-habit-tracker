import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialJourney, journeyReducer, routeMeters } from '../lib/journey.ts';
import { passportCollection } from '../lib/passport.ts';
import { placeKey } from '../lib/places.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../data/cities.json', import.meta.url))).places;
const imported = () => journeyReducer(initialJourney(sample.days, sample.route, catalog), {type:'import',reading:sample.healthImport});
const all = collection => [...collection.preview, ...collection.moreCollected, ...collection.moreUpcoming];
const city = name => catalog.find(place => place.name === name);
const move = (state, name) => journeyReducer(state, {type:'change-origin',origin:city(name),candidates:catalog});

test('S6.29-30: preview shows origin, latest arrival and next stop; disclosure adds remaining destinations without duplicates', () => {
  const collection = passportCollection(imported());
  assert.deepEqual(collection.preview.map(stamp=>stamp.city.id), ['washington','alexandria','occoquan']);
  assert.deepEqual(collection.preview.map(stamp=>stamp.earned), [true,true,false]);
  assert.deepEqual(collection.moreUpcoming.map(stamp=>stamp.city.id), ['fredericksburg','richmond']);
  assert.equal(collection.moreCollected.length, 0);
  assert.equal(collection.arrivalCount, 1);
  assert.equal(all(collection).length, 5);
  assert.equal(new Set(all(collection).map(stamp=>placeKey(stamp.city))).size, 5);
});

test('S6.29: before the first arrival, preview fills available slots with upcoming cities', () => {
  const collection = passportCollection(initialJourney(sample.days, sample.route));
  assert.deepEqual(collection.preview.map(stamp=>stamp.city.id), ['washington','alexandria','occoquan']);
  assert.deepEqual(collection.preview.map(stamp=>stamp.earned), [true,false,false]);
  assert.equal(collection.arrivalCount, 0);
});

test('S6.29-30: a longer journey previews its latest arrival and exposes earlier collected stamps', () => {
  const state = initialJourney([{date:sample.today,importedMeters:80000}], sample.route);
  const collection = passportCollection(state);
  assert.deepEqual(collection.preview.map(stamp=>stamp.city.id), ['washington','fredericksburg','richmond']);
  assert.deepEqual(collection.moreCollected.map(stamp=>stamp.city.id), ['alexandria','occoquan']);
  assert.equal(collection.moreUpcoming.length, 0);
  assert.equal(collection.arrivalCount, 3);
});

test('S6.29-30: an exhausted route has only earned stamps and never invents a future destination', () => {
  const collection = passportCollection(initialJourney([{date:sample.today,importedMeters:200000}], sample.route));
  assert.equal(collection.preview.length, 3);
  assert.equal(collection.moreUpcoming.length, 0);
  assert.ok(all(collection).every(stamp=>stamp.earned));
  assert.equal(collection.arrivalCount, 4);
});

test('S6.29-30/S3.28: moving origin preserves all rewards, with current origin and next city in the compact preview', () => {
  let state = move(move(imported(), 'New York'), 'Seattle');
  const collection = passportCollection(state);
  assert.equal(collection.preview[0].city.name, 'Seattle');
  assert.equal(collection.preview[1].city.id, 'alexandria');
  assert.equal(collection.preview[2].earned, false);
  assert.ok(collection.moreCollected.some(stamp=>stamp.city.id==='washington'));
  assert.ok(collection.moreCollected.some(stamp=>stamp.city.name==='New York'));
  assert.equal(collection.arrivalCount, 1);
  assert.equal(new Set(all(collection).map(stamp=>placeKey(stamp.city))).size, all(collection).length);
  state = journeyReducer(state, {type:'correct-day',date:sample.today,meters:0});
  assert.equal(routeMeters(state), 0);
  assert.equal(passportCollection(state).arrivalCount, 1);
});

test('S6.30: correction recalculates active stamps and keeps future stamps out of the arrival count', () => {
  let state = journeyReducer(imported(), {type:'correct-day',date:sample.today,meters:0});
  let collection = passportCollection(state);
  assert.equal(collection.arrivalCount, 0);
  assert.equal(collection.preview.find(stamp=>stamp.city.id==='alexandria').earned, false);
  state = journeyReducer(state, {type:'use-imported',date:sample.today});
  collection = passportCollection(state);
  assert.equal(collection.arrivalCount, 1);
  assert.equal(collection.preview.find(stamp=>stamp.city.id==='alexandria').earned, true);
  assert.deepEqual(state.arrivals, []);
});

test('S6.30: selecting an already collected city as origin cannot duplicate or downgrade its destination stamp', () => {
  const collection = passportCollection(move(move(imported(), 'New York'), 'Alexandria'));
  const stamps = all(collection).filter(stamp=>stamp.city.id==='alexandria');
  assert.equal(stamps.length, 1);
  assert.equal(stamps[0].earned, true);
  assert.equal(stamps[0].origin, false);
  assert.equal(collection.arrivalCount, 1);
});

test('S6.31: one activity update queues each newly reached city in route order, and dismissal/resync cannot replay them', () => {
  let state = imported();
  state = journeyReducer(state, {type:'dismiss-arrival'});
  state = journeyReducer(state, {type:'correct-day',date:sample.today,meters:70000});
  assert.deepEqual(state.arrivals.map(city=>city.id), ['occoquan','fredericksburg']);
  state = journeyReducer(state, {type:'dismiss-arrival'});
  assert.deepEqual(state.arrivals.map(city=>city.id), ['fredericksburg']);
  state = journeyReducer(state, {type:'dismiss-arrival'});
  state = journeyReducer(state, {type:'import',reading:sample.healthImport});
  assert.deepEqual(state.arrivals, []);
  assert.equal(passportCollection(state).arrivalCount, 3);
});

test('S6.31: downward correction removes queued arrivals that are no longer reached', () => {
  let state = journeyReducer(imported(), {type:'correct-day',date:sample.today,meters:70000});
  state = journeyReducer(state, {type:'correct-day',date:sample.today,meters:0});
  assert.deepEqual(state.arrivals, []);
  assert.equal(passportCollection(state).arrivalCount, 0);
});

test('S6.29: when every known stamp fits the preview, there is nothing to disclose', () => {
  const collection = passportCollection(initialJourney(sample.days, sample.route.slice(0,3)));
  assert.equal(collection.preview.length, 3);
  assert.equal(collection.moreCollected.length, 0);
  assert.equal(collection.moreUpcoming.length, 0);
});
