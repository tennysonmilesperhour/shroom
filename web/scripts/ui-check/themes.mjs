// Run against the UI-check mock app. Exercises real collection switches,
// persistence, both themes, and worst-case text contrast over either photograph.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.UI_CHECK_BASE ?? 'http://localhost:3000';
const out = process.env.UI_CHECK_OUT ?? 'ui-check-shots/themes';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_CHECK_CHROMIUM ?? '/opt/pw-browsers/chromium' });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(base);
    for (const mode of ['functional', 'magic']) {
      await page.getByRole('button', { name: mode === 'functional' ? /Functional/ : /Magic/ }).click();
      await page.reload();
      assert.equal(await page.locator('html').getAttribute('data-mushroom-mode'), mode);
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(350);
        const result = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
          function rgba(value) {
            ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data].map(n => n / 255);
          }
          const token = name => rgba(style.getPropertyValue(name).trim());
          const luminance = rgb => rgb.slice(0,3).map(n => n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
          const ratio = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
          const scrim = token('--forest-scrim');
          const extreme = document.documentElement.dataset.theme === 'light' ? 0 : 1;
          const worst = scrim.slice(0,3).map(n => n*scrim[3]+extreme*(1-scrim[3]));
          const contrasts = Object.fromEntries(['--text','--text-2','--muted','--faint'].map(name=>[name,ratio(token(name),worst)]));
          const selected = getComputedStyle(document.querySelector('.mode-segmented button.active'));
          if (document.documentElement.dataset.mushroomMode === 'functional') contrasts.selected = ratio(rgba(selected.color),rgba(selected.backgroundColor));
          return {contrasts, overflow:document.documentElement.scrollWidth>innerWidth, overlay:!!document.querySelector('[data-nextjs-dialog]')};
        });
        assert.equal(result.overflow,false); assert.equal(result.overlay,false);
        for (const [token,ratio] of Object.entries(result.contrasts)) assert.ok(ratio >= 4.5, `${mode}/${theme} ${token}: ${ratio.toFixed(2)}:1`);
        await page.screenshot({ path: `${out}/${mode}-${theme}-${width}.png` });
        console.log(`PASS ${width} ${mode}/${theme}: minimum text contrast ${Math.min(...Object.values(result.contrasts)).toFixed(2)}:1`);
      }
    }
    await context.close();
  }
} finally { await browser.close(); }
