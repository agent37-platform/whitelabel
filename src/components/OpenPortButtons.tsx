"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { PORT_LABELS } from "@/config/agents";
import type { Agent } from "@/lib/types";
import { Button } from "@/components/ui/button";

// "Open in new tab" buttons for an instance's web UIs (Hermes dashboard, terminal, files, etc.).
// The openable set is derived from the LIVE instance ports — never a static map — minus the
// default/gateway port, which the native Chat tab talks to instead of opening in a tab. Each click
// mints a short-lived signed URL server-side, then opens it. Disabled unless the agent is running.
export function OpenPortButtons({
  agentId,
  ports,
  disabled,
}: {
  agentId: string;
  ports: Agent["ports"];
  disabled?: boolean;
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
    <div className="flex flex-col gap-1">
      {openable.map((p) => (
        <Button
          key={p.port}
          variant="ghost"
          size="sm"
          className="w-full justify-start font-normal text-muted-foreground hover:text-foreground"
          disabled={disabled || opening === p.port}
          onClick={() => open(p.port)}
        >
          {opening === p.port ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {PORT_LABELS[p.port] ?? `Port ${p.port}`}
        </Button>
      ))}
    </div>
  );
}
