// UI-check screenshot sweep.
//
// Captures every route at a mobile and a desktop viewport (full page), plus a
// few interaction scenarios (add panels, edit dialogs, row menus) that only
// exist after a click. Run it against `next dev` pointed at mock-supabase.mjs:
//
//   node scripts/ui-check/mock-supabase.mjs &
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=ui-check \
//     npm run dev &
//   node scripts/ui-check/screenshot.mjs            # writes to ./ui-check-shots
//
// Env: UI_CHECK_BASE (default http://localhost:3000), UI_CHECK_OUT (output dir),
// UI_CHECK_CHROMIUM (browser binary; defaults to the Playwright-installed one).

import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.UI_CHECK_BASE ?? "http://localhost:3000";
const OUT = process.env.UI_CHECK_OUT ?? "ui-check-shots";
const EXECUTABLE = process.env.UI_CHECK_CHROMIUM ?? "/opt/pw-browsers/chromium";

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

const ROUTES = [
  "/label/batch/1",
  "/label/batches?ids=1",
  "/label/harvest/1",
  "/",
  "/batches",
  "/batches/1",
  "/presets",
  "/strains",
  "/strains/1",
  "/cultures",
  "/harvests",
  "/tasks",
  "/environment",
  "/contamination",
  "/orders",
  "/customers",
  "/customers/1",
  "/catalog",
  "/marketing",
  "/subscriptions",
  "/vendors",
  "/purchase-orders",
  "/supplies",
  "/traceability",
  "/food-safety",
  "/guides",
  "/advisor",
  "/reports",
  "/truth-source",
  "/sync",
];

// Click-through scenarios captured at both widths.
const SCENARIOS = [
  { name: "photo-upload", route: "/batches/1", act: async (page) => {
    await page.getByRole("button", { name: /Take or upload photo/ }).click();
    await page.locator('input[type="file"]').waitFor();
  } },
  { name: "functional-batches", route: "/batches", act: async (page) => {
    await page.getByRole("button", { name: /Functional/ }).click();
    await page.waitForTimeout(900);
  } },
  {
    name: "presets-edit-dialog",
    route: "/presets",
    act: async (page) => {
      await page.locator("button.ghost", { hasText: "Edit" }).first().click();
      await page.locator(".modal-panel").waitFor();
    },
  },
  {
    name: "presets-add-panel",
    route: "/presets",
    act: async (page) => {
      if (await page.locator(".add-panel-toggle").first().getAttribute('aria-expanded') === 'false') await page.locator(".add-panel-toggle").first().click();
      await page.locator(".add-panel-body").waitFor();
    },
  },
  {
    name: "cultures-edit-dialog",
    route: "/cultures",
    act: async (page) => {
      await page.locator('.row-actions button[aria-label^="Edit"]').first().click();
      await page.locator(".modal-panel").waitFor();
    },
  },
  {
    name: "cultures-row-menu",
    route: "/cultures",
    act: async (page) => {
      await page.locator('.row-actions button[aria-haspopup="menu"]').first().click();
      await page.locator(".row-menu").waitFor();
    },
  },
  {
    name: "environment-edit-dialog",
    route: "/environment",
    act: async (page) => {
      await page.locator('.row-actions button[aria-label^="Edit"]').first().click();
      await page.locator(".modal-panel").waitFor();
    },
  },
  {
    name: "batches-add-panel",
    route: "/batches",
    act: async (page) => {
      if (await page.locator(".add-panel-toggle").first().getAttribute('aria-expanded') === 'false') await page.locator(".add-panel-toggle").first().click();
      await page.locator(".add-panel-body").waitFor();
    },
  },
];

function slug(route) {
  return route === "/" ? "dashboard" : route.slice(1).replace(/\//g, "-");
}

async function settle(page) {
  // networkidle never settles (version poller); wait for the shell instead.
  await page.locator("main, .label-page, .batch-label-sheet").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(700); // count-up animations, fonts
  if (await page.getByRole('heading', { name: 'We couldn’t load this page.' }).count()) throw new Error('Application error boundary rendered');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('Horizontal page overflow');
}

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: ["--no-sandbox"],
});

const failures = [];
const consoleErrors = new Map();

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  const dir = path.join(OUT, vpName);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  // The fixture points at a fictional sheet; keep this test independent of Google.
  await context.route('https://docs.google.com/**', route => route.fulfill({contentType:'text/html',body:'<p>Local workbook embed fixture</p>'}));
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const key = `${vpName} ${page.url()}`;
      consoleErrors.set(key, [...(consoleErrors.get(key) ?? []), msg.text()]);
    }
  });

  for (const route of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await settle(page);
      await page.screenshot({ path: path.join(dir, `${slug(route)}.png`), fullPage: true, caret: "initial" });
      console.log(`ok  ${vpName} ${route}`);
    } catch (err) {
      failures.push(`${vpName} ${route}: ${err.message.split("\n")[0]}`);
      console.log(`ERR ${vpName} ${route}: ${err.message.split("\n")[0]}`);
    }
  }

  for (const s of SCENARIOS) {
    try {
      await page.goto(BASE + s.route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await settle(page);
      await s.act(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(dir, `x-${s.name}.png`), fullPage: true, caret: "initial" });
      console.log(`ok  ${vpName} scenario ${s.name}`);
    } catch (err) {
      failures.push(`${vpName} scenario ${s.name}: ${err.message.split("\n")[0]}`);
      console.log(`ERR ${vpName} scenario ${s.name}: ${err.message.split("\n")[0]}`);
    }
  }

  await context.close();
}

await browser.close();

if (consoleErrors.size > 0) {
  console.log("\nConsole errors:");
  for (const [where, msgs] of consoleErrors) {
    for (const m of [...new Set(msgs)].slice(0, 3)) console.log(`  ${where}: ${m}`);
  }
}
if (failures.length > 0) {
  console.log(`\n${failures.length} capture(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nAll captures complete.");
}
