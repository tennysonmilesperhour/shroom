import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";

// Side-notes feedback API.
//
// The FeedbackPanel (mounted in the app shell, so it's on every page) talks to
// this route. GET is polled for near-real-time visibility into new notes; POST
// files a note tagged with the page it came from; PATCH flips a note's status
// so the dev can clear what they've handled.
//
// Open-access architecture: reads/writes go through the service-role client on
// the server, same as the SSR pages. The browser never holds a Supabase token.

export const dynamic = "force-dynamic";

interface FeedbackRow {
  id: number;
  page: string;
  page_label: string;
  body: string;
  status: "open" | "done";
  created_at: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const scope = searchParams.get("scope") ?? "all"; // "all" | "page"

  const supabase = createServiceClient();
  let query = supabase
    .from("feedback")
    .select("id,page,page_label,body,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (scope === "page" && page) {
    query = query.eq("page", page);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const items = (data as FeedbackRow[] | null) ?? [];
  const openCount = items.filter((i) => i.status === "open").length;
  return NextResponse.json({ ok: true, items, openCount });
}

export async function POST(request: Request) {
  let payload: { page?: unknown; page_label?: unknown; body?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const body = String(payload.body ?? "").trim();
  if (!body) {
    return NextResponse.json({ ok: false, error: "Note can't be empty." }, { status: 400 });
  }
  const page = String(payload.page ?? "").slice(0, 200);
  const page_label = String(payload.page_label ?? "").slice(0, 80);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("feedback")
    .insert({ page, page_label, body: body.slice(0, 2000) })
    .select("id,page,page_label,body,status,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Insert failed." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, item: data as FeedbackRow }, { status: 201 });
}

export async function PATCH(request: Request) {
  let payload: { id?: unknown; status?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const id = Number(payload.id);
  const status = String(payload.status ?? "");
  if (!Number.isFinite(id) || (status !== "open" && status !== "done")) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
