import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectedStamps, initialJourney, journeyReducer, nextCity, routeMeters, totalMeters } from '../lib/journey.ts';
import { discoverNextCities, normalizeCities } from '../lib/cities.ts';
import { distanceMeters, extendRoute, placeKey, routeFromOrigin } from '../lib/places.ts';
import responses from './fixtures/photon-cities.json' with { type:'json' };
const catalog=JSON.parse(readFileSync(new URL('../data/cities.json',import.meta.url))).places;
const place=name=>catalog.find(city=>city.name===name);

test('finishing the saved Brasília itinerary extends beyond Formosa without changing its traveled prefix', async () => {
  const route=extendRoute(routeFromOrigin(place('Brasília'),catalog,0),catalog,0,12);
  assert.equal(route.at(-1).name,'Formosa');
  const meters=route.at(-1).cumulativeMeters;
  const before=initialJourney([{date:'2026-11-22',importedMeters:meters}],route,catalog);
  assert.equal(nextCity(route,meters),undefined);
  const candidates=await discoverNextCities(route,catalog,undefined,async()=>Response.json(responses.formosa));
  const after=journeyReducer(before,{type:'extend-route',candidates});
  assert(after.route.length>route.length);
  assert(nextCity(after.route,routeMeters(after)));
  assert.deepEqual(after.route.slice(0,route.length),route);
  assert.deepEqual(after.days,before.days);
  for(let i=1;i<after.route.length;i++)assert.equal(after.route[i].cumulativeMeters-after.route[i-1].cumulativeMeters,distanceMeters(after.route[i-1],after.route[i]));
});

test('a new journey can revisit an exhausted origin without duplicate stamps or replayed arrivals', () => {
  const route=extendRoute(routeFromOrigin(place('Brasília'),catalog,0),catalog,0,12);
  let state=initialJourney([{date:'2026-11-22',importedMeters:route.at(-1).cumulativeMeters}],route,catalog);
  const stamps=collectedStamps(state).length;
  state=journeyReducer(state,{type:'change-origin',origin:place('Washington'),candidates:catalog});
  state=journeyReducer(state,{type:'change-origin',origin:place('Brasília'),candidates:catalog});
  assert.equal(state.route[0].name,'Brasília');assert.equal(routeMeters(state),0);
  assert(state.route.length>=3);assert.equal(collectedStamps(state).length,stamps+1);
  const before=totalMeters(state.days), target=state.route[1].cumulativeMeters;
  state=journeyReducer(state,{type:'correct-day',date:'2026-11-22',meters:before+target});
  assert.equal(routeMeters(state),target);assert.deepEqual(state.arrivals,[]);
  const keys=collectedStamps(state).map(stamp=>placeKey(stamp.city));assert.equal(new Set(keys).size,keys.length);
});

const feature=(name,latitude,longitude)=>({geometry:{type:'Point',coordinates:[longitude,latitude]},properties:{name,state:'Massachusetts',countrycode:'US',osm_key:'place',osm_value:'city',type:'city'}});
const settled=[feature('Boston',42.36,-71.06),feature('Cambridge',42.37,-71.11)];
const route=normalizeCities({features:settled},[]).map((place,index)=>({...place,cumulativeMeters:index*5000}));

test('a capped nearest response triggers one bounded set of outward probes, not an idle loop', async () => {
  let calls=0;
  const candidates=await discoverNextCities(route,[],undefined,async url=>{
    calls++;assert.equal(new URL(url).searchParams.get('radius'),'250');
    return Response.json({features:calls===1?settled:[feature('Somerville',42.39,-71.10)]});
  });
  assert.equal(calls,5);assert(candidates.some(city=>city.name==='Somerville'));
  assert(extendRoute(route,candidates,0,route.length).length>route.length);
});

test('useful primary responses avoid probes; service failure stays local and cancellation propagates', async () => {
  let calls=0;
  await discoverNextCities(route,[],undefined,async()=>{calls++;return Response.json({features:[feature('Somerville',42.39,-71.10)]});});
  assert.equal(calls,1);
  calls=0;assert.deepEqual(await discoverNextCities(route,[],undefined,async()=>{calls++;return new Response(null,{status:503});}),[]);assert.equal(calls,1);
  const controller=new AbortController();controller.abort();
  await assert.rejects(discoverNextCities(route,[],controller.signal,async(_url,{signal})=>signal.throwIfAborted()));
});
