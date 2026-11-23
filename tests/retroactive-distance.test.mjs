import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialJourney,journeyReducer,routeMeters,totalMeters,collectedStamps} from '../lib/journey.ts';
import {demoReadingForJourney} from '../lib/health.ts';
import {periodActivity} from '../lib/history.ts';
const sample=JSON.parse(readFileSync(new URL('../data/sample.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../data/cities.json',import.meta.url))).places;
const history=[...sample.previousJourneys,{days:sample.days,route:sample.route}];
const chosen=()=>journeyReducer(initialJourney([],[],catalog),{type:'change-origin',origin:catalog.find(p=>p.name==='New York'),candidates:catalog});
const sync=(state,reading=demoReadingForJourney(state,sample.today))=>journeyReducer(state,{type:'demo-sync',reading,history});

test('past-day corrections update the same calendar, lifetime, and active journey without changing today',()=>{
 const before=sync(chosen());
 const state=journeyReducer(before,{type:'correct-day',date:'2026-11-21',meters:5000});
 assert.equal(totalMeters(state.days)-totalMeters(before.days),2200);
 assert.equal(routeMeters(state)-routeMeters(before),2200);
 assert.deepEqual(state.days.find(d=>d.date===sample.today),before.days.find(d=>d.date===sample.today));
 assert.equal(periodActivity(['2026-11-21'],state.days,sample.today)[0].meters,5000);
});

test('zero past correction recalculates active stamps, retains archived stamps, and restores the source without replay',()=>{
 let state=sync(chosen());const before=routeMeters(state),checkpointId=state.route[1].id;
 state=journeyReducer(state,{type:'dismiss-arrival'});
 state=journeyReducer(state,{type:'correct-day',date:'2026-11-21',meters:0});
 assert.equal(routeMeters(state),before-2800);
 assert.ok(!collectedStamps(state).some(s=>s.city.id===checkpointId));
 assert.ok(collectedStamps(state).some(s=>s.city.name==='Goiânia'));
 state=journeyReducer(state,{type:'use-imported',date:'2026-11-21'});
 assert.equal(routeMeters(state),before);
 assert.ok(collectedStamps(state).some(s=>s.city.id===checkpointId));
 assert.deepEqual(state.arrivals,[]);
});

test('past manual entries before first sync retain their correction and receive a restorable imported source',()=>{
 let state=chosen();const reading=demoReadingForJourney(state,sample.today);
 state=journeyReducer(state,{type:'correct-day',date:'2026-11-21',meters:1000});
 state=sync(state,reading);
 const day=state.days.find(d=>d.date==='2026-11-21');
 assert.equal(day.manualOverrideMeters,1000);assert.equal(day.importedMeters,2800);
 assert.equal(routeMeters(state),reading.importedMeters+1000);
 state=journeyReducer(state,{type:'use-imported',date:'2026-11-21'});
 assert.equal(routeMeters(state),reading.importedMeters+2800);
 assert.equal(new Set(state.days.map(d=>d.date)).size,state.days.length);
});
