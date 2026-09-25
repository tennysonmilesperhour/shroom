// Pure planning half of the app → sheet write-back. Given the current grid of
// a worksheet and the app's record, decide exactly which cells to change.
//
// The rules mirror the Python importer (backend/app/sheet/parse.py) so a value
// written here is read back to the same thing on the next import:
//   * headers are found and matched the way `_find_header` / `_col` do;
//   * a cell is only rewritten when its *parsed* meaning differs from the app
//     value, so operator prose like "🟢 In contact" survives an unrelated edit;
//   * rows are located by the sheet's natural key (strain name, buyer name,
//     tub, tub + flush). Anything ambiguous is skipped, never guessed.
// No network or database access lives here so every rule is unit-testable.

export type Cell = string | number | boolean | null | undefined;
export type Grid = Cell[][];

export interface CellWrite {
  row: number; // 0-based grid row
  col: number; // 0-based grid column
  value: string | number;
}

export interface Plan {
  writes: CellWrite[];
  /** Whole new rows to append below the table (already column-aligned). */
  append: (string | number)[][];
  /** Why nothing (or not everything) could be written; empty when clean. */
  skipped: string[];
  /** For harvests: the tub+flush key the row now carries (importer source_ref). */
  sourceRef?: string;
}

const BLANKISH = new Set(["", "-", "—", "–", "tbd", "n/a", "na", "none", "?"]);

export function clean(value: Cell): string {
  if (value == null) return "";
  const t = String(value).trim();
  return BLANKISH.has(t.toLowerCase()) ? "" : t;
}

// ── Header + column matching (parse._find_header / parse._col) ──────────────

export function findHeader(grid: Grid, tokens: string[], limit = 40): number {
  const want = tokens.map((t) => t.toLowerCase());
  for (let i = 0; i < Math.min(grid.length, limit); i++) {
    const text = (grid[i] ?? []).map((c) => clean(c)).join(" | ").toLowerCase();
    if (want.every((t) => text.includes(t))) return i;
  }
  return -1;
}

export function col(headers: Cell[], ...aliases: string[]): number {
  const cleaned = headers.map((h) => clean(h).toLowerCase());
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    const i = cleaned.findIndex((h) => h.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}

/** Fuzzy tab lookup (parse._get_sheet): case/space-insensitive substring. */
export function findTab(titles: string[], ...candidates: string[]): string | null {
  const norm = titles.map((t) => [t.toLowerCase().replace(/\s+/g, ""), t] as const);
  for (const cand of candidates) {
    const key = cand.toLowerCase().replace(/\s+/g, "");
    for (const [k, original] of norm) if (k.includes(key) || key.includes(k)) return original;
  }
  return null;
}

// ── Value parsing (util.py) ─────────────────────────────────────────────────

const SHEETS_EPOCH = Date.UTC(1899, 11, 30);

/** Any sheet date shape → ISO yyyy-mm-dd, or "" when there's no usable date. */
export function parseDate(value: Cell): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 20000 && value < 80000) {
    return new Date(SHEETS_EPOCH + Math.floor(value) * 86_400_000).toISOString().slice(0, 10);
  }
  let t = clean(value);
  if (!t) return "";
  t = t.replace(/^[~≈\s]+/, "").replace(/(\d{1,2})\s*[-–]\s*\d{1,2}(?!\d)/, "$1");
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (us) {
    const y = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${y}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  // The importer defaults a missing year to 2026.
  const withYear = /\b\d{4}\b/.test(t) ? t : `${t} 2026`;
  const ms = Date.parse(`${withYear} UTC`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

export function firstNumber(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const m = /-?\d+(?:\.\d+)?/.exec(clean(value).replace(/,/g, ""));
  return m ? Number(m[0]) : null;
}

export function parseBool(value: Cell): boolean | null {
  const t = clean(value).toLowerCase();
  if (["yes", "y", "true", "1"].includes(t)) return true;
  if (["no", "n", "false", "0"].includes(t)) return false;
  return null;
}

const CONTAINER_PAREN = /\s*\([^)]*\b(?:bag|grain|aio|tub|monotub|jar)\b[^)]*\)\s*$/i;
const LEADING_DECOR = /^[\s•▪◦‣·♦●○*\-–—]+/;

/** parse._strip_name: the canonical strain name a cell imports as. */
export function stripName(value: Cell): string {
  return clean(value).replace(CONTAINER_PAREN, "").replace(LEADING_DECOR, "").replace(/\s{2,}/g, " ").trim();
}

