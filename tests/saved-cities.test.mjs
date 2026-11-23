import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rememberCity } from '../lib/saved-cities.ts';
const rio={id:'rio',name:'Rio de Janeiro',region:'RJ',country:'BR',latitude:-22.911,longitude:-43.209};
const denver={id:'denver',name:'Denver',region:'CO',country:'US',latitude:39.739,longitude:-104.985};

test('only chosen cities populate a saved list; choosing again moves one identity to the front',()=>{
  const empty=[];
  const first=rememberCity(empty,rio);
  assert.deepEqual(empty,[]);
  assert.deepEqual(first,[rio]);
  const second=rememberCity(first,denver);
  assert.deepEqual(second,[denver,rio]);
  const alias={...rio,id:'other-provider',region:'Rio de Janeiro'};
  assert.deepEqual(rememberCity(second,alias),[alias,denver]);
});

test('unnamed GPS coordinates do not become saved city choices',()=>{
  const saved=[rio];
  assert.strictEqual(rememberCity(saved,{...denver,id:'location-39--104',name:'Current location'}),saved);
});
