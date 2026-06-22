# Agent37 White-Label Template

A white-label, multi-tenant dashboard for managing Hermes/Openclaw agents on the [Agent37](https://www.agent37.com) Cloud API. Fork it and rebrand it

<p align="center">
  <img src="screenshots/overview.png" alt="The white-label dashboard (agents, team, sign-in) plus each agent's own UIs (Hermes chat, file browser)" width="100%" />
</p>

## Setup

**1. Get two keys** (both behind a login, so only you can fetch them):

- `AGENT37_API_KEY` — Agent37 dashboard → **Cloud → API keys**, then **fund the wallet** (Cloud → Billing).
- `SUPABASE_ACCESS_TOKEN` — [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).

**2. Hand it to your coding agent.** Open this folder in Claude Code / Codex and paste:

```
Set this repo up and run it locally, end to end — follow SETUP.md. Ask me for the two
login-gated keys it needs, then do everything else and tell me the local URL.
```

It writes your keys, configures Supabase, and starts the app. Prefer to do it yourself?
**[SETUP.md](SETUP.md)** has the four-command path and deploy steps too.