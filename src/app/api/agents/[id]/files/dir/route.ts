import { agent37 } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { requireTrimmed } from "../../_helpers";

type Ctx = { params: Promise<{ id: string }> };

// Create a directory (mkdir -p, recursive + idempotent) on the instance. Returns the resolved
// FileEntry of the directory.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "admin");

    const path = requireTrimmed(new URL(request.url).searchParams.get("path"), "path is required");
    return json(await agent37.makeDir(id, path), 201);
  } catch (e) {
    return handleError(e);
  }
}
