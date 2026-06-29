import { requireUser } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const { db, user } = await requireUser();

    // Pass the verified user id explicitly: under the service-role client auth.uid() is NULL, so the
    // function can't read it from the JWT.
    const { data, error } = await db.rpc("accept_invitation", { p_token: token, p_user: user.id });
    if (error) throw new ApiError(400, "invalid_request", error.message);

    return json({ workspace_id: data as string });
  } catch (e) {
    return handleError(e);
  }
}
