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
