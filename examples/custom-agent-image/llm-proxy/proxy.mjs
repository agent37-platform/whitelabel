#!/usr/bin/env node
// Minimal example LLM proxy for an Agent37 custom image.
//
// It's an OpenAI-compatible pass-through: a Hermes instance talks to it as a
// "custom provider" (api_mode: chat_completions), and it forwards to OpenRouter
// using YOUR key. This is the stripped-down cousin of Agent37's managed
// starter-proxy — no billing, no accounting, no quotas. Read it, deploy it, point
// an instance at it.
//
// OPTIONAL: by default, Agent37 instances run on Agent37's managed model and need
// none of this. Deploy this only if you want an instance to run on your own model.
//
// Two routes Hermes needs:
//   GET  /v1/models            -> the model id(s) it can pick (no auth)
//   POST /v1/chat/completions  -> the chat turn (Bearer = PROXY_TOKEN), forwarded upstream
//
// Run:  cp .env.example .env  &&  node proxy.mjs   (Node 18+)
import http from 'node:http';

const PORT = process.env.PORT || 8787;

// Your OpenRouter key — server-side only, never commit it. https://openrouter.ai/keys
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// The token Hermes presents as `api_key`. Pick any value; put the SAME one in the
// instance's ~/.hermes/config.yaml custom_providers[].api_key.
const PROXY_TOKEN = process.env.PROXY_TOKEN;

// Which OpenRouter model to serve. Swap for any model OpenRouter offers.
const UPSTREAM_MODEL = process.env.UPSTREAM_MODEL || 'moonshotai/kimi-k2.7-code';

const UPSTREAM = 'https://openrouter.ai/api/v1';

if (!OPENROUTER_API_KEY || !PROXY_TOKEN) {
  console.error('Set OPENROUTER_API_KEY and PROXY_TOKEN (see .env.example).');
  process.exit(1);
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;

  // GET /v1/models — Hermes reads this to learn which model id to use.
  if (req.method === 'GET' && path === '/v1/models') {
    return json(res, 200, {
      object: 'list',
      data: [{ id: UPSTREAM_MODEL, object: 'model', created: 0, owned_by: 'you' }],
    });
  }

  // POST /v1/chat/completions — the turn. Bearer must equal PROXY_TOKEN.
  if (req.method === 'POST' && path === '/v1/chat/completions') {
    if (req.headers['authorization'] !== `Bearer ${PROXY_TOKEN}`) {
      return json(res, 401, { error: 'Invalid token' });
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        payload.model = UPSTREAM_MODEL; // serve one model regardless of what was asked
        const upstream = await fetch(`${UPSTREAM}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        // Pipe the upstream response straight through — works for both streaming
        // (SSE) and non-streaming JSON, since we never buffer or reshape it.
        res.writeHead(upstream.status, {
          'content-type': upstream.headers.get('content-type') || 'application/json',
        });
        const reader = upstream.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (err) {
        json(res, 502, { error: String(err) });
      }
    });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`example llm-proxy on :${PORT} -> ${UPSTREAM} (${UPSTREAM_MODEL})`));
