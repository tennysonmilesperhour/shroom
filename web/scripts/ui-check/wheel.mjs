// Run against the full audited 57-entry fixture (see research brief).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const base=process.env.UI_CHECK_BASE ?? 'http://localhost:3106';
const out=process.env.UI_CHECK_OUT ?? 'ui-check-shots/wheel';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.UI_CHECK_CHROMIUM ?? '/opt/pw-browsers/chromium'});
const errors=[];
for (const width of [390,1440]) {
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width===390,reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/strains');
 const wheel=page.locator('.spectrum-wheel svg');
 const picker=page.getByLabel(/Find a strain/);
 await picker.waitFor();
 const count=await page.locator('.spectrum-wedge').count();
 assert.equal(count,57,'Use the complete live-library fixture');
 assert.equal(await picker.locator('option').count(),58);
 for (const option of await picker.locator('option').all()) {
  const value=await option.getAttribute('value');
  if(value) {await picker.selectOption(value);assert.ok(await page.locator('.spectrum-readout strong').isVisible());}
 }
 await picker.selectOption('');
 await wheel.scrollIntoViewIfNeeded();
 const point=async(angle)=>{const b=await wheel.boundingBox(),r=b.width*135/360;return {x:b.x+b.width/2+r*Math.cos(angle*Math.PI/180),y:b.y+b.height/2-r*Math.sin(angle*Math.PI/180)};};
 const magnified=()=>wheel.getAttribute('data-magnified');
 const paths=()=>page.locator('.spectrum-wedge path').evaluateAll(ns=>ns.map(n=>n.getAttribute('d')));
 const normal=await paths();
 let p=await point(3);
 if(width===390) await page.touchscreen.tap(p.x,p.y);else await page.mouse.move(p.x,p.y);
 await page.waitForFunction(()=>document.querySelector('.spectrum-wheel svg').dataset.magnified==='true');
 assert.notDeepEqual(await paths(),normal);
 assert.equal(new URL(page.url()).pathname,'/strains');
 for(const theme of ['light','dark']) {
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await page.locator('.spectrum').screenshot({path:path.join(out,`magnified-${width}-${theme}.png`)});
 }
 if(width===390) {
  // The second tap can choose a neighboring enlarged slice, not only the first one.
  p=await point(13);
  const id=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('a[data-strain-id]')?.dataset.strainId,p);
  assert.ok(id);await page.touchscreen.tap(p.x,p.y);await page.waitForURL(base+'/strains/'+id);
  await page.goto(base+'/strains');await wheel.scrollIntoViewIfNeeded();
  const cdp=await context.newCDPSession(page);p=await point(355);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  for(const a of [359,3,10,25,40]) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[await point(a)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(new URL(page.url()).pathname,'/strains','Dragging must not navigate');
  assert.equal(await magnified(),'true');
  await page.touchscreen.tap(5,200);assert.equal(await magnified(),'false');
  p=await point(20);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await magnified(),'false');
 } else {
  const focusedPaths = await paths();
  p=await point(13);await page.mouse.move(p.x,p.y);
  assert.deepEqual(await paths(),focusedPaths,'Neighbor targets must remain enlarged and stable');
  await page.mouse.move(0,0);assert.equal(await magnified(),'false');
  assert.deepEqual(await paths(),normal,'Mouse leave restores equal-angle slices');
  p=await point(120);await page.mouse.move(p.x,p.y);
  const id=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('a[data-strain-id]')?.dataset.strainId,p);
  await page.mouse.click(p.x,p.y);await page.waitForURL(base+'/strains/'+id);
 }
 await page.goto(base+'/strains');await page.locator('.spectrum-wedge').first().focus();
 assert.equal(await magnified(),'true');await page.keyboard.press('Escape');assert.equal(await magnified(),'false');
 const href=await page.locator('.spectrum-wedge').first().getAttribute('href');await page.keyboard.press('Enter');await page.waitForURL(base+href);
 for(const id of [21,74,75,93]) {
  await page.goto(base+'/strains/'+id);
  await page.locator('.profile-card').waitFor();
  assert.equal(await page.locator('.profile-split').count(),0,'Missing ratio must not be invented');
  if(id===75) {assert.match(await page.locator('.profile-card').innerText(),/0.495%/);await page.locator('.profile-card a[href="https://doi.org/10.3390/jof12070486"]').waitFor();}
  if(id===21) await page.locator('.profile-card').screenshot({path:path.join(out,`profile-${width}.png`)});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 }
 console.log(`PASS ${width}: 57 entries, magnification, navigation, reset, keyboard, sourced profiles, no overflow`);
 await context.close();
}
assert.deepEqual(errors,[]);await browser.close();
