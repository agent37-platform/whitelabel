# AGENTS.md

Guidance for AI coding agents (and humans) working in **agent37-whitelabel**.
`CLAUDE.md` imports this file via `@AGENTS.md`, so this is the single source of
truth — edit here, not there.

## First-time setup

Setting this up from a fresh clone? Follow **[`SETUP.md`](SETUP.md)** — the complete runbook
(it's what the README tells adopters to hand you). Two login-gated secrets are human-supplied:
`AGENT37_API_KEY` (plus a **funded** Agent37 wallet) and `SUPABASE_ACCESS_TOKEN`;
`npm run setup` does the rest. Never print or commit the `sk_live_` key.

## What this project is

A white-label, multi-tenant dashboard for managing AI agents, built entirely on
top of the public **[Agent37](https://www.agent37.com) B2B Agents API**. Forkers
rebrand it (via env vars) and ship it; their end users sign in, get workspaces,
invite teammates, and create / manage agents.

Everything this app can do is a **subset of the Agent37 `/v1` API**. This repo is
a *client* of that API — it does not implement agent infrastructure itself. So
**the API docs, not this code, are the authority on what an agent can and cannot
do.**

## The API this is built on — read the docs first

This product is built on top of our public API. **Before adding or changing any
agent capability, consult the docs** — they define the full surface and its
limits. Two machine-readable entry points are designed for you (an AI agent) to
fetch directly:

- **<https://www.agent37.com/docs/llms.txt>** — concise index of every doc page.
  *Start here* to find the right page.
- **<https://www.agent37.com/docs/llms-full.txt>** — the entire documentation
  inlined into one file. Use for deep reference.
- Human-browsable docs: **<https://www.agent37.com/docs>**
  (append `.md` to any page URL to get raw markdown.)

### Documented capability map

Two planes, one `sk_live_` key. The **control plane** is what this template uses;
the **data plane** is fully documented and reachable but **not wired up here**.

**Control plane — `https://api.agent37.com/v1/*`** (the `sk_live_` key this app holds):

| Page | Covers | Used here |
|---|---|---|
| [Core concepts](https://www.agent37.com/docs/agents-api/concepts) | the model, auth, the two planes | read first |
| [Instances](https://www.agent37.com/docs/agents-api/instances) | create / list / get / start / stop / restart / update / resize / delete | ✅ |
| [Instance URLs](https://www.agent37.com/docs/agents-api/urls) | short-lived signed URLs to open an agent's ports | ✅ |
| [Templates](https://www.agent37.com/docs/agents-api/templates) | the agent images you can provision | ✅ |
| [Managed services & budgets](https://www.agent37.com/docs/agents-api/budgets) | per-agent managed-spend cap | ✅ |
| [Billing](https://www.agent37.com/docs/agents-api/billing) | wallet, compute prepay, usage | ✅ (usage) |
| [Run commands](https://www.agent37.com/docs/agents-api/exec) | exec a command inside an instance | available, not used |
| [Errors](https://www.agent37.com/docs/agents-api/errors) | machine-readable error codes | ✅ (mapped in `Agent37Error`) |

**Data plane — `https://{instanceId}.agent37.app/v1/*`** (talk to one agent's
gateway). This template opens each agent's own web UIs via signed URLs instead of
calling these endpoints — they're where to look if you want to build chat or
automation **into** the dashboard:

| Page | Covers |
|---|---|
| [Send a message](https://www.agent37.com/docs/agents-api/chat) | post a message, get a response |
| [Streaming](https://www.agent37.com/docs/agents-api/streaming) | stream responses (SSE) |
| [Sessions & models](https://www.agent37.com/docs/agents-api/sessions) | conversation state, model selection |
| [Files](https://www.agent37.com/docs/agents-api/files) | upload / download files |
| [Build a chat app](https://www.agent37.com/docs/agents-api/chat-app) | end-to-end guide for a chat UI |

So: **what's possible** = the whole map above. **What this template does today** =
the control-plane rows marked ✅, plus opening each agent's dashboard / terminal /
files UI. The data plane is documented and reachable — it just isn't wired into
this dashboard yet.

## How this app fits together

```
Browser ─▶ Next.js (this app) ─▶ Agent37 /v1 API   (one server-side sk_live_ key)
   │            │
   │            └─▶ Supabase (Auth + Postgres + RLS): users, workspaces, members, agent mirror
   │
   └──────────────▶ https://{instance}.agent37.app  (agent's own UI, via short-lived signed URLs)
```

- **One key, many app workspaces.** A single `sk_live_` key, server-side only, is
  shared by the whole app. Every agent is created under your one Agent37 workspace
  and tagged `metadata.app_workspace`; a Supabase mirror table is the source of
  truth for which app-workspace owns which agent.
- **Isolation is Postgres RLS.** Users see only the workspaces they belong to, and
  the `sk_live_` key never reaches the browser.
- **`src/lib/agent37.ts` is the only thing that calls the Agent37 API**
  (`server-only`). Internal `src/app/api/**` routes are this app's BFF: the browser
  calls them, they enforce workspace ownership via Supabase, then call `agent37.ts`.
- **Naming:** the upstream API calls these resources **instances**; this app brands
  them **agents**. Paths stay `/instances`; the client methods read `agent…`.

## Where things live

| Path | What |
|---|---|
| `src/lib/agent37.ts` | The Agent37 `/v1` client — the single egress to the API |
| `src/app/api/**` | This app's own API routes (BFF); enforce auth + ownership |
| `src/config/agents.ts` | Shapes, the canonical `DEFAULT_AGENT`, browsable ports |
| `src/config/branding.ts` | Env-driven white-label branding |
| `src/lib/types.ts` | App + upstream `/v1` types |
| `supabase/migrations/0001_init.sql` | Schema + RLS |
| `scripts/setup.mjs` | One-command Supabase setup (`npm run setup`) |

## Commands

```bash
npm install
npm run setup       # configure Supabase end-to-end (idempotent; needs SUPABASE_ACCESS_TOKEN)
npm run dev         # http://localhost:3000
npm run build
npm run typecheck   # tsc --noEmit
```

There is no test suite; the gate before shipping is a clean `npm run typecheck`
and `npm run build`. Setup is "paste two keys + `npm run setup`" — no manual
dashboard steps.

## House rules

- **The API is the final authority.** Shapes, disks, templates, budgets — the
  `/v1` API can reject anything your account's tier disallows, regardless of what
  `src/config` lists. Check the docs before assuming a capability exists.
- **Never expose `AGENT37_API_KEY` to the browser.** It stays server-side; all
  agent calls go through `src/app/api/**` → `src/lib/agent37.ts`.
- **Payments are intentionally excluded.** Add Stripe (or anything) yourself when
  you're ready to charge your own customers.
- **Branding is env-only** (`NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_LOGO_URL`). Keep
  it that way.
- Keep changes small and focused; don't add unrequested features or touch
  unrelated code.
