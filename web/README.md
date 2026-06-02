# Shroom OS — Web (Next.js + Supabase, deploys on Vercel)

The production v1 UI. Next.js 15 App Router, Supabase auth (RLS-gated), reading
the live `quantumblue` database.

## Local dev

```bash
cd web
cp .env.local.example .env.local   # fill in the publishable key
npm install
npm run dev                        # http://localhost:3000
```

## Pages

`/login` · `/` dashboard · `/strains` · `/batches` · `/harvests` ·
`/environment` · `/business` (orders, CRM, live valuation, strain scoreboard) ·
`/traceability` (recall RPC) · `/reference` (SOPs, guides, issue log, vendors,
pricing) · `/advisor` (RAG over issue_log + guides).

## Deploy on Vercel

This app lives in the `web/` subdirectory of the repo, so set:

1. **Project → Settings → Build & Development → Root Directory = `web`**
2. **Environment Variables:**
   - `NEXT_PUBLIC_SUPABASE_URL = https://evfogagjbpwzalbkeomc.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_…`
   - *(optional)* `ANTHROPIC_API_KEY` to enable the live advisor
3. Redeploy. Auth + all pages run server-side against Supabase.

## First login

Create a user in **Supabase → Authentication → Users → Add user** (or use the
in-app sign-up; if email confirmation is enabled, confirm first). RLS then grants
that authenticated user full access.
