"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Badge, Card } from "@/components/ui";

const TYPES = ["trichoderma", "cobweb", "bacterial_blotch", "green_mold", "wet_spot", "other"];

export default function ContaminationPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [form, setForm] = useState({ batch_id: "", contam_type: "trichoderma", severity: "low", photo_url: "", action_taken: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    const [l, g, b] = await Promise.all([
      supabase.from("contamination_logs").select("*, batches(lot_code)").order("observed_on", { ascending: false }),
      supabase.from("reference_guides").select("*").eq("guide_type", "contamination"),
      supabase.from("batches").select("id,lot_code,container_id").order("created_at", { ascending: false }),
    ]);
    setLogs(l.data ?? []);
    setGuides(g.data ?? []);
    setBatches(b.data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.batch_id) { setMsg("Pick a batch."); return; }
    const { error } = await supabase.from("contamination_logs").insert({
      batch_id: Number(form.batch_id),
      observed_on: new Date().toISOString().slice(0, 10),
      contam_type: form.contam_type,
      severity: form.severity,
      photo_url: form.photo_url,
      action_taken: form.action_taken,
      reported_by: "app",
    });
    setMsg(error ? error.message : "Logged ✓");
    if (!error) { setForm({ ...form, photo_url: "", action_taken: "" }); load(); }
  }

  const guideFor = (t: string) =>
    guides.find((g) => g.label.toLowerCase().includes(t.split("_")[0]))?.action;

  return (
    <>
      <h2 className="section">Contamination Watch</h2>
      <p className="lead">
        Log a sighting with a photo. <span className="muted">CV hook:</span> a vision model can auto-classify the
        photo and pre-fill the type — the <code>photo_url</code> + guide lookup are the integration point (#1).
      </p>

      <div className="grid two">
        <Card title="Log a sighting">
          <form onSubmit={submit}>
            <div style={{ marginBottom: 8 }}>
              <select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
                <option value="">Select batch…</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.container_id || b.lot_code} — {b.lot_code}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select value={form.contam_type} onChange={(e) => setForm({ ...form, contam_type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} style={{ width: 120 }}>
                <option value="low">low</option><option value="med">med</option><option value="high">high</option>
              </select>
            </div>
            <input style={{ marginBottom: 8 }} placeholder="photo URL" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
            <textarea style={{ marginBottom: 8 }} rows={2} placeholder="action taken" value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} />
            {guideFor(form.contam_type) && (
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                📖 Guide: {guideFor(form.contam_type)}
              </div>
            )}
            <button className="primary">Log sighting</button>
            {msg && <span className="muted" style={{ marginLeft: 10 }}>{msg}</span>}
          </form>
        </Card>

        <Card title="Recent sightings">
          {logs.length === 0 ? <div className="muted">None logged.</div> : (
            <table>
              <thead><tr><th>Date</th><th>Batch</th><th>Type</th><th>Sev</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="muted">{l.observed_on}</td>
                    <td>{l.batches?.lot_code}</td>
                    <td>{l.contam_type}</td>
                    <td><Badge tone={l.severity === "high" ? "red" : l.severity === "med" ? "amber" : "muted"}>{l.severity}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
