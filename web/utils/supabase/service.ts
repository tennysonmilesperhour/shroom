import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Service-role server client.
//
// Open-access architecture: every page is publicly viewable but RLS is locked
// to authenticated users. Pages render server-side using this client so the
// reader sees real data; nothing reaches the browser as an anon Supabase
// session, so PostgREST stays inaccessible to the visitor.
//
// MUST be used only from server components, route handlers, and server actions.
// The service-role key bypasses RLS - exposing it client-side would expose
// every row in every table.

function requireEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cached: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (cached) return cached;
  cached = createSupabaseClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-shroom-source": "ssr" } },
    },
  );
  return cached;
}
