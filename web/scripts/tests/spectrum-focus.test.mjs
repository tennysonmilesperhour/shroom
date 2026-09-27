import test from 'node:test';
import assert from 'node:assert/strict';
import { lensSlices, FOCUS_HALF_WIDTH, FOCUS_SCALE } from '../../lib/spectrum-focus.ts';
test('local lens enlarges targets without redistributing the rest of the wheel', () => {
 const original = [10, 16];
 const enlarged = lensSlices(...original, 13);
 assert.equal(enlarged[0][1] - enlarged[0][0], 6 * FOCUS_SCALE);
 assert.deepEqual(original, [10, 16]);
 assert.deepEqual(lensSlices(90, 96, 13), []);
});
test('lens occupies exactly one eighth and handles the circular seam at every density', () => {
 for (const count of [1,2,4,57,100]) for (const focus of [0,3,179,359]) {
  const pieces=Array.from({length:count},(_,i)=>lensSlices(i*360/count,(i+1)*360/count,focus)).flat().sort((a,b)=>a[0]-b[0]);
  let width=0;
  for (let i=0;i<pieces.length;i++) {
   const [a,b]=pieces[i];assert.ok(b>a);
   assert.ok(a>=focus-FOCUS_HALF_WIDTH-1e-8 && b<=focus+FOCUS_HALF_WIDTH+1e-8);
   if(i)assert.ok(Math.abs(a-pieces[i-1][1])<1e-8);
   width+=b-a;
  }
  assert.ok(Math.abs(width-45)<1e-8);
 }
});
