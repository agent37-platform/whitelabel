import { ApiError } from "@/lib/http";

// Shared helpers for the per-agent data-plane BFF routes. This is NOT a Next.js route (only
// `route.ts` files are endpoints), just a private module the route handlers in this tree import —
// it keeps the streaming/byte-proxy error handling DRY without growing the app-wide `@/lib/http`.

// Trim a user-supplied string and reject empty input with a 400 — the shape every create/rename/
// move/delete handler that takes a `path`/`from`/`to` needs.
export function requireTrimmed(value: string | null | undefined, message: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) throw new ApiError(400, "invalid_request", message);
  return trimmed;
}

// Turn an Agent37 instance's error body into a member-safe message. The Agents API returns
// `{ error: { message } }` or `{ message }`; a non-JSON body (e.g. a gateway HTML 502) is logged
// server-side under `context` and collapsed to `fallback` so we never echo internals. Consumes the
// Response body — call only on the failure path (the success path keeps `upstream.body` intact).
export async function upstreamErrorMessage(upstream: Response, context: string, fallback: string): Promise<string> {
  const text = await upstream.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return j.error?.message || j.message || fallback;
  } catch {
    if (text) console.error(`[${context}] non-JSON upstream`, upstream.status, text.slice(0, 500));
    return fallback;
  }
}

// Throw a mapped ApiError when an Agent37 instance Response failed, reading its body once for the
// message. Returns immediately on success WITHOUT touching the body, so the streaming / upload
// routes can still consume `upstream.body`/`upstream.text()` themselves.
export async function assertUpstreamOk(
  upstream: Response,
  context: string,
  fallback: string,
  code: string
): Promise<void> {
  if (upstream.ok) return;
  throw new ApiError(upstream.status || 502, code, await upstreamErrorMessage(upstream, context, fallback));
}
