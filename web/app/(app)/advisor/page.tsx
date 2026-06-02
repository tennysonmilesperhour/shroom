"use client";

import { useState } from "react";

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

  async function ask(question: string) {
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
      setAnswer(`(${data.reason})`);
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
        <div className="quick">
          {QUICK.map((x) => (
            <button key={x} onClick={() => ask(x)}>{x.length > 38 ? x.slice(0, 36) + "…" : x}</button>
          ))}
        </div>
        <textarea rows={3} placeholder="Ask the advisor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginTop: 10 }}>
          <button className="primary" onClick={() => ask(q)} disabled={busy || !q}>Ask advisor</button>
        </div>
        <div className="advisor-answer" style={{ marginTop: 12 }}>
          {answer || "Answers appear here. Without ANTHROPIC_API_KEY set, the assembled live context is shown."}
          {ctx && <pre style={{ whiteSpace: "pre-wrap", marginTop: 10, color: "var(--muted)" }}>{ctx}</pre>}
        </div>
      </div>
    </>
  );
}
