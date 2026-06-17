import { agent37 } from "@/lib/agent37";
import { getAgentRow, requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const row = await getAgentRow(supabase, id);
    await requireAdmin(supabase, row.workspace_id, user.id);

    const { name } = await readJson<{ name?: string }>(request);
    const trimmed = (name || "").trim();
    if (!trimmed) throw new ApiError(400, "invalid_request", "name is required");

    const { error } = await supabase.from("agents").update({ name: trimmed }).eq("agent37_id", id);
    if (error) throw new ApiError(500, "db_error", error.message);

    return json({ id, name: trimmed });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const row = await getAgentRow(supabase, id);
    await requireAdmin(supabase, row.workspace_id, user.id);

    await agent37.deleteAgent(id);
    await supabase.from("agents").delete().eq("agent37_id", id);

    return json({ id, deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
