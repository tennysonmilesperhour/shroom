import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

const MODEL = process.env.SHROOM_ADVISOR_MODEL || "claude-sonnet-4-6";

// Innovation #8: ground the advisor in the operation's OWN lessons + guides
// (RAG over issue_log + reference_guides) plus live state — assembled per call.
async function buildContext(supabase: any): Promise<string> {
  const [batches, harvests, env, issues, guides, low] = await Promise.all([
    supabase.from("batches").select("lot_code,stage,block_count,container_id,strains(name)").in("stage", ["colonization", "spawn_to_bulk", "fruiting", "harvesting"]),
    supabase.from("v_dry_ratio").select("*").order("harvested_on", { ascending: false }).limit(6),
    supabase.from("v_environment_status").select("*"),
    supabase.from("issue_log").select("issue,root_cause,resolution").order("log_date", { ascending: false }).limit(12),
    supabase.from("reference_guides").select("label,cause,action"),
    supabase.from("inventory_items").select("name,quantity_on_hand,reorder_threshold"),
  ]);

  const lines: string[] = [];
  lines.push("ACTIVE BATCHES:");
  (batches.data ?? []).forEach((b: any) =>
    lines.push(`  - ${b.lot_code} (${b.container_id}) ${b.strains?.name} | ${b.stage} | ${b.block_count} units`));
  lines.push("\nRECENT HARVESTS (fresh g / dry g / ratio):");
  (harvests.data ?? []).forEach((h: any) =>
    lines.push(`  - ${h.harvested_on} ${h.strain} F${h.flush_number}: ${h.fresh_g}g / ${h.dry_g}g = ${h.dry_ratio_pct}%${h.below_floor ? " ⚠ LOW" : ""}`));
  lines.push("\nENVIRONMENT (latest per room, in spec?):");
  (env.data ?? []).forEach((e: any) =>
    lines.push(`  - ${e.room}: ${e.temp_c}C / ${e.humidity}% / ${e.co2_ppm}ppm / FAE ${e.fae_per_hr} — ${e.in_spec ? "OK" : "ALERT"}`));
  const lowStock = (low.data ?? []).filter((i: any) => i.quantity_on_hand <= i.reorder_threshold).map((i: any) => i.name);
  if (lowStock.length) lines.push("\nLOW STOCK: " + lowStock.join(", "));
  lines.push("\nOPERATION LESSONS (issue log):");
  (issues.data ?? []).forEach((i: any) => lines.push(`  - ${i.issue} -> ${i.root_cause}: ${i.resolution}`));
  lines.push("\nTROUBLESHOOTING REFERENCE:");
  (guides.data ?? []).forEach((g: any) => lines.push(`  - ${g.label}: ${g.action}`));
  return lines.join("\n");
}

const SYSTEM =
  "You are the grow advisor for a dual-track psychedelic + functional mushroom operation " +
  "running a grain-bag-to-tub workflow. Answer from the operation's OWN live data and lessons " +
  "provided below. Be concise, concrete, and cite the relevant prior lesson when applicable. " +
  "Recurring themes: CO2-driven flush stalls, low dry ratios from wet substrate, humidity loss from heater condensation.";

export async function POST(request: Request) {
  const { question } = await request.json();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const context = await buildContext(supabase);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ answered: false, reason: "ANTHROPIC_API_KEY not set on the server.", context });
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: `${SYSTEM}\n\n--- LIVE OPERATION STATE ---\n${context}`,
        messages: [{ role: "user", content: question }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || `Anthropic API ${resp.status}`;
      return NextResponse.json({ answered: false, reason: `Anthropic error: ${msg}`, context });
    }
    const text = (data.content ?? []).map((b: any) => b.text ?? "").join("");
    if (!text.trim()) {
      return NextResponse.json({ answered: false, reason: "Empty response from Anthropic.", context });
    }
    return NextResponse.json({ answered: true, answer: text });
  } catch (e: any) {
    return NextResponse.json({ answered: false, reason: `Advisor call failed: ${e.message}`, context });
  }
}

// Lightweight status check so the UI can show whether the key is configured
// in THIS deployment's environment (Preview vs Production differ on Vercel).
export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: MODEL,
  });
}
