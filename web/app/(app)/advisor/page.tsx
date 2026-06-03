"use client";

import { useEffect, useState } from "react";

const QUICK = [
  "My Stargazer dry ratio is low — what's driving it and how do I fix it?",
  "Fruiting Tent A CO₂ is high and FAE is low. What should I change?",
  "What should I prioritize today across my active batches?",
  "JMF has early trichoderma in one grain bag. What now?",
];

export default function AdvisorPage() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [ctx, setCtx] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);

  useEffect(() => {
    fetch("/api/advisor")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, model: "" }));
  }, []);

  async function ask(question: string) {
    if (!question.trim()) return;
    setQ(question);
    setBusy(true);
    setAnswer("Thinking…");
    setCtx("");
    const res = await fetch("/api/advisor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.answered) {
      setAnswer(data.answer);
    } else {
      setAnswer(`⚠ ${data.reason}`);
      setCtx(data.context ?? "");
    }
  }

  return (
    <>
      <h2 className="section">AI Grow Advisor</h2>
      <p className="lead">
        Grounded in your live data <i>and</i> your own issue log + troubleshooting guides (RAG). Key stays server-side.
      </p>
      <div className="card">
        <div style={{ marginBottom: 12 }}>
          {status === null ? (
            <span className="badge muted">checking AI status…</span>
          ) : status.configured ? (
            <span className="badge green">AI connected · {status.model}</span>
          ) : (
            <span className="badge red">
              No API key in this deployment — add ANTHROPIC_API_KEY for the Preview environment in Vercel, then redeploy
            </span>
          )}
        </div>
        <div className="quick">
          {QUICK.map((x) => (
            <button key={x} onClick={() => ask(x)}>{x.length > 38 ? x.slice(0, 36) + "…" : x}</button>
          ))}
        </div>
        <textarea rows={3} placeholder="Ask the advisor about your grow…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginTop: 10 }}>
          <button className="primary" onClick={() => ask(q)} disabled={busy || !q.trim()}>Ask advisor</button>
        </div>
        <div className="advisor-answer" style={{ marginTop: 12 }}>
          {answer || "Ask a question to get advice grounded in your live operation data."}
          {ctx && <pre style={{ whiteSpace: "pre-wrap", marginTop: 10, color: "var(--muted)" }}>{ctx}</pre>}
        </div>
      </div>
    </>
  );
}
