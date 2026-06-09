// Weekly spore-source crawler.
//
// When a strain's `library_status` is set to `unknown`, the operator no longer
// has a trusted in-house source for that genetic and wants the system to go
// find one. This module does a best-effort web crawl of the spore/genetics
// vendors already tracked in the `vendors` table, looking for pages that both
// mention the strain and carry an "in stock / add to cart" buy signal.
//
// It is intentionally heuristic: there is no universal per-product stock API
// across hobbyist spore vendors, so we fetch each vendor's search results (and
// landing page) and scan the HTML for the strain name alongside stock signals.
// Every fetch is time-boxed and failure-tolerant, so a slow or unreachable
// vendor degrades to "no listing found" rather than failing the whole run.
//
// Results are point-in-time facts ("currently in stock"), so each run replaces
// the prior listings for the strains it checks. Runs are logged to
// `spore_crawl_runs` for observability.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeUrl } from "@/lib/external";

const STOCK_SIGNALS = [
  /in\s*stock/i,
  /add[\s-]?to[\s-]?cart/i,
  /add_to_cart/i,
  /buy\s*now/i,
  /available\s*(now|for\s*purchase)/i,
  /"availability"\s*:\s*"https?:\/\/schema\.org\/InStock"/i,
];

const OOS_SIGNALS = [
  /out\s*of\s*stock/i,
  /sold\s*out/i,
  /currently\s*unavailable/i,
  /back[\s-]?order/i,
  /notify\s*me\s*when/i,
  /"availability"\s*:\s*"https?:\/\/schema\.org\/OutOfStock"/i,
];

// Caps that keep a single run bounded enough to finish inside a serverless
// execution window even when many strains are unknown.
const MAX_VENDORS_PER_STRAIN = 8;
const MAX_FETCHES = 60;
const FETCH_TIMEOUT_MS = 8000;

export interface CrawlSummary {
  runId: number | null;
  strainsChecked: number;
  listingsFound: number;
  fetchFailures: number;
  status: "ok" | "error";
  detail: string;
}

interface StrainLite {
  id: number;
  name: string;
  species: string | null;
  strain_code: string | null;
}

interface VendorLite {
  name: string;
  url: string | null;
}

interface Listing {
  strain_id: number;
  vendor_name: string;
  source_url: string;
  product_title: string;
  in_stock: boolean;
  price: string;
  crawl_run_id: number | null;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A descriptive UA; many storefronts reject blank agents.
        "user-agent": "ShroomOS-SporeCrawler/1.0 (+sourcing-bot)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("text")) return null;
    // Cap body size so a giant page can't blow up memory.
    const body = await res.text();
    return body.length > 600_000 ? body.slice(0, 600_000) : body;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Candidate URLs to try for a strain on a given vendor origin: the common
// WooCommerce / Shopify / generic search paths, then the bare landing page.
export function candidateUrls(origin: string, strainName: string): string[] {
  const q = encodeURIComponent(strainName);
  return [
    `${origin}/?s=${q}&post_type=product`,
    `${origin}/search?q=${q}`,
    `${origin}/?s=${q}`,
    origin,
  ];
}

// Decide whether a fetched page represents an in-stock listing of the strain.
// `matched` is true only when the strain name actually appears on the page.
export function detectListing(
  html: string,
  strainName: string,
): { matched: boolean; inStock: boolean } {
  const hay = html.toLowerCase();
  const needle = strainName.trim().toLowerCase();
  const matched = needle.length > 2 && hay.includes(needle);
  if (!matched) return { matched: false, inStock: false };
  const hasStock = STOCK_SIGNALS.some((re) => re.test(html));
  const hasOOS = OOS_SIGNALS.some((re) => re.test(html));
  return { matched: true, inStock: hasStock && !hasOOS };
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export async function runSporeCrawl(
  supabase: SupabaseClient,
  opts: { strainId?: number } = {},
): Promise<CrawlSummary> {
  // Open a run record up front (best-effort; table may not exist yet).
  let runId: number | null = null;
  {
    const { data } = await supabase
      .from("spore_crawl_runs")
      .insert({ status: "running" })
      .select("id")
      .single();
    runId = data?.id ?? null;
  }

  let fetchFailures = 0;
  try {
    // Strains whose source is unknown and therefore need a source found.
    let strainQuery = supabase
      .from("strains")
      .select("id,name,species,strain_code")
      .eq("library_status", "unknown");
    if (opts.strainId) strainQuery = strainQuery.eq("id", opts.strainId);
    const { data: strains, error: strainErr } = await strainQuery;
    if (strainErr) throw new Error(strainErr.message);
    const targets = (strains ?? []) as StrainLite[];

    // Vendors we trust for genetics — spores + functional spawn with a URL.
    const { data: vendorRows } = await supabase
      .from("vendors")
      .select("name,url")
      .in("category", ["spores", "functional"]);
    const vendors = ((vendorRows ?? []) as VendorLite[])
      .map((v) => ({ name: v.name, url: normalizeUrl(v.url) }))
      .filter((v): v is { name: string; url: string } => !!v.url)
      .slice(0, MAX_VENDORS_PER_STRAIN);

    const listings: Listing[] = [];
    let fetches = 0;

    for (const strain of targets) {
      for (const vendor of vendors) {
        if (fetches >= MAX_FETCHES) break;
        const origin = originOf(vendor.url);
        if (!origin) continue;

        // Try candidate URLs until one returns a page that mentions the strain.
        for (const url of candidateUrls(origin, strain.name)) {
          if (fetches >= MAX_FETCHES) break;
          fetches += 1;
          const html = await fetchText(url);
          if (html == null) {
            fetchFailures += 1;
            continue;
          }
          const { matched, inStock } = detectListing(html, strain.name);
          if (matched) {
            listings.push({
              strain_id: strain.id,
              vendor_name: vendor.name,
              source_url: url,
              product_title: strain.name,
              in_stock: inStock,
              price: "",
              crawl_run_id: runId,
            });
            break; // one hit per vendor is enough
          }
        }
      }
    }

    // Replace prior listings for exactly the strains we just checked, then
    // insert the fresh point-in-time findings.
    const checkedIds = targets.map((s) => s.id);
    if (checkedIds.length > 0) {
      await supabase.from("spore_source_listings").delete().in("strain_id", checkedIds);
    }
    if (listings.length > 0) {
      await supabase.from("spore_source_listings").insert(listings);
    }

    const inStockCount = listings.filter((l) => l.in_stock).length;
    const detail = `Checked ${targets.length} unknown-source strain(s) across ${vendors.length} vendor(s); ${listings.length} mention(s), ${inStockCount} in stock; ${fetchFailures} fetch failure(s).`;

    if (runId != null) {
      await supabase
        .from("spore_crawl_runs")
        .update({
          finished_at: new Date().toISOString(),
          strains_checked: targets.length,
          listings_found: inStockCount,
          status: "ok",
          detail,
        })
        .eq("id", runId);
    }

    return {
      runId,
      strainsChecked: targets.length,
      listingsFound: inStockCount,
      fetchFailures,
      status: "ok",
      detail,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (runId != null) {
      await supabase
        .from("spore_crawl_runs")
        .update({ finished_at: new Date().toISOString(), status: "error", detail })
        .eq("id", runId);
    }
    return {
      runId,
      strainsChecked: 0,
      listingsFound: 0,
      fetchFailures,
      status: "error",
      detail,
    };
  }
}
