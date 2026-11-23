import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialJourney,journeyReducer,routeMeters,totalMeters,collectedStamps} from '../lib/journey.ts';
import {demoReadingForJourney} from '../lib/health.ts';
import {countryPassports,passportCollection} from '../lib/passport.ts';
import {countryName} from '../lib/countries.ts';
const sample=JSON.parse(readFileSync(new URL('../data/sample.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../data/cities.json',import.meta.url))).places;
const history=[...sample.previousJourneys,{days:sample.days,route:sample.route}];
const fresh=()=>initialJourney([],[],catalog);
const start=(state,name='New York')=>journeyReducer(state,{type:'change-origin',origin:catalog.find(city=>city.name===name),candidates:catalog});
const sync=(state,reading=demoReadingForJourney(state,sample.today))=>journeyReducer(state,{type:'demo-sync',reading,history});

test('fresh account and city selection contain no backfilled activity or historical stamps',()=>{
 const state=fresh();
 assert.deepEqual(state.days,[]);
 assert.deepEqual(state.route,[]);
 assert.deepEqual(state.previousJourneys,[]);
 assert.deepEqual(countryPassports(state),[]);
 assert.equal(state.demoHistoryLoaded,false);
 const chosen=start(state);
 assert.deepEqual(chosen.days,[]);
 assert.equal(totalMeters(chosen.days),0);
 assert.equal(routeMeters(chosen),0);
 assert.equal(collectedStamps(chosen).length,1);
 assert.equal(collectedStamps(chosen)[0].city.name,'New York');
 assert.equal(passportCollection(chosen).arrivalCount,0);
 assert.deepEqual(countryPassports(chosen).map(group=>group.country),['US']);
 assert.strictEqual(sync(state,{date:sample.today,importedMeters:1234}),state);
});

test('first sync populates past months and country stamps while only new activity advances the chosen route',()=>{
 const chosen=start(fresh());
 const reading=demoReadingForJourney(chosen,sample.today);
 const state=sync(chosen,reading);
 assert.equal(state.demoHistoryLoaded,true);
 assert.equal(state.days[0].date,'2026-08-01');
 assert.ok(state.days.length>100);
 assert.equal(new Set(state.days.map(day=>day.date)).size,state.days.length);
 assert.equal(state.previousJourneys.length,2);
 assert.equal(totalMeters(state.days),319652+reading.importedMeters);
 assert.equal(routeMeters(state),reading.importedMeters);
 assert.deepEqual(state.arrivals.map(city=>city.id),[chosen.route[1].id]);
 assert.equal(passportCollection(state,'BR').arrivalCount,4);
 assert.equal(passportCollection(state,'US').arrivalCount,1);
 assert.deepEqual(countryPassports(state).map(group=>group.country),['BR','US']);
 const repeated=sync(journeyReducer(state,{type:'dismiss-arrival'}),reading);
 assert.equal(totalMeters(repeated.days),totalMeters(state.days));
 assert.equal(repeated.previousJourneys.length,2);
 assert.deepEqual(repeated.arrivals,[]);
});

test('a later city change keeps populated history and subsequent sync cannot append the backfill again',()=>{
 let state=sync(start(fresh()));
 state=start(state,'Boston');
 const before=totalMeters(state.days), snapshots=state.previousJourneys.length;
 assert.equal(routeMeters(state),0);
 const synced=sync(state);
 assert.equal(synced.previousJourneys.length,snapshots);
 assert.equal(synced.days.length,state.days.length);
 assert.equal(totalMeters(synced.days)-before,routeMeters(synced));
 assert.equal(synced.arrivals.length,1);
});

test('backfill and first sync preserve a manual total, including zero',()=>{
 let state=start(fresh());
 const reading=demoReadingForJourney(state,sample.today);
 state=journeyReducer(state,{type:'correct-day',date:sample.today,meters:0});
 state=sync(state,reading);
 assert.equal(state.demoHistoryLoaded,true);
 assert.equal(routeMeters(state),0);
 assert.deepEqual(state.arrivals,[]);
 assert.equal(state.days.find(day=>day.date===sample.today).manualOverrideMeters,0);
 state=journeyReducer(state,{type:'use-imported',date:sample.today});
 assert.equal(state.arrivals[0].id,state.route[1].id);
 assert.equal(countryName('DE'),'Germany');
});
