import { agent37 } from "@/lib/agent37";
import { getAgentRow, requireMember, requireUser } from "@/lib/auth";
import { PORTS } from "@/config/agents";
import { ApiError, handleError, json, readJson } from "@/lib/http";

const ALLOWED_PORTS = Object.values(PORTS) as number[];

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const row = await getAgentRow(supabase, id);
    await requireMember(supabase, row.workspace_id, user.id);

    const { port, ttl_seconds } = await readJson<{ port?: number; ttl_seconds?: number }>(request);
    if (!port) throw new ApiError(400, "invalid_request", "port is required");
    // Enforce the allowlist server-side: a member must not open an arbitrary internal port.
    if (!ALLOWED_PORTS.includes(port)) throw new ApiError(400, "invalid_request", "port is not openable");

    const result = await agent37.signedUrl(id, port, ttl_seconds);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
