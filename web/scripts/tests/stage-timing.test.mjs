import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOMATION_CONFIDENCE, baselineConfidence, baselineFor, batchDepartures, batchTimeline, buildBaseline,
  classify, cohortBaselines, factorSummary, predictNext, stageEntries, summarize,
} from '../../lib/stage-timing.ts';

const base = { strain_id: 1, container_type: 'tub', contamination_flag: false, colonized_on: null, fruiting_on: null, spent_on: null };

test('stage entries prefer operator dates, drop undone and rewound stages', () => {
  const batch = { ...base, id: 1, stage: 'fruiting', inoculated_on: '2026-07-01', fruiting_on: '2026-07-20' };
  const entries = stageEntries(batch, [
    { batch_id: 1, stage: 'colonization', occurred_at: '2026-07-01T10:00:00Z' },
    { batch_id: 1, stage: 'spawn_to_bulk', occurred_at: '2026-07-10T10:00:00Z' },
    { batch_id: 1, stage: 'harvesting', occurred_at: '2026-07-12T10:00:00Z' },
    { batch_id: 1, stage: 'undo', note: 'Undid: Advanced to harvesting', occurred_at: '2026-07-12T10:05:00Z' },
    { batch_id: 1, stage: 'fruiting', occurred_at: '2026-07-21T10:00:00Z' },
    { batch_id: 1, stage: 'moved', occurred_at: '2026-07-22T10:00:00Z' },
  ]);
  assert.deepEqual(Object.fromEntries(entries), {
    colonization: '2026-07-01', spawn_to_bulk: '2026-07-10', fruiting: '2026-07-20',
  });
});

test('stages beyond the current one are ignored after a manual rewind', () => {
  const batch = { ...base, id: 1, stage: 'colonization', inoculated_on: '2026-07-01' };
  const entries = stageEntries(batch, [{ batch_id: 1, stage: 'fruiting', occurred_at: '2026-07-10T00:00:00Z' }]);
  assert.deepEqual([...entries.keys()], ['colonization']);
});

test('timeline measures each step and the open stage', () => {
  const batch = { ...base, id: 2, stage: 'fruiting', inoculated_on: '2026-07-01', fruiting_on: '2026-07-15' };
  const { transitions, open } = batchTimeline(batch, [], '2026-07-20');
  assert.deepEqual(transitions.map((t) => [t.from, t.to, t.days]), [['colonization', 'fruiting', 14]]);
  assert.deepEqual(open, { batchId: 2, from: 'fruiting', startedOn: '2026-07-15', days: 5 });
  assert.equal(batchTimeline({ ...batch, contamination_flag: true }, [], '2026-07-20').open, null);
});

test('summary gives range, spread and a confidence that grows with agreement', () => {
  const tight = summarize([14, 14, 15, 13, 14, 15, 14, 13, 14, 14]);
  assert.equal(tight.n, 10);
  assert.equal(tight.median, 14);
  assert.ok(tight.confidence >= 90, `tight confidence ${tight.confidence}`);
  const loose = summarize([7, 25, 12]);
  assert.ok(loose.confidence < 25, `loose confidence ${loose.confidence}`);
  assert.equal(loose.low, 7);
  assert.equal(loose.high, 25);
});

test('departures need enough samples and a real margin', () => {
  assert.equal(classify(30, summarize([14, 15])), null);
  const stats = summarize([14, 15, 14, 13, 14]);
  assert.equal(classify(15, stats), null);
  assert.equal(classify(21, stats), 'slow');
  assert.equal(classify(8, stats), 'fast');
});

function history(n, days, container = 'tub', startId = 100) {
  return Array.from({ length: n }, (_, i) => ({
    ...base, id: startId + i, container_type: container, stage: 'spent',
    inoculated_on: '2026-05-01', fruiting_on: `2026-05-${String(1 + days[i % days.length]).padStart(2, '0')}`, spent_on: '2026-06-20',
  }));
}

test('batch departures use the container cohort when it has data, else the strain', () => {
  const batches = [...history(5, [14, 15, 14, 13, 14]), ...history(2, [25], 'aio', 200)];
  const { baselines } = cohortBaselines(batches, new Map(), [], '2026-07-01');
  assert.equal(baselineFor(baselines, 'tub', 'colonization').scope, 'container');
  assert.equal(baselineFor(baselines, 'aio', 'colonization').scope, 'strain');

  const slow = { ...base, id: 9, stage: 'fruiting', inoculated_on: '2026-07-01', fruiting_on: '2026-07-24' };
  const found = batchDepartures(slow, batchTimeline(slow, [], '2026-07-25'), baselines);
  assert.deepEqual(found.map((d) => [d.from, d.to, d.direction, d.scope]), [['colonization', 'fruiting', 'slow', 'container']]);

  const stuck = { ...base, id: 10, stage: 'colonization', inoculated_on: '2026-07-01' };
  const running = batchDepartures(stuck, batchTimeline(stuck, [], '2026-07-30'), baselines);
  assert.deepEqual(running.map((d) => [d.from, d.to, d.direction]), [['colonization', null, 'slow']]);
});

test('explained runs leave the baseline and feed the factor tally', () => {
  const batches = history(4, [14, 14, 15, 30]);
  const notes = [{ batch_id: 103, from_stage: 'colonization', to_stage: 'fruiting', observed_days: 30, expected_days: 14, direction: 'slow', response: 'changed', factors: ['temperature', 'substrate'], note: 'Heater failed' }];
  const { baselines } = cohortBaselines(batches, new Map(), notes, '2026-07-01');
  assert.equal(baselines.strain.byFrom.get('colonization').max, 15);
  const tally = factorSummary(notes, 'slow');
  assert.deepEqual(tally.map((f) => [f.factor, f.runs, f.avgShift]), [['temperature', 1, 16], ['substrate', 1, 16]]);
  assert.deepEqual(factorSummary(notes, 'fast'), []);
});

test('prediction and automation confidence', () => {
  const baseline = buildBaseline(Array.from({ length: 10 }, (_, i) => ({ batchId: i, from: 'colonization', to: 'fruiting', days: 14, startedOn: '2026-01-01', endedOn: '2026-01-15' })));
  assert.ok(baselineConfidence(baseline) >= AUTOMATION_CONFIDENCE);
  const p = predictNext({ batchId: 1, from: 'colonization', startedOn: '2026-07-01', days: 12 }, baseline, '2026-07-13');
  assert.equal(p.next, 'fruiting');
  assert.equal(p.expectedOn, '2026-07-15');
  assert.equal(p.daysUntil, 2);
  assert.equal(predictNext({ batchId: 1, from: 'fruiting', startedOn: '2026-07-01', days: 1 }, baseline, '2026-07-02'), null);
});
