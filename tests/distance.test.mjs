import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { entryValue, formatDistance, formatImportedDistance, parseDistanceEntry } from '../lib/distance.ts';
import { arrivedCities, effectiveMeters, initialJourney, journeyReducer, nextCity, totalMeters } from '../lib/journey.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json',import.meta.url)));
const synced = () => journeyReducer(initialJourney(sample.days,sample.route),{type:'import',reading:sample.healthImport});

test('S2.5: summaries convert consistently and do not mutate meters', () => {
  const state=synced();
  assert.equal(formatDistance(2400,'metric'),'2.4 km');
  assert.equal(formatDistance(2400,'miles'),'1.5 mi');
  assert.equal(formatDistance(12400,'miles'),'7.7 mi');
  assert.equal(formatDistance(20450,'miles'),'12.7 mi');
  assert.equal(formatImportedDistance(2400,'metric'),'2,400 m');
  for(let i=0;i<100;i++) { formatDistance(totalMeters(state.days),'metric'); formatDistance(totalMeters(state.days),'miles'); }
  assert.equal(totalMeters(state.days),12400);
});

test('S2.6-7: correction replaces the day while imports update only its source', () => {
  let state=journeyReducer(synced(),{type:'correct-day',date:sample.today,meters:3200});
  assert.equal(totalMeters(state.days),13200);
  state=journeyReducer(state,{type:'import',reading:{date:sample.today,importedMeters:5100}});
  const day=state.days.find(day=>day.date===sample.today);
  assert.equal(day.importedMeters,5100);
  assert.equal(effectiveMeters(day),3200);
  assert.equal(totalMeters(state.days),13200);
  state=journeyReducer(state,{type:'use-imported',date:sample.today});
  assert.equal(totalMeters(state.days),15100);
  assert.equal(state.days.find(day=>day.date===sample.today).manualOverrideMeters,undefined);
});

test('S2.8: zero stays effective after resync and recalculates the passport', () => {
  let state=journeyReducer(synced(),{type:'correct-day',date:sample.today,meters:0});
  state=journeyReducer(state,{type:'import',reading:sample.healthImport});
  assert.equal(totalMeters(state.days),10000);
  assert.deepEqual(arrivedCities(state.route,totalMeters(state.days)),[]);
  assert.equal(nextCity(state.route,totalMeters(state.days)).id,'alexandria');
  assert.deepEqual(state.arrivals,[]);
});

test('S2.10: unchanged rounded mile entries preserve the original meter value', () => {
  for(const meters of [0,1,2,500,1609,2400,3200,32850,165051]) {
    assert.equal(parseDistanceEntry(entryValue(meters,'miles'),'miles',meters),meters);
    assert.equal(parseDistanceEntry(entryValue(meters,'metric'),'metric',meters),meters);
  }
  let meters=2400;
  for(let i=0;i<100;i++) meters=parseDistanceEntry(entryValue(meters,'miles'),'miles',meters);
  assert.equal(meters,2400);
  assert.equal(parseDistanceEntry('1.4910','miles',2400),2400);
});

test('changed miles convert once to whole meters; invalid entries do not become zero', () => {
  assert.equal(parseDistanceEntry('1','miles',2400),1609);
  assert.equal(parseDistanceEntry('2.5','miles',2400),4023);
  assert.equal(parseDistanceEntry('2,5','miles',2400),4023);
  assert.equal(parseDistanceEntry('3200','metric',2400),3200);
  assert.equal(parseDistanceEntry('0','metric',2400),0);
  for(const input of ['', ' ', '-2', 'abc', 'NaN', 'Infinity', '1e3', '1.5', '3,200', '99999999999999999']) {
    assert.equal(parseDistanceEntry(input,'metric',2400),null,input);
  }
  for(const input of ['', '-1', 'Infinity', '1.2.3', '1,2,3']) assert.equal(parseDistanceEntry(input,'miles',2400),null,input);
});

test('correction before the first import remains effective when health arrives', () => {
  let state=journeyReducer(initialJourney(sample.days,sample.route),{type:'correct-day',date:sample.today,meters:500});
  state=journeyReducer(state,{type:'import',reading:sample.healthImport});
  assert.equal(totalMeters(state.days),10500);
  assert.equal(state.days.find(day=>day.date===sample.today).importedMeters,2400);
});

test('restoring an imported total does not replay an already announced arrival', () => {
  let state=journeyReducer(synced(),{type:'dismiss-arrival'});
  state=journeyReducer(state,{type:'correct-day',date:sample.today,meters:0});
  state=journeyReducer(state,{type:'use-imported',date:sample.today});
  assert.equal(arrivedCities(state.route,totalMeters(state.days)).length,1);
  assert.deepEqual(state.arrivals,[]);
});
