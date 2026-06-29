# Setup

This app runs on two secrets you supply (both behind a login, so a human must fetch them):

- **`AGENT37_API_KEY`** (`sk_live_…`) — Agent37 dashboard → **Cloud → API keys**. Then
  **fund the wallet** (Cloud → Billing): creating an agent costs real money, and an empty
  wallet returns a `402` at create time.
- **`SUPABASE_ACCESS_TOKEN`** (`sbp_…`) — [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) (~30s).

`npm run setup` does everything else: creates a free Supabase project (or configures the one
whose URL you paste into `NEXT_PUBLIC_SUPABASE_URL`), runs the migration, enables email auth,
and writes the Supabase URL, anon key, and **server-only service-role key** back into
`.env.local`. (Clients never touch the DB directly — the app reads/writes every table server-side
with the service-role key; see [`AGENTS.md`](AGENTS.md).) It's idempotent and fills only blank
values. Per-variable docs live in [`.env.example`](.env.example).

## For your coding agent

The README tells adopters to paste a one-liner that points here. If you're that agent, follow
these steps in order; don't skip the checks.

1. **Scaffold.** Run `npm install`, then `npm run setup` once. On a fresh clone this creates
   `.env.local` from `.env.example` and exits asking for two secrets — that exit is
   **expected**, not an error.
2. **Ask me for the two secrets.** You can't fetch them (both are behind a login). Print where
   to get each, then stop and wait for my reply:
   - `AGENT37_API_KEY` (starts with `sk_live_`): Agent37 dashboard → Cloud → API keys
     (<https://www.agent37.com/dashboard/cloud/api-keys>). Creating agents also needs a
     **funded** wallet (Cloud → Billing), or it later fails with a `402`.
   - `SUPABASE_ACCESS_TOKEN` (starts with `sbp_`): <https://supabase.com/dashboard/account/tokens>.
3. **Validate.** Confirm the prefixes (`sk_live_`, `sbp_`). If one's wrong, ask again — don't proceed.
4. **Write the secrets into `.env.local` only** (confirm it's gitignored first). Fill only
   those two lines; leave everything else as-is. Never print the full `sk_live_` value back
   (mask as `sk_live_…last4`), never `cat .env.local`, never `git add`/commit it.
5. **Complete setup.** Run `npm run setup` again. If it fails, read its message and act on it
   instead of retrying blind:
   - "free-project limit" → ask me for an existing project's URL in `NEXT_PUBLIC_SUPABASE_URL`
     (or free a slot at supabase.com/dashboard), then re-run.
   - "more than one organization" / `403` on create → my account has multiple Supabase orgs (or
     can't create in the default one). Setup prints the orgs with a `SUPABASE_ORG=<slug>` for each;
     re-run as `SUPABASE_ORG=<slug> npm run setup` for the one I want (usually my personal org).
   - `401` → my Supabase token is wrong/expired; ask for a new one.
   - `404` → `NEXT_PUBLIC_SUPABASE_URL` points at a project this token can't see.
6. **Verify.** Run `npm run typecheck` and `npm run build` (no test suite — these two are the gate).
7. **Start.** Run `npm run dev` and report the URL (<http://localhost:3000>): I sign up with
   email + password (open signup, no email verification) → land in a fresh workspace. Remind me
   that creating an agent needs a funded wallet — a `402` at create time is the wallet, not a bug.

Constraints: keep changes minimal; add no features; the `sk_live_` key stays server-side;
branding stays code-side (`src/config/branding.ts`).

## By hand

```bash
npm install
npm run setup     # first run creates .env.local and prints the two keys to paste
#                 → paste both into .env.local, then:
npm run setup     # creates/configures Supabase, runs the migration, sets up auth
npm run dev       # http://localhost:3000 → sign up with email + password
```

<details>
<summary><b>Manual Supabase setup</b> — if you'd rather not use an access token</summary>

Leave `SUPABASE_ACCESS_TOKEN` blank, skip `npm run setup`, create a free
[Supabase](https://supabase.com) project, then: (1) **SQL Editor** → run
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) (it sets up the schema
*and* revokes direct client table access — all DB access is server-side);
(2) **Authentication → Providers** → enable **Email**; (3) **Authentication → URL
Configuration** → Site URL `http://localhost:3000`, add `http://localhost:3000/auth/callback`
to Redirect URLs. Paste the project URL, anon key, and **service-role key** (Project Settings →
API) into `.env.local` (`SUPABASE_SERVICE_ROLE_KEY` — server-only), then `npm run dev`.
</details>

## Deploy to production (Vercel)

The Vercel button alone is **not** enough — it deploys the app but can't create your Supabase
backend or register your sign-in URLs. Run setup locally once first, then:

1. Run `npm run setup` locally (creates Supabase + schema + auth config).
2. Push your fork to GitHub, then in Vercel: **Add New → Project → Import Git Repository**.
3. Add **only these** env vars: `AGENT37_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — the runtime needs
   it for all DB access), `NEXT_PUBLIC_SITE_URL` (your prod URL).
   **Never add** `SUPABASE_ACCESS_TOKEN` — it's setup-only (used to create/configure the project,
   never at runtime).
   (Branding is code-side now — edit `src/config/branding.ts`, not env.)
4. Register your prod sign-in URL with Supabase: set `NEXT_PUBLIC_SITE_URL` to your prod URL
   in `.env.local` and re-run `npm run setup` (it adds `<prod>/auth/callback` for you).
