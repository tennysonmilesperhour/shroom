import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importHealth } from '../../lib/sheet-sync-status.ts';
const now = Date.parse('2026-10-06T20:00:00Z');
const run = (status, hours) => ({ status, started_at: new Date(now - hours * 3600000).toISOString() });
test('import health flags absence, failure, stalled jobs, and overdue successes', () => {
  assert.equal(importHealth([], now).state, 'attention');
  assert.equal(importHealth([run('ok', 1)], now).state, 'healthy');
  assert.equal(importHealth([run('error', 0), run('ok', 1)], now).state, 'attention');
  assert.equal(importHealth([run('running', 1), run('ok', 2)], now).state, 'attention');
  assert.equal(importHealth([run('ok', 37)], now).state, 'attention');
});
