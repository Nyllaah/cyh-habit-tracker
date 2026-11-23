import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cityArtwork, distanceMeters, distinctPlaces, extendRoute, nearbyPlaces, passportPreview, placeKey, routeFromOrigin, routeWindow, searchLocalPlaces } from '../lib/places.ts';
import { discoverNearby, normalizeCities, searchCities } from '../lib/cities.ts';
const sample=JSON.parse(readFileSync(new URL('../data/sample.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../data/cities.json',import.meta.url))).places;
const washington=sample.route[0];
const ny=catalog.find(place=>place.name==='New York');
const feature=(name='New York',state='New York',lon=-74.006,lat=40.7128)=>({type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{name,state,countrycode:'us',osm_key:'place',osm_value:'city',osm_type:'N',osm_id:123}});

test('geographic distance uses city coordinates and round-once origin distances',()=>{
 assert.equal(distanceMeters(sample.route[0],sample.route[1]),11117);
 assert.equal(distanceMeters(ny,ny),0);
 const route=routeFromOrigin(ny,catalog,12400);
 for(let i=1;i<route.length;i++) assert.equal(route[i].distanceFromOriginMeters,distanceMeters(route[0],route[i]));
});

test('S3.14: choose nearest unvisited places with deterministic ties, not catalog order',()=>{
 const candidates=[...sample.route.slice(1)].reverse();
 const found=nearbyPlaces(washington,candidates);
 assert.equal(found[0].id,'alexandria');
 const a={id:'a',name:'Alpha',region:'',latitude:1,longitude:0};
 const b={...a,id:'b',name:'Bravo'};
 assert.deepEqual(nearbyPlaces({...a,id:'origin',name:'Origin',latitude:0},[b,a]).map(place=>place.id),['a','b']);
 const alias={...washington,id:'other-provider',region:'District of Columbia'};
 assert.equal(placeKey(alias),placeKey(washington));
 assert.equal(distinctPlaces([washington,alias]).length,1);
 assert.ok(!nearbyPlaces(washington,[alias]).length);
});

test('S3.14: route extension preserves its prefix, excludes visits, and keeps two future stops',()=>{
 const initial=routeFromOrigin(ny,catalog,0);
 const extended=extendRoute(initial,catalog,30000);
 assert.deepEqual(extended.slice(0,initial.length),initial);
 assert.equal(new Set(extended.map(placeKey)).size,extended.length);
 assert.ok(extended.filter(city=>city.distanceFromOriginMeters>30000).length>=2);
 assert.equal(initial.length,3);
 assert.equal(extendRoute(initial,[],30000).length,initial.length);
});

test('S3.13: every featured offline cluster supports an origin and nearby route',()=>{
 for(const name of ['Washington','New York','Boston','Seattle','San Francisco']){
  const origin=catalog.find(city=>city.name===name);
  assert.ok(origin,name);
  assert.ok(routeFromOrigin(origin,catalog,12400).length>=3,name);
 }
 assert.equal(nearbyPlaces({...ny,latitude:0,longitude:0},catalog).length,0);
});

test('local city search handles state codes, full state names and multiple words',()=>{
 assert.ok(searchLocalPlaces(catalog,'New York, NY').some(city=>city.name==='New York'));
 assert.ok(searchLocalPlaces(catalog,'Washington, District of Columbia').some(city=>city.id==='washington'));
 assert.ok(searchLocalPlaces(catalog,'Boston Massachusetts').some(city=>city.name==='Boston'));
 assert.equal(searchLocalPlaces(catalog,'Nowhereville').length,0);
});

test('provider normalization accepts named settlements with finite coordinates and preserves known artwork',()=>{
 const data={features:[feature(),feature(),feature('Cafe','New York'),feature('Bad','NY',200,95),feature('Missing','NY','bad',1),{},null]};
 data.features[2].properties.osm_key='amenity';
 const found=normalizeCities(data,catalog);
 assert.equal(found.length,1);
 assert.equal(found[0].id,ny.id);
 assert.equal(cityArtwork(found[0]),'generic-city');
 const dc=normalizeCities({features:[feature('Washington','District of Columbia',-77.0165,38.9042)]},catalog)[0];
 assert.equal(dc.id,'washington');assert.equal(cityArtwork(dc),'washington');
 assert.deepEqual(normalizeCities({error:'unavailable'},catalog),[]);
});

test('S3.13: HTTP failures return usable local city matches and local nearby candidates',async()=>{
 const unavailable=async()=>new Response('',{status:503});
 const result=await searchCities('Boston',catalog,undefined,unavailable);
 assert.equal(result.saved,true);assert.ok(result.places.some(city=>city.name==='Boston'));
 const nearby=await discoverNearby(ny,catalog,undefined,unavailable);
 assert.ok(nearby.length>=2);assert.ok(nearby.every(city=>distanceMeters(ny,city)<=250000));
});

test('S3.12: live city search normalizes data and nearby lookup uses latitude/longitude, not name search',async()=>{
 let seen;
 const fetcher=async url=>{seen=new URL(url);return Response.json({features:[feature('Albany','New York',-73.7562,42.6526)]});};
 const result=await searchCities('Albany',catalog,undefined,fetcher);
 assert.equal(result.saved,false);assert.equal(result.places[0].name,'Albany');
 assert.equal(seen.pathname,'/api/');assert.equal(seen.searchParams.get('q'),'Albany');
 await discoverNearby(ny,catalog,undefined,fetcher);
 assert.equal(seen.pathname,'/reverse');assert.equal(Number(seen.searchParams.get('lat')),ny.latitude);
 assert.equal(Number(seen.searchParams.get('lon')),ny.longitude);assert.equal(seen.searchParams.get('layer'),'city');
});

test('cancelled city requests propagate cancellation rather than replacing newer results with fallback',async()=>{
 const controller=new AbortController();controller.abort();
 const fetcher=async(_url,{signal})=>{signal.throwIfAborted();};
 await assert.rejects(searchCities('Boston',catalog,controller.signal,fetcher));
});

test('map window follows progress and passport preview shows origin, latest arrival, next city',()=>{
 const route=sample.route;
 assert.deepEqual(routeWindow(route,12400).map(city=>city.id),['washington','occoquan','fredericksburg']);
 assert.deepEqual(routeWindow(route,80000).map(city=>city.id),['washington','richmond']);
 assert.deepEqual(passportPreview(route,80000).map(city=>city.id),['washington','fredericksburg','richmond']);
 assert.equal(cityArtwork({id:'new-place',artwork:'../washington'}),'generic-city');
});

test('S3.13: a slow city request times out to the local catalog',async()=>{
 const never=async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError')),{once:true}));
 const result=await searchCities('Seattle',catalog,undefined,never);
 assert.equal(result.saved,true);
 assert.ok(result.places.some(city=>city.name==='Seattle'));
});
