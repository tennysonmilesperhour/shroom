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

// SVG so the code stays crisp at any stock size; a bitmap blurs when a 6×4
// label prints it at 2+ inches.
export async function batchQrDataUrl(batchId: number): Promise<string> {
  const svg = await QRCode.toString(await batchScanUrl(batchId), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
