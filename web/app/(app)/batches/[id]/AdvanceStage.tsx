"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceBatchStage } from "../actions";
import { nextStage } from "@/lib/stages";

interface AdvanceStageProps {
  batchId: number;
  currentStage: string;
}

export default function AdvanceStage({ batchId, currentStage }: AdvanceStageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const next = nextStage(currentStage);
  if (!next) return null;

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
