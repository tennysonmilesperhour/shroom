"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Opt = { id: number; name: string };

// Innovation #7: turn an SOP checklist into batch-scoped tasks via the
// generate_protocol_tasks RPC.
export default function GenerateTasks({ protocols, batches }: { protocols: Opt[]; batches: Opt[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [protocol, setProtocol] = useState(protocols[0]?.id ?? 0);
  const [batch, setBatch] = useState<number | "">("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.rpc("generate_protocol_tasks", {
      p_protocol_id: protocol,
      p_batch_id: batch === "" ? null : batch,
    });
    setBusy(false);
    setMsg(error ? error.message : `Created ${data} tasks ✓`);
    if (!error) router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <select value={protocol} onChange={(e) => setProtocol(Number(e.target.value))} style={{ width: "auto" }}>
        {protocols.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={batch} onChange={(e) => setBatch(e.target.value === "" ? "" : Number(e.target.value))} style={{ width: "auto" }}>
        <option value="">(no batch)</option>
        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <button className="primary" onClick={run} disabled={busy}>Generate SOP tasks</button>
      {msg && <span className="muted">{msg}</span>}
    </div>
  );
}