export function libraryStatus(value: Cell): string {
  const t = clean(value).toLowerCase();
  if (!t) return "";
  for (const key of ["active", "colonizing", "inoculating", "awaiting", "ordered", "en route", "en_route"]) {
    if (t.includes(key)) return key.replace(" ", "_");
  }
  if (t.includes("fridge")) return "fridge";
  if (t.includes("inoculated")) return "inoculating";
  if (t.includes("play") || t.includes("coming soon")) return "coming_soon";
  return t.split("—")[0].split("-")[0].trim();
}

export function customerStatus(value: Cell): string {
  const t = clean(value).toLowerCase().replace(/^[^a-z]+/, "");
  if (!t) return "lead";
  if (t.includes("not contacted")) return "not_contacted";
  if (t.includes("in contact")) return "in_contact";
  if (t.includes("integrated")) return "integrated";
  if (t.includes("active")) return "active";
  return t.replace(/ /g, "_");
}

function isContaminated(value: Cell): boolean {
  const t = clean(value).toLowerCase();
  return t !== "" && t !== "none" && t !== "no";
}

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const eqText = (a: Cell, b: string) => clean(a) === b.trim();
const eqNum = (a: Cell, b: number | null | undefined) => {
  const n = firstNumber(a);
  if (b == null) return n == null;
  return n != null && Math.abs(n - b) < 0.005;
};

// ── Generic field diffing ───────────────────────────────────────────────────

interface FieldRule {
  /** Header aliases, checked in order like parse._col. */
  aliases: string[];
  /** Does the existing cell already mean this app value? */
  same: (cell: Cell) => boolean;
  /** What to write when it doesn't. */
  write: string | number;
}

function diffRow(grid: Grid, rowIdx: number, headers: Cell[], rules: FieldRule[], out: Plan) {
  const row = grid[rowIdx] ?? [];
  for (const r of rules) {
    const c = col(headers, ...r.aliases);
    if (c < 0) continue;
    if (!r.same(row[c])) out.writes.push({ row: rowIdx, col: c, value: r.write });
  }
}

function alignedRow(headers: Cell[], values: [string[], string | number][]): (string | number)[] {
  const width = headers.length;
  const row: (string | number)[] = Array(width).fill("");
  for (const [aliases, v] of values) {
    const c = col(headers, ...aliases);
    if (c >= 0) row[c] = v;
  }
  return row;
}

const empty = (): Plan => ({ writes: [], append: [], skipped: [] });

// ── Strain Library ──────────────────────────────────────────────────────────

export interface StrainRecord {
  name: string;
  vendor?: string | null;
  potency?: string | null;
  ease_rating?: number | null;
  grow_again?: boolean | null;
  notes?: string | null;
  mushroom_type?: string | null;
  species?: string | null;
  library_status?: string | null;
  acquired_on?: string | null;
}

export const STRAIN_TAB = ["Strain Library"];
const STRAIN_HEADER = ["strain", "status", "potency", "grow again"];

function strainRules(s: StrainRecord): FieldRule[] {
  const rules: FieldRule[] = [];
  const text = (aliases: string[], v: string | null | undefined) => {
    if (v == null) return;
    rules.push({ aliases, same: (c) => eqText(c, v), write: v });
  };
  text(["vendor"], s.vendor);
  text(["potency"], s.potency);
  text(["notes"], s.notes);
  text(["species"], s.species);
  if (s.ease_rating != null) rules.push({ aliases: ["ease"], same: (c) => eqNum(c, s.ease_rating), write: s.ease_rating });
  if (s.grow_again != null) {
    rules.push({ aliases: ["grow again"], same: (c) => parseBool(c) === s.grow_again, write: s.grow_again ? "Yes" : "No" });
  }
  if (s.mushroom_type) {
    const want = s.mushroom_type.toLowerCase();
    rules.push({
      aliases: ["mushroom type", "collection"],
      same: (c) => {
        const v = clean(c).toLowerCase();
        return ({ magic: "psychedelic", function: "functional" } as Record<string, string>)[v] === want || v === want || (!v && want === "psychedelic");
      },
      write: titleCase(want),
    });
  }
  if (s.library_status) {
    rules.push({ aliases: ["status"], same: (c) => libraryStatus(c) === s.library_status, write: titleCase(s.library_status) });
  }
  if (s.acquired_on) rules.push({ aliases: ["inoculated"], same: (c) => parseDate(c) === s.acquired_on, write: s.acquired_on });
  return rules;
}

