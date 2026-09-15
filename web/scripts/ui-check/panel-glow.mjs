// Verify pointer-following light, surface opacity, and contrast at the glow center.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const out = process.env.UI_CHECK_OUT ?? 'ui-check-shots/glow';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_CHECK_CHROMIUM ?? '/opt/pw-browsers/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await page.goto(process.env.UI_CHECK_BASE ?? 'http://localhost:3000');
  for (const mode of ['Magic', 'Functional']) {
    await page.getByRole('button', { name: new RegExp(mode) }).click();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      for (const selector of ['.command-center', '.cc-lane', '.spotlight', '.card']) {
        const panel = page.locator(selector).first();
        await panel.scrollIntoViewIfNeeded();
        const box = await panel.boundingBox();
        const x = box.x + Math.min(box.width / 2, 100), y = box.y + Math.min(box.height / 2, 70);
        await page.mouse.move(x, y);
        await page.waitForTimeout(900);
        const result = await panel.evaluate(el => {
          const style = getComputedStyle(el), glow = getComputedStyle(el, '::after');
          const ctx = document.createElement('canvas').getContext('2d');
          const rgba = color => {
            ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data].map(n => n / 255);
          };
          const root = getComputedStyle(document.documentElement);
          const token = name => rgba(root.getPropertyValue(name));
          const blend = (fg, bg, alpha = fg[3]) => fg.slice(0, 3).map((c, i) => c * alpha + bg[i] * (1 - alpha));
          const extreme = themeValue => themeValue === 'light' ? [0,0,0] : [1,1,1];
          let bg = blend(token('--forest-scrim'), extreme(document.documentElement.dataset.theme));
          bg = blend(token('--ink-2'), bg, .5);
          bg = blend(token('--lumen'), bg, .12);
          const lum = rgb => rgb.slice(0,3).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((s,n,i) => s + n * [.2126,.7152,.0722][i], 0);
          const ratios = ['--text','--text-2','--muted','--faint'].map(name => (Math.max(lum(token(name)),lum(bg))+.05)/(Math.min(lum(token(name)),lum(bg))+.05));
          return { x: parseFloat(style.getPropertyValue('--aura-x')), alpha: rgba(style.backgroundColor)[3], glow: glow.opacity, background: glow.backgroundImage, contrast: Math.min(...ratios) };
        });
        assert.ok(Math.abs(result.x - (x - box.x)) < 8, `${selector}: light follows pointer`);
        assert.equal(result.glow, '1');
        assert.ok(result.background.includes('radial-gradient'));
        if (selector !== '.cc-lane') assert.ok(Math.abs(result.alpha - .5) < .01);
        assert.ok(result.contrast >= 4.5, `${mode}/${theme}: ${result.contrast}`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('.cc-lane').first().hover();
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/${mode.toLowerCase()}-${theme}-hover.png` });
      console.log(`PASS ${mode}/${theme}: all panel types track the cursor; opacity and glow contrast pass`);
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('.cc-lane').first().hover();
  assert.equal(await page.locator('.cc-lane').first().evaluate(el => getComputedStyle(el, '::after').content), 'none');
  console.log('PASS reduced motion disables the cursor light');
} finally { await browser.close(); }
