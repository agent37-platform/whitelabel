import { agent37 } from "@/lib/agent37";
import { getAgentRow, requireMember, requireUser } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const row = await getAgentRow(supabase, id);
    await requireMember(supabase, row.workspace_id, user.id);

    const { toolkit } = await readJson<{ toolkit?: string }>(request);
    if (!toolkit || typeof toolkit !== "string") {
      throw new ApiError(400, "invalid_request", "toolkit is required");
    }

    return json(await agent37.connectIntegration(id, { toolkit }));
  } catch (e) {
    return handleError(e);
  }
}
