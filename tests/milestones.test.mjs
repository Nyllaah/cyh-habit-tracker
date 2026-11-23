import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capitalKind, extendRoute, nearbyPlaces, regionCode, searchLocalPlaces } from '../lib/places.ts';
const registry=JSON.parse(readFileSync(new URL('../data/capitals.json',import.meta.url)));
const place=(name,region,country='US')=>({id:name,name,region,country,latitude:0,longitude:0});

test('national and state capitals qualify; other large or similarly named cities remain standard',()=>{
 assert.equal(capitalKind(place('Washington','DC')),'national');
 assert.equal(capitalKind(place('Brasilia','Federal District','BR')),'national');
 assert.equal(capitalKind(place('Boston','Massachusetts')),'state');
 assert.equal(capitalKind(place('Richmond','VA')),'state');
 assert.equal(capitalKind(place('Goiania','Goiás','BR')),'state');
 assert.equal(capitalKind(place('New York','NY')),null);
 assert.equal(capitalKind(place('Seattle','WA')),null);
 assert.equal(capitalKind(place('Washington','WA')),null);
 assert.equal(capitalKind(place('Boston','MA','BR')),null);
 assert.equal(capitalKind(place('Albany','New York')),'state');
 assert.equal(capitalKind(place('St. Paul','MN')),'state');
 assert.equal(capitalKind(place('São Paulo','São Paulo','BR')),'state');
});

test('registry covers supported national/state capitals and preserves country-specific region search',()=>{
 assert.equal(registry.capitals.filter(c=>c.kind==='national').length,2);
 assert.equal(registry.capitals.filter(c=>c.country==='US'&&c.kind==='state').length,50);
 assert.equal(registry.capitals.filter(c=>c.country==='BR'&&c.kind==='state').length,26);
 for(const c of registry.capitals)assert.equal(capitalKind(place(c.name,c.region,c.country)),c.kind);
 const cities=[place('Boston','MA'),place('São Luís','MA','BR'),place('Montgomery','AL'),place('Maceió','AL','BR')];
 assert.deepEqual(searchLocalPlaces(cities,'Maranhão').map(c=>c.name),['São Luís']);
 assert.deepEqual(searchLocalPlaces(cities,'Massachusetts').map(c=>c.name),['Boston']);
 assert.deepEqual(searchLocalPlaces(cities,'Alagoas').map(c=>c.name),['Maceió']);
 assert.equal(regionCode('North Carolina'),'NC');
});

test('nearest-city routing stays in the country, permits state borders, and does not prioritize capitals',()=>{
 const origin={...place('Origin','VA'),latitude:39,longitude:-77,cumulativeMeters:0};
 const foreign={...place('Foreign','ON','CA'),latitude:39.02,longitude:-77};
 const ordinary={...place('Small town','MD'),latitude:39.03,longitude:-77};
 const capital={...place('Albany','NY'),latitude:39.04,longitude:-77};
 assert.deepEqual(nearbyPlaces(origin,[capital,foreign,ordinary]).map(c=>c.name),['Small town','Albany']);
 const route=extendRoute([origin],[capital,foreign,ordinary],0);
 assert.deepEqual(route.map(c=>c.name),['Origin','Small town','Albany']);
 assert.equal(route[2].cumulativeMeters-route[1].cumulativeMeters<route[2].cumulativeMeters,true);
 const gps={...origin,country:''};
 assert.deepEqual(nearbyPlaces(gps,[foreign,ordinary]).map(c=>c.name),['Small town']);
});
