import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The privileged, SERVER-ONLY Supabase client, keyed by the service-role secret.
//
// It BYPASSES Row-Level Security, so it must never be imported by a client component or reach the
// browser (`server-only` makes that a build error; the key has no NEXT_PUBLIC_ prefix). This app
// does NOT let the browser touch tables directly — the migration revokes all anon/authenticated
// table grants (see supabase/migrations/0001_init.sql), so every read and write goes through
// the Next.js BFF using this client. That means the authorization checks in `src/lib/auth.ts`
// (requireUser / requireMember / requireAdmin / requireAgentAccess), NOT RLS, are the security
// boundary — each query must be gated by them before it runs. RLS stays on only as a backstop.
//
// Cached module-side: the client is stateless (no per-request cookies/session), so one instance is
// reused across requests rather than rebuilt each call.
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — run `npm run setup`."
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
