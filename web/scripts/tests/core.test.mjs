import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyTotals } from '../../lib/weekly-totals.ts';
import { activeSheetImport, displayImportStatus } from '../../lib/sheet-sync-status.ts';

test('weekly totals keep Monday boundaries, zero weeks, and exclude future/invalid dates', () => {
  const totals = weeklyTotals([
    {date:'2026-09-06T23:59:00Z',amount:125},
    {date:'2026-09-07T00:00:00Z',amount:40},
    {date:'2026-09-07T08:00:00Z',amount:60},
    {date:'2026-09-08',amount:999},
    {date:'2025-01-01',amount:999},
    {date:null,amount:999},
    {date:'not-a-date',amount:999},
  ], new Date('2026-09-07T12:00:00Z'));
  assert.equal(totals.length,16);
  assert.deepEqual(totals.slice(0,14),Array(14).fill(0));
  assert.deepEqual(totals.slice(-2),[125,100]);
});

test('completed, failed, stale, and future sync records do not block a retry', () => {
  const now=Date.parse('2026-09-07T12:00:00Z');
  for(const status of ['ok','error','running']) {
    assert.equal(activeSheetImport([{status,started_at:'2026-09-07T11:00:00Z'}],now),false);
  }
  assert.equal(activeSheetImport([{status:'running',started_at:'2026-09-07T11:59:00Z'}],now),true);
  assert.equal(activeSheetImport([{status:'running',started_at:'2026-09-08T12:00:00Z'}],now),false);
  assert.equal(displayImportStatus({status:'running',started_at:'2026-09-07T11:45:00Z'},now),'stalled');
});
