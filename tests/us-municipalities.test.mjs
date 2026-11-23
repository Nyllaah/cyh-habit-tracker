import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMunicipality } from '../lib/municipalities.ts';
import { normalizeCities, discoverNearby } from '../lib/cities.ts';
const catalog = JSON.parse(readFileSync(new URL('../data/cities.json', import.meta.url))).places;
const place = (name, region, latitude, longitude) => ({id:name,name,region,country:'US',latitude,longitude});
const feature = (place, value = 'city') => ({type:'Feature',geometry:{type:'Point',coordinates:[place.longitude,place.latitude]},properties:{name:place.name,state:place.region,countrycode:'US',osm_key:'place',osm_value:value}});

test('US filtering preserves municipalities and municipal towns while excluding CDPs and neighborhoods', () => {
  const eligible = [place('Washington','DC',38.904,-77.016),place('New York','NY',40.713,-74.006),place('Brookline','MA',42.324,-71.142),place('Winthrop','MA',42.388,-70.969),place('Weehawken','NJ',40.768,-74.016),place('North Bergen','NJ',40.8,-74.02)];
  assert.ok(eligible.every(isMunicipality));
  assert.equal(normalizeCities({features:[feature(place("Elmsford","NY",41.055,-73.82),"village")]},catalog)[0].name,"Elmsford");
  for (const p of [place('White Center','WA',47.51,-122.35),place('Back Bay','MA',42.35,-71.08),place('Capitol Hill','WA',47.62,-122.32)]) {
    assert.equal(isMunicipality(p),false,p.name);
    assert.deepEqual(normalizeCities({features:[feature(p)]},catalog),[]);
  }
  assert.ok(catalog.every(isMunicipality));
  assert.ok(!catalog.some(p=>p.name==='White Center'||p.name==='Greenville'));
});

test('same-state names use Census reference coordinates to reject an unrelated unincorporated community', () => {
  const cdp=place('Greenville','NY',40.99864,-73.81898);
  const municipality=place('Greenville','NY',42.39711,-74.01482);
  assert.equal(isMunicipality(cdp),false);
  assert.equal(isMunicipality(municipality),true);
  assert.equal(isMunicipality(place('Greenville','SC',34.85,-82.4)),true);
  assert.equal(normalizeCities({features:[feature(cdp),feature(municipality)]},catalog).length,1);
});

test('nearby US discovery rejects mislabeled neighborhoods and CDPs before route candidates are returned', async () => {
  const seattle=catalog.find(p=>p.name==='Seattle');
  const invalid=[place('White Center','WA',47.51,-122.35),place('Capitol Hill','WA',47.62,-122.32)];
  const data={features:invalid.map(p=>feature(p,'town'))};
  const found=await discoverNearby(seattle,catalog,undefined,async()=>Response.json(data));
  assert.ok(found.length>=2);
  assert.ok(found.every(isMunicipality));
  assert.ok(!found.some(p=>invalid.some(other=>p.name===other.name)));
});
