import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBagCsv } from '../../lib/bag-csv.ts';
test('bag CSV supports quoted notes and rejects duplicates or invalid dates', () => {
  const header = 'lot_code,strain,inoculated_on,notes\n';
  const row = 'QB-GT-260529,Golden Teacher,2026-05-29,"one, bag"';
  assert.equal(parseBagCsv(header + row)[0].notes, 'one, bag');
  assert.throws(() => parseBagCsv(header + row + '\n' + row), /duplicate/);
  assert.throws(() => parseBagCsv(header + row.replace('2026-05-29', '2026-02-30')), /date/);
});
test('rejects duplicate or unknown headers', () => {
  assert.throws(() => parseBagCsv('lot_code,strain,inoculated_on,strain\nA,GT,,GT'), /unique/);
  assert.throws(() => parseBagCsv('lot_code,strain,inoculated_on,typo\nA,GT,,x'), /unique/);
});
