import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reachGeometry } from '../lib/map.ts';
import { insideRing } from '../lib/countries.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));
const outlines = JSON.parse(readFileSync(new URL('../data/country-maps.json', import.meta.url)));

test('reach geometry keeps the selected origin centered and only connects it to the next discovery', () => {
 const route=sample.route, center=[route[0].latitude,route[0].longitude];
 for(const meters of [0,route[1].distanceFromOriginMeters,99999999]){
  const geometry=reachGeometry(route,meters);
  assert.deepEqual(geometry.center,center);assert.equal(geometry.radius,meters);
  if(geometry.nextLine.length)assert.deepEqual(geometry.nextLine[0],center);
 }
 assert.deepEqual(reachGeometry(route,route[1].distanceFromOriginMeters).nextLine[1],[route[2].latitude,route[2].longitude]);
 assert.deepEqual(reachGeometry(route,99999999).nextLine,[]);
});

test('offline outlines distinguish Brazil and US coordinates, including a GPS origin without a country code', () => {
  const contains = (code, lon, lat) => {
    const feature = outlines.features.find(f => f.properties.code === code);
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return polygons.some(rings => insideRing(lon, lat, rings[0]) && !rings.slice(1).some(ring => insideRing(lon, lat, ring)));
  };
  assert.equal(contains('US', -77.0165, 38.9042), true);
  assert.equal(contains('BR', -47.8828, -15.7939), true);
  assert.equal(contains('US', -47.8828, -15.7939), false);
  assert.equal(contains('BR', -77.0165, 38.9042), false);
  assert.equal(contains('BR', 0, 0), false);
});
