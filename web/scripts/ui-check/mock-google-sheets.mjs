// Local stand-in for the Google OAuth token endpoint + Sheets values API, so the
// app → sheet write-back can be exercised end to end without real credentials.
// Point the app at it with:
//   SHROOM_SHEETS_API_BASE=http://127.0.0.1:55322/v4/spreadsheets
//   MASTER_SHEET_GOOGLE_ID=mock
//   GOOGLE_SERVICE_ACCOUNT_JSON="$(node scripts/ui-check/mock-google-sheets.mjs --key)"
// GET /__writes returns every write received; GET /__grid/<tab> the tab's cells.
import http from 'node:http';
import { generateKeyPairSync } from 'node:crypto';

const PORT = Number(process.env.MOCK_SHEETS_PORT ?? 55322);
const base = `http://127.0.0.1:${PORT}`;

if (process.argv.includes('--key')) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  console.log(JSON.stringify({ client_email: 'ui-check@mock.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: `${base}/token` }));
  process.exit(0);
}

const tabs = {
  'Strain Library': [
    ['Strain', 'Status', 'Vendor', 'Inoculated', 'Potency', 'Ease', 'Grow Again', 'Tub/Bag ID', 'Notes', 'Mushroom Type', 'Species'],
    ['Golden Teacher', 'Active — fruiting', 'Sporeworks', 'May 17, 2026', 'moderate', '9/10', 'Yes', 'T-01', '', 'Psychedelic', 'Psilocybe cubensis'],
  ],
  'Buyers & Pricing': [
    ['Name', 'Tier', 'Role', 'Volume', 'Last Contact', 'Status', 'Notes'],
    ['Cascadia Fungi Distribution', 'distributor', 'Regional distributor', '', '', 'Integrated', 'Standing monthly order; net-30 terms working fine.'],
  ],
  'Grow Cycle Log': [['Strain', 'Tub', 'Flush', 'Inoculated', 'Transferred', 'First Pins', 'Harvest Date', 'Contam', 'Issues', 'Notes']],
  'Harvest Tracker': [['Strain', 'Tub', 'Flush', 'Harvest Date', 'Fresh (g)', 'Dry (g)', 'Notes']],
};
const writes = [];

function a1(range) {
  const m = /^'?(.*?)'?!([A-Z]+)(\d+)$/.exec(range);
  if (!m) return null;
  const col = [...m[2]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  return { tab: m[1].replace(/''/g, "'"), row: Number(m[3]) - 1, col };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, base);
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  const json = (v, s = 200) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(v)); };
  const path = decodeURIComponent(url.pathname);
  if (path === '/token') return json({ access_token: 'mock-token', expires_in: 3600 });
  if (path === '/__writes') return json(writes);
  if (path.startsWith('/__grid/')) return json(tabs[path.slice(8)] ?? null);
  if (req.headers.authorization !== 'Bearer mock-token') return json({ error: 'unauthorized' }, 401);
  const m = /^\/v4\/spreadsheets\/[^/]+(.*)$/.exec(path);
  if (!m) return json({ error: 'not found' }, 404);
  const rest = m[1];
  if (rest === '') return json({ sheets: Object.keys(tabs).map((title) => ({ properties: { title } })) });
  if (rest === '/values:batchUpdate') {
    const body = JSON.parse(raw);
    for (const d of body.data) {
      const t = a1(d.range);
      writes.push({ kind: 'cell', range: d.range, value: d.values[0][0] });
      const grid = tabs[t.tab]; grid[t.row] = grid[t.row] ?? []; grid[t.row][t.col] = d.values[0][0];
    }
    return json({ totalUpdatedCells: body.data.length });
  }
  const append = /^\/values\/'?(.*?)'?!A1:append$/.exec(rest);
  if (append) {
    const tab = append[1].replace(/''/g, "'");
    const rows = JSON.parse(raw).values;
    writes.push({ kind: 'append', tab, rows });
    tabs[tab].push(...rows);
    return json({ updates: { updatedRows: rows.length } });
  }
  const read = /^\/values\/'?(.*?)'?$/.exec(rest);
  if (read && req.method === 'GET') return json({ values: tabs[read[1].replace(/''/g, "'")] ?? [] });
  return json({ error: `unhandled ${rest}` }, 400);
}).listen(PORT, '127.0.0.1', () => console.log(`[mock-google-sheets] listening on ${base}`));
