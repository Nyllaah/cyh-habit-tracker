import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { insideRing, journeyPosition } from '../lib/map.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));
const outlines = JSON.parse(readFileSync(new URL('../data/country-maps.json', import.meta.url)));

test('virtual map progress matches real city coordinates at checkpoints and interpolates within a leg', () => {
  const route = sample.route;
  const first = journeyPosition(route, 0);
  assert.equal(first.latitude, route[0].latitude);
  assert.equal(first.longitude, route[0].longitude);
  const arrived = journeyPosition(route, route[1].cumulativeMeters);
  assert.equal(arrived.latitude, route[1].latitude);
  assert.equal(arrived.longitude, route[1].longitude);
  const halfway = journeyPosition(route, route[1].cumulativeMeters / 2);
  assert.equal(halfway.latitude, (route[0].latitude + route[1].latitude) / 2);
  assert.equal(halfway.longitude, (route[0].longitude + route[1].longitude) / 2);
  assert.strictEqual(journeyPosition(route, 99999999), route.at(-1));
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
