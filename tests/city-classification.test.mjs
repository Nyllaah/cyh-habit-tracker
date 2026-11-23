import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCities, discoverNearby, searchCities } from '../lib/cities.ts';
import { initialJourney, journeyReducer } from '../lib/journey.ts';
const catalog = JSON.parse(readFileSync(new URL('../data/cities.json', import.meta.url))).places;
const registry = JSON.parse(readFileSync(new URL('../data/brazil-municipalities.json', import.meta.url))).municipalitiesByState;
const feature = (name, state = 'Federal District', value = 'town', countrycode = 'BR', coordinates = [-47.94, -15.79]) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates },
  properties: { name, state, countrycode, osm_key: 'place', osm_value: value, osm_type: 'R', osm_id: name },
});
const districts = ['Sudoeste e Octogonal', 'Cruzeiro', 'Guará', 'Águas Claras', 'São Sebastião', 'Planaltina', 'Taguatinga'];

test('Brazilian city results reject administrative regions even when tagged city or town', () => {
  for (const kind of ['city', 'town', 'suburb', 'neighbourhood', 'district', 'village']) {
    assert.deepEqual(normalizeCities({ features: districts.map(name => feature(name, 'Federal District', kind)) }, catalog), []);
  }
  assert.equal(normalizeCities({features:[feature('Brasilia', 'Distrito Federal', 'city')]}, catalog)[0].id, 'brasilia');
});

test('municipality validation respects state identity, accented names, and small municipalities', () => {
  const features = [feature('Cruzeiro', 'São Paulo'), feature('Cruzeiro', 'Federal District'), feature('Planaltina', 'Goiás'), feature('Planaltina', 'Federal District'), feature('Aguas Lindas de Goias', 'GO'), feature('Boa Esperança do Norte', 'Mato Grosso')];
  const results = normalizeCities({ features }, catalog);
  assert.deepEqual(results.map(place => [place.name, place.region]), [['Cruzeiro','SP'],['Planaltina','GO'],['Águas Lindas de Goiás','GO'],['Boa Esperança do Norte','MT']]);
  assert.equal(Object.values(registry).flat().length, 5571);
  assert.deepEqual(registry.DF, ['Brasília']);
  for (const place of catalog.filter(place => place.country === 'BR')) {
    assert.ok(normalizeCities({features:[feature(place.name,place.region)]},catalog).some(result => result.id === place.id));
  }
  assert.equal(normalizeCities({features:[feature('Boston','Massachusetts','city','US',[-71.06,42.36])]},catalog)[0].name,'Boston');
  assert.deepEqual(normalizeCities({features:[feature('Back Bay','Massachusetts','suburb','US',[-71.08,42.35])]},catalog),[]);
});

test('search, initial routes, and route extensions exclude mislabeled districts and retain offline city fallback', async () => {
  const data = {features: [...districts.map(name => feature(name)), feature('Valparaíso de Goiás','Goiás','town','BR',[-47.98,-16.07])]};
  const fetcher = async () => Response.json(data);
  const origin = catalog.find(place => place.name === 'Brasília');
  const candidates = await discoverNearby(origin,catalog,undefined,fetcher);
  assert.ok(candidates.length >= 2);
  assert.ok(!candidates.some(place => districts.includes(place.name)));
  let state = journeyReducer(initialJourney([],[],catalog),{type:'change-origin',origin,candidates});
  assert.equal(state.route[1].name,'Valparaíso de Goiás');
  state = journeyReducer(state,{type:'extend-route',candidates});
  assert.ok(!state.route.some(place => districts.includes(place.name)));
  const search = await searchCities('Cruzeiro',catalog,undefined,fetcher);
  assert.ok(!search.places.some(place => districts.includes(place.name)));
  const offline = await discoverNearby(origin,catalog,undefined,async()=>{throw new Error('offline');});
  assert.equal(offline[0].name,'Águas Lindas de Goiás');
});
