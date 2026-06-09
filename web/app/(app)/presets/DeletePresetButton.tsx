"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ToastProvider";
import { deletePreset } from "./actions";

export default function DeletePresetButton({
  presetId,
  name,
}: {
  presetId: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  return (
    <button
      type="button"
      className="link-danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete preset "${name}"?`)) return;
        startTransition(async () => {
          const r = await deletePreset(presetId);
          push({
            title: r.ok ? "Deleted" : "Couldn’t delete",
            body: r.message,
            tone: r.ok ? "moss" : "ember",
          });
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
