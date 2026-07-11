"use client";

import { useRef, useState, useTransition, type ReactNode, type FormEvent } from "react";
import { useToast } from "@/components/ToastProvider";

export interface EntityResult {
  ok: boolean;
  message?: string;
}

interface EntityFormProps {
  action: (formData: FormData) => Promise<EntityResult>;
  submitLabel?: string;
  children: ReactNode;
  /** Reset the form on success. Default true. */
  resetOnSuccess?: boolean;
}

// Thin wrapper for "Add X" forms. Children are the labelled inputs; this
// component handles submission state, optimistic disable, and inline status.
export default function EntityForm({
  action,
  submitLabel = "Save",
  children,
  resetOnSuccess = true,
}: EntityFormProps) {
  const [result, setResult] = useState<EntityResult | null>(null);
  const [bloom, setBloom] = useState(false);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const bloomTimer = useRef<number | undefined>(undefined);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const r = await action(data);
      setResult(r);
      if (r.ok && resetOnSuccess) form.reset();
      if (r.ok) {
        // One-shot success bloom on the button, echoing the toast.
        setBloom(false);
        window.clearTimeout(bloomTimer.current);
        requestAnimationFrame(() => setBloom(true));
        bloomTimer.current = window.setTimeout(() => setBloom(false), 900);
      }
      push({
        title: r.ok ? "Saved" : "Couldn’t save",
        body: r.message ?? (r.ok ? undefined : "Something went wrong."),
        tone: r.ok ? "moss" : "ember",
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="form-grid">
      {children}
      <div className="actions full">
        <button
          type="submit"
          className={`primary${bloom ? " action-bloom" : ""}`}
          data-ripple
          disabled={pending}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {result && (
          <span
            role="status"
            className="muted"
            style={{ color: result.ok ? "var(--moss)" : "var(--ember)" }}
          >
            {result.message ?? (result.ok ? "Saved ✓" : "Failed")}
          </span>
        )}
      </div>
    </form>
  );
}
