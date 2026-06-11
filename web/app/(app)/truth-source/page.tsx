import { Badge, Card, Kpi } from "@/components/ui";
import { createServiceClient } from "@/utils/supabase/service";
import { must } from "@/lib/query";
import { toSheetEmbedUrl, isGoogleSheet } from "@/lib/sheets";
import { displayUrl } from "@/lib/external";
import AddPanel from "@/components/AddPanel";
import AddTruthSourceForm from "./AddTruthSourceForm";
import RemoveSourceButton from "./RemoveSourceButton";

export const dynamic = "force-dynamic";

interface TruthSource {
  id: number;
  label: string;
  url: string;
  category: string;
  notes: string | null;
  position: number;
  height: number;
  created_at: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  cultivation: "Cultivation",
  sales: "Sales",
  finance: "Finance",
  inventory: "Inventory",
};

export default async function TruthSourcePage() {
  const supabase = createServiceClient();
  const sources = await must<TruthSource[]>(
    supabase
      .from("truth_sources")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    "load truth sources",
  );

  const categories = new Set(sources.map((s) => s.category));

  return (
    <>
      <div>
        <div className="eyebrow">Intelligence</div>
        <h1 className="section">Truth Source</h1>
        <p className="lead">
          Embed the Google Sheets you treat as canonical. Each registered sheet
          renders live below and refreshes from Google on every load — add or
          remove a source and that live data input appears (or disappears)
          everywhere this tab is viewed. The sheets stay editable in Google; this
          is the single place the whole team reads them.
        </p>
      </div>

      <div className="kpi-row">
        <Kpi label="Live sources" countTo={sources.length} feature />
        <Kpi label="Categories" countTo={categories.size} />
        <Kpi
          label="Most recent"
          value={sources[sources.length - 1]?.created_at?.slice(0, 10) ?? "—"}
        />
      </div>

      <AddPanel label="New truth source">
        <AddTruthSourceForm />
      </AddPanel>

      {sources.length === 0 ? (
        <Card title="No sources yet">
          <p className="muted" style={{ margin: 0 }}>
            Paste a Google Sheets link above to embed your first live data input.
            In Google, share the sheet as <b>“Anyone with the link can view”</b>{" "}
            (or use <b>File → Share → Publish to web</b>) so it renders here.
          </p>
        </Card>
      ) : (
        sources.map((s) => {
          const embed = toSheetEmbedUrl(s.url);
          return (
            <Card key={s.id} className="embed-source">
              <div className="embed-source-head">
                <div>
                  <h3 style={{ margin: 0 }}>{s.label}</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <Badge tone="violet">{CATEGORY_LABEL[s.category] ?? s.category}</Badge>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="muted"
                      style={{ fontSize: 11 }}
                    >
                      {displayUrl(s.url)} ↗
                    </a>
                  </div>
                  {s.notes && (
                    <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                      {s.notes}
                    </p>
                  )}
                </div>
                <RemoveSourceButton id={s.id} label={s.label} />
              </div>

              {embed ? (
                <iframe
                  className="embed-frame"
                  src={embed}
                  title={s.label}
                  style={{ height: s.height }}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  This URL can’t be embedded.{" "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    Open it directly ↗
                  </a>
                </p>
              )}

              {embed && !isGoogleSheet(s.url) && (
                <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                  Embedded as a generic live URL (not a Google Sheet).
                </p>
              )}
            </Card>
          );
        })
      )}
    </>
  );
}
