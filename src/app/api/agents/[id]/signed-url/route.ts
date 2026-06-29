import { agent37 } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "member");

    const { port, ttl_seconds } = await readJson<{ port?: number; ttl_seconds?: number }>(request);
    if (!port) throw new ApiError(400, "invalid_request", "port is required");

    // Validate against the LIVE instance's open ports, not a static allowlist: a member must not
    // open an arbitrary internal port, and the openable set is whatever the instance actually
    // exposes (stock template ports plus any a custom image remapped).
    const inst = await agent37.getAgent(id);
    if (!inst.ports.some((p) => p.port === port)) {
      throw new ApiError(400, "invalid_request", "port is not openable");
    }

    const result = await agent37.signedUrl(id, port, ttl_seconds);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
