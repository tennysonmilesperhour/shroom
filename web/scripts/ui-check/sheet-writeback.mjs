// End-to-end check of app → sheet write-back and order line items, against
// mock-supabase + mock-google-sheets. Edits records through the real UI and
// asserts the mock sheet received exactly the expected cell writes.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.env.UI_CHECK_BASE ?? "http://localhost:3000";
const SHEETS = process.env.MOCK_SHEETS_URL ?? "http://127.0.0.1:55322";
const OUT = process.env.UI_CHECK_OUT ?? "ui-check-shots/writeback";
const browser = await chromium.launch({ executablePath: process.env.UI_CHECK_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const writes = async () => (await fetch(`${SHEETS}/__writes`)).json();
async function waitWrites(n) {
  for (let i = 0; i < 40; i++) { const w = await writes(); if (w.length >= n) return w; await page.waitForTimeout(250); }
  return writes();
}

async function editField(route, rowText, field, value) {
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForTimeout(1500); // let React hydrate before clicking
  const scope = rowText ? page.locator(`.row-actions button[aria-label="Edit ${rowText}"]`) : page.locator('.detail-head .row-actions button[aria-label^="Edit"]');
  await scope.first().click();
  await page.locator(".modal-panel").waitFor();
  await page.locator(`.modal-panel [name="${field}"]`).fill(value);
  await page.locator(".modal-panel button[type=submit]").click();
  await page.locator(".modal-panel").waitFor({ state: "detached", timeout: 15_000 });
}

// 1. Strain potency: one cell on Strain Library; status prose untouched.
await editField("/strains", "Golden Teacher", "potency", "High");
let w = await waitWrites(1);
assert.deepEqual(w, [{ kind: "cell", range: "'Strain Library'!E2", value: "High" }], JSON.stringify(w));

// 2. Buyer volume estimate on Buyers & Pricing.
await editField("/customers/5", null, "volume_est", "3 lb / month");
w = await waitWrites(2);
assert.deepEqual(w[1], { kind: "cell", range: "'Buyers & Pricing'!D2", value: "3 lb / month" }, JSON.stringify(w));

// 3. An edit to a field the sheet doesn't hold writes nothing.
await editField("/customers/5", null, "contact_email", "new@cascadiafungi.example.com");
await page.waitForTimeout(2500);
assert.equal((await writes()).length, 2);

// 4. Order detail: add a line item and see it listed.
await page.goto(BASE + "/orders/3", { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.locator('select[name="product_id"]').selectOption({ index: 1 });
await page.locator('input[name="quantity"]').fill("2");
await page.getByRole("button", { name: "Add line" }).click();
await page.getByText(/Line added/).first().waitFor({ timeout: 15_000 });
await page.screenshot({ path: `${OUT}/order-detail-after-add.png`, fullPage: true });

console.log("sheet write-back + order lines OK:", JSON.stringify(await writes()));
await browser.close();
