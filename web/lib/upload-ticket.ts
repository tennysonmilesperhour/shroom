import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function signUploadTicket(value: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify({ ...value, expires: Date.now() + 30 * 60_000 })).toString("base64url");
  const signature = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readUploadTicket(ticket: string): Record<string, unknown> {
  const [body, signature] = ticket.split(".");
  if (!body || !signature || ticket.length > 4096) throw new Error("Invalid upload receipt.");
  const expected = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(body).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("Invalid upload receipt.");
  const value = JSON.parse(Buffer.from(body, "base64url").toString());
  if (typeof value.expires !== "number" || value.expires < Date.now()) throw new Error("Upload receipt expired. Try uploading again.");
  return value;
}
