import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import responses from './fixtures/photon-cities.json' with { type: 'json' };
import { normalizeCities, searchCities, discoverRouteCities } from '../lib/cities.ts';
import { routeFromOrigin } from '../lib/places.ts';
const catalog=JSON.parse(readFileSync(new URL('../data/cities.json',import.meta.url))).places;

test('recorded Photon municipality results make São Paulo searchable with a genuine starting route', async () => {
  const result=await searchCities('São Paulo',catalog,undefined,async()=>Response.json(responses['sao-paulo']));
  const city=result.places.find(city=>city.name==='São Paulo');
  assert.equal(city.region,'SP');
  assert(routeFromOrigin(city,catalog,0).length>=3);
  const offline=await searchCities('Sao Paulo',catalog,undefined,async()=>new Response(null,{status:503}));
  assert(offline.saved);assert(offline.places.some(city=>city.name==='São Paulo'));
});

test('recorded Brasília and Formosa results retain municipalities and exclude DF neighborhoods', async () => {
  const cities=normalizeCities(responses.brasilia,catalog);
  assert(cities.some(city=>city.name==='Valparaíso de Goiás'));
  assert(!cities.some(city=>['Cruzeiro','Sudoeste e Octogonal'].includes(city.name)));
  const origin=catalog.find(city=>city.name==='Formosa');
  const onward=await discoverRouteCities(origin,catalog,undefined,async()=>Response.json(responses.formosa));
  assert(onward.some(city=>city.name==='Água Fria de Goiás'));
  assert(onward.some(city=>city.name==='Planaltina'&&city.region==='GO'));
});

test('city-layer administrative boundaries still require an official BR/US municipality identity', () => {
  const features=responses.washington.features.map(feature=>({...feature,properties:{...feature.properties,osm_key:'boundary',osm_value:'administrative'}}));
  const cities=normalizeCities({features},catalog);
  assert(cities.some(city=>city.name==='Mount Rainier'));
  assert(!cities.some(city=>city.name==='Arlington')); // Unincorporated CDP, despite provider city layer.
  assert.deepEqual(normalizeCities({features:features.map(feature=>({...feature,properties:{...feature.properties,type:'state'}}))},catalog),[]);
  assert.deepEqual(normalizeCities({features:features.map(feature=>({...feature,properties:{...feature.properties,countrycode:'FR'}}))},catalog),[]);
});


test('global searches find Rio and Denver without adding either city to the saved catalog', async () => {
  for (const [query, fixture, region] of [['Rio de Janeiro', responses.rio, 'RJ'], ['Denver', responses.denver, 'CO']]) {
    assert(!catalog.some(city=>city.name===query));
    let requested;
    const result=await searchCities(query,catalog,undefined,async url=>{requested=new URL(url);return Response.json(fixture);});
    assert.equal(requested.searchParams.get('q'),query);
    assert.equal(result.saved,false);
    assert.equal(result.places[0].name,query);
    assert.equal(result.places[0].region,region);
  }
});
