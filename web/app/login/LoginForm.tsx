"use client";

import { useActionState, useId } from "react";
import { signIn } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(signIn, null);
  const id = useId();
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor={id}>Password</label>
        <input id={id} name="password" type="password" autoComplete="current-password" required autoFocus />
      </div>
      <button type="submit" className="primary" disabled={pending} style={{ width: "100%", marginTop: "var(--space-3)" }}>
        {pending ? "Checking…" : "Enter"}
      </button>
      {error && <div className="err" role="alert">{error}</div>}
    </form>
  );
}
