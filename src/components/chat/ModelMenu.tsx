"use client";

import { useMemo } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { findModel, prettyModelLabel, prettyProvider, type ModelGroup } from "./types";

interface Props {
  groups: ModelGroup[];
  model: string | null; // selected model id; null => riding the instance default
  defaultModel: string | null; // instance default model id — pre-selected and badged
  defaultLabel: string; // resolved trigger label fallback (while loading / nothing matched)
  disabled?: boolean;
  onChange: (model: string | null, provider: string | null) => void;
}

// Always-visible model switcher: lists every model the instance can run (GET /v1/models), grouped
// by provider with the instance default pre-selected and badged. The check marks the active model
// — the explicit selection, or the instance default while none is picked — so the trigger label
// and the checked row always name the same model. A single-model agent (the metered gateway's lone
// "default") renders as one checked row.
export function ModelMenu({ groups, model, defaultModel, defaultLabel, disabled, onChange }: Props) {
  // The active model: the explicit selection, or the instance default when riding null.
  const activeId = model ?? defaultModel;
  const active = useMemo(() => findModel(groups, activeId), [groups, activeId]);
  const label = active ? prettyModelLabel(active.label) : defaultLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={`Model: ${label}`}
          className="inline-flex h-8 max-w-[12rem] items-center gap-1.5 rounded-full bg-secondary/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        {groups.map((g, gi) => {
          const labelId = `model-provider-${gi}`;
          return (
            <DropdownMenuGroup key={`${g.provider}:${gi}`} aria-labelledby={labelId}>
              {gi > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel id={labelId}>{prettyProvider(g.provider)}</DropdownMenuLabel>
              {g.models.map((m, mi) => (
                <DropdownMenuItem key={`${g.provider}:${m.id}:${mi}`} onSelect={() => onChange(m.id, m.provider)}>
                  <Check className={cn("h-4 w-4", m.id === activeId ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{prettyModelLabel(m.label)}</span>
                  {m.id === defaultModel && (
                    <span className="ml-2 shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Default
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
