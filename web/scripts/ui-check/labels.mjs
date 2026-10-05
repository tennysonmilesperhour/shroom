// Label print check.
//
// For every label page and stock size: the on-screen preview keeps the
// stock's proportions without scrolling sideways at 390px or 1440px, and the
// printed PDF is exactly one page per label at the stock size. Screenshots of
// the previews and of each label as it prints land in ./ui-check-shots/labels.
//
//   node scripts/ui-check/labels.mjs   # app running against mock-supabase.mjs
//
// Env: UI_CHECK_BASE, UI_CHECK_OUT, UI_CHECK_CHROMIUM (as screenshot.mjs).

import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.UI_CHECK_BASE ?? "http://localhost:3000";
const OUT = process.env.UI_CHECK_OUT ?? "ui-check-shots/labels";
const EXECUTABLE = process.env.UI_CHECK_CHROMIUM ?? "/opt/pw-browsers/chromium";

// Mirrors LABEL_SIZES in lib/label-size.ts; "" is the default (no ?size=).
const SIZES = { "": [6, 4], sm: [2, 1], md: [2.25, 1.25], lg: [4, 2], xl: [6, 4] };
const PAGES = [
  { name: "batch", route: "/label/batch/1", labels: 1 },
  { name: "batches", route: "/label/batches?ids=1,2", labels: 2 },
  { name: "harvest", route: "/label/harvest/1", labels: 1 },
];
const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

function withSize(route, key) {
  if (!key) return route;
  return `${route}${route.includes("?") ? "&" : "?"}size=${key}`;
}

// Page boxes from Chromium's PDF output, in points (72 per inch).
function pdfPages(pdf) {
  const text = pdf.toString("latin1");
  return [...text.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => ({
    w: Number(m[3]) - Number(m[1]),
    h: Number(m[4]) - Number(m[2]),
  }));
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const failures = [];

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({ viewport, hasTouch: vpName === "mobile" });
  const page = await context.newPage();
  for (const { name, route, labels } of PAGES) {
    for (const [key, [w, h]] of Object.entries(SIZES)) {
      const where = `${vpName} ${withSize(route, key)}`;
      try {
        await page.emulateMedia({ media: "screen" });
        await page.goto(BASE + withSize(route, key), { waitUntil: "networkidle", timeout: 60_000 });
        await page.locator("#label-page-size").waitFor({ state: "attached", timeout: 30_000 });
        const sheets = page.locator(".label-sheet");
        assert.equal(await sheets.count(), labels, "label count");

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, `page scrolls sideways by ${overflow}px`);
        for (const box of await sheets.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
          assert.ok(box.right <= viewport.width, `sheet runs off screen (right edge ${box.right}px)`);
          assert.ok(Math.abs(box.width / box.height - w / h) < 0.02, `preview ratio ${box.width}x${box.height}, stock ${w}x${h}`);
        }
        await page.screenshot({ path: path.join(OUT, `${vpName}-${name}-${key || "default"}.png`), fullPage: true });

        if (vpName === "desktop") {
          await page.emulateMedia({ media: "print" });
          await sheets.first().screenshot({ path: path.join(OUT, `print-${name}-${key || "default"}.png`) });
          const pages = pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
          assert.equal(pages.length, labels, `printed ${pages.length} pages for ${labels} label(s)`);
          for (const p of pages) {
            assert.ok(Math.abs(p.w - w * 72) < 1 && Math.abs(p.h - h * 72) < 1, `page ${p.w}x${p.h}pt, stock ${w * 72}x${h * 72}pt`);
          }
        }
        console.log(`ok    ${where}`);
      } catch (error) {
        failures.push(where);
        console.log(`FAIL  ${where}: ${error.message.split("\n")[0]}`);
      }
    }
  }
  await context.close();
}

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} label check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll label checks passed. Screenshots in ${OUT}/`);
