import { agent37 } from "@/lib/agent37";
import { getAgentRow, requireMember, requireUser } from "@/lib/auth";
import { handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const row = await getAgentRow(supabase, id);
    await requireMember(supabase, row.workspace_id, user.id);

    const month = new URL(request.url).searchParams.get("month") || undefined;
    return json(await agent37.getUsage(id, month));
  } catch (e) {
    return handleError(e);
  }
}
