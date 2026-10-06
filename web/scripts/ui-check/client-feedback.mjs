import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.env.UI_CHECK_BASE || 'http://localhost:3106';
const out = process.env.UI_CHECK_OUT || 'ui-check-shots/client-feedback';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_CHECK_CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const route of ['/', '/batches', '/batches/1', '/sync', '/presets']) {
      const response = await page.goto(base + route);
      assert.equal(response.status(), 200, route);
      await page.locator('main').waitFor();
      if (route === '/') {
        const values = page.locator('.spotlight-stat .value');
        assert.match(await values.nth(0).innerText(), /1,960/);
        assert.match(await values.nth(1).innerText(), /210/);
      }
      if (route === '/batches') {
        await page.getByRole('button', { name: /Import CSV/ }).click();
        await page.getByLabel('Grain bag CSV').setInputFiles({ name: 'bags.csv', mimeType: 'text/csv', buffer: Buffer.from('lot_code,strain,inoculated_on,notes\nQB-GT-260529,Golden Teacher,2026-05-29,test\n') });
        assert.equal(await page.getByRole('button', { name: 'Import reviewed bags' }).count(), 0, 'no import before preview');
        await page.getByRole('button', { name: 'Preview bags' }).click();
        await page.getByRole('button', { name: 'Import reviewed bags' }).waitFor();
        assert.match(await page.locator('.add-panel-body').innerText(), /QB-GT-260529/);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width} ${route}: overflow`);
      await page.screenshot({ path: `${out}/${width}-${route.replaceAll('/', '_') || 'dashboard'}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const qty = dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).first();
    await qty.fill('0.45359237');
    assert.equal(await qty.evaluate(el => el.validity.stepMismatch), false, 'precise material quantities must be editable');
    assert.equal(await dialog.locator('form').evaluate(el => el.checkValidity()), true, 'prefilled preset must be valid');
    await page.screenshot({ path: `${out}/${width}-preset-edit.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log(`${width}px: changed routes render without overflow; preset precision and save passed (mock backend)`);
    await page.close();
  }
} finally { await browser.close(); }
