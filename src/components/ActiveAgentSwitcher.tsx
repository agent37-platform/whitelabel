"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { agentTabPath, type AgentTab } from "@/lib/dashboard-tabs";
import { statusVariant } from "@/lib/format";
import type { MergedAgent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// The dot color mirrors the status badge palette (lib/format#statusVariant) so a glance at the
// dropdown reads the same as the fleet list.
const DOT: Record<ReturnType<typeof statusVariant>, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  destructive: "bg-red-500",
  muted: "bg-muted-foreground/40",
};

function StatusDot({ status }: { status?: string | null }) {
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[statusVariant(status)])} />;
}

// THE control that scopes the whole per-agent workspace. URL-bound: selecting another agent
// navigates to the same tab on that agent (router.push), which remounts the workspace around the
// new active agent. Sits at the TOP of the per-agent sidebar; the workspace/account switcher
// (AccountMenu) sits at the bottom.
export function ActiveAgentSwitcher({
  agents,
  activeAgentId,
  currentTab,
}: {
  agents: MergedAgent[];
  activeAgentId: string;
  currentTab: AgentTab;
}) {
  const router = useRouter();
  const active = agents.find((a) => a.agent37_id === activeAgentId);
  const label = active?.name?.trim() || active?.agent37_id || "Select agent";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="flex min-w-0 items-center gap-2">
            <StatusDot status={active?.live_status} />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Agents</DropdownMenuLabel>
        {agents.map((a) => (
          <DropdownMenuItem
            key={a.agent37_id}
            onClick={() => router.push(agentTabPath(a.agent37_id, currentTab))}
          >
            <StatusDot status={a.live_status} />
            <span className="flex-1 truncate">{a.name?.trim() || a.agent37_id}</span>
            {a.agent37_id === activeAgentId && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
