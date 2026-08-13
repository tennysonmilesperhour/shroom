import { NextResponse } from "next/server";

// Returns the build id of the deployment currently serving this request. The
// client compares it to the id baked into the build its tab is running; a
// mismatch means a newer deploy is live and the user is on stale code.
//
// NEXT_PUBLIC_BUILD_ID is computed and inlined at build time in next.config.mjs
// (deployment id on Vercel, then commit SHA or a local timestamp as fallbacks).
// It is always present, so the comparison cannot silently disable itself.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
  return NextResponse.json(
    { buildId },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        // Generated deployment URLs query the stable production alias. The
        // payload is intentionally public and contains only a deployment id.
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    },
  );
}
