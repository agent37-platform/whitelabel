"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Check, Play, RotateCw, Search, Sparkles, Square, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { isTransitional, statusVariant, usd } from "@/lib/format";
import { SHAPE_PRESETS, type Shape } from "@/config/agents";
import type { Budget, MergedAgent, Role, Usage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OpenPortButtons } from "@/components/OpenPortButtons";
import { useAsyncAction } from "@/components/useAsyncAction";
import { cn } from "@/lib/utils";

// All of an agent's controls, consolidated into one tab: rename, lifecycle (start/stop/restart/
// update), resize, the managed-spend budget cap, read-only usage, open-port shortcuts, and delete.
// Every MUTATION is gated on role === "admin"; non-admins see the same surfaces read-only.
export function AgentSettingsTab({
  agentId,
  agent,
  role,
  onChanged,
}: {
  agentId: string;
  agent: MergedAgent;
  role: Role;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const running = agent.live_status === "running";
  const transitional = isTransitional(agent.live_status);

  const { busy, run } = useAsyncAction();

  // POST a lifecycle action; the merged list refreshes via onChanged.
  const action = (path: string, msg: string) =>
    run(async () => {
      await apiFetch(`/api/agents/${agentId}/${path}`, { method: "POST" });
      toast.success(msg);
      onChanged?.();
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage this agent.</p>
      </div>

      <StatusSection agent={agent} />
      <RenameSection agentId={agentId} agent={agent} isAdmin={isAdmin} onChanged={onChanged} />

      {/* Lifecycle */}
      <Section title="Lifecycle" description="Start, stop, restart, or roll this agent to the latest image.">
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <Button variant="outline" size="sm" disabled={busy || transitional} onClick={() => action("stop", "Stopping")}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={busy || transitional} onClick={() => action("start", "Starting")}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={!running || busy} onClick={() => action("restart", "Restarting")}>
              <RotateCw className="h-4 w-4" />
              Restart
            </Button>
            {agent.update_available && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                disabled={transitional || busy}
                onClick={() => action("update", "Updating")}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Update available
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Only admins can start, stop, or update this agent.</p>
        )}
      </Section>

      <ResizeSection agentId={agentId} agent={agent} isAdmin={isAdmin} onChanged={onChanged} />
      <BudgetSection agentId={agentId} isAdmin={isAdmin} />

      {/* Open the agent's web UIs */}
      <Section title="Open apps" description="Open this agent's web interfaces in a new tab. Available while it's running.">
        <OpenPortButtons agentId={agentId} ports={agent.ports} disabled={!running} />
        {!running && <p className="mt-1 text-xs text-muted-foreground">Start the agent to open its apps.</p>}
      </Section>

      {isAdmin && <DeleteSection agentId={agentId} onDeleted={() => router.push("/dashboard")} />}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusSection({ agent }: { agent: MergedAgent }) {
  return (
    <Section title="Status">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={statusVariant(agent.live_status)}>{agent.live_status ?? "unknown"}</Badge>
        {agent.past_due && <Badge variant="warning">past due</Badge>}
        <span className="text-muted-foreground">
          {agent.template ?? "-"} · {agent.cpu} vCPU · {agent.memory} GB · {agent.disk} GB
        </span>
      </div>
      {agent.status_reason && (
        <p className="mt-2 text-xs text-destructive" title={agent.status_reason.message}>
          {agent.status_reason.message}
        </p>
      )}
      <p className="mt-2 truncate font-mono text-xs text-muted-foreground" title={agent.agent37_id}>
        {agent.agent37_id}
      </p>
    </Section>
  );
}

function RenameSection({
  agentId,
  agent,
  isAdmin,
  onChanged,
}: {
  agentId: string;
  agent: MergedAgent;
  isAdmin: boolean;
  onChanged?: () => void;
}) {
  const [name, setName] = useState(agent.name ?? "");
  const { busy: saving, run } = useAsyncAction();

  function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === (agent.name ?? "")) return;
    run(async () => {
      await apiFetch(`/api/agents/${agentId}`, { method: "PATCH", body: JSON.stringify({ name: trimmed }) });
      toast.success("Renamed");
      onChanged?.();
    });
  }

  return (
    <Section title="Name" description="A label for this agent inside your workspace.">
      <div className="flex max-w-md items-center gap-2">
        <Input
          value={name}
          disabled={!isAdmin || saving}
          placeholder="Untitled agent"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        {isAdmin && (
          <Button
            size="sm"
            disabled={saving || !name.trim() || name.trim() === (agent.name ?? "")}
            onClick={save}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>
    </Section>
  );
}

function ResizeSection({
  agentId,
  agent,
  isAdmin,
  onChanged,
}: {
  agentId: string;
  agent: MergedAgent;
  isAdmin: boolean;
  onChanged?: () => void;
}) {
  const { busy, run } = useAsyncAction();

  function resize(shape: Shape) {
    // CPU + memory only: disk can't shrink, so we leave it where it is and let a fork extend this.
    run(async () => {
      await apiFetch(`/api/agents/${agentId}/resize`, {
        method: "POST",
        body: JSON.stringify({ cpu: shape.cpu, memory: shape.memory }),
      });
      toast.success("Resizing");
      onChanged?.();
    });
  }

  return (
    <Section title="Size" description="Change the agent's CPU and memory. Disk is unchanged.">
      <div className="grid gap-2 sm:grid-cols-2">
        {SHAPE_PRESETS.map((s) => {
          const current = s.cpu === agent.cpu && s.memory === agent.memory;
          return (
            <button
              key={s.label}
              type="button"
              disabled={!isAdmin || current || busy}
              onClick={() => resize(s)}
              aria-pressed={current}
              className={cn(
                "rounded-lg border bg-background p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                current ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-accent/40",
                (!isAdmin || busy) && !current && "cursor-not-allowed opacity-60",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium leading-none">{s.label}</span>
                {current && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>
      {!isAdmin && <p className="mt-2 text-xs text-muted-foreground">Only admins can resize this agent.</p>}
    </Section>
  );
}

function BudgetSection({ agentId, isAdmin }: { agentId: string; isAdmin: boolean }) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [cap, setCap] = useState("");
  const [loading, setLoading] = useState(true);
  const { busy: saving, run } = useAsyncAction();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch<Budget>(`/api/agents/${agentId}/budget`),
      apiFetch<Usage>(`/api/agents/${agentId}/usage`),
    ])
      .then(([b, u]) => {
        if (cancelled) return;
        setBudget(b);
        setUsage(u);
        setCap((b.monthly_cap_micros / 1_000_000).toFixed(2));
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  function save() {
    const value = Number(cap);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    run(async () => {
      const b = await apiFetch<Budget>(`/api/agents/${agentId}/budget`, {
        method: "PATCH",
        body: JSON.stringify({ monthly_cap_usd: value }),
      });
      setBudget(b);
      setCap((b.monthly_cap_micros / 1_000_000).toFixed(2));
      toast.success("Budget updated");
    });
  }

  return (
    <Section
      title="Budget & usage"
      description="The monthly managed-spend cap (LLM, search, tools) and what's been used this period."
    >
      {loading || !budget || !usage ? (
        <p className="py-2 text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Allowance" value={usd(budget.monthly_cap_micros)} />
            <Stat label="Spent" value={usd(budget.monthly_consumed_micros)} />
            <Stat label="Remaining" value={usd(budget.monthly_remaining_micros)} />
          </div>

          <div className="overflow-hidden rounded-md border">
            <UsageRow icon={<Sparkles />} label="LLM" cost={usage.by_integration.llm.cost_micros} calls={usage.by_integration.llm.calls} />
            <UsageRow icon={<Search />} label="Search" cost={usage.by_integration.brave.cost_micros} calls={usage.by_integration.brave.calls} />
            <UsageRow icon={<Wrench />} label="Tools" cost={usage.by_integration.composio.cost_micros} calls={usage.by_integration.composio.calls} last />
          </div>

          {isAdmin && (
            <div className="flex max-w-xs items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="budget-cap">Monthly cap (USD)</Label>
                <Input
                  id="budget-cap"
                  type="number"
                  min={0}
                  step="0.01"
                  value={cap}
                  disabled={saving}
                  onChange={(e) => setCap(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
              </div>
              <Button size="sm" disabled={saving} onClick={save}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function DeleteSection({ agentId, onDeleted }: { agentId: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);

  async function remove() {
    await apiFetch(`/api/agents/${agentId}`, { method: "DELETE" });
    toast.success("Agent deleted");
    onDeleted();
  }

  return (
    <section className="rounded-lg border border-destructive/30 p-5">
      <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Permanently delete this agent and its data. This cannot be undone.
      </p>
      <Button variant="destructive" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete agent
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete agent?"
        description="This permanently deletes the agent and its data. This cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={remove}
      />
    </section>
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
