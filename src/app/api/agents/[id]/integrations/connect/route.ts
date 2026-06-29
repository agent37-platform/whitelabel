import { agent37 } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    // Connecting an external account to a shared agent is a capability grant — admin-only, like
    // every other agent mutation.
    await requireAgentAccess(id, "admin");

    const { toolkit } = await readJson<{ toolkit?: string }>(request);
    if (!toolkit || typeof toolkit !== "string") {
      throw new ApiError(400, "invalid_request", "toolkit is required");
    }

    return json(await agent37.connectIntegration(id, { toolkit }));
  } catch (e) {
    return handleError(e);
  }
}
