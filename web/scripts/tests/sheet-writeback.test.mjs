import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStrain, planCustomer, planBatch, planHarvest, parseDate, colLetter, findTab } from '../../lib/sheet-writeback/plan.ts';

const strainGrid = [
  ['Master Strain Library'],
  ['Strain', 'Status', 'Vendor', 'Inoculated', 'Potency', 'Ease', 'Grow Again', 'Tub/Bag ID', 'Notes', 'Mushroom Type', 'Species'],
  ['PSYCHEDELIC — FRUITING'],
  ['• Golden Teacher (bag)', 'Active — fruiting', 'Sporeworks', 'May 17, 2026', 'Moderate', '8/10', 'Yes', 'T-01', 'Reliable', 'Psychedelic', 'Psilocybe cubensis'],
  ['Lion’s Mane', 'Colonizing', 'North Spore', '', '', 9, 'Y', '', '', 'Functional', 'Hericium erinaceus'],
];

test('strain: only cells whose meaning changed are written', () => {
  const plan = planStrain(strainGrid, {
    name: 'Golden Teacher', vendor: 'Sporeworks', potency: 'High', ease_rating: 8, grow_again: true,
    notes: 'Reliable', mushroom_type: 'psychedelic', library_status: 'active', acquired_on: '2026-05-17',
  });
  // Status prose "Active — fruiting" still parses to active; only potency differs.
  assert.deepEqual(plan.writes, [{ row: 3, col: 4, value: 'High' }]);
});

test('strain: rename locates the old name and writes the new one', () => {
  const plan = planStrain(strainGrid, { name: 'Lions Mane', grow_again: false }, { previousName: 'Lion’s Mane' });
  assert.deepEqual(plan.writes, [{ row: 4, col: 0, value: 'Lions Mane' }, { row: 4, col: 6, value: 'No' }]);
});

test('strain: missing rows append only when allowed', () => {
  assert.equal(planStrain(strainGrid, { name: 'Shakti' }).writes.length, 0);
  const plan = planStrain(strainGrid, { name: 'Shakti', mushroom_type: 'functional' }, { allowAppend: true });
  assert.equal(plan.append[0][0], 'Shakti');
  assert.equal(plan.append[0][1], 'Active');
  assert.equal(plan.append[0][9], 'Functional');
});

const growGrid = [
  ['Strain', 'Tub', 'Flush', 'Inoculated', 'Transferred', 'First Pins', 'Harvest Date', 'Contam', 'Issues', 'Notes'],
  ['Golden Teacher', 'T-01', 2, 'May 17, 2026', '', 'Jun 20, 2026', 'Jun 25, 2026', '', '', 'second'],
  ['Golden Teacher', 'T-01', 1, 'May 17, 2026', 'Jun 1, 2026', 'Jun 10, 2026', 'Jun 14, 2026', 'None', '', 'first'],
  ['Penis Envy', 'T-02', 1, 'May 20, 2026', '', '', '', '', '', 'solo'],
];

test('batch: tub-level dates go to the first flush row, contam flag and single-row notes map', () => {
  const plan = planBatch(growGrid, { tub: 'T-01', strain: 'Golden Teacher', first_pins_on: '2026-06-09', contamination_flag: true, inoculated_on: '2026-05-17' });
  assert.deepEqual(plan.writes, [{ row: 2, col: 5, value: '2026-06-09' }, { row: 2, col: 7, value: 'Yes' }]);
  const solo = planBatch(growGrid, { tub: 'T-02', strain: 'PE6', notes: 'moved to tent' });
  assert.deepEqual(solo.writes, [{ row: 3, col: 0, value: 'PE6' }, { row: 3, col: 9, value: 'moved to tent' }]);
});

test('batch: multi-row notes are left alone and reported', () => {
  const plan = planBatch(growGrid, { tub: 'T-01', strain: 'Golden Teacher', notes: 'something new' });
  assert.equal(plan.writes.length, 0);
  assert.match(plan.skipped[0], /span 2 flush rows/);
});

const harvestGrid = [
  ['Strain', 'Tub', 'Flush', 'Harvest Date', 'Fresh (g)', 'Dry (g)', 'Notes'],
  ['Golden Teacher', 'T-01', 1, 'Jun 14, 2026', 793, 63, ''],
  ['Golden Teacher', 'T-01', 2, 'Jun 25, 2026', 410, '', 'drying'],
];

test('harvest: weights convert kg → g and match on tub + flush', () => {
  const plan = planHarvest(harvestGrid, { tub: 'T-01', strain: 'Golden Teacher', flush_number: 2, harvested_on: '2026-06-25', weight_kg: 0.41, dry_weight_kg: 0.038, notes: 'drying', source_ref: 'T-01-F2' });
  assert.deepEqual(plan.writes, [{ row: 2, col: 5, value: 38 }]);
  assert.equal(plan.sourceRef, 'T-01-F2');
});

test('harvest: app-only pull on an occupied tub+flush with another date is skipped', () => {
  const plan = planHarvest(harvestGrid, { tub: 'T-01', strain: 'Golden Teacher', flush_number: 1, harvested_on: '2026-06-16', weight_kg: 0.063, dry_weight_kg: 0 }, { allowAppend: true });
  assert.equal(plan.writes.length + plan.append.length, 0);
  assert.match(plan.skipped[0], /different pull/);
});

test('harvest: new tub+flush appends and returns the importer key', () => {
  const plan = planHarvest(harvestGrid, { tub: 'T-01', strain: 'Golden Teacher', flush_number: 3, harvested_on: '2026-07-05', weight_kg: 0.2, dry_weight_kg: null }, { allowAppend: true });
  assert.deepEqual(plan.append, [['Golden Teacher', 'T-01', 3, '2026-07-05', 200, '', '']]);
  assert.equal(plan.sourceRef, 'T-01-F3');
});

test('customer: status prose survives when meaning is unchanged', () => {
  const grid = [['Name', 'Tier', 'Role', 'Volume', 'Last Contact', 'Status', 'Notes'], ['Greg', 'Restaurant', 'Chef', '2 lb/wk', 'Aug 1, 2026', '🟢 In contact', '']];
  const plan = planCustomer(grid, { name: 'Greg', status: 'in_contact', volume_est: '3 lb/wk', last_contact: '2026-08-01' });
  assert.deepEqual(plan.writes, [{ row: 1, col: 3, value: '3 lb/wk' }]);
});

test('helpers', () => {
  assert.equal(parseDate(46159), '2026-05-17');
  assert.equal(parseDate('~May 29-30, 2026'), '2026-05-29');
  assert.equal(parseDate('Jun 1'), '2026-06-01');
  assert.equal(colLetter(0), 'A');
  assert.equal(colLetter(27), 'AB');
  assert.equal(findTab(['Strain Library', 'Buyers & Pricing'], 'Buyers & Pricing', 'Buyers'), 'Buyers & Pricing');
});
