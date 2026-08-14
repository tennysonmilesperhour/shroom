import { headers } from "next/headers";
import QRCode from "qrcode";

function configuredOrigin(): string {
  const host =
    process.env.SHROOM_PRODUCTION_ORIGIN ||
    process.env.NEXT_PUBLIC_PRODUCTION_HOST ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "";
  if (!host) return "";
  return (host.startsWith("http") ? host : `https://${host}`).replace(/\/$/, "");
}

export async function batchScanUrl(batchId: number): Promise<string> {
  const origin = configuredOrigin();
  if (origin) return `${origin}/batches/${batchId}`;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/batches/${batchId}`;
}

export async function batchQrDataUrl(batchId: number): Promise<string> {
  return QRCode.toDataURL(await batchScanUrl(batchId), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
