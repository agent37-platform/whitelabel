import { agent37 } from "@/lib/agent37";
import { getAgentRow, requireMember, requireUser } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; connectedAccountId: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, connectedAccountId } = await params;
    if (!connectedAccountId) {
      throw new ApiError(400, "invalid_request", "connectedAccountId is required");
    }

    const { supabase, user } = await requireUser();
    const row = await getAgentRow(supabase, id);
    await requireMember(supabase, row.workspace_id, user.id);

    // Ownership of the connected account to this instance's Composio entity is
    // verified upstream by the v1 endpoint before deletion.
    return json(await agent37.disconnectIntegration(id, connectedAccountId));
  } catch (e) {
    return handleError(e);
  }
}
