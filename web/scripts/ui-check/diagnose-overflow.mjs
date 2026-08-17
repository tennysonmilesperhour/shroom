// Find elements that force horizontal overflow at mobile width.
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const ROUTES = process.argv.slice(2);

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("main").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(600);
  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const doc = document.documentElement.scrollWidth;
    const label = (el) =>
      `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${
        el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : ""
      }`;
    const out = [];
    for (const el of document.querySelectorAll("main, main *")) {
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 2) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") continue;
      // skip if an ancestor clips it (overflow hidden/auto/scroll)
      let clipped = false;
      let a = el.parentElement;
      while (a && a !== document.body) {
        const acs = getComputedStyle(a);
        if (/(hidden|auto|scroll|clip)/.test(acs.overflowX + acs.overflow)) {
          clipped = true;
          break;
        }
        a = a.parentElement;
      }
      if (clipped) continue;
      // ancestor chain for context
      const chain = [];
      let p = el.parentElement;
      for (let i = 0; i < 4 && p && p !== document.body; i++) {
        chain.push(label(p));
        p = p.parentElement;
      }
      out.push({ right: Math.round(r.right), w: Math.round(r.width), desc: label(el), chain: chain.join(" < ") });
    }
    out.sort((x, y) => y.right - x.right);
    // keep the widest few unique descriptions
    const seen = new Set();
    const top = [];
    for (const o of out) {
      const key = o.desc;
      if (seen.has(key)) continue;
      seen.add(key);
      top.push(o);
      if (top.length >= 8) break;
    }
    return { vw, doc, top };
  });
  console.log(`\n=== ${route} viewport=${report.vw} scrollWidth=${report.doc}`);
  for (const t of report.top) console.log(`  right=${t.right} w=${t.w}  ${t.desc}\n      in: ${t.chain}`);
}
await browser.close();
