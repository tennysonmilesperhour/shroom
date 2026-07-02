// Small utilities for rendering external references safely.
//
// PostgREST stores free-text URLs; users may enter "northspore.com" or
// "https://northspore.com" or even "www.northspore.com". `normalizeUrl`
// returns a valid href or null. `displayUrl` strips the scheme for display.

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(v)) return `https://${v}`;
  return null;
}

// SSRF guard for server-side outbound fetches (spore crawler, etc.). Vendor
// URLs are operator-entered free text, so before the server fetches one we
// reject anything that isn't a public http(s) host: no other schemes, no
// loopback/link-local/private ranges, no bare hostnames that resolve to them.
// This is a best-effort static check on the literal host in the URL; it does
// not do DNS resolution, so pair it with `redirect: "manual"`/no-follow at the
// fetch site to avoid a redirect into a private address.
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^169\.254\./, // link-local, incl. cloud metadata 169.254.169.254
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./, // 172.16.0.0/12
  /^::1$/,
  /^fe80:/i, // IPv6 link-local
  /^f[cd][0-9a-f]{2}:/i, // IPv6 unique-local
];

export function isPublicHttpUrl(raw: string | null | undefined): boolean {
  const normalized = normalizeUrl(raw);
  if (!normalized) return false;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return false;
  if (host === "metadata" || host === "metadata.google.internal") return false;
  return !PRIVATE_HOST_PATTERNS.some((re) => re.test(host));
}

export function displayUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

export function mailto(email: string | null | undefined): string | null {
  if (!email) return null;
  const v = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? `mailto:${v}` : null;
}

export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const v = phone.replace(/[^\d+]/g, "");
  return v.length >= 6 ? `tel:${v}` : null;
}
