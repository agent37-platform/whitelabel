"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { agentTabPath } from "@/lib/dashboard-tabs";
import { statusVariant, type StatusVariant } from "@/lib/format";
import type { MergedAgent } from "@/lib/types";
import { cn } from "@/lib/utils";

// The dot color mirrors the status badge palette (lib/format#statusVariant), matching the shell's
// ActiveAgentSwitcher so the chat composer reads the same as the fleet list.
const DOT: Record<StatusVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  destructive: "bg-red-500",
  muted: "bg-muted-foreground/40",
};

function StatusDot({ status }: { status?: string | null }) {
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[statusVariant(status)])} />;
}

interface Props {
  agents: MergedAgent[];
  activeAgentId: string;
  disabled?: boolean;
}

// Composer-level agent switcher, sitting alongside the model + effort pickers. Selecting another
// agent navigates to its Chat tab (router.push) — the workspace remounts around the new active
// agent, so the chat targets the agent in the URL. Styled to match ModelMenu / EffortMenu pills.
export function AgentMenu({ agents, activeAgentId, disabled }: Props) {
  const router = useRouter();
  const active = useMemo(() => agents.find((a) => a.agent37_id === activeAgentId), [agents, activeAgentId]);
  const label = active?.name?.trim() || active?.agent37_id || activeAgentId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={`Agent: ${label}`}
          className="inline-flex h-8 max-w-[12rem] items-center gap-1.5 rounded-full bg-secondary/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <Bot className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuLabel>Agents</DropdownMenuLabel>
        {agents.map((a) => (
          <DropdownMenuItem
            key={a.agent37_id}
            onSelect={() => {
              if (a.agent37_id !== activeAgentId) router.push(agentTabPath(a.agent37_id, "chat"));
            }}
          >
            <StatusDot status={a.live_status} />
            <span className="flex-1 truncate">{a.name?.trim() || a.agent37_id}</span>
            {a.agent37_id === activeAgentId && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
