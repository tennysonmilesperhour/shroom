import { createServiceClient } from "@/utils/supabase/service";
import { Badge, Card } from "@/components/ui";
import { cToF } from "@/lib/format";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

interface RoomStatus {
  room_id: number;
  room: string;
  room_type: string;
  target_temp_c: number;
  target_humidity: number;
  target_co2_ppm: number;
  target_fae_per_hr: number;
  temp_c: number | null;
  humidity: number | null;
  co2_ppm: number | null;
  fae_per_hr: number | null;
  in_spec: boolean | null;
}

export default async function EnvironmentPage() {
  const supabase = createServiceClient();
  const rooms = await must<RoomStatus[]>(
    supabase.from("v_environment_status").select("*").order("room"),
    "load environment status",
  );

  return (
    <>
      <div>
        <div className="eyebrow">Production</div>
        <h1 className="section">Environment monitoring</h1>
        <p className="lead">
          Latest reading per room vs. target (temperature °F · relative humidity · CO₂ · fresh-air exchanges).
        </p>
      </div>

      {rooms.length === 0 ? (
        <Card variant="quiet">
          <p className="muted" style={{ margin: 0 }}>
            No rooms configured yet, or no sensor readings recorded.
          </p>
        </Card>
      ) : (
        rooms.map((e) => (
          <div className="card" key={e.room_id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <h3 style={{ margin: 0 }}>
                {e.room} <Badge tone="muted">{e.room_type}</Badge>
              </h3>
              <Badge tone={e.in_spec ? "green" : "red"}>
                {e.in_spec ? "in spec" : "alert"}
              </Badge>
            </div>
            <div
              style={{
                display: "flex",
                gap: 18,
                color: "var(--text-2)",
                fontSize: 13,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <span>
                Temp <b style={{ color: "var(--text)" }}>{cToF(e.temp_c) ?? "-"}°F</b>
                <span className="muted"> / {cToF(e.target_temp_c)}</span>
              </span>
              <span>
                RH <b style={{ color: "var(--text)" }}>{e.humidity ?? "-"}%</b>
                <span className="muted"> / {e.target_humidity}</span>
              </span>
              <span>
                CO₂ <b style={{ color: "var(--text)" }}>{e.co2_ppm ?? "-"}ppm</b>
                <span className="muted"> / {e.target_co2_ppm}</span>
              </span>
              <span>
                FAE <b style={{ color: "var(--text)" }}>{e.fae_per_hr ?? "-"}/hr</b>
                <span className="muted"> / {e.target_fae_per_hr}</span>
              </span>
            </div>
          </div>
        ))
      )}
    </>
  );
}
