"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { AGENT_TYPES } from "@/config/agents";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_TEMPLATE =
  AGENT_TYPES.find((a) => a.recommended)?.template ?? AGENT_TYPES[0].template;

export function CreateAgentButton({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  async function create() {
    setBusy(true);
    try {
      await apiFetch("/api/agents", {
        method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, template }),
      });
      toast.success("Agent is provisioning");
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create agent
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create agent</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium">Agent type</p>
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Agent type">
              {AGENT_TYPES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setTemplate(a.template)}
                  aria-pressed={template === a.template}
                  className={cn(
                    "rounded-lg border bg-background p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    template === a.template
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:bg-accent/40",
                    busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none">{a.label}</p>
                    {a.recommended && (
                      <span className="text-xs text-muted-foreground">Recommended</span>
                    )}
                    {template === a.template && (
                      <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{a.description}</p>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy}>
              {busy ? "Creating..." : "Create agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
