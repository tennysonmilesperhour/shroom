import { NextResponse } from "next/server";

// Returns the build id of the deployment currently serving this request. The
// client compares it to the id baked into the build its tab is running; a
// mismatch means a newer deploy is live and the user is on stale code.
//
// NEXT_PUBLIC_BUILD_ID is computed and inlined at build time in next.config.mjs
// (commit SHA on Vercel, timestamp locally). It is always present, so the
// comparison works even when Vercel system env vars are not exposed.

export const dynamic = "force-dynamic";

export async function GET() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
  return NextResponse.json(
    { buildId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
