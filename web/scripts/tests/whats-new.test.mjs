import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WHATS_NEW } from '../../lib/whats-new.ts';

test('what\'s new entries are unique, dated, newest first, and complete', () => {
  const ids = WHATS_NEW.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique (they record what was seen)');
  for (const entry of WHATS_NEW) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.title.trim() && entry.summary.trim(), `${entry.id} needs a title and summary`);
    for (const step of entry.steps ?? []) {
      assert.ok(step.title.trim() && step.body.trim(), `${entry.id} step needs a title and body`);
      if (step.route) assert.ok(step.route.startsWith('/'), `${entry.id} route must be an app path`);
    }
  }
  const dates = WHATS_NEW.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'newest entry goes first');
});
