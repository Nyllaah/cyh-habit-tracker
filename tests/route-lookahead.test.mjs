import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialJourney,journeyReducer,routeMeters,collectedStamps} from '../lib/journey.ts';
import {routeFromOrigin,distanceMeters} from '../lib/places.ts';
const catalog=JSON.parse(readFileSync(new URL('../data/cities.json',import.meta.url))).places;
const origin=catalog.find(p=>p.name==='New York');
const initial=()=>initialJourney([],routeFromOrigin(origin,catalog,0),catalog);

test('lookahead appends a connected state-first itinerary without changing progress, rewards, or existing legs',()=>{
 const before=initial();
 const state=journeyReducer(before,{type:'extend-route',candidates:catalog,upcomingCount:12});
 assert.equal(state.route.length,13);
 assert.deepEqual(state.route.slice(0,before.route.length),before.route);
 assert.equal(routeMeters(state),0);assert.deepEqual(state.days,[]);assert.deepEqual(state.arrivals,[]);
 assert.deepEqual(collectedStamps(state),collectedStamps(before));
 for(let i=1;i<state.route.length;i++) assert.equal(state.route[i].cumulativeMeters-state.route[i-1].cumulativeMeters,distanceMeters(state.route[i-1],state.route[i]));
 const firstNewJersey=state.route.findIndex(p=>p.region==='NJ');
 assert.ok(firstNewJersey>3);
 assert.ok(state.route.slice(0,firstNewJersey).every(p=>p.region==='NY'));
});

test('repeated map discovery is an identity no-op and lookahead cannot request an unbounded number of stops',()=>{
 const state=journeyReducer(initial(),{type:'extend-route',candidates:catalog,upcomingCount:1000});
 assert.equal(state.route.length,13);
 assert.strictEqual(journeyReducer(state,{type:'extend-route',candidates:catalog,upcomingCount:12}),state);
 assert.strictEqual(journeyReducer(state,{type:'extend-route',candidates:[],upcomingCount:12}),state);
});
