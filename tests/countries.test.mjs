import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countryName, placeCountry } from '../lib/countries.ts';
import { initialJourney, journeyReducer } from '../lib/journey.ts';
import { countryPassports, passportCollection } from '../lib/passport.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../data/cities.json', import.meta.url))).places;
const account = () => initialJourney(sample.days, sample.route, catalog, sample.previousJourneys);
const stamps = collection => [...collection.preview, ...collection.moreCollected, ...collection.moreUpcoming];

test('country passports separate existing and upcoming US stamps from collected Brazil stamps', () => {
  const state = account();
  const us = passportCollection(state, 'US');
  const br = passportCollection(state, 'BR');
  assert.ok(stamps(us).every(stamp => placeCountry(stamp.city) === 'US'));
  assert.ok(stamps(br).every(stamp => placeCountry(stamp.city) === 'BR'));
  assert.deepEqual(us.preview.map(stamp => stamp.city.id), ['washington', 'alexandria', 'occoquan']);
  assert.equal(us.arrivalCount, 0);
  assert.equal(br.arrivalCount, 4);
  assert.equal(br.preview[0].city.name, 'Brasília');
  assert.equal(br.moreUpcoming.length, 0);
  assert.equal(stamps(br).length, 5);
  assert.ok(stamps(br).every(stamp => stamp.earned));
  assert.equal(passportCollection(state).arrivalCount, us.arrivalCount + br.arrivalCount);
});

test('country grouping follows corrections without changing the archived country collection', () => {
  let state = journeyReducer(account(), {type:'import',reading:sample.healthImport});
  const before = passportCollection(state, 'BR');
  assert.equal(passportCollection(state, 'US').arrivalCount, 1);
  state = journeyReducer(state, {type:'correct-day',date:sample.today,meters:0});
  assert.equal(passportCollection(state, 'US').arrivalCount, 0);
  assert.deepEqual(passportCollection(state, 'BR'), before);
});

test('country identity handles explicit codes, coordinate-only GPS origins, and unsupported places', () => {
  assert.equal(placeCountry({country:'br'}), 'BR');
  assert.equal(placeCountry({country:'',latitude:-15.7939,longitude:-47.8828}), 'BR');
  assert.equal(placeCountry({country:'',latitude:38.9042,longitude:-77.0165}), 'US');
  assert.equal(placeCountry({country:'',latitude:0,longitude:0}), '');
  assert.equal(countryName('BR'), 'Brazil');
  assert.equal(countryName('US'), 'United States');
  assert.equal(countryName(''), 'Other places');
});

test('country groups cover the passport exactly once and derive current country from origin changes', () => {
  const state = account();
  const snapshot = JSON.stringify(state);
  const groups = countryPassports(state);
  assert.deepEqual(groups.map(group => group.country), ['BR', 'US']);
  assert.deepEqual(groups.map(group => group.name), ['Brazil', 'United States']);
  assert.equal(groups.flatMap(group => stamps(group.collection)).length, stamps(passportCollection(state)).length);
  assert.equal(JSON.stringify(state), snapshot);
  const origin = catalog.find(city => city.name === 'Brasília');
  const moved = journeyReducer(state, {type:'change-origin', origin, candidates:catalog});
  assert.equal(placeCountry(moved.route[0]), 'BR');
  assert.equal(countryPassports(moved).find(group => group.country === 'BR').collection.preview[0].city.name, 'Brasília');
  assert.strictEqual(moved.days, state.days);
  assert.equal(passportCollection(moved, 'US').preview[0].city.name, 'Washington');
});
