# Supabase backend (v1)

The production data layer for Shroom OS. Project: **quantumblue**
(`evfogagjbpwzalbkeomc`, region us-east-2, Postgres 17).

## Migrations

Applied in order (also tracked in Supabase's migration history):

| File | What it does |
|---|---|
| `20260602185730_01_core_schema.sql` | 17 tables: cultivation, operations, business, traceability spine |
| `20260602185741_02_rls_authenticated_access.sql` | Enables RLS on every table; authenticated-only full access |
| `20260602190000_03_harden_rls_auto_enable_grant.sql` | Revokes public RPC reach of the platform RLS auto-enable trigger fn |

Apply locally with the Supabase CLI:

```bash
supabase link --project-ref evfogagjbpwzalbkeomc
supabase db push
```

## Security posture (v1)

- **RLS on, anon denied.** Only signed-in (`authenticated`) users can read/write.
- The `auth_all` policies are intentionally permissive for v1 (any staff login
  sees everything). The Supabase linter flags these as `rls_policy_always_true` —
  expected. **Next layer:** role-based policies (owner / operator / picker) and a
  multi-tenant `org_id`, plus a `staff.user_id → auth.users` mapping (column
  already present).

## Roadmap to feature parity with the FastAPI reference

Analytics currently implemented in Python (`backend/app/routers/analytics.py`)
move into Postgres for scale:

- `recall_trace(lot_code)`, `yield_by_strain`, `dashboard(period_days)` → SQL
  views / RPC functions
- dry-ratio 7.5% flag → already a generated column (`harvests.dry_ratio_pct`)
- AI advisor → Supabase Edge Function (keeps `ANTHROPIC_API_KEY` server-side)
