"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  MoreHorizontal,
  Play,
  Radar,
  RotateCw,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { isTransitional } from "@/lib/format";
import { PORTS } from "@/config/agents";
import type { MergedAgent, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BudgetDialog } from "@/components/BudgetDialog";

export function AgentActionsMenu({
  agent,
  role,
  onChanged,
}: {
  agent: MergedAgent;
  role: Role;
  onChanged: () => void;
}) {
  const isAdmin = role === "admin";
  const running = agent.live_status === "running";
  const transitional = isTransitional(agent.live_status);

  const [budgeting, setBudgeting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);

  async function action(path: string, msg: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/agents/${agent.agent37_id}/${path}`, { method: "POST" });
      toast.success(msg);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openPort(port: number) {
    setOpening(port);
    try {
      const { url } = await apiFetch<{ url: string }>(
        `/api/agents/${agent.agent37_id}/signed-url`,
        { method: "POST", body: JSON.stringify({ port }) }
      );
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(null);
    }
  }

  async function remove() {
    await apiFetch(`/api/agents/${agent.agent37_id}`, { method: "DELETE" });
    toast.success("Agent deleted");
    onChanged();
  }

  return (
    <>
      <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!running || opening === PORTS.dashboard}
              onClick={() => openPort(PORTS.dashboard)}
              aria-label="Open Hermes dashboard"
            >
              <LayoutDashboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open the Hermes dashboard</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!running || opening === PORTS.missionControl}
              onClick={() => openPort(PORTS.missionControl)}
              aria-label="Open mission control"
            >
              <Radar className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open mission control</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!running || opening === PORTS.files}
              onClick={() => openPort(PORTS.files)}
              aria-label="Open file browser"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open file browser</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!running || opening === PORTS.terminal}
              onClick={() => openPort(PORTS.terminal)}
              aria-label="Open terminal"
            >
              <Terminal className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open terminal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setBudgeting(true)}
              aria-label="Usage"
            >
              <Gauge className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Usage</TooltipContent>
        </Tooltip>

        {isAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={!running || busy}
                onClick={() => action("restart", "Restarting")}
                aria-label="Restart this agent"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restart this agent</TooltipContent>
          </Tooltip>
        )}

        {isAdmin && agent.update_available && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-amber-400 text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                disabled={transitional || busy}
                onClick={() => action("update", "Updating")}
                aria-label="Update agent (update available)"
              >
                <ArrowDownToLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Update available — roll to the latest image</TooltipContent>
          </Tooltip>
        )}

        {isAdmin && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={busy}
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              {running ? (
                <DropdownMenuItem onClick={() => action("stop", "Stopping")}>
                  <Square />
                  Stop agent
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => action("start", "Starting")}>
                  <Play />
                  Start agent
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 />
                Delete agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      </TooltipProvider>

      <BudgetDialog open={budgeting} onOpenChange={setBudgeting} agentId={agent.agent37_id} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete agent?"
        description="This permanently deletes the agent and its data. This cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
