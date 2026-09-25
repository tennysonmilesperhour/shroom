"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ToastProvider";
import { removeOrderLine } from "../actions";

export default function RemoveLineButton({ orderId, lineId, label }: { orderId: number; lineId: number; label: string }) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  return (
    <button
      type="button"
      className="icon-btn"
      disabled={pending}
      aria-label={`Remove ${label}`}
      title="Remove line"
      onClick={() => {
        if (!window.confirm(`Remove ${label} from this order?`)) return;
        startTransition(async () => {
          const r = await removeOrderLine(orderId, lineId);
          push({ title: r.ok ? "Removed" : "Couldn’t remove", body: r.message, tone: r.ok ? "moss" : "ember" });
        });
      }}
    >
      {pending ? "…" : "×"}
    </button>
  );
}
