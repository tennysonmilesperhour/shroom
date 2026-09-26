import test from 'node:test';
import assert from 'node:assert/strict';
import { magnifyAngle } from '../../lib/spectrum-focus.ts';
test('fisheye enlarges neighbors, preserves center and full circle without overlaps', () => {
  for (const focus of [0, 3, 179, 359]) {
    assert.equal(magnifyAngle(focus, focus), focus);
    assert.equal(magnifyAngle(focus + 3, focus) - magnifyAngle(focus - 3, focus), 12);
    let width = 0;
    for (let i = 0; i < 57; i++) {
      const a = magnifyAngle(i * 360 / 57, focus);
      const b = magnifyAngle((i + 1) * 360 / 57, focus);
      assert.ok(b > a);
      width += b - a;
    }
    assert.ok(Math.abs(width - 360) < 1e-8);
  }
});
test('unfocused geometry is unchanged', () => {
  for (let a = 0; a <= 360; a++) assert.equal(magnifyAngle(a, null), a);
});
