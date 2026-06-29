"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, MoreHorizontal, RotateCw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { apiFetch } from "@/lib/api";
import { isTransitional, statusVariant } from "@/lib/format";
import { agentTabPath } from "@/lib/dashboard-tabs";
import type { MergedAgent, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentNameCell } from "@/components/AgentNameCell";
import { CreateAgentButton } from "@/components/CreateAgentButton";
import { OpenPortButtons } from "@/components/OpenPortButtons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAsyncAction } from "@/components/useAsyncAction";

export function AgentsView() {
  const { current } = useWorkspace();
  const [agents, setAgents] = useState<MergedAgent[]>([]);
  const [role, setRole] = useState<Role>("admin");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!current) return;
    try {
      const data = await apiFetch<{ agents: MergedAgent[]; role: Role }>(
        `/api/agents?workspace=${current.id}`
      );
      setAgents(data.agents);
      setRole(data.role);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!agents.some((a) => isTransitional(a.live_status))) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [agents, load]);

  if (!current) return <p className="text-sm text-muted-foreground">No workspace selected.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">{current.name}</p>
        </div>
        {role === "admin" && <CreateAgentButton workspaceId={current.id} onCreated={load} />}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {role === "admin"
              ? "No agents yet. Create your first one."
              : "No agents in this workspace yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Template</th>
                <th className="px-4 py-2 font-medium">Resources</th>
                <th className="px-4 py-2 text-right font-medium">Quick actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.agent37_id} className="border-t [&>td]:align-middle">
                  <td className="px-4 py-3">
                    <AgentNameCell
                      agent={a}
                      canEdit={role === "admin"}
                      onRenamed={load}
                      href={agentTabPath(a.agent37_id, "chat")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Badge variant={statusVariant(a.live_status)}>{a.live_status ?? "unknown"}</Badge>
                      {a.past_due && <Badge variant="warning">past due</Badge>}
                    </div>
                    {a.status_reason && (
                      <div
                        className="mt-1 max-w-[16rem] truncate text-xs text-destructive"
                        title={a.status_reason.message}
                      >
                        {a.status_reason.message}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a.template ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.cpu} vCPU · {a.memory} GB · {a.disk} GB
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={agentTabPath(a.agent37_id, "chat")}>
                          <MessageSquare className="h-4 w-4" />
                          Chat
                        </Link>
                      </Button>
                      <OpenPortButtons
                        agentId={a.agent37_id}
                        ports={a.ports}
                        disabled={a.live_status !== "running"}
                        template={a.template}
                        size="sm"
                        className="justify-end"
                      />
                      {role === "admin" && <AgentOptionsMenu agent={a} onChanged={load} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgentOptionsMenu({ agent, onChanged }: { agent: MergedAgent; onChanged: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, run } = useAsyncAction();
  const running = agent.live_status === "running";
  const transitional = isTransitional(agent.live_status);
  const name = agent.name?.trim() || "this agent";

  function action(path: "restart" | "stop", message: string) {
    run(async () => {
      await apiFetch(`/api/agents/${agent.agent37_id}/${path}`, { method: "POST" });
      toast.success(message);
      onChanged();
    });
  }

  async function deleteAgent() {
    await apiFetch(`/api/agents/${agent.agent37_id}`, { method: "DELETE" });
    toast.success("Agent deleted");
    onChanged();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Agent options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!running || busy} onClick={() => action("restart", "Restarting")}>
            <RotateCw className="h-4 w-4" />
            Restart agent
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!running || transitional || busy} onClick={() => action("stop", "Stopping")}>
            <Square className="h-4 w-4" />
            Stop agent
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Delete agent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete agent?"
        description={`This will permanently delete ${name}. This cannot be undone.`}
        confirmText="Delete agent"
        destructive
        onConfirm={deleteAgent}
      />
    </>
  );
}
