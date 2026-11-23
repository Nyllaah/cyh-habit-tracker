import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addDays, dateLabel, distanceBand, monthDates, periodActivity, shiftMonth, weekdayIndex } from '../lib/history.ts';
import { initialJourney, journeyReducer, totalMeters } from '../lib/journey.ts';
const sample = JSON.parse(readFileSync(new URL('../data/sample.json', import.meta.url)));

test('S5.21: month dates honor leap years, actual lengths and Monday-first placement', () => {
  assert.equal(monthDates('2024-02-15').length, 29);
  assert.equal(monthDates('2026-02-15').length, 28);
  assert.equal(monthDates('2026-11-22').length, 30);
  assert.equal(monthDates('2026-12-22').length, 31);
  assert.equal(weekdayIndex('2026-11-01'), 6);
  assert.equal(weekdayIndex('2026-11-02'), 0);
  assert.deepEqual(monthDates('2024-02-29').slice(-2), ['2024-02-28', '2024-02-29']);
});

test('calendar navigation crosses months and years and clamps the selected day to the target month', () => {
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftMonth('2024-01-31', 1), '2024-02-29');
  assert.equal(shiftMonth('2026-12-31', 1), '2027-01-31');
  assert.equal(shiftMonth('2026-01-31', -1), '2025-12-31');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addDays('2026-11-02', -7), '2026-10-26');
});

test('date-only calculations and formatting are independent of browser timezone and daylight-saving changes', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['Pacific/Honolulu', 'Pacific/Kiritimati', 'America/New_York']) {
      process.env.TZ = zone;
      assert.equal(addDays('2026-03-08', 1), '2026-03-09');
      assert.equal(addDays('2026-11-01', 1), '2026-11-02');
      assert.equal(dateLabel('2026-11-22', { month: 'short', day: 'numeric' }), 'Nov 22');
      assert.equal(weekdayIndex('2026-11-01'), 6);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test('S5.24: six equal positive-distance bands have exact boundaries; zero is neutral', () => {
  assert.equal(distanceBand(0, 6000), null);
  assert.equal(distanceBand(0, 0), null);
  assert.deepEqual([1, 1000, 1001, 2000, 2001, 3001, 4001, 5001, 6000].map(m => distanceBand(m, 6000)), [0,0,1,1,2,3,4,5,5]);
});

test('S5.25/27: future and unrecorded dates differ from confirmed zero and cannot distort the scale', () => {
  const cells = periodActivity(['2026-11-19','2026-11-20','2026-11-21','2026-11-22','2026-11-23'], [
    {date:'2026-11-19',importedMeters:0}, {date:'2026-11-21',importedMeters:6000},
    {date:'2026-11-22',importedMeters:1000}, {date:'2026-11-23',importedMeters:999999}
  ], '2026-11-22');
  assert.deepEqual(cells.map(c => c.status), ['recorded','unrecorded','recorded','recorded','future']);
  assert.deepEqual(cells.map(c => c.meters), [0,null,6000,1000,null]);
  assert.deepEqual(cells.map(c => c.band), [null,null,5,0,null]);
  assert.ok(periodActivity(monthDates('2024-02-15'), [], '2026-11-22').every(c => c.band === null && c.meters === null));
});

test('S5.22/23: history shares imports and effective corrections with the journey; colors have no unit dependency', () => {
  let state = journeyReducer(initialJourney(sample.days, sample.route), {type:'import',reading:sample.healthImport});
  const get = () => periodActivity(monthDates(sample.today), state.days, sample.today).find(c => c.date === sample.today);
  assert.equal(get().meters, 2400);
  state = journeyReducer(state, {type:'correct-day',date:sample.today,meters:500});
  assert.equal(get().meters, 500);
  assert.equal(totalMeters(state.days), 10500);
  state = journeyReducer(state, {type:'import',reading:sample.healthImport});
  assert.equal(get().meters, 500);
  state = journeyReducer(state, {type:'correct-day',date:sample.today,meters:0});
  assert.equal(get().status, 'recorded'); assert.equal(get().meters, 0); assert.equal(get().band, null);
  state = journeyReducer(state, {type:'use-imported',date:sample.today});
  assert.equal(get().meters, 2400);
  assert.equal(totalMeters(state.days), 12400);
});

test('S5.24: each displayed period uses one maximum; changes can recolor the whole month', () => {
  const dates = monthDates('2026-11-22');
  const days = [{date:'2026-10-01',importedMeters:999999}, {date:'2026-11-01',importedMeters:1000}, {date:'2026-11-02',importedMeters:6000}];
  assert.equal(periodActivity(dates, days, '2026-11-22')[0].band, 0);
  const corrected = days.map(day => day.date === '2026-11-02' ? {...day,manualOverrideMeters:2000} : day);
  assert.equal(periodActivity(dates, corrected, '2026-11-22')[0].band, 2);
});
