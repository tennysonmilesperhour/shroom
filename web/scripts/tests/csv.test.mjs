import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, flattenRow } from '../../lib/csv.ts';

test('flattens embeds into dotted columns', () => {
  assert.deepEqual(flattenRow({ id: 1, strains: { name: 'GT' }, batches: { lot: 'A', strains: { name: 'X' } } }),
    { id: 1, 'strains.name': 'GT', 'batches.lot': 'A', 'batches.strains.name': 'X' });
});

test('escapes quotes, commas, newlines and neutralises formulas', () => {
  const csv = toCsv([{ a: 'x,"y"', b: 'line1\nline2', c: '=HYPERLINK("x")', d: -5, e: '-12.5', f: null }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.equal(csv.slice(1), 'a,b,c,d,e,f\r\n"x,""y""","line1\nline2","\'=HYPERLINK(""x"")",-5,-12.5,\r\n');
});

test('preferred columns lead, union of keys follows', () => {
  const csv = toCsv([{ b: 1, a: 2 }, { c: 3 }], ['a']);
  assert.equal(csv.slice(1).split('\r\n')[0], 'a,b,c');
});
