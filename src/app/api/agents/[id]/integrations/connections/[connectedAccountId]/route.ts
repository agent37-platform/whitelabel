import { agent37 } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; connectedAccountId: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, connectedAccountId } = await params;
    if (!connectedAccountId) {
      throw new ApiError(400, "invalid_request", "connectedAccountId is required");
    }

    // Disconnecting an integration is a destructive mutation — admin-only.
    await requireAgentAccess(id, "admin");

    // Ownership of the connected account to this instance's Composio entity is
    // verified upstream by the v1 endpoint before deletion.
    return json(await agent37.disconnectIntegration(id, connectedAccountId));
  } catch (e) {
    return handleError(e);
  }
}
