import {test} from 'node:test';
import assert from 'node:assert/strict';
import {citiesInView,discoverMapCities,discoverRouteCities} from '../lib/cities.ts';
const view={latitude:38.9,longitude:-77,south:38.5,west:-77.5,north:39.5,east:-76.5,radiusKm:60,country:'US'};
const city=(name,latitude=38.9,longitude=-77,country='US')=>({id:name,name,latitude,longitude,region:'VA',country});

test('viewport filtering respects country, bounds, duplicate identities, and dateline wrapping',()=>{
 const a=city('Fairfax');
 assert.deepEqual(citiesInView([a,a,city('Outside',42),city('Foreign',38.9,-77,'BR')],view),[a]);
 const wrapped={...view,west:170,east:190};
 assert.deepEqual(citiesInView([city('East',39,179),city('West',39,-179),a],wrapped).map(p=>p.name),['East','West']);
});

test('map lookup uses bounded center/radius queries and municipality validation, retaining saved candidates',async()=>{
 let seen;
 const features=['Fairfax','Fake Neighborhood'].map(name=>({geometry:{type:'Point',coordinates:[-77.3,38.85]},properties:{name,state:'Virginia',countrycode:'US',osm_key:'place',osm_value:'city'}}));
 const fetched=await discoverMapCities({...view,radiusKm:2000},[city('Alexandria',38.82,-77.08)],undefined,async url=>{seen=new URL(url);return Response.json({features});});
 assert.equal(seen.searchParams.get('radius'),'500');assert.equal(seen.searchParams.get('limit'),'40');assert.equal(seen.searchParams.get('lat'),'38.9');
 assert.deepEqual(fetched.map(p=>p.name),['Fairfax','Alexandria']);
});

test('map service failure preserves visible local cities and cancellation remains cancellable',async()=>{
 const saved=[city('Alexandria')];
 assert.deepEqual(await discoverMapCities(view,saved,undefined,async()=>{throw new Error('offline');}),saved);
 const controller=new AbortController();controller.abort();
 await assert.rejects(discoverMapCities(view,saved,controller.signal,async(_url,{signal})=>signal.throwIfAborted()));
});

test('onward discovery queries the route endpoint rather than the viewport, with validated bounded candidates',async()=>{
 const tail=city('Takoma Park',38.9779,-77.0075);tail.region='MD';
 let seen;
 const features=['College Park','Fake Neighborhood'].map(name=>({geometry:{type:'Point',coordinates:[-76.9369,38.9897]},properties:{name,state:'Maryland',countrycode:'US',osm_key:'place',osm_value:'city'}}));
 const result=await discoverRouteCities(tail,[],undefined,async url=>{seen=new URL(url);return Response.json({features});});
 assert.equal(seen.searchParams.get('lat'),String(tail.latitude));assert.equal(seen.searchParams.get('lon'),String(tail.longitude));
 assert.equal(seen.searchParams.get('limit'),'100');assert.equal(seen.searchParams.get('radius'),'250');
 assert.deepEqual(result.map(p=>p.name),['College Park']);
 assert.deepEqual(await discoverRouteCities(tail,[city('Alexandria',38.82,-77.08)],undefined,async()=>{throw new Error('offline');}),[city('Alexandria',38.82,-77.08)]);
 const controller=new AbortController();controller.abort();
 await assert.rejects(discoverRouteCities(tail,[],controller.signal,async(_url,{signal})=>signal.throwIfAborted()));
});
