import { agent37 } from "@/lib/agent37";
import { requireAgentAccess } from "@/lib/auth";
import { usdToMicros } from "@/lib/format";
import { ApiError, handleError, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "member");

    return json(await agent37.getBudget(id));
  } catch (e) {
    return handleError(e);
  }
}

// Set the agent's monthly managed-spend cap. Admin-only; the body is in USD (the UI's unit) and
// converted to micros for the API. Returns the updated Budget.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "admin");

    const { monthly_cap_usd } = await readJson<{ monthly_cap_usd?: number }>(request);
    if (typeof monthly_cap_usd !== "number" || !Number.isFinite(monthly_cap_usd) || monthly_cap_usd < 0) {
      throw new ApiError(400, "invalid_request", "monthly_cap_usd must be a non-negative number");
    }

    return json(await agent37.setBudget(id, { monthly_cap_micros: usdToMicros(monthly_cap_usd) }));
  } catch (e) {
    return handleError(e);
  }
}
