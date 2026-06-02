import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui";
import { cToF } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EnvironmentPage() {
  const supabase = await createClient();
  const { data: env } = await supabase.from("v_environment_status").select("*").order("room");

  return (
    <>
      <h2 className="section">Environment Monitoring</h2>
      <p className="lead">Latest reading per room vs. target (temp °F / RH / CO₂ / FAE).</p>
      {(env ?? []).map((e) => (
        <div className="card" key={e.room_id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>
              {e.room} <Badge tone="muted">{e.room_type}</Badge>
            </h3>
            <Badge tone={e.in_spec ? "green" : "red"}>{e.in_spec ? "in spec" : "alert"}</Badge>
          </div>
          <div style={{ display: "flex", gap: 18, color: "var(--muted)", fontSize: 12, marginTop: 10, flexWrap: "wrap" }}>
            <span>Temp <b style={{ color: "var(--text)" }}>{cToF(e.temp_c) ?? "—"}°F</b> / {cToF(e.target_temp_c)}</span>
            <span>RH <b style={{ color: "var(--text)" }}>{e.humidity ?? "—"}%</b> / {e.target_humidity}</span>
            <span>CO₂ <b style={{ color: "var(--text)" }}>{e.co2_ppm ?? "—"}ppm</b> / {e.target_co2_ppm}</span>
            <span>FAE <b style={{ color: "var(--text)" }}>{e.fae_per_hr ?? "—"}/hr</b> / {e.target_fae_per_hr}</span>
          </div>
        </div>
      ))}
    </>
  );
}