export function planStrain(grid: Grid, s: StrainRecord, opts: { previousName?: string; allowAppend?: boolean } = {}): Plan {
  const out = empty();
  const h = findHeader(grid, STRAIN_HEADER);
  if (h < 0) return { ...out, skipped: ["Strain Library header row not found"] };
  const headers = grid[h];
  const cName = col(headers, "strain");
  const cStatus = col(headers, "status");
  const lookFor = (opts.previousName ?? s.name).toLowerCase();
  const rows: number[] = [];
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    // Section banners have a name but no status; the importer skips them too.
    if (!clean(r[cStatus])) continue;
    if (stripName(r[cName]).toLowerCase() === lookFor) rows.push(i);
  }
  if (rows.length === 0) {
    if (!opts.allowAppend) return { ...out, skipped: [`“${s.name}” isn’t on the Strain Library tab`] };
    out.append.push(
      alignedRow(headers, [
        [["strain"], s.name],
        [["status"], titleCase(s.library_status || "active")],
        [["vendor"], s.vendor ?? ""],
        [["potency"], s.potency ?? ""],
        [["ease"], s.ease_rating ?? ""],
        [["grow again"], s.grow_again == null ? "" : s.grow_again ? "Yes" : "No"],
        [["notes"], s.notes ?? ""],
        [["mushroom type", "collection"], titleCase(s.mushroom_type || "psychedelic")],
        [["species"], s.species ?? ""],
      ]),
    );
    return out;
  }
  for (const i of rows) {
    if (opts.previousName && stripName(grid[i][cName]).toLowerCase() !== s.name.toLowerCase()) {
      out.writes.push({ row: i, col: cName, value: s.name });
    }
    diffRow(grid, i, headers, strainRules(s), out);
  }
  return out;
}

// ── Buyers & Pricing ────────────────────────────────────────────────────────

export interface CustomerRecord {
  name: string;
  price_tier?: string | null;
  role?: string | null;
  volume_est?: string | null;
  last_contact?: string | null;
  status?: string | null;
  notes?: string | null;
}

export const CUSTOMER_TAB = ["Buyers & Pricing", "Buyers"];

function customerRules(c: CustomerRecord): FieldRule[] {
  const rules: FieldRule[] = [];
  const text = (aliases: string[], v: string | null | undefined) => {
    if (v == null) return;
    rules.push({ aliases, same: (cell) => eqText(cell, v), write: v });
  };
  text(["tier"], c.price_tier);
  text(["role"], c.role);
  text(["volume"], c.volume_est);
  text(["notes"], c.notes);
  if (c.last_contact) rules.push({ aliases: ["last contact"], same: (cell) => parseDate(cell) === c.last_contact, write: c.last_contact });
  if (c.status) rules.push({ aliases: ["status"], same: (cell) => customerStatus(cell) === c.status, write: titleCase(c.status) });
  return rules;
}

export function planCustomer(grid: Grid, c: CustomerRecord, opts: { previousName?: string; allowAppend?: boolean } = {}): Plan {
  const out = empty();
  const h = findHeader(grid, ["name", "tier"]);
  if (h < 0) return { ...out, skipped: ["Buyers & Pricing header row not found"] };
  const headers = grid[h];
  const cName = col(headers, "name");
  const lookFor = (opts.previousName ?? c.name).trim().toLowerCase();
  const rows: number[] = [];
  for (let i = h + 1; i < grid.length; i++) {
    if (clean(grid[i]?.[cName]).toLowerCase() === lookFor) rows.push(i);
  }
  if (rows.length === 0) {
    if (!opts.allowAppend) return { ...out, skipped: [`“${c.name}” isn’t on the Buyers tab`] };
    out.append.push(
      alignedRow(headers, [
        [["name"], c.name],
        [["tier"], c.price_tier ?? ""],
        [["role"], c.role ?? ""],
        [["volume"], c.volume_est ?? ""],
        [["last contact"], c.last_contact ?? ""],
        [["status"], c.status ? titleCase(c.status) : ""],
        [["notes"], c.notes ?? ""],
      ]),
    );
    return out;
  }
  for (const i of rows) {
    if (opts.previousName && clean(grid[i][cName]) !== c.name) out.writes.push({ row: i, col: cName, value: c.name });
    diffRow(grid, i, headers, customerRules(c), out);
  }
  return out;
}

// ── Grow Cycle Log (one row per flush, grouped into a tub by the importer) ─

export interface BatchRecord {
  tub: string;
  strain: string | null;
  inoculated_on?: string | null;
  transferred_on?: string | null;
  first_pins_on?: string | null;
  contamination_flag?: boolean | null;
  issues?: string | null;
  notes?: string | null;
}

export const BATCH_TAB = ["Grow Cycle Log", "Grow Cycle", "Cycle Log"];

