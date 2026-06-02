"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (mode === "up") { setMsg("Account created. If email confirmation is on, confirm then sign in."); setMode("in"); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="logo">Shroom<span>OS</span></div>
        <p className="lead" style={{ textAlign: "center" }}>Quantum Blue Mycology</p>
        <div className="field">
          <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        {err && <div className="err">{err}</div>}
        {msg && <div className="lead" style={{ marginTop: 8 }}>{msg}</div>}
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button type="button" className="toggle" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
