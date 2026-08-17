// Minimal PostgREST/Supabase stand-in for the local UI-check harness.
//
// Serves the fixture rows in fixtures.mjs for any GET /rest/v1/<table> the
// app makes, so every page renders with representative data and zero
// production credentials. Filters/ordering in the query string are ignored —
// the fixtures are already shaped per page — but `limit` is honoured and
// `.single()` (Accept: vnd.pgrst.object) returns the first row. Writes are
// accepted and discarded so an accidental form submit can never touch
// anything real.
//
// Usage:  node scripts/ui-check/mock-supabase.mjs   (port 55321, override with MOCK_SUPABASE_PORT)

import http from "node:http";
import fixtures from "./fixtures.mjs";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 55321);

// Neutral placeholder for any storage object (batch photos, etc.).
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
  <rect width="640" height="480" fill="#1d2733"/>
  <circle cx="320" cy="215" r="90" fill="#2e4457"/>
  <text x="320" y="410" fill="#7f97ab" font-family="sans-serif" font-size="28" text-anchor="middle">batch photo</text>
</svg>`;

const seen = new Set();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  // Storage objects → placeholder image.
  if (path.startsWith("/storage/v1/")) {
    res.writeHead(200, { "content-type": "image/svg+xml" });
    res.end(PLACEHOLDER_SVG);
    return;
  }

  // RPC calls → empty result.
  if (path.startsWith("/rest/v1/rpc/")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end("[]");
    return;
  }

  const m = path.match(/^\/rest\/v1\/([a-zA-Z0-9_]+)$/);
  if (!m) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{}");
    return;
  }
  const table = m[1];

  // Writes: accept, discard, echo nothing back.
  if (req.method !== "GET" && req.method !== "HEAD") {
    req.resume();
    req.on("end", () => {
      const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      const body = wantsObject ? JSON.stringify(fixtures[table]?.[0] ?? {}) : "[]";
      res.writeHead(200, { "content-type": "application/json" });
      res.end(body);
    });
    return;
  }

  let rows = fixtures[table];
  if (!rows) {
    if (!seen.has(table)) {
      seen.add(table);
      console.log(`[mock-supabase] no fixture for "${table}" — serving []`);
    }
    rows = [];
  }

  const limit = Number(url.searchParams.get("limit"));
  if (Number.isFinite(limit) && limit > 0) rows = rows.slice(0, limit);

  const headers = {
    "content-type": "application/json",
    // supabase-js reads counts (head:true / count:exact) from Content-Range.
    "content-range": rows.length === 0 ? "*/0" : `0-${rows.length - 1}/${rows.length}`,
  };

  if (req.method === "HEAD") {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  if (wantsObject) {
    if (rows.length === 0) {
      res.writeHead(406, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "no rows", code: "PGRST116" }));
      return;
    }
    res.writeHead(200, headers);
    res.end(JSON.stringify(rows[0]));
    return;
  }

  res.writeHead(200, headers);
  res.end(JSON.stringify(rows));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-supabase] listening on http://127.0.0.1:${PORT}`);
});