export function planBatch(grid: Grid, b: BatchRecord, opts: { allowAppend?: boolean } = {}): Plan {
  const out = empty();
  const h = findHeader(grid, ["strain", "tub", "flush", "inoculated"]);
  if (h < 0) return { ...out, skipped: ["Grow Cycle Log header row not found"] };
  const headers = grid[h];
  const cStrain = col(headers, "strain");
  const cTub = col(headers, "tub");
  const cFlush = col(headers, "flush");
  const key = b.tub.trim().toLowerCase();
  const rows: number[] = [];
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    if (!clean(r[cStrain]) || clean(r[cStrain]).toUpperCase().startsWith("TOTAL")) continue;
    if (clean(r[cTub]).toLowerCase() === key) rows.push(i);
  }
  if (rows.length === 0) {
    if (!opts.allowAppend || !b.strain) return { ...out, skipped: [`Tub “${b.tub}” isn’t on the Grow Cycle Log`] };
    out.append.push(
      alignedRow(headers, [
        [["strain"], b.strain],
        [["tub"], b.tub],
        [["flush"], 1],
        [["inoculated"], b.inoculated_on ?? ""],
        [["transferred"], b.transferred_on ?? ""],
        [["first pins"], b.first_pins_on ?? ""],
        [["contam"], b.contamination_flag ? "Yes" : ""],
        [["issues"], b.issues ?? ""],
        [["notes"], b.notes ?? ""],
      ]),
    );
    return out;
  }
  // The first flush row carries tub-level events; the importer takes the
  // earliest date across a tub's rows, so that's where they belong.
  rows.sort((a, z) => (firstNumber(grid[a][cFlush]) ?? 1) - (firstNumber(grid[z][cFlush]) ?? 1));
  const first = rows[0];

  if (b.strain) {
    for (const i of rows) {
      if (stripName(grid[i][cStrain]).toLowerCase() !== b.strain.toLowerCase()) {
        out.writes.push({ row: i, col: cStrain, value: b.strain });
      }
    }
  }

  const earliest = (aliases: string[], v: string | null | undefined) => {
    if (!v) return;
    const c = col(headers, ...aliases);
    if (c < 0) return;
    const dates = rows.map((i) => parseDate(grid[i][c])).filter(Boolean).sort();
    if (dates[0] === v) return;
    if (parseDate(grid[first][c]) !== v) out.writes.push({ row: first, col: c, value: v });
    // Any other flush row holding an earlier date would win on re-import.
    for (const i of rows.slice(1)) {
      const d = parseDate(grid[i][c]);
      if (d && d < v) out.writes.push({ row: i, col: c, value: v });
    }
  };
  earliest(["inoculated"], b.inoculated_on);
  earliest(["transferred"], b.transferred_on);
  earliest(["first pins"], b.first_pins_on);

  const cContam = col(headers, "contam");
  if (cContam >= 0 && b.contamination_flag != null) {
    const flagged = rows.filter((i) => isContaminated(grid[i][cContam]));
    if (b.contamination_flag && flagged.length === 0) out.writes.push({ row: first, col: cContam, value: "Yes" });
    if (!b.contamination_flag) for (const i of flagged) out.writes.push({ row: i, col: cContam, value: "No" });
  }

  // Notes/issues are joined across flush rows on import, so only a single-row
  // tub maps one-to-one.
  for (const [aliases, v] of [[["issues"], b.issues], [["notes"], b.notes]] as const) {
    if (v == null) continue;
    const c = col(headers, ...aliases);
    if (c < 0) continue;
    if (rows.length === 1) {
      if (!eqText(grid[first][c], v)) out.writes.push({ row: first, col: c, value: v });
    } else {
      const joined = rows.map((i) => clean(grid[i][c])).filter(Boolean).join("; ");
      if (joined !== v.trim()) out.skipped.push(`${aliases[0]} span ${rows.length} flush rows for ${b.tub}; left as is`);
    }
  }
  return out;
}

// ── Harvest Tracker (key: Tub + Flush) ──────────────────────────────────────

export interface HarvestRecord {
  tub: string;
  strain: string | null;
  flush_number: number;
  harvested_on: string | null;
  weight_kg: number | null;
  dry_weight_kg: number | null;
  notes?: string | null;
  /** The importer's key for the row this harvest came from (`T-01-F2`). */
  source_ref?: string | null;
}

export const HARVEST_TAB = ["Harvest Tracker", "Harvest"];

export function lotCode(tub: string, flush: number | null | undefined): string {
  const t = tub.trim() || "UNK";
  return flush ? `${t}-F${flush}` : t;
}

