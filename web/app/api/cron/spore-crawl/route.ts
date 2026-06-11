import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { runSporeCrawl } from "@/lib/spore-crawler";

// Weekly spore-source crawler endpoint.
//
// Scheduled by the `crons` entry in vercel.json (Mondays 06:00 UTC). Vercel
// Cron sends `Authorization: Bearer $CRON_SECRET`; we require it when the
// secret is configured so the route can't be triggered by the public. In
// local dev (no CRON_SECRET) it runs unauthenticated for convenience.

export const dynamic = "force-dynamic";
// Give the crawl room to fan out across vendors before the function times out.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const summary = await runSporeCrawl(supabase);
  const status = summary.status === "error" ? 500 : 200;
  return NextResponse.json(summary, { status });
}
