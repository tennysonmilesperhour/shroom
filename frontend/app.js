// Shroom OS dashboard — vanilla JS, no build step. Talks to the FastAPI /api.
const API = (path) => fetch(`/api${path}`).then((r) => {
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
});
const POST = (path, body) => fetch(`/api${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json());

const $ = (id) => document.getElementById(id);
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
const g = (kg) => Math.round(kg * 1000);            // kg -> grams
const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
const stageBadge = (s) => {
  const map = { harvesting: 'green', fruiting: 'green', colonization: 'amber', inoculation: 'amber',
                spawn_to_bulk: 'amber', spent: 'muted', contaminated: 'red' };
  return `<span class="badge ${map[s] || 'muted'}">${s}</span>`;
};

// --- Navigation ---
const views = {};
document.querySelectorAll('#nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#nav button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.view;
    $(id).classList.add('active');
    (views[id] || (() => {}))();
  });
});

API('/health').then((h) => { $('health').textContent = `● ${h.service} ${'ok'}`; })
  .catch(() => { $('health').textContent = '● offline'; $('health').style.color = 'var(--red)'; });

// --- Dashboard ---
views.dashboard = async () => {
  const root = $('dashboard');
  root.innerHTML = '<div class="loading">Loading operation snapshot…</div>';
  const [d, dry, env, yields] = await Promise.all([
    API('/analytics/dashboard'), API('/analytics/dry-ratio'),
    API('/environment/status'), API('/analytics/yield-by-strain'),
  ]);
  const kpi = (label, value, unit = '') =>
    `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}<span class="unit"> ${unit}</span></div></div>`;
  const alerts = env.filter((e) => e.alerts.length);
  root.innerHTML = `
    <h2 class="section">Operation Dashboard</h2>
    <p class="lead">Live, persisted source of truth — last ${d.period_days} days.</p>
    <div class="grid kpis">
      ${kpi('Active batches', d.active_batches)}
      ${kpi('Blocks in production', d.blocks_in_production)}
      ${kpi('Harvested (fresh)', g(d.harvested_kg), 'g')}
      ${kpi('Overall dry ratio', dry.overall_dry_ratio_pct, '%')}
      ${kpi('Revenue', money(d.revenue_period))}
      ${kpi('Contam rate', d.contamination_rate_pct, '%')}
    </div>
    <div class="grid two" style="margin-top:16px">
      <div class="card">
        <h3>Environment alerts</h3>
        ${alerts.length ? alerts.map((a) => `<div class="env-row"><span><b>${a.room}</b></span>
          <span class="badge red">${a.alerts.join(' · ')}</span></div>`).join('')
          : '<div class="muted">All rooms in spec ✓</div>'}
      </div>
      <div class="card">
        <h3>Attention</h3>
        <div class="env-row"><span>Open tasks</span><span class="badge amber">${d.open_tasks}</span></div>
        <div class="env-row"><span>Low-stock items</span><span class="badge ${d.low_stock_count ? 'red' : 'green'}">${d.low_stock_count}</span></div>
        <div class="muted" style="margin-top:8px">${d.low_stock_items.join(', ') || 'Inventory healthy'}</div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Yield by strain</h3>
      <table><thead><tr><th>Strain</th><th>Batches</th><th class="right">Fresh (g)</th><th class="right">Bio-efficiency</th></tr></thead>
      <tbody>${yields.map((y) => `<tr><td>${y.strain}</td><td>${y.batches}</td>
        <td class="right">${g(y.fresh_kg)}</td><td class="right">${y.biological_efficiency_pct}%</td></tr>`).join('')}</tbody></table>
    </div>`;
};

// --- Strains ---
views.strains = async () => {
  const root = $('strains');
  root.innerHTML = '<div class="loading">Loading strains…</div>';
  const strains = await API('/strains');
  const typeBadge = (t) => `<span class="badge ${t === 'psychedelic' ? 'blue' : t === 'functional' ? 'green' : 'amber'}">${t}</span>`;
  root.innerHTML = `<h2 class="section">Strain Library</h2>
    <p class="lead">Vendor, genetics, potency, ease & grow-again — carried from the strain cards.</p>
    ${strains.map((s) => `
      <details class="strain">
        <summary>${s.name} ${typeBadge(s.mushroom_type)}
          <span class="stars">${stars(s.ease_rating)}</span>
          ${s.grow_again ? '<span class="badge green">grow again</span>' : '<span class="badge red">retire</span>'}</summary>
        <div class="body">
          <div>Species: <b>${s.species || '—'}</b></div>
          <div>Code: <b>${s.strain_code || '—'}</b></div>
          <div>Vendor: <b>${s.vendor || '—'}</b></div>
          <div>Genetics: <b>${s.genetics || '—'}</b></div>
          <div>Potency: <b>${s.potency || '—'}</b></div>
          <div>Generation: <b>F${s.generation}</b></div>
          <div>Target: <b>${s.target_temp_c}°C / ${s.target_humidity}% / ${s.target_co2_ppm}ppm</b></div>
          <div>Typical BE: <b>${s.typical_be}%</b> over <b>${s.typical_flushes}</b> flushes</div>
          <div style="grid-column:1/3">Notes: <b>${s.notes || '—'}</b></div>
        </div>
      </details>`).join('')}`;
};

// --- Batches ---
views.batches = async () => {
  const root = $('batches');
  root.innerHTML = '<div class="loading">Loading batches…</div>';
  const [batches, strains, rooms] = await Promise.all([API('/batches'), API('/strains'), API('/rooms')]);
  const sName = (id) => (strains.find((s) => s.id === id) || {}).name || '?';
  const rName = (id) => (rooms.find((r) => r.id === id) || {}).name || '—';
  root.innerHTML = `<h2 class="section">Production Batches</h2>
    <p class="lead">Each batch is a traceable lot through the grain-bag-to-tub lifecycle.</p>
    <div class="card"><table>
      <thead><tr><th>Lot</th><th>Strain</th><th>Stage</th><th>Room</th><th class="right">Units</th><th class="right">Substrate</th><th>Inoculated</th></tr></thead>
      <tbody>${batches.map((b) => `<tr>
        <td><b>${b.lot_code}</b>${b.contamination_flag ? ' <span class="badge red">contam</span>' : ''}</td>
        <td>${sName(b.strain_id)}</td><td>${stageBadge(b.stage)}</td><td>${rName(b.room_id)}</td>
        <td class="right">${b.block_count}</td><td class="right">${b.substrate_weight_kg} kg</td>
        <td>${b.inoculated_on || '—'}</td></tr>`).join('')}</tbody>
    </table></div>`;
};

// --- Harvests ---
views.harvests = async () => {
  const root = $('harvests');
  root.innerHTML = '<div class="loading">Loading harvests…</div>';
  const dry = await API('/analytics/dry-ratio');
  root.innerHTML = `<h2 class="section">Harvests & Dry Ratio</h2>
    <p class="lead">Flush-by-flush. Rows flagged when dry ratio falls below the ${dry.dry_ratio_floor_pct}% floor.</p>
    <div class="grid kpis">
      <div class="card kpi"><div class="label">Total fresh</div><div class="value">${dry.total_fresh_g}<span class="unit"> g</span></div></div>
      <div class="card kpi"><div class="label">Total dry</div><div class="value">${dry.total_dry_g}<span class="unit"> g</span></div></div>
      <div class="card kpi"><div class="label">Overall ratio</div><div class="value">${dry.overall_dry_ratio_pct}<span class="unit"> %</span></div></div>
      <div class="card kpi"><div class="label">Below floor</div><div class="value">${dry.flagged_below_floor}<span class="unit"> / ${dry.flushes}</span></div></div>
    </div>
    <div class="card" style="margin-top:16px"><table>
      <thead><tr><th>Date</th><th>Strain</th><th>Lot</th><th class="right">Flush</th><th class="right">Fresh (g)</th><th class="right">Dry (g)</th><th class="right">Ratio</th></tr></thead>
      <tbody>${dry.rows.map((r) => `<tr class="${r.below_floor ? 'flag-low' : ''}">
        <td>${r.harvested_on}</td><td>${r.strain || '?'}</td><td>${r.lot_code || '—'}</td>
        <td class="right">F${r.flush_number}</td><td class="right">${r.fresh_g}</td><td class="right">${r.dry_g}</td>
        <td class="right">${r.dry_ratio_pct}%${r.below_floor ? ' ⚠' : ''}</td></tr>`).join('')}</tbody>
    </table></div>`;
};

// --- Environment ---
views.environment = async () => {
  const root = $('environment');
  root.innerHTML = '<div class="loading">Loading environment…</div>';
  const env = await API('/environment/status');
  root.innerHTML = `<h2 class="section">Environment Monitoring</h2>
    <p class="lead">Latest reading per room vs. target (temp / RH / CO₂ / FAE).</p>
    ${env.map((e) => `<div class="card" style="margin-bottom:12px">
      <div class="env-row" style="border:none;padding-bottom:4px">
        <h3 style="margin:0">${e.room} <span class="badge muted">${e.room_type}</span></h3>
        <span class="badge ${e.in_spec ? 'green' : 'red'}">${e.in_spec ? 'in spec' : 'alert'}</span>
      </div>
      <div class="env-metrics">
        <span>Temp <b>${e.latest.temp_c ?? '—'}°C</b> / ${e.target.temp_c}</span>
        <span>RH <b>${e.latest.humidity ?? '—'}%</b> / ${e.target.humidity}</span>
        <span>CO₂ <b>${e.latest.co2_ppm ?? '—'}ppm</b> / ${e.target.co2_ppm}</span>
        <span>FAE <b>${e.latest.fae_per_hr ?? '—'}/hr</b> / ${e.target.fae_per_hr}</span>
      </div>
      ${e.alerts.length ? `<div style="margin-top:8px">${e.alerts.map((a) => `<span class="badge red">${a}</span>`).join(' ')}</div>` : ''}
    </div>`).join('')}`;
};

// --- Business ---
views.business = async () => {
  const root = $('business');
  root.innerHTML = '<div class="loading">Loading business…</div>';
  const [orders, customers, channels] = await Promise.all([
    API('/orders'), API('/customers'), API('/analytics/sales-by-channel'),
  ]);
  const cName = (id) => (customers.find((c) => c.id === id) || {}).name || '?';
  root.innerHTML = `<h2 class="section">Business Backend</h2>
    <p class="lead">Multi-channel sales, customers & revenue mix.</p>
    <div class="grid two">
      <div class="card"><h3>Sales by channel (${channels.period_days}d · ${money(channels.total_revenue)})</h3>
        ${channels.channels.map((c) => `<div style="margin:8px 0">
          <div style="display:flex;justify-content:space-between"><span>${c.channel}</span><span class="muted">${money(c.revenue)} · ${c.share_pct}%</span></div>
          <div class="bar"><span style="width:${c.share_pct}%"></span></div></div>`).join('')}
      </div>
      <div class="card"><h3>Customers</h3>
        <table><tbody>${customers.map((c) => `<tr><td>${c.name}</td><td class="right"><span class="badge blue">${c.channel}</span></td></tr>`).join('')}</tbody></table>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Orders</h3>
      <table><thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Date</th><th>Status</th><th class="right">Total</th></tr></thead>
      <tbody>${orders.map((o) => `<tr><td><b>${o.order_number}</b></td><td>${cName(o.customer_id)}</td>
        <td><span class="badge muted">${o.channel}</span></td><td>${o.order_date}</td>
        <td><span class="badge ${o.status === 'paid' || o.status === 'fulfilled' ? 'green' : 'amber'}">${o.status}</span></td>
        <td class="right">${money(o.total)}</td></tr>`).join('')}</tbody></table>
    </div>`;
};

// --- Traceability / Recall ---
views.recall = async () => {
  const root = $('recall');
  const batches = await API('/batches');
  root.innerHTML = `<h2 class="section">Lot Traceability & Recall</h2>
    <p class="lead">FSMA-204 style one-click trace: pick a lot to see every affected customer & shipment.</p>
    <div class="card">
      <div style="display:flex;gap:10px;align-items:center;max-width:480px">
        <select id="recall-lot">${batches.map((b) => `<option value="${b.lot_code}">${b.lot_code} — ${b.stage}</option>`).join('')}</select>
        <button class="primary" id="recall-go">Trace</button>
      </div>
      <div id="recall-result" style="margin-top:16px"></div>
    </div>`;
  const run = async () => {
    const lot = $('recall-lot').value;
    $('recall-result').innerHTML = '<div class="loading">Tracing…</div>';
    const t = await API(`/analytics/recall/${encodeURIComponent(lot)}`);
    $('recall-result').innerHTML = `
      <div class="grid kpis">
        <div class="card kpi"><div class="label">Harvests</div><div class="value">${t.harvests}</div></div>
        <div class="card kpi"><div class="label">Units out</div><div class="value">${
          Object.keys(t.units_distributed_by_uom || {}).length
            ? Object.entries(t.units_distributed_by_uom).map(([u, q]) => `${q} ${u}`).join(' · ')
            : t.total_units_distributed
        }</div></div>
        <div class="card kpi"><div class="label">Orders hit</div><div class="value">${t.affected_order_count}</div></div>
        <div class="card kpi"><div class="label">Customers hit</div><div class="value">${t.affected_customer_count}</div></div>
      </div>
      <h3 style="margin-top:18px">Affected shipments — ${t.strain || ''}</h3>
      ${t.affected_orders.length ? `<table><thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Product</th><th class="right">Qty</th><th>Fulfilled</th></tr></thead>
        <tbody>${t.affected_orders.map((o) => `<tr><td>${o.order_number}</td><td>${o.customer}</td>
          <td><span class="badge muted">${o.channel}</span></td><td>${o.product}</td><td class="right">${o.quantity}</td><td>${o.fulfillment_date || '—'}</td></tr>`).join('')}</tbody></table>`
        : '<div class="muted">No shipments traced to this lot yet.</div>'}`;
  };
  $('recall-go').addEventListener('click', run);
  run();
};

// --- Advisor ---
views.advisor = async () => {
  const root = $('advisor');
  root.innerHTML = `<h2 class="section">AI Grow Advisor</h2>
    <p class="lead">Server-side advisor with <i>live</i> context (not hardcoded). Key stays on the server.</p>
    <div class="card advisor-box">
      <div class="advisor-quick">
        <button data-q="My Stargazer dry ratio is low — what's driving it and how do I fix it?">Low dry ratio?</button>
        <button data-q="Fruiting Tent A CO₂ is high and FAE is low. What should I change?">CO₂ / FAE</button>
        <button data-q="What should I prioritize today across my active batches?">Today's priorities</button>
        <button data-q="JMF has early trichoderma in one grain bag. What now?">Contam response</button>
      </div>
      <textarea id="adv-q" rows="3" placeholder="Ask the advisor…"></textarea>
      <div><button class="primary" id="adv-go">Ask advisor</button></div>
      <div class="advisor-answer" id="adv-a"><span class="ctx">Answers appear here. If no ANTHROPIC_API_KEY is set on the server, the live grow-context briefing is shown instead.</span></div>
    </div>`;
  const ask = async (q) => {
    $('adv-q').value = q;
    $('adv-a').innerHTML = '<span class="ctx">Thinking…</span>';
    const r = await POST('/advisor/ask', { question: q });
    if (r.answered) {
      $('adv-a').textContent = r.answer;
    } else {
      $('adv-a').innerHTML = `<div class="ctx">${r.reason}</div><pre style="white-space:pre-wrap;margin-top:10px">${r.context_preview || ''}</pre>`;
    }
  };
  root.querySelectorAll('.advisor-quick button').forEach((b) => b.addEventListener('click', () => ask(b.dataset.q)));
  $('adv-go').addEventListener('click', () => ask($('adv-q').value));
};

// --- Sheet Sync (two-way: Excel / Google Sheet <-> app) ---
// POST helper that surfaces the API's error detail instead of swallowing it.
const POST_CHECKED = async (path, body) => {
  const r = await fetch(`/api${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `${path} -> ${r.status}`);
  return data;
};

