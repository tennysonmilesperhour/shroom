// CSV serialisation for data exports. Nested PostgREST embeds are flattened to
// dotted columns (`strains.name`), arrays/objects deeper than that are written
// as JSON, and text cells that a spreadsheet would evaluate as a formula are
// prefixed with a quote so an exported note can't run in Excel/Sheets.

type Row = Record<string, unknown>;

export function flattenRow(row: Row, prefix = "", out: Row = {}): Row {
  for (const [key, value] of Object.entries(row)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      flattenRow(value as Row, name, out);
    } else {
      out[name] = value;
    }
  }
  return out;
}

function cell(value: unknown): string {
  if (value == null) return "";
  let s: string;
  if (typeof value === "string") {
    s = value;
    const looksNumeric = /^-?\d+(\.\d+)?$/.test(s);
    if (!looksNumeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  } else if (typeof value === "number" || typeof value === "boolean") {
    s = String(value);
  } else if (value instanceof Date) {
    s = value.toISOString();
  } else {
    s = JSON.stringify(value);
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[], preferredOrder: string[] = []): string {
  const flat = rows.map((r) => flattenRow(r));
  const seen = new Set<string>();
  const columns: string[] = [];
  for (const c of preferredOrder) {
    if (flat.some((r) => c in r) && !seen.has(c)) {
      seen.add(c);
      columns.push(c);
    }
  }
  for (const r of flat) {
    for (const c of Object.keys(r)) {
      if (!seen.has(c)) {
        seen.add(c);
        columns.push(c);
      }
    }
  }
  const lines = [columns.map(cell).join(",")];
  for (const r of flat) lines.push(columns.map((c) => cell(r[c])).join(","));
  // BOM so Excel opens UTF-8 (strain names, µ, °) correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
