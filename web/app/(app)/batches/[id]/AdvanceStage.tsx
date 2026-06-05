"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceBatchStage } from "../actions";

interface AdvanceStageProps {
  batchId: number;
  currentStage: string;
}

const STAGE_ORDER = [
  "inoculation", "colonization", "spawn_to_bulk",
  "fruiting", "harvesting", "spent",
] as const;

export default function AdvanceStage({ batchId, currentStage }: AdvanceStageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const idx = STAGE_ORDER.indexOf(currentStage as (typeof STAGE_ORDER)[number]);
  if (idx < 0 || idx === STAGE_ORDER.length - 1) return null;
  const next = STAGE_ORDER[idx + 1];

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await advanceBatchStage(batchId);
      if (r.ok) router.refresh();
      else setMsg(r.message ?? "Failed");
    });
  }

  return (
    <button
      type="button"
      className="primary"
      onClick={run}
      disabled={pending}
      style={{ marginTop: 4 }}
    >
      {pending ? "Advancing…" : `Advance to ${next}`}
      {msg && (
        <span style={{ marginLeft: 10, color: "var(--ember)", fontSize: 12, fontWeight: 400 }}>
          {msg}
        </span>
      )}
    </button>
  );
}
