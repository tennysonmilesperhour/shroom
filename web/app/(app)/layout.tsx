import Nav from "@/components/Nav";
import MobileNav from "@/components/MobileNav";
import SporeMark from "@/components/SporeMark";
import SectionTint from "@/components/SectionTint";
import CommandPalette from "@/components/CommandPalette";
import VersionWatcher from "@/components/VersionWatcher";
import { createServiceClient } from "@/utils/supabase/service";

// Open access - no auth gate. SSR pages read with the service-role client
// (see utils/supabase/service.ts); the browser never holds a Supabase session.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Lightweight index for the command palette: enough to search and
  // navigate but no PII. Errors degrade silently to an empty list.
  let cmdIndex: Awaited<ReturnType<typeof loadCommandIndex>> = {
    batches: [], strains: [], customers: [], orders: [],
  };
  try {
    cmdIndex = await loadCommandIndex();
  } catch {
    /* ignore - palette still renders with empty results */
  }

  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

  return (
    <div className="shell">
      <SectionTint />
      <VersionWatcher buildId={buildId} />
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <MobileNav />

      <aside className="sidebar" aria-label="Sidebar">
        <div className="brand">
          <SporeMark size={26} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span className="logo">Quantum Blue</span>
            <span
              style={{
                fontSize: 9.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              Mycology OS
            </span>
          </div>
        </div>
        <Nav />
        <div className="foot">
          <span className="who">
            <span className="live-dot" aria-hidden="true" />
            Live · in-house
          </span>
        </div>
      </aside>

      <div className="content">
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <CommandPalette index={cmdIndex} />
    </div>
  );
}

interface CommandIndex {
  batches: { id: number; lot_code: string; stage: string; strain: string | null }[];
  strains: { id: number; name: string; mushroom_type: string }[];
  customers: { id: number; name: string; channel: string }[];
  orders: { id: number; order_number: string; date: string; customer: string | null }[];
}

async function loadCommandIndex(): Promise<CommandIndex> {
  const supabase = createServiceClient();
  const [batches, strains, customers, orders] = await Promise.all([
    supabase
      .from("batches")
      .select("id,lot_code,stage,strains(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("strains").select("id,name,mushroom_type").order("name").limit(200),
    supabase.from("customers").select("id,name,channel").order("name").limit(200),
    supabase
      .from("orders")
      .select("id,order_number,order_date,customers(name)")
      .order("order_date", { ascending: false })
      .limit(200),
  ]);

  type B = { id: number; lot_code: string; stage: string; strains: { name: string } | null };
  type S = { id: number; name: string; mushroom_type: string };
  type C = { id: number; name: string; channel: string };
  type O = {
    id: number; order_number: string; order_date: string;
    customers: { name: string } | null;
  };

  return {
    batches: ((batches.data as B[] | null) ?? []).map((b) => ({
      id: b.id, lot_code: b.lot_code, stage: b.stage, strain: b.strains?.name ?? null,
    })),
    strains: ((strains.data as S[] | null) ?? []).map((s) => ({
      id: s.id, name: s.name, mushroom_type: s.mushroom_type,
    })),
    customers: ((customers.data as C[] | null) ?? []).map((c) => ({
      id: c.id, name: c.name, channel: c.channel,
    })),
    orders: ((orders.data as O[] | null) ?? []).map((o) => ({
      id: o.id, order_number: o.order_number, date: o.order_date, customer: o.customers?.name ?? null,
    })),
  };
}
