// Optional shared-password gate. Off unless SHROOM_ACCESS_PASSWORD is set, so
// an existing open deployment keeps working until the operator opts in.
// The cookie holds an HMAC of a fixed label keyed by the password: it proves
// the holder knew the password without storing it, and changing the password
// signs everyone out. Web Crypto only, so it runs in middleware (edge).

export const ACCESS_COOKIE = "shroom_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function accessPassword(): string | null {
  const p = process.env.SHROOM_ACCESS_PASSWORD;
  return p && p.length > 0 ? p : null;
}

export async function accessToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("shroom-os-access-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
