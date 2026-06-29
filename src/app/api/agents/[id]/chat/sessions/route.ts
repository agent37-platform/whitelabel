import { agent37 } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// The thread rail. The Agent37 Agents API is the source of truth — GET /v1/sessions lists every
// conversation on the instance (web chat and any other channel alike); there is no local index
// table. We resolve each rail label here as `title || preview` (the server-side title once set,
// otherwise the first-message preview the list already carries) and order most-recently-active
// first, so the client needs no per-session fetch to label the rail.
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "member");

    const { data } = await agent37.listSessions(id);
    const sessions = data
      .map((s) => ({
        session_id: s.id,
        title: s.title?.trim() || s.preview?.trim() || null,
        last_active: s.last_active ?? s.started_at ?? 0,
      }))
      .sort((a, b) => b.last_active - a.last_active);

    return json({ sessions });
  } catch (e) {
    return handleError(e);
  }
}
