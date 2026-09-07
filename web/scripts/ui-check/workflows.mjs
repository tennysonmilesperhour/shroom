import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const BASE=process.env.UI_CHECK_BASE || 'http://localhost:3100';
const OUT=process.env.UI_CHECK_OUT || '../../after-workflows';
mkdirSync(OUT,{recursive:true});
const root=fileURLToPath(new URL('../../../',import.meta.url));
const fixtureDir=path.resolve(OUT,'fixtures');
mkdirSync(fixtureDir,{recursive:true});
const workbook=path.join(fixtureDir,'sample.xlsx');
execFileSync(process.env.UI_CHECK_PYTHON || path.join(root,'.venv/bin/python'), ['-c', 'from tests.fixtures.master_reference_sample import build; import sys; build(sys.argv[1])',workbook],{cwd:root});
const photo=await sharp(randomBytes(1550*1250*3),{raw:{width:1550,height:1250,channels:3}}).png({compressionLevel:0}).toBuffer();
assert(photo.length > 4.5 * 1024 * 1024 && photo.length < 6*1024*1024);
const photoPath=path.join(fixtureDir,'large.png');
writeFileSync(photoPath,photo);
const browser=await chromium.launch({executablePath:process.env.UI_CHECK_CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(BASE+'/sync');
  await page.locator('input[type="file"]').setInputFiles(workbook);
  await page.getByRole('button',{name:'Preview import',exact:true}).click();
  await page.getByRole('heading',{name:/records ready to review/}).waitFor();
  assert.equal(await page.getByText('Import complete',{exact:true}).count(),0);
  await page.screenshot({path:`${OUT}/${width}-workbook-preview.png`,fullPage:true,caret:'initial'});
  await page.getByRole('button',{name:/^Import \d+ records$/}).click();
  await page.getByText('Import complete',{exact:true}).waitFor();
  await page.screenshot({path:`${OUT}/${width}-workbook-success.png`,fullPage:true,caret:'initial'});
  await page.goto(BASE+'/batches/1');
  await page.getByRole('button',{name:/Take or upload photo/}).click();
  await page.locator('input[type="file"]').setInputFiles(photoPath);
  await page.getByRole('button',{name:'Add photo',exact:true}).click();
  await page.getByText('Photo added',{exact:true}).first().waitFor({timeout:30000});
  await page.screenshot({path:`${OUT}/${width}-photo-saved.png`,fullPage:true,caret:'initial'});
  if(width === 390) {
    await context.setOffline(true);
    await page.locator('input[type="file"]').setInputFiles(photoPath);
    await page.getByRole('button',{name:'Add photo',exact:true}).click();
    await page.getByText('Photo queued',{exact:true}).waitFor();
    await page.screenshot({path:`${OUT}/${width}-offline-queued.png`,fullPage:true,caret:'initial'});
    await context.setOffline(false);
    await page.getByText('Synced 1 offline update',{exact:true}).waitFor({timeout:30000});
    await page.locator('.offline-queue-pill').waitFor({state:'detached'});
    console.log('Offline photo persisted in IndexedDB and synchronized after reconnection');
  }
  // Collection change should update the list and choices, not only its colors.
  await page.goto(BASE+'/batches');
  await page.getByRole('button',{name:/Functional/}).click();
  await page.waitForFunction(()=>document.cookie.includes('shroom-mushroom-mode=functional'));
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('main').getByText('GT-2608-A',{exact:true}).count(),0);
  assert((await page.locator('main').innerText()).includes('LM-2605-A'));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  assert(!overflow,`${width}: horizontal page overflow`);
  assert.deepEqual(errors,[]);
  console.log(`${width}px: workbook preview/import, >4.5 MB photo upload, collection filtering, layout passed`);
  await context.close();
}
} finally { await browser.close(); }
