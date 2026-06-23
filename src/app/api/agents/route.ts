import { agent37 } from "@/lib/agent37";
import { requireAdmin, requireMember, requireUser } from "@/lib/auth";
import { AGENT_TEMPLATES, DEFAULT_AGENT } from "@/config/agents";
import { usdToMicros } from "@/lib/format";
import { ApiError, handleError, json, readJson } from "@/lib/http";
import type { Agent, AgentRow, MergedAgent } from "@/lib/types";

async function resolveTemplate(): Promise<string | undefined> {
  try {
    const { data } = await agent37.listTemplates();
    const preferred = data.find((t) => t.name === DEFAULT_AGENT.template);
    if (preferred) return preferred.name;
    const builtin = data.find((t) => t.scope === "system");
    return (builtin ?? data[0])?.name;
  } catch {
    return DEFAULT_AGENT.template;
  }
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const workspaceId = new URL(request.url).searchParams.get("workspace");
    if (!workspaceId) throw new ApiError(400, "invalid_request", "workspace query param is required");

    const role = await requireMember(supabase, workspaceId, user.id);

    const { data: rows, error } = await supabase
      .from("agents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new ApiError(500, "db_error", error.message);

    let live = new Map<string, Agent>();
    let templateImages = new Map<string, string>();
    const [liveRes, tmplRes] = await Promise.allSettled([
      agent37.listAgents(),
      agent37.listTemplates(),
    ]);
    if (liveRes.status === "fulfilled") {
      live = new Map(liveRes.value.data.map((i) => [i.id, i]));
    }
    if (tmplRes.status === "fulfilled") {
      templateImages = new Map(
        tmplRes.value.data.filter((t) => t.image_ref).map((t) => [t.name, t.image_ref])
      );
    }

    const agents: MergedAgent[] = (rows as AgentRow[]).map((row) => {
      const l = live.get(row.agent37_id);
      if (l && l.status !== row.status) {
        supabase.rpc("set_agent_status", { p_agent37_id: row.agent37_id, p_status: l.status }).then(() => {});
      }
      const latestImage = l ? templateImages.get(l.template) : undefined;
      return {
        ...row,
        cpu: l?.resources.cpu ?? row.cpu,
        memory: l?.resources.memory ?? row.memory,
        disk: l?.resources.disk ?? row.disk,
        live_status: l?.status ?? row.status,
        status_reason: l?.status_reason ?? null,
        past_due: l?.past_due ?? false,
        ports: l?.ports ?? [],
        update_available: !!(l?.image_ref && latestImage && l.image_ref !== latestImage),
      };
    });

    return json({ agents, role });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    // Shape is fixed server-side (DEFAULT_AGENT); the client picks the workspace and the agent type.
    const body = await readJson<{ workspace_id?: string; template?: string }>(request);

    const workspaceId = body.workspace_id;
    if (!workspaceId) throw new ApiError(400, "invalid_request", "workspace_id is required");
    await requireAdmin(supabase, workspaceId, user.id);

    const template =
      body.template && AGENT_TEMPLATES.includes(body.template)
        ? body.template
        : await resolveTemplate();

    const agent = await agent37.createAgent({
      template,
      resources: {
        cpu: DEFAULT_AGENT.cpu,
        memory: DEFAULT_AGENT.memory,
        disk: DEFAULT_AGENT.disk,
      },
      user: user.id,
      metadata: { app_workspace: workspaceId },
      budget: { monthly_cap_micros: usdToMicros(DEFAULT_AGENT.monthlyCapUsd) },
    });

    const { error } = await supabase.from("agents").insert({
      agent37_id: agent.id,
      workspace_id: workspaceId,
      name: agent.name || null,
      status: agent.status,
      template: agent.template,
      cpu: agent.resources.cpu,
      memory: agent.resources.memory,
      disk: agent.resources.disk,
      created_by: user.id,
    });
    if (error) {
      // Roll back the orphaned agent so we never bill for an untracked box.
      try {
        await agent37.deleteAgent(agent.id);
      } catch {
        /* best-effort */
      }
      throw new ApiError(500, "db_error", error.message);
    }

    return json(agent, 201);
  } catch (e) {
    return handleError(e);
  }
}
