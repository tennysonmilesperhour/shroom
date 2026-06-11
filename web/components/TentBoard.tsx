"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "./ui";
import { cToF } from "@/lib/format";
import { moveBatchToRoom } from "@/app/(app)/environment/actions";

export interface TentRoom {
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

export interface TentBatch {
  id: number;
  lot_code: string;
  container_id: string | null;
  container_type: string | null;
  stage: string;
  room_id: number | null;
  contamination_flag: boolean;
  strain: string | null;
}

interface TentBoardProps {
  rooms: TentRoom[];
  batches: TentBatch[];
}

// A single environment metric (target vs. latest), the three the operator
// actually dials in per tent: FAE, relative humidity, CO2 (plus temp).
function Metric({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number | null;
  target: number | string;
  unit: string;
}) {
  return (
    <span className="tent-metric">
      <span className="tent-metric-label">{label}</span>
      <b>
        {value ?? "-"}
        {unit}
      </b>
      <span className="muted"> / {target}</span>
    </span>
  );
}

export default function TentBoard({ rooms, batches }: TentBoardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overRoom, setOverRoom] = useState<number | "tray" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Optimistic placement: while a move is in flight, reflect it immediately so
  // the chip jumps to its new tent without waiting on the round-trip.
  const [optimistic, setOptimistic] = useState<Record<number, number | null>>({});
  const roomOf = (b: TentBatch) =>
    b.id in optimistic ? optimistic[b.id] : b.room_id;

  const unassigned = batches.filter((b) => roomOf(b) === null);

  function drop(target: number | null) {
    setOverRoom(null);
    const id = dragId;
    setDragId(null);
    if (id === null) return;
    const batch = batches.find((b) => b.id === id);
    if (!batch || roomOf(batch) === target) return;

    setOptimistic((m) => ({ ...m, [id]: target }));
    setMsg(null);
    startTransition(async () => {
      const r = await moveBatchToRoom(id, target);
      if (r.ok) {
        router.refresh();
      } else {
        // Roll the optimistic move back if the server rejected it.
        setOptimistic((m) => {
          const next = { ...m };
          delete next[id];
          return next;
        });
        setMsg(r.message ?? "Move failed");
      }
    });
  }

  function chip(b: TentBatch) {
    return (
      <div
        key={b.id}
        className={`tent-chip${dragId === b.id ? " dragging" : ""}`}
        draggable
        onDragStart={() => setDragId(b.id)}
        onDragEnd={() => {
          setDragId(null);
          setOverRoom(null);
        }}
        title="Drag to another tent"
      >
        <Link href={`/batches/${b.id}`} className="tent-chip-link">
          <b>{b.container_id || b.lot_code}</b>
          {b.contamination_flag && (
            <Badge tone="red">
              <span className="sr-only">Contaminated</span>!
            </Badge>
          )}
          <span className="tent-chip-meta">
            {b.strain ?? "?"} · {b.stage.replace(/_/g, " ")}
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className={pending ? "tent-board busy" : "tent-board"}>
      {msg && (
        <p className="muted" style={{ color: "var(--ember)", fontSize: 13 }}>
          {msg}
        </p>
      )}

      <div className="tent-grid">
        {rooms.map((r) => {
          const items = batches.filter((b) => roomOf(b) === r.room_id);
          const isOver = overRoom === r.room_id;
          return (
            <div
              key={r.room_id}
              className={`tent${isOver ? " over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (overRoom !== r.room_id) setOverRoom(r.room_id);
              }}
              onDragLeave={(e) => {
                // Only clear when actually leaving the box, not crossing children.
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setOverRoom((o) => (o === r.room_id ? null : o));
              }}
              onDrop={() => drop(r.room_id)}
            >
              <div className="tent-head">
                <h3>
                  {r.room}{" "}
                  <Badge tone="muted">{r.room_type.replace(/_/g, " ")}</Badge>
                </h3>
                <Badge tone={r.in_spec === false ? "red" : r.in_spec ? "green" : "muted"}>
                  {r.in_spec === null ? "no data" : r.in_spec ? "in spec" : "alert"}
                </Badge>
              </div>

              <div className="tent-metrics">
                <Metric label="Temp" value={cToF(r.temp_c)} target={`${cToF(r.target_temp_c)}°F`} unit="°F" />
                <Metric label="RH" value={r.humidity} target={`${r.target_humidity}%`} unit="%" />
                <Metric label="CO₂" value={r.co2_ppm} target={`${r.target_co2_ppm}ppm`} unit="ppm" />
                <Metric label="FAE" value={r.fae_per_hr} target={`${r.target_fae_per_hr}/hr`} unit="/hr" />
              </div>

              <div className="tent-bin">
                <div className="tent-bin-head">
                  <span className="muted">
                    {items.length} {items.length === 1 ? "lot" : "lots"}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="tent-empty muted">Drop a lot here</p>
                ) : (
                  items.map(chip)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Staging tray: lots not placed in any tent yet, ready to drag in. */}
      <div
        className={`tent-tray${overRoom === "tray" ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (overRoom !== "tray") setOverRoom("tray");
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setOverRoom((o) => (o === "tray" ? null : o));
        }}
        onDrop={() => drop(null)}
      >
        <h4>
          Unassigned <span className="muted">· {unassigned.length}</span>
        </h4>
        <div className="tent-tray-items">
          {unassigned.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Every lot is placed in a tent. Drag one here to pull it out.
            </p>
          ) : (
            unassigned.map(chip)
          )}
        </div>
      </div>
    </div>
  );
}
