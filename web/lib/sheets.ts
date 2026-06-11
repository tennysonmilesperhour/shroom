// Turn a pasted Google Sheets link into something an <iframe> can render live.
//
// Operators paste whatever they have - the normal edit URL, a "Publish to web"
// URL, or an already-embeddable one. We extract the spreadsheet id and the
// active sheet (gid) and build a read-only, iframe-safe URL that stays live:
// Google re-fetches the sheet on each load, so the embed reflects the latest
// values without us copying anything.
//
//   edit  : https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>
//   pub   : https://docs.google.com/spreadsheets/d/e/<TOKEN>/pubhtml?gid=<GID>
//
// `toSheetEmbedUrl` returns the embeddable URL, or null when the input is not a
// usable URL. A non-Google but otherwise valid http(s) URL is passed through so
// the same tab can embed other live dashboards if needed.

function extractGid(raw: string): string | null {
  // gid can live in the query (?gid=0) or the hash (#gid=0).
  const m = raw.match(/[#?&]gid=(\d+)/);
  return m ? m[1] : null;
}

export function toSheetEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return null;

  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "docs.google.com") {
    // Not a Google Sheet - allow any other live URL to be embedded as-is.
    return v;
  }

  const gid = extractGid(v);

  // Already-published sheet: /spreadsheets/d/e/<token>/pubhtml(...)
  const pub = parsed.pathname.match(/\/spreadsheets\/d\/e\/([^/]+)/);
  if (pub) {
    const base = `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pubhtml`;
    const params = new URLSearchParams({ widget: "true", headers: "false" });
    if (gid) {
      params.set("gid", gid);
      params.set("single", "true");
    }
    return `${base}?${params.toString()}`;
  }

  // Standard sheet: /spreadsheets/d/<id>/edit -> /preview (iframe-embeddable,
  // read-only). Requires the sheet to be shared "anyone with the link".
  const std = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (std) {
    const base = `https://docs.google.com/spreadsheets/d/${std[1]}/preview`;
    return gid ? `${base}?gid=${gid}` : base;
  }

  return null;
}

/** True when the URL looks like a Google Sheet we can confidently embed. */
export function isGoogleSheet(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /docs\.google\.com\/spreadsheets\/d\//i.test(raw.trim());
}
