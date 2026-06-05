import { NextResponse } from "next/server";

// Returns the current deployment's commit SHA. The client compares this to
// the SHA that was baked into its own page render; a mismatch means a newer
// deploy is live and the user is on stale code.
//
// `VERCEL_GIT_COMMIT_SHA` is set automatically on Vercel deploys. In local
// dev it's unset and we return "dev", so the client never trips a stale
// warning while you're iterating locally.

export const dynamic = "force-dynamic";

export async function GET() {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  return NextResponse.json({ buildId });
}
