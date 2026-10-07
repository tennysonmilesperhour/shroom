"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStageAutomation } from "@/app/(app)/timing-actions";

export default function StageAutomationToggles({
  strainId,
  alerts,
  labels,
  unlocked,
}: {
  strainId: number;
  alerts: boolean;
  labels: boolean;
  /** Confidence has cleared the bar. Switches stay usable for turning things off. */
  unlocked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save(patch: { alerts?: boolean; labels?: boolean }) {
    setMessage(null);
    startTransition(async () => {
      const result = await setStageAutomation({ strainId, ...patch });
      if (result.ok) router.refresh();
      else setMessage(result.message ?? "Could not save.");
    });
  }

  return (
    <div className="timing-automation">
      <label className="tap-toggle" htmlFor={`timing-alerts-${strainId}`}>
        <input
          id={`timing-alerts-${strainId}`}
          type="checkbox"
          checked={alerts}
          disabled={pending || (!unlocked && !alerts)}
          onChange={(e) => save({ alerts: e.target.checked })}
        />
        <span className="tap-toggle-track" aria-hidden="true"><span /></span>
        <span>Alert when a batch is due to change stage</span>
      </label>
      <label className="tap-toggle" htmlFor={`timing-labels-${strainId}`}>
        <input
          id={`timing-labels-${strainId}`}
          type="checkbox"
          checked={labels}
          disabled={pending || (!unlocked && !labels)}
          onChange={(e) => save({ labels: e.target.checked })}
        />
        <span className="tap-toggle-track" aria-hidden="true"><span /></span>
        <span>Queue next-stage labels for printing</span>
      </label>
      {message && <p className="timing-prompt-error">{message}</p>}
    </div>
  );
}
