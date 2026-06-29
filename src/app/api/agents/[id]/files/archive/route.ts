import { instanceFetch } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/http";
import { assertUpstreamOk } from "../../_helpers";

type Ctx = { params: Promise<{ id: string }> };

// Stream a directory back to the browser as a .tar.gz. The Agents API builds the archive by piping
// the system `tar` straight through, so it arrives as an unbounded byte stream — we proxy the body
// (and the archive's Content-Type / Content-Disposition) through without buffering, like the single
// -file content route. `path` is the directory to pack; omitting it packs the agent workspace. This
// is the URL an <a download> points at, with the sk_live_ key attached server-side.
export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "member");

    const path = new URL(request.url).searchParams.get("path");
    const qs = path ? `?path=${encodeURIComponent(path)}` : "";

    const upstream = await instanceFetch(id, `/v1/files/archive${qs}`);
    await assertUpstreamOk(upstream, "files/archive", "Download failed", "download_error");
    if (!upstream.body) throw new ApiError(502, "download_error", "Download failed");

    const headers = new Headers();
    const ct = upstream.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    const cd = upstream.headers.get("Content-Disposition");
    if (cd) headers.set("Content-Disposition", cd);
    headers.set("Cache-Control", "no-store");

    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return handleError(e);
  }
}

// Archiving a large tree can take a while; allow a generous ceiling like the other byte routes.
export const maxDuration = 300;
