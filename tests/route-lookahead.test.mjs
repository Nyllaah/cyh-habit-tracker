import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialJourney,journeyReducer,routeMeters,collectedStamps} from '../lib/journey.ts';
import {routeFromOrigin,distanceMeters} from '../lib/places.ts';
const catalog=JSON.parse(readFileSync(new URL('../data/cities.json',import.meta.url))).places;
const origin=catalog.find(p=>p.name==='New York');
const initial=()=>initialJourney([],routeFromOrigin(origin,catalog,0),catalog);

test('lookahead appends a origin-based discovery list without changing progress, rewards, or existing legs',()=>{
 const before=initial();
 const state=journeyReducer(before,{type:'extend-route',candidates:catalog,upcomingCount:12});
 assert.equal(state.route.length,13);
 assert.deepEqual(state.route.slice(0,before.route.length),before.route);
 assert.equal(routeMeters(state),0);assert.deepEqual(state.days,[]);assert.deepEqual(state.arrivals,[]);
 assert.deepEqual(collectedStamps(state),collectedStamps(before));
 for(let i=1;i<state.route.length;i++) assert.equal(state.route[i].distanceFromOriginMeters,distanceMeters(state.route[0],state.route[i]));
 assert.equal(state.route[1].region,'NJ');
});

test('successive exploration batches grow beyond twelve stops while preserving every prior leg',()=>{
 const candidates=Array.from({length:40},(_,i)=>({id:`city-${i}`,name:`City ${i}`,region:'VA',country:'US',latitude:38,longitude:-78+i*0.025}));
 let state=initialJourney([],routeFromOrigin(candidates[0],candidates,0),candidates);
 for(let batch=0;batch<4;batch++){
  const before=state;
  state=journeyReducer(state,{type:'extend-route',candidates,appendCount:6});
  assert.equal(state.route.length,before.route.length+6);
  assert.deepEqual(state.route.slice(0,before.route.length),before.route);
  assert.equal(routeMeters(state),0);assert.deepEqual(state.arrivals,[]);assert.deepEqual(state.days,[]);
  assert.deepEqual(collectedStamps(state),collectedStamps(before));
 }
 assert.ok(state.route.length>13);
 assert.equal(new Set(state.route.map(p=>p.id)).size,state.route.length);
 const before=state;
 state=journeyReducer(state,{type:'extend-route',candidates,appendCount:1000});
 assert.equal(state.route.length,before.route.length+12);
 state=journeyReducer(state,{type:'extend-route',candidates,appendCount:6});
 assert.equal(state.route.length,candidates.length);
 assert.strictEqual(journeyReducer(state,{type:'extend-route',candidates,appendCount:6}),state);
 assert.strictEqual(journeyReducer(state,{type:'extend-route',candidates:[],upcomingCount:2}),state);
});
