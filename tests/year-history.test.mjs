import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, navigateHistory, periodActivity, weekdayIndex, yearColumns, yearDates } from '../lib/history.ts';

test('S5.26: a year has continuous Monday-first weeks and every calendar date appears exactly once', () => {
  const columns = yearColumns('2026-11-22');
  assert.equal(columns.length, 53);
  assert.ok(columns.every(week => week.length === 7));
  assert.deepEqual(columns[0], [null, null, null, '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
  assert.deepEqual(columns.at(-1), ['2026-12-28','2026-12-29','2026-12-30','2026-12-31',null,null,null]);
  const dates = columns.flat().filter(Boolean);
  assert.equal(dates.length, 365);
  assert.equal(new Set(dates).size, 365);
  assert.deepEqual(dates, yearDates('2026-01-01'));
  columns.forEach(week => week.forEach((date, row) => { if (date) assert.equal(weekdayIndex(date), row); }));
  for (let index=1; index<dates.length; index++) assert.equal(dates[index], addDays(dates[index-1], 1));
});

test('S5.21/26: leap years include February 29 and support all year-boundary week shapes', () => {
  for (const year of [2024, 2028, 2012]) {
    const dates = yearColumns(`${year}-01-01`).flat().filter(Boolean);
    assert.equal(dates.length, 366);
    assert.ok(dates.includes(`${year}-02-29`));
    assert.equal(dates[0], `${year}-01-01`);
    assert.equal(dates.at(-1), `${year}-12-31`);
  }
  assert.equal(yearColumns('2012-01-01').length, 54);
  assert.equal(yearColumns('2024-01-01')[0][0], '2024-01-01');
  assert.equal(yearDates('2100-01-01').length, 365);
});

test('S5.26: month labels align to the week of each first day without restarting month calendars', () => {
  const columns = yearColumns('2026-11-22');
  const monthWeeks = Array.from({length:12},(_,month)=>columns.findIndex(week=>week.includes(`2026-${String(month+1).padStart(2,'0')}-01`)));
  assert.deepEqual(monthWeeks, [0,4,8,13,17,22,26,30,35,39,43,48]);
  assert.ok(columns[4].includes('2026-01-31') && columns[4].includes('2026-02-01'));
});

test('S5.22-24/27: yearly colors share one maximum, use corrections, and distinguish unknown, zero, and future', () => {
  const dates = yearDates('2026-11-22');
  const days = [
    {date:'2026-01-01',importedMeters:6000},
    {date:'2026-06-01',importedMeters:1000},
    {date:'2026-11-21',importedMeters:2000,manualOverrideMeters:0},
    {date:'2026-12-01',importedMeters:999999},
    {date:'2025-12-31',importedMeters:999999},
  ];
  const byDate = new Map(periodActivity(dates, days, '2026-11-22').map(cell=>[cell.date,cell]));
  assert.equal(byDate.get('2026-01-01').band, 5);
  assert.equal(byDate.get('2026-06-01').band, 0);
  assert.equal(byDate.get('2026-11-21').meters, 0);
  assert.equal(byDate.get('2026-11-21').status, 'recorded');
  assert.equal(byDate.get('2026-11-21').band, null);
  assert.equal(byDate.get('2026-11-22').status, 'unrecorded');
  assert.equal(byDate.get('2026-12-01').status, 'future');
  assert.equal(byDate.get('2026-12-01').meters, null);
});

test('S5.26: year arrows follow physical grid directions, including year boundaries', () => {
  assert.equal(navigateHistory('2026-11-22','ArrowLeft','year'), '2026-11-15');
  assert.equal(navigateHistory('2026-11-22','ArrowRight','year'), '2026-11-29');
  assert.equal(navigateHistory('2026-11-22','ArrowUp','year'), '2026-11-21');
  assert.equal(navigateHistory('2026-11-22','ArrowDown','year'), '2026-11-23');
  assert.equal(navigateHistory('2026-12-31','ArrowDown','year'), '2027-01-01');
  assert.equal(navigateHistory('2026-01-01','ArrowUp','year'), '2025-12-31');
  assert.equal(navigateHistory('2026-11-22','Home','year'), '2026-11-16');
  assert.equal(navigateHistory('2026-11-18','End','year'), '2026-11-22');
  assert.equal(navigateHistory('2024-02-29','PageUp','year'), '2023-02-28');
  assert.equal(navigateHistory('2026-11-22','PageDown','year'), '2027-11-22');
  assert.equal(navigateHistory('2026-11-22','Tab','year'), null);
});

test('monthly keyboard directions retain their existing day/week behavior', () => {
  assert.equal(navigateHistory('2026-11-22','ArrowLeft','month'), '2026-11-21');
  assert.equal(navigateHistory('2026-11-22','ArrowRight','month'), '2026-11-23');
  assert.equal(navigateHistory('2026-11-22','ArrowUp','month'), '2026-11-15');
  assert.equal(navigateHistory('2026-11-22','ArrowDown','month'), '2026-11-29');
  assert.equal(navigateHistory('2026-03-31','PageUp','month'), '2026-02-28');
  assert.equal(navigateHistory('2026-11-22','PageDown','month'), '2026-12-22');
});
