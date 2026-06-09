"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ToastProvider";
import { setCultureStatus } from "./actions";
import { CULTURE_STATUSES } from "./constants";

interface StatusSelectProps {
  cultureId: number;
  status: string;
}

// Inline dropdown to move a unit along the lifecycle pipeline. Optimistically
// reflects the choice, then confirms (or reverts) once the server action lands.
export default function StatusSelect({ cultureId, status }: StatusSelectProps) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const r = await setCultureStatus(cultureId, next);
      if (!r.ok) {
        setValue(prev);
        push({ title: "Couldn’t update", body: r.message, tone: "ember" });
      } else {
        push({ title: "Moved", body: r.message, tone: "moss" });
      }
    });
  }

  return (
    <select
      className="inline-select"
      aria-label="Lifecycle status"
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
    >
      {CULTURE_STATUSES.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
