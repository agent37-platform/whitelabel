import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; token: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, token } = await params;
    const { db, user } = await requireUser();
    await requireAdmin(db, id, user.id);

    const { error } = await db
      .from("invitations")
      .delete()
      .eq("token", token)
      .eq("workspace_id", id);
    if (error) throw new ApiError(500, "db_error", error.message);

    return json({ token, deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
