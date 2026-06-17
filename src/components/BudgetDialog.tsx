"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { usd } from "@/lib/format";
import type { Budget, Usage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BudgetDialog({
  open,
  onOpenChange,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      apiFetch<Budget>(`/api/agents/${agentId}/budget`),
      apiFetch<Usage>(`/api/agents/${agentId}/usage`),
    ])
      .then(([b, u]) => {
        setBudget(b);
        setUsage(u);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, agentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usage</DialogTitle>
          <DialogDescription>
            Your monthly allowance and managed-spend (LLM, search, tools) for this agent.
          </DialogDescription>
        </DialogHeader>

        {loading || !budget || !usage ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Allowance" value={usd(budget.monthly_cap_micros)} />
              <Stat label="Spent" value={usd(budget.monthly_consumed_micros)} />
              <Stat label="Remaining" value={usd(budget.monthly_remaining_micros)} />
            </div>

            <div className="overflow-hidden rounded-md border">
              <UsageRow
                icon={<Sparkles />}
                label="LLM"
                cost={usage.by_integration.llm.cost_micros}
                calls={usage.by_integration.llm.calls}
              />
              <UsageRow
                icon={<Search />}
                label="Search"
                cost={usage.by_integration.brave.cost_micros}
                calls={usage.by_integration.brave.calls}
              />
              <UsageRow
                icon={<Wrench />}
                label="Tools"
                cost={usage.by_integration.composio.cost_micros}
                calls={usage.by_integration.composio.calls}
                last
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function UsageRow({
  icon,
  label,
  cost,
  calls,
  last,
}: {
  icon: ReactNode;
  label: string;
  cost: number;
  calls: number;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 text-sm ${last ? "" : "border-b"}`}>
      <span className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {calls} calls · {usd(cost)}
      </span>
    </div>
  );
}