views.sync = async () => {
  const root = $('sync');
  root.innerHTML = '<div class="loading">Checking sync configuration…</div>';
  const kindLabel = {
    google_sheet: 'Google Sheet (live, cell-level)',
    drive_xlsx: 'Excel .xlsx on Google Drive',
    local_xlsx: 'Local .xlsx file',
  };
  const render = (s) => {
    const rt = s.read_source, wt = s.write_target;
    const rows = Object.entries(s.pushable_rows || {})
      .map(([k, v]) => `<div class="env-row"><span>${k}</span><span class="badge ${v ? 'green' : 'muted'}">${v} rows</span></div>`).join('');
    const badge = (ok, yes, no) => `<span class="badge ${ok ? 'green' : 'amber'}">${ok ? yes : no}</span>`;
    root.innerHTML = `
      <h2 class="section">Sheet Sync</h2>
      <p class="lead">Two-way bridge between the app and your Master Cultivation Reference —
        an Excel workbook or a Google Sheet as the single source of truth.</p>
      <div class="grid two">
        <div class="card">
          <h3>Pull — Sheet → App</h3>
          <div class="env-row"><span>Read source</span>${badge(rt.configured, kindLabel[rt.kind] || rt.kind, 'not configured')}</div>
          <div class="muted" style="margin:6px 0 12px">${rt.ref || 'Set MASTER_SHEET_PATH or MASTER_SHEET_FILE_ID on the server.'}</div>
          <button class="primary" id="sync-pull">Import from sheet</button>
        </div>
        <div class="card">
          <h3>Push — App → Sheet</h3>
          <div class="env-row"><span>Write target</span>${badge(wt.configured, kindLabel[wt.kind] || wt.kind, 'not configured')}</div>
          <div class="env-row"><span>Writable</span>${badge(wt.writable, 'ready', 'needs credentials')}</div>
          <div class="env-row"><span>Live mirror on create</span>${badge(s.mirror_enabled, 'on', 'off')}</div>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="primary" id="sync-push">Push to sheet</button>
            <button id="sync-download">Download .xlsx</button>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>What the app would push</h3>
        ${rows || '<div class="muted">No data yet.</div>'}
      </div>
      <div class="card" style="margin-top:16px" id="sync-log"><span class="muted">Actions and results appear here.</span></div>`;

    const log = (html, cls = '') => { $('sync-log').innerHTML = `<div class="${cls}">${html}</div>`; };
    const busy = (btn, fn) => async () => {
      const label = btn.textContent; btn.disabled = true; btn.textContent = '…';
      try { await fn(); } catch (e) { log(`<b>Error:</b> ${e.message}`, 'badge red'); }
      finally { btn.disabled = false; btn.textContent = label; views.sync(); }
    };

    $('sync-pull').addEventListener('click', busy($('sync-pull'), async () => {
      const r = await POST_CHECKED('/sync/pull');
      log(`Imported from sheet → app: <b>${JSON.stringify(r.imported)}</b>`);
    }));
    $('sync-push').addEventListener('click', busy($('sync-push'), async () => {
      const r = await POST_CHECKED('/sync/push');
      log(`Pushed app → ${r.target.kind}: <b>${JSON.stringify(r.written)}</b>`);
    }));
    $('sync-download').addEventListener('click', () => {
      window.location = '/api/sync/workbook.xlsx';
    });
  };
  try {
    render(await API('/sync/status'));
  } catch (e) {
    root.innerHTML = `<h2 class="section">Sheet Sync</h2><div class="card badge red">Could not load status: ${e.message}</div>`;
  }
};

views.dashboard();