function splitRef(ref: string): { tub: string; flush: number } | null {
  const m = /^(.+?)-F(\d+)$/.exec(ref.trim());
  return m ? { tub: m[1], flush: Number(m[2]) } : null;
}

const grams = (kg: number | null) => (kg == null ? null : Math.round(kg * 1000 * 100) / 100);

export function planHarvest(grid: Grid, hv: HarvestRecord, opts: { allowAppend?: boolean } = {}): Plan {
  const out = empty();
  const h = findHeader(grid, ["strain", "tub", "flush", "fresh"]);
  if (h < 0) return { ...out, skipped: ["Harvest Tracker header row not found"] };
  const headers = grid[h];
  const cStrain = col(headers, "strain");
  const cTub = col(headers, "tub");
  const cFlush = col(headers, "flush");
  const cDate = col(headers, "harvest date");

  const rowsFor = (tub: string, flush: number) => {
    const found: number[] = [];
    for (let i = h + 1; i < grid.length; i++) {
      const r = grid[i] ?? [];
      if (!clean(r[cStrain]) || clean(r[cStrain]).toUpperCase().startsWith("TOTAL")) continue;
      if (clean(r[cTub]).toLowerCase() === tub.trim().toLowerCase() && (firstNumber(r[cFlush]) ?? 1) === flush) {
        found.push(i);
      }
    }
    return found;
  };

  // Locate by where the harvest came from, else by where it would go.
  const ref = hv.source_ref ? splitRef(hv.source_ref) : null;
  let rows = ref ? rowsFor(ref.tub, ref.flush) : rowsFor(hv.tub, hv.flush_number);
  if (rows.length > 1 && hv.harvested_on && cDate >= 0) {
    rows = rows.filter((i) => parseDate(grid[i][cDate]) === hv.harvested_on);
  }
  const newRef = lotCode(hv.tub, hv.flush_number);

  if (rows.length === 0) {
    if (ref) return { ...out, skipped: [`Row ${hv.source_ref} is no longer on the Harvest Tracker`] };
    if (!opts.allowAppend || !hv.strain) return { ...out, skipped: [`${newRef} isn’t on the Harvest Tracker`] };
    out.append.push(
      alignedRow(headers, [
        [["strain"], hv.strain],
        [["tub"], hv.tub],
        [["flush"], hv.flush_number],
        [["harvest date"], hv.harvested_on ?? ""],
        [["fresh"], grams(hv.weight_kg) ?? ""],
        [["dry (g)", "dry"], grams(hv.dry_weight_kg) ?? ""],
        [["notes"], hv.notes ?? ""],
      ]),
    );
    out.sourceRef = newRef;
    return out;
  }
  if (rows.length > 1) return { ...out, skipped: [`${newRef} matches ${rows.length} Harvest Tracker rows; left as is`] };

  // An app harvest with no source_ref that lands on an existing row is only
  // the same harvest when the dates agree; otherwise the sheet can't hold both.
  const i = rows[0];
  if (!ref && hv.harvested_on && cDate >= 0) {
    const d = parseDate(grid[i][cDate]);
    if (d && d !== hv.harvested_on) {
      return { ...out, skipped: [`${newRef} on the sheet is a different pull (${d}); the Harvest Tracker has one row per tub + flush`] };
    }
  }

  const rules: FieldRule[] = [];
  if (hv.strain) rules.push({ aliases: ["strain"], same: (c) => stripName(c).toLowerCase() === hv.strain!.toLowerCase(), write: hv.strain });
  rules.push({ aliases: ["tub"], same: (c) => clean(c).toLowerCase() === hv.tub.trim().toLowerCase(), write: hv.tub });
  rules.push({ aliases: ["flush"], same: (c) => (firstNumber(c) ?? 1) === hv.flush_number, write: hv.flush_number });
  if (hv.harvested_on) rules.push({ aliases: ["harvest date"], same: (c) => parseDate(c) === hv.harvested_on, write: hv.harvested_on });
  const fresh = grams(hv.weight_kg);
  if (fresh != null) rules.push({ aliases: ["fresh"], same: (c) => eqNum(c, fresh), write: fresh });
  const dry = grams(hv.dry_weight_kg);
  if (dry != null) rules.push({ aliases: ["dry (g)", "dry"], same: (c) => eqNum(c, dry), write: dry });
  if (hv.notes != null) rules.push({ aliases: ["notes"], same: (c) => eqText(c, hv.notes!), write: hv.notes });
  diffRow(grid, i, headers, rules, out);
  out.sourceRef = newRef;
  return out;
}

/** A1 column letters for a 0-based index (0 → A, 26 → AA). */
export function colLetter(idx: number): string {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
