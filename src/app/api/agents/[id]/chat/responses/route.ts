import { instanceFetch } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, readJson } from "@/lib/http";
import { upstreamErrorMessage } from "../../_helpers";

type Ctx = { params: Promise<{ id: string }> };

interface ResponsesBody {
  input?: string;
  session_id?: string;
  model?: string | null;
  provider?: string | null;
  reasoning_effort?: string | null;
  files?: string[];
}

// Run a chat turn and stream the agent's reply back as Server-Sent Events. We authorize +
// validate BEFORE the first byte (status/headers lock once streaming starts), then pipe the
// instance's SSE straight through; the try/catch still turns any pre-stream throw into the
// canonical { error: { code, message } } shape so the client's apiFetch can read it.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "admin");

    const body = await readJson<ResponsesBody>(request);
    const input = (body.input ?? "").trim();
    const files = Array.isArray(body.files) ? body.files.filter(Boolean) : [];
    if (!input && files.length === 0) {
      throw new ApiError(400, "invalid_request", "input is required");
    }
    // The Agents API marks `input` required; for a files-only turn supply a sensible default
    // prompt so we always send a non-empty input rather than relying on "" being accepted.
    const finalInput = input || "Please review the attached file(s).";

    // Forward only what the Agents API expects; omit null/empty so the agent's own defaults
    // apply (model/provider/effort). provider only rides along when a model is chosen.
    const payload: Record<string, unknown> = { input: finalInput, stream: true };
    if (body.session_id) payload.session_id = body.session_id;
    if (body.model) {
      payload.model = body.model;
      if (body.provider) payload.provider = body.provider;
    }
    if (body.reasoning_effort) payload.reasoning_effort = body.reasoning_effort;
    if (files.length) payload.files = files;

    const upstream = await instanceFetch(id, "/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const message = await upstreamErrorMessage(upstream, "chat/responses", "Chat request failed");
      // The client softens the "busy" case by matching the message, not a code, and the 409 is
      // preserved in the status — so one code suffices.
      throw new ApiError(upstream.status || 502, "upstream_error", message);
    }

    // Pipe the SSE body straight through to the browser.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

// Chat turns (especially with tools) can run for a while; allow a generous ceiling.
export const maxDuration = 300;
