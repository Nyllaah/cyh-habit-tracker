import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extendRoute,routeFromOrigin} from '../lib/places.ts';
const city=(id,region,latitude,longitude=0)=>({id,name:id,region,country:'US',latitude,longitude});

test('an itinerary exhausts known cities in the current state before a nearer border city',()=>{
 const a=city('Origin','AA',0), border=city('Border','BB',.01), same=city('Same state','AA',.1), last=city('Last in state','AA',.2);
 const route=extendRoute([{...a,cumulativeMeters:0}],[border,last,same],100000);
 assert.deepEqual(route.map(p=>p.id),['Origin','Same state','Last in state','Border']);
 assert.ok(route.every((p,i)=>i===0||p.cumulativeMeters>route[i-1].cumulativeMeters));
});

test('a route does not reenter a completed state when later discovery finds another city there',()=>{
 const a=city('Origin','AA',0), b=city('Next state','BB',.2), c=city('Later in BB','BB',.3), old=city('Discovered in old state','AA',.21);
 const prefix=[{...a,cumulativeMeters:0},{...b,cumulativeMeters:22239}];
 const route=extendRoute(prefix,[old,c],0);
 assert.deepEqual(route.map(p=>p.id),['Origin','Next state','Later in BB']);
 assert.deepEqual(route.slice(0,2),prefix);
});

test('a distant remaining state city cannot be bypassed by crossing the border; unnamed states retain nearest-first behavior',()=>{
 const a=city('Origin','AA',0), far=city('Far same state','AA',4), border=city('Border','BB',.01);
 assert.equal(routeFromOrigin(a,[far,border],0).length,1);
 const unnamed={...a,region:''};
 assert.equal(routeFromOrigin(unnamed,[border],0)[1].id,'Border');
});
