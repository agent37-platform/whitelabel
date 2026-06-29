import { requireUser } from "@/lib/auth";
import { handleError, json, readJson, ApiError } from "@/lib/http";
import type { Role, Workspace, WorkspaceWithRole } from "@/lib/types";

export async function GET() {
  try {
    const { db, user } = await requireUser();
    const { data, error } = await db
      .from("memberships")
      .select("role, workspaces(*)")
      .eq("user_id", user.id);
    if (error) throw new ApiError(500, "db_error", error.message);

    const workspaces: WorkspaceWithRole[] = (data ?? [])
      .map((row) => {
        const ws = row.workspaces as unknown as Workspace | null;
        if (!ws) return null;
        return { ...ws, role: row.role as Role };
      })
      .filter((w): w is WorkspaceWithRole => w !== null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    return json({ workspaces });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { db, user } = await requireUser();
    const { name } = await readJson<{ name?: string }>(request);
    const trimmed = (name || "").trim();
    if (!trimmed) throw new ApiError(400, "invalid_request", "Workspace name is required");

    const { data, error } = await db
      .from("workspaces")
      .insert({ name: trimmed, owner_id: user.id })
      .select("*")
      .single();
    if (error) throw new ApiError(500, "db_error", error.message);

    return json({ workspace: { ...(data as Workspace), role: "admin" as Role } }, 201);
  } catch (e) {
    return handleError(e);
  }
}
