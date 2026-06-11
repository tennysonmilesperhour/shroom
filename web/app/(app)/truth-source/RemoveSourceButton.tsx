"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { removeTruthSource } from "./actions";

export default function RemoveSourceButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm(`Remove "${label}" from Truth Source? The sheet itself is untouched.`)) {
      return;
    }
    startTransition(async () => {
      const r = await removeTruthSource(id);
      push({
        title: r.ok ? "Removed" : "Couldn’t remove",
        body: r.message,
        tone: r.ok ? "moss" : "ember",
      });
      if (r.ok) router.refresh();
    });
  }

  return (
    <button type="button" className="btn-ghost" onClick={run} disabled={pending}>
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
