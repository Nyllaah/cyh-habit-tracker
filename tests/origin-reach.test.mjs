import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distanceMeters,routeFromOrigin} from '../lib/places.ts';
import {arrivedCities,initialJourney,journeyReducer,routeMeters} from '../lib/journey.ts';
const city=(id,region,latitude,longitude=0)=>({id,name:id,region,country:'US',latitude,longitude});

test('origin reach crosses state boundaries and measures every city independently',()=>{
 const origin=city('Origin','AA',0),border=city('Border','BB',.1),same=city('Same state','AA',.2);
 const route=routeFromOrigin(origin,[same,border]);
 assert.deepEqual(route.map(p=>p.id),['Origin','Border','Same state']);
 assert.equal(route[2].distanceFromOriginMeters,distanceMeters(origin,same));
 const meters=route[2].distanceFromOriginMeters;
 assert.deepEqual(arrivedCities(route,meters).map(p=>p.id),['Border','Same state']);
});

test('later discovery inside the existing reach earns its stamp without spending distance or changing other thresholds',()=>{
 const origin=city('Origin','AA',0),a=city('First','BB',.2),b=city('Second','BB',.3),inner=city('Discovered later','AA',.1);
 const route=routeFromOrigin(origin,[a,b]);
 let state=initialJourney([{date:'2026-11-22',importedMeters:25000}],route,[a,b]);
 state=journeyReducer(state,{type:'extend-route',candidates:[inner]});
 assert.equal(routeMeters(state),25000);
 assert.equal(state.route.find(p=>p.id==='First').distanceFromOriginMeters,route[1].distanceFromOriginMeters);
 assert.deepEqual(state.arrivals.map(p=>p.id),['Discovered later']);
 assert.deepEqual(arrivedCities(state.route,25000).map(p=>p.id),['Discovered later','First']);
 state=journeyReducer(state,{type:'correct-day',date:'2026-11-22',meters:15000});
 assert.deepEqual(arrivedCities(state.route,routeMeters(state)).map(p=>p.id),['Discovered later']);
});

test('long-range known cities can be reached without a chain of intermediate cities',()=>{
 const origin=city('Origin','AA',0),far=city('Far','BB',4),foreign={...city('Foreign','CC',.01),country:'BR'};
 const route=routeFromOrigin(origin,[far,foreign]);
 assert.deepEqual(route.map(p=>p.id),['Origin','Far']);
 assert.ok(route[1].distanceFromOriginMeters>250000);
 assert.equal(arrivedCities(route,route[1].distanceFromOriginMeters).length,1);
});
