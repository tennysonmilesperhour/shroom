export function parseBagCsv(raw: string) {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  raw = raw.replace(/^\uFEFF/, "");
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(value.replace(/\r$/, "")); value = "";
      if (c === '\n') { rows.push(row); row = []; }
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift()?.map((s) => s.trim().toLowerCase()) ?? [];
  if (!["lot_code", "strain", "inoculated_on"].every((s) => headers.includes(s))) throw new Error("Required columns: lot_code,strain,inoculated_on; optional: notes.");
  if (new Set(headers).size !== headers.length || headers.some((h) => !["lot_code", "strain", "inoculated_on", "notes"].includes(h))) throw new Error("Use unique columns: lot_code,strain,inoculated_on,notes.");
  const seen = new Set<string>();
  const bags = rows.filter((r) => r.some((s) => s.trim())).map((r, i) => {
    if (r.length !== headers.length) throw new Error(`Row ${i + 2}: column count does not match.`);
    const get = (key: string) => (r[headers.indexOf(key)] ?? "").trim();
    const lot = get("lot_code"), date = get("inoculated_on");
    if (!lot || !get("strain") || seen.has(lot)) throw new Error(`Row ${i + 2}: missing strain/lot or duplicate lot.`);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error(`Row ${i + 2}: date must be YYYY-MM-DD.`);
    seen.add(lot);
    return { lot_code: lot, strain: get("strain"), inoculated_on: date || null, notes: get("notes") };
  });
  if (!bags.length || bags.length > 500) throw new Error("Import between 1 and 500 bags at a time.");
  return bags;
}
