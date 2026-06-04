"use client";

import { useEffect, useId, useState } from "react";

const QUICK: readonly string[] = [
  "My Stargazer dry ratio is low. What's driving it and how do I fix it?",
  "Fruiting Tent A CO₂ is high and FAE is low. What should I change?",
  "What should I prioritize today across my active batches?",
  "JMF has early trichoderma in one grain bag. What now?",
];

interface AdvisorStatus {
  configured: boolean;
  model: string;
}

interface AdvisorResponse {
  answered: boolean;
  answer?: string;
  reason?: string;
}

export default function AdvisorPage() {
  const textareaId = useId();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AdvisorStatus | null>(null);

  useEffect(() => {
    fetch("/api/advisor")
      .then((r) => r.json() as Promise<AdvisorStatus>)
      .then(setStatus)
      .catch(() => setStatus({ configured: false, model: "" }));
  }, []);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQ(question);
    setBusy(true);
    setAnswer("Thinking…");
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await res.json()) as AdvisorResponse;
      if (data.answered && data.answer) {
        setAnswer(data.answer);
      } else {
        setAnswer(`⚠ ${data.reason ?? "Advisor unavailable."}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setAnswer(`⚠ ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div>
        <div className="eyebrow">Intelligence</div>
        <h1 className="section">AI Grow Advisor</h1>
        <p className="lead">
          Grounded in your live data and your own issue log + troubleshooting guides (RAG).
          The Anthropic key stays server-side.
        </p>
      </div>

      <div className="card">
        <div style={{ marginBottom: 12 }}>
          {status === null ? (
            <span className="badge muted">checking AI status…</span>
          ) : status.configured ? (
            <span className="badge green">AI connected · {status.model}</span>
          ) : (
            <span className="badge red">
              No API key in this deployment. Add ANTHROPIC_API_KEY in Vercel, then redeploy.
            </span>
          )}
        </div>

        <div className="quick">
          {QUICK.map((x) => (
            <button key={x} type="button" onClick={() => ask(x)} aria-label={x} title={x}>
              {x.length > 38 ? x.slice(0, 36) + "…" : x}
            </button>
          ))}
        </div>

        <label htmlFor={textareaId} className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
          Your question
        </label>
        <textarea
          id={textareaId}
          rows={3}
          placeholder="Ask the advisor about your grow…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="primary"
            onClick={() => ask(q)}
            disabled={busy || !q.trim()}
          >
            Ask advisor
          </button>
        </div>

        <div
          className="advisor-answer"
          style={{ marginTop: 12 }}
          aria-live="polite"
          aria-busy={busy}
        >
          {answer || "Ask a question to get advice grounded in your live operation data."}
        </div>
      </div>
    </>
  );
}
