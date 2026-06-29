import { instanceFetch } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";
import { assertUpstreamOk, requireTrimmed } from "../../_helpers";

type Ctx = { params: Promise<{ id: string }> };

// Stream a file's bytes back to the browser (preview/download). This is the URL <img>/<iframe>/<a>
// point at, so we pass the upstream Content-Type and Content-Disposition straight through —
// `disposition=inline` lets the browser render, `attachment` (the Agents API default) downloads.
// `nosniff` keeps the browser from second-guessing the extension-derived type. The byte stream is
// piped without buffering so any size works. Note: HTML/SVG previews are rendered ONLY inside a
// sandboxed <iframe> on the client — never navigated to directly on this origin.
export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "member");

    const { searchParams } = new URL(request.url);
    const qs = new URLSearchParams();
    const path = searchParams.get("path");
    const disposition = searchParams.get("disposition");
    if (path) qs.set("path", path);
    if (disposition) qs.set("disposition", disposition);

    const upstream = await instanceFetch(id, `/v1/files/content?${qs.toString()}`);
    await assertUpstreamOk(upstream, "files/content", "Download failed", "download_error");
    if (!upstream.body) throw new ApiError(502, "download_error", "Download failed");

    const headers = new Headers();
    const ct = upstream.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    const cd = upstream.headers.get("Content-Disposition");
    if (cd) headers.set("Content-Disposition", cd);
    const cl = upstream.headers.get("Content-Length");
    if (cl) headers.set("Content-Length", cl);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return handleError(e);
  }
}

// Write raw bytes to a path (create / overwrite / upload). The request body is forwarded to the
// Agents API PUT /v1/files/content; `overwrite` and the optional X-Expected-Mtime (epoch ms,
// optimistic-concurrency) header pass through. Returns the resolved FileEntry. The upstream HTTP
// status is preserved, so overwrite=false collisions (409) and stale-mtime writes (412) reach the
// client with the right status. instanceFetch buffers the streamed body to a known length so the
// instance-host proxy frames it correctly (it drops chunked request bodies — see instanceFetch).
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "admin");

    const { searchParams } = new URL(request.url);
    const path = requireTrimmed(searchParams.get("path"), "path is required");
    const qs = new URLSearchParams();
    qs.set("path", path);
    const overwrite = searchParams.get("overwrite");
    if (overwrite != null) qs.set("overwrite", overwrite);

    const headers: Record<string, string> = {};
    const ct = request.headers.get("Content-Type");
    if (ct) headers["Content-Type"] = ct;
    const mtime = request.headers.get("X-Expected-Mtime");
    if (mtime) headers["X-Expected-Mtime"] = mtime;

    const upstream = await instanceFetch(id, `/v1/files/content?${qs.toString()}`, {
      method: "PUT",
      headers,
      body: request.body,
    });

    await assertUpstreamOk(upstream, "files/content", "Save failed", "save_error");
    const text = await upstream.text().catch(() => "");
    return json(text ? JSON.parse(text) : {});
  } catch (e) {
    return handleError(e);
  }
}

// Uploads (and large downloads) can take a while; allow a generous ceiling like the chat routes.
export const maxDuration = 300;
