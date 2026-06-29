"use client";

import { useState } from "react";
import {
  ExternalLink,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  Server,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { AGENT_TYPES, PORT_LABELS } from "@/config/agents";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// A known port label → icon. Anything unrecognized falls back to a generic "open in new tab" glyph.
const PORT_ICON: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Terminal: SquareTerminal,
  Files: FolderOpen,
  Gateway: Server,
};

// The agent's primary web UI is its "dashboard", but the port label differs by template (Hermes →
// "Dashboard", OpenClaw → "OpenClaw"). Name it after the agent type so the tooltip reads, e.g.,
// "Open Hermes dashboard" / "Open OpenClaw dashboard" instead of the bare port label.
const DASHBOARD_LABELS = new Set(["Dashboard", "OpenClaw"]);
function dashboardLabel(template?: string | null): string {
  const type = template ? AGENT_TYPES.find((t) => t.template === template)?.label : null;
  return type ? `${type} dashboard` : "Dashboard";
}

// A compact ICON ROW of "open in new tab" shortcuts for an instance's web UIs (dashboard, terminal,
// files, …). The openable set is derived from the LIVE instance ports — never a static map — minus
// the default/gateway port, which the native Chat tab talks to instead of opening in a tab. Each
// click mints a short-lived signed URL server-side, then opens it. Disabled unless the agent is
// running. Labels live in the tooltip/aria so the rail stays just icons.
export function OpenPortButtons({
  agentId,
  ports,
  disabled,
  template,
  size = "default",
  className,
}: {
  agentId: string;
  ports: Agent["ports"];
  disabled?: boolean;
  // The agent's template, used to name its dashboard port after the agent type.
  template?: string | null;
  size?: "default" | "sm";
  className?: string;
}) {
  const [opening, setOpening] = useState<number | null>(null);
  const openable = ports.filter((p) => !p.default);

  async function open(port: number) {
    setOpening(port);
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/agents/${agentId}/signed-url`, {
        method: "POST",
        body: JSON.stringify({ port }),
      });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(null);
    }
  }

  if (openable.length === 0) return null;

  return (
    <TooltipProvider delayDuration={250}>
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {openable.map((p) => {
          const base = PORT_LABELS[p.port] ?? `Port ${p.port}`;
          const isDashboard = DASHBOARD_LABELS.has(base);
          const label = isDashboard ? dashboardLabel(template) : base;
          const Icon = isDashboard ? LayoutDashboard : PORT_ICON[base] ?? ExternalLink;
          return (
            <Tooltip key={p.port}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <button
                    type="button"
                    aria-label={`Open ${label}`}
                    disabled={disabled || opening === p.port}
                    onClick={() => open(p.port)}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors",
                      "hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
                      size === "sm" ? "h-8 w-8" : "h-9 w-9"
                    )}
                  >
                    {opening === p.port ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {disabled ? `${label} is available when the agent is running` : `Open ${label}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
