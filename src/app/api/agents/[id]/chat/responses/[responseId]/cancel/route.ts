import { agent37 } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; responseId: string }> };

// Stop an in-flight turn (the composer's stop button).
export async function POST(_request: Request, { params }: Ctx) {
  try {
    const { id, responseId } = await params;
    await requireAgentAccess(id, "admin");

    return json(await agent37.cancelResponse(id, responseId));
  } catch (e) {
    return handleError(e);
  }
}
