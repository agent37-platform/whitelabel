import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; userId: string }> };

async function isOwner(
  db: Awaited<ReturnType<typeof requireUser>>["db"],
  workspaceId: string,
  userId: string
) {
  const { data } = await db.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle();
  return data?.owner_id === userId;
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, userId } = await params;
    const { db, user } = await requireUser();

    if (userId !== user.id) {
      await requireAdmin(db, id, user.id);
    }
    if (await isOwner(db, id, userId)) {
      throw new ApiError(400, "invalid_request", "The workspace owner cannot be removed");
    }

    const { error } = await db
      .from("memberships")
      .delete()
      .eq("workspace_id", id)
      .eq("user_id", userId);
    if (error) throw new ApiError(500, "db_error", error.message);

    return json({ user_id: userId, removed: true });
  } catch (e) {
    return handleError(e);
  }
}
