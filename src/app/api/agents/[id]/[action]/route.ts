import { agent37 } from "@/lib/agent37";
import { getAgentRow, requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; action: string }> };

const ACTIONS = {
  start: agent37.start,
  stop: agent37.stop,
  restart: agent37.restart,
  update: agent37.update,
} as const;

export async function POST(_request: Request, { params }: Ctx) {
  try {
    const { id, action } = await params;
    const fn = ACTIONS[action as keyof typeof ACTIONS];
    if (!fn) throw new ApiError(404, "not_found", `Unknown action: ${action}`);

    const { supabase, user } = await requireUser();
    const row = await getAgentRow(supabase, id);
    await requireAdmin(supabase, row.workspace_id, user.id);

    const result = await fn(id);
    if (result.status) {
      await supabase.rpc("set_agent_status", { p_agent37_id: id, p_status: result.status });
    }

    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
