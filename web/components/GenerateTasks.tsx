"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateProtocolTasks } from "@/app/(app)/batches/actions";

interface Option {
  id: number;
  name: string;
}

interface GenerateTasksProps {
  protocols: Option[];
  batches: Option[];
}

// Materializes an SOP checklist into batch-scoped tasks. The actual insert
// happens server-side via the `generate_protocol_tasks` RPC, called through a
// server action so the browser never holds a Supabase client.
export default function GenerateTasks({ protocols, batches }: GenerateTasksProps) {
  const router = useRouter();
  const protocolId = useId();
  const batchId = useId();

  const [protocol, setProtocol] = useState<number>(protocols[0]?.id ?? 0);
  const [batch, setBatch] = useState<number | "">("");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  function run() {
    setMsg("");
    startTransition(async () => {
      const res = await generateProtocolTasks(
        protocol,
        batch === "" ? null : batch,
      );
      if (res.ok) {
        setMsg(`Created ${res.created} tasks ✓`);
        router.refresh();
      } else {
        setMsg(res.message);
      }
    });
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div>
        <label htmlFor={protocolId} className="eyebrow" style={{ display: "block", marginBottom: 4 }}>
          Protocol
        </label>
        <select
          id={protocolId}
          value={protocol}
          onChange={(e) => setProtocol(Number(e.target.value))}
          style={{ width: "auto" }}
        >
          {protocols.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={batchId} className="eyebrow" style={{ display: "block", marginBottom: 4 }}>
          Batch
        </label>
        <select
          id={batchId}
          value={batch}
          onChange={(e) => setBatch(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ width: "auto" }}
        >
          <option value="">(no batch)</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <button type="button" className="primary" onClick={run} disabled={pending || protocols.length === 0}>
        {pending ? "Creating…" : "Spawn tasks"}
      </button>
      {msg && (
        <span className="muted" role="status">
          {msg}
        </span>
      )}
    </div>
  );
}
