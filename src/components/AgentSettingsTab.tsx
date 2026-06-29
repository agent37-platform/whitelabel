"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Pencil, Play, RotateCw, Search, Sparkles, Square, Trash2, Wrench, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { isTransitional, statusVariant, usd } from "@/lib/format";
import { AGENT_TYPES, SHAPE_PRESETS } from "@/config/agents";
import type { Budget, MergedAgent, Role, Usage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OpenPortButtons } from "@/components/OpenPortButtons";
import { useAsyncAction } from "@/components/useAsyncAction";
import { cn } from "@/lib/utils";

// The agent's overview/manage tab: a clean header (inline-rename name, status + shape + template
// badges, and lifecycle actions as icon buttons) over app shortcuts and a read-only budget + usage
// panel. Mutations are admin-only.
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, run } = useAsyncAction();

  // POST a lifecycle action; the merged list refreshes via onChanged.
  const action = (path: string, msg: string) =>
    run(async () => {
      await apiFetch(`/api/agents/${agentId}/${path}`, { method: "POST" });
      toast.success(msg);
      onChanged?.();
    });

  async function deleteAgent() {
    await apiFetch(`/api/agents/${agentId}`, { method: "DELETE" });
    toast.success("Agent deleted");
    router.push("/dashboard");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <NameEditor agentId={agentId} agent={agent} isAdmin={isAdmin} onChanged={onChanged} />
          {isAdmin && (
            <div className="flex shrink-0 items-center gap-1.5">
              {running ? (
                <IconAction label="Stop" icon={Square} disabled={busy || transitional} onClick={() => action("stop", "Stopping")} />
              ) : (
                <IconAction label="Start" icon={Play} disabled={busy || transitional} onClick={() => action("start", "Starting")} />
              )}
              <IconAction label="Restart" icon={RotateCw} disabled={!running || busy} onClick={() => action("restart", "Restarting")} />
              {agent.update_available && (
                <IconAction
                  label="Update to latest image"
                  icon={ArrowDownToLine}
                  amber
                  disabled={transitional || busy}
                  onClick={() => action("update", "Updating")}
                />
              )}
              <IconAction
                label="Delete agent"
                icon={Trash2}
                destructive
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(agent.live_status)}>{agent.live_status ?? "unknown"}</Badge>
          {shapeLabel(agent) && <Badge variant="outline">{shapeLabel(agent)}</Badge>}
          {templateLabel(agent) && <Badge variant="outline">{templateLabel(agent)}</Badge>}
          {agent.past_due && <Badge variant="warning">past due</Badge>}
          <span className="truncate font-mono text-xs text-muted-foreground" title={agent.agent37_id}>
            {agent.agent37_id}
          </span>
        </div>

        {agent.status_reason && (
          <p className="text-xs text-destructive" title={agent.status_reason.message}>
            {agent.status_reason.message}
          </p>
        )}
      </header>

      <AppsSection agentId={agentId} agent={agent} />
      <BudgetSection agentId={agentId} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete agent?"
        description={`This will permanently delete ${agent.name?.trim() || "this agent"}. This cannot be undone.`}
        confirmText="Delete agent"
        destructive
        onConfirm={deleteAgent}
      />
    </div>
  );
}

// Short shape name (e.g. "Max") by matching live CPU/memory to a preset; null if it's a custom size.
function shapeLabel(agent: MergedAgent): string | null {
  const s = SHAPE_PRESETS.find((p) => p.cpu === agent.cpu && p.memory === agent.memory);
  return s ? s.label.split(" · ")[0] : null;
}

// Friendly template name (e.g. "OpenClaw") from the catalog; falls back to the raw template id.
function templateLabel(agent: MergedAgent): string | null {
  if (!agent.template) return null;
  return AGENT_TYPES.find((t) => t.template === agent.template)?.label ?? agent.template;
}

// A circular icon button for a header action. Label rides the tooltip + aria so the row stays icons.
function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  amber,
  destructive,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  amber?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
        amber && "border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700",
        destructive && "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// The agent name as an inline-editable title: click the pencil to swap the heading for an input.
// Enter / blur commits; Escape cancels (skipBlur suppresses the commit the resulting blur would fire).
function NameEditor({
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(agent.name ?? "");
  const skipBlur = useRef(false);
  const { busy: saving, run } = useAsyncAction();

  // Adopt an externally-changed name while not editing (e.g. a rename from another surface).
  useEffect(() => {
    if (!editing) setDraft(agent.name ?? "");
  }, [agent.name, editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === (agent.name ?? "")) return;
    run(async () => {
      await apiFetch(`/api/agents/${agentId}`, { method: "PATCH", body: JSON.stringify({ name: trimmed }) });
      toast.success("Renamed");
      onChanged?.();
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => {
          if (skipBlur.current) {
            skipBlur.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            skipBlur.current = true;
            setDraft(agent.name ?? "");
            setEditing(false);
          }
        }}
        aria-label="Agent name"
        placeholder="Untitled agent"
        className="min-w-0 max-w-md flex-1 border-b-2 border-ring bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-2xl font-semibold tracking-tight">{agent.name?.trim() || "Untitled agent"}</h1>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Rename agent"
          title="Rename"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function AppsSection({ agentId, agent }: { agentId: string; agent: MergedAgent }) {
  const running = agent.live_status === "running";
  const openableCount = agent.ports.filter((p) => !p.default).length;

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Apps</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Open this agent&apos;s own web apps, such as dashboard, terminal, or file browser, using short-lived signed links.
      </p>
      <div className="mt-4">
        {openableCount > 0 ? (
          <OpenPortButtons agentId={agentId} ports={agent.ports} disabled={!running} template={agent.template} />
        ) : (
          <p className="text-sm text-muted-foreground">No app ports are available for this agent yet.</p>
        )}
        {!running && openableCount > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Start the agent to open its apps.</p>
        )}
      </div>
    </section>
  );
}

// Read-only budget + usage. The monthly cap is shown but NOT editable from the UI.
function BudgetSection({ agentId }: { agentId: string }) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

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
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Budget &amp; usage</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        The monthly managed-spend cap (LLM, search, tools) and what&apos;s been used this period.
      </p>
      <div className="mt-4">
        {loading || !budget || !usage ? (
          <p className="py-2 text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Monthly cap" value={usd(budget.monthly_cap_micros)} />
              <Stat label="Spent" value={usd(budget.monthly_consumed_micros)} />
              <Stat label="Remaining" value={usd(budget.monthly_remaining_micros)} />
            </div>

            <div className="overflow-hidden rounded-md border">
              <UsageRow icon={<Sparkles />} label="LLM" cost={usage.by_integration.llm.cost_micros} calls={usage.by_integration.llm.calls} />
              <UsageRow icon={<Search />} label="Search" cost={usage.by_integration.brave.cost_micros} calls={usage.by_integration.brave.calls} />
              <UsageRow icon={<Wrench />} label="Tools" cost={usage.by_integration.composio.cost_micros} calls={usage.by_integration.composio.calls} last />
            </div>
          </div>
        )}
      </div>
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
