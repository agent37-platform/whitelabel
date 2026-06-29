"use client";

import { Check, ChevronDown, Zap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { REASONING_EFFORTS, REASONING_LABELS, type ReasoningEffort } from "./types";

interface Props {
  value: ReasoningEffort | null; // null => agent default
  disabled?: boolean;
  onChange: (value: ReasoningEffort | null) => void;
}

export function EffortMenu({ value, disabled, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <Zap className="h-3.5 w-3.5 shrink-0" />
          <span>{value ? REASONING_LABELS[value] : "Effort"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
          <span className="flex-1">Default</span>
        </DropdownMenuItem>
        {REASONING_EFFORTS.map((e) => (
          <DropdownMenuItem key={e} onSelect={() => onChange(e)}>
            <Check className={cn("h-4 w-4", value === e ? "opacity-100" : "opacity-0")} />
            <span className="flex-1">{REASONING_LABELS[e]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
