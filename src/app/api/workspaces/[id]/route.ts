import { requireAdmin, requireUser } from "@/lib/auth";
import { agent37 } from "@/lib/agent37";
import { ApiError, handleError, json, readJson } from "@/lib/http";
import type { Workspace } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { db, user } = await requireUser();
    await requireAdmin(db, id, user.id);

    const { name } = await readJson<{ name?: string }>(request);
    const trimmed = (name || "").trim();
    if (!trimmed) throw new ApiError(400, "invalid_request", "Workspace name is required");

    const { data, error } = await db
      .from("workspaces")
      .update({ name: trimmed })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new ApiError(500, "db_error", error.message);

    return json({ workspace: data as Workspace });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { db, user } = await requireUser();

    const { data: ws } = await db.from("workspaces").select("owner_id").eq("id", id).maybeSingle();
    if (!ws) throw new ApiError(404, "not_found", "Workspace not found");
    if (ws.owner_id !== user.id) throw new ApiError(403, "forbidden", "Only the owner can delete a workspace");

    // Tear down the workspace's Agent37 agents first so none are orphaned.
    const { data: rows } = await db.from("agents").select("agent37_id").eq("workspace_id", id);
    for (const row of rows ?? []) {
      try {
        await agent37.deleteAgent(row.agent37_id as string);
      } catch {
        /* best-effort */
      }
    }

    const { error } = await db.from("workspaces").delete().eq("id", id);
    if (error) throw new ApiError(500, "db_error", error.message);

    return json({ id, deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
