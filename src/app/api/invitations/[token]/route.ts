import { requireUser } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const { supabase } = await requireUser();

    const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
    if (error) throw new ApiError(400, "invalid_request", error.message);

    return json({ workspace_id: data as string });
  } catch (e) {
    return handleError(e);
  }
}
