"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { MergedAgent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AgentNameCell({
  agent,
  canEdit,
  onRenamed,
  href,
}: {
  agent: MergedAgent;
  canEdit: boolean;
  onRenamed: () => void;
  // When set, the (display-mode) name links here — e.g. the agent's chat tab. The pencil stays a
  // separate control so opening the agent and renaming it don't collide.
  href?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent.name ?? "");
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (wasEditing.current && !editing) triggerRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function startEditing() {
    setName(agent.name ?? "");
    setEditing(true);
  }

  function cancel() {
    setName(agent.name ?? "");
    setEditing(false);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === (agent.name ?? "")) {
      cancel();
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/agents/${agent.agent37_id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      toast.success("Renamed");
      setEditing(false);
      onRenamed();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    // Fixed width (not max-): the column must reserve the same space whether it's showing the name +
    // pencil or the wider input + ✓/✗, so entering edit mode doesn't grow the column and shove every
    // other column to the right.
    <div className="group/name w-64">
      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            aria-label="Agent name"
            placeholder="Untitled agent"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              else if (e.key === "Escape") cancel();
            }}
            className="h-8 min-w-0 flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={busy || !name.trim()}
            onClick={save}
            aria-label="Save name"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={busy}
            onClick={cancel}
            aria-label="Cancel rename"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {href ? (
            <Link
              href={href}
              className={`min-w-0 truncate hover:underline ${
                agent.name?.trim() ? "font-medium" : "italic text-muted-foreground"
              }`}
              title={agent.name?.trim() || "Untitled agent"}
            >
              {agent.name?.trim() || "Untitled agent"}
            </Link>
          ) : (
            <span
              className={`min-w-0 truncate ${
                agent.name?.trim() ? "font-medium" : "italic text-muted-foreground"
              }`}
              title={agent.name?.trim() || "Untitled agent"}
            >
              {agent.name?.trim() || "Untitled agent"}
            </span>
          )}
          {canEdit && (
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              onClick={startEditing}
              aria-label="Rename agent"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
      <div className="truncate font-mono text-xs text-muted-foreground" title={agent.agent37_id}>
        {agent.agent37_id}
      </div>
    </div>
  );
}
