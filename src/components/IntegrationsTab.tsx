"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, Plug, Plus, Search, Unplug } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { DEFAULT_INTEGRATION_TOOLKITS, composioLogoUrl } from "@/lib/integration-catalog";
import { cn } from "@/lib/utils";
import type {
  IntegrationConnection,
  IntegrationConnectionsResult,
  IntegrationConnectResult,
  IntegrationToolkit,
  IntegrationToolkitsResult,
  Role,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH = 3; // the v1 toolkits route 400s a non-empty query shorter than this
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 45000;

type SubTab = "browse" | "connected";

function toolkitKey(slug: string): string {
  return slug.toLowerCase();
}

function connToolkitSlug(c: IntegrationConnection): string {
  return (c.toolkitSlug || "").toLowerCase();
}

function isActive(c: IntegrationConnection): boolean {
  return (c.status || "").toUpperCase() === "ACTIVE";
}

function isToolkitConnected(conns: IntegrationConnection[], slug: string): boolean {
  return conns.some((c) => connToolkitSlug(c) === slug.toLowerCase() && isActive(c));
}

// The Integrations surface: connect third-party apps (Gmail, GitHub, Slack…) to this agent.
// Browse shows a popular catalog on first paint and live-searches the full 1,000+ app catalog as you
// type; Connected manages the linked accounts. Mutations (connect / disconnect) are admin-only —
// everyone can browse and see what is connected. Rendered both as the Integrations tab and inside
// IntegrationsDialog (`embedded`, which drops the page header since the dialog supplies its own).
//
// Lifecycle follows MOUNT: connections load on mount; polling and the debounced search clean up on
// unmount.
export function IntegrationsTab({
  agentId,
  role,
  embedded = false,
}: {
  agentId: string;
  role: Role;
  embedded?: boolean;
}) {
  const isAdmin = role === "admin";
  const [tab, setTab] = useState<SubTab>("browse");
  const [search, setSearch] = useState("");
  const [toolkits, setToolkits] = useState<IntegrationToolkit[]>([]);
  const [searching, setSearching] = useState(false);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef(0);

  const fetchConnections = useCallback(async () => {
    const { connections: conns } = await apiFetch<IntegrationConnectionsResult>(
      `/api/agents/${agentId}/integrations/connections`
    );
    setConnections(conns);
    return conns;
  }, [agentId]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setPendingSlug(null);
  }, []);

  // Load connections on mount; stop any poll on unmount.
  useEffect(() => {
    setLoadingConns(true);
    fetchConnections()
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoadingConns(false));
  }, [fetchConnections]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Debounced live search. Empty query shows the static popular catalog (no remote round-trip);
  // 1–2 chars wait (the v1 route 400s a short query); 3+ chars search the full catalog.
  useEffect(() => {
    const q = search.trim();
    if (q.length < MIN_SEARCH) {
      setToolkits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      apiFetch<IntegrationToolkitsResult>(
        `/api/agents/${agentId}/integrations/toolkits?search=${encodeURIComponent(q)}`
      )
        .then((res) => setToolkits(res.items))
        .catch((e) => toast.error((e as Error).message))
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, agentId]);

  // Called from a connect handler (not render): poll connections until the toolkit shows ACTIVE or
  // we pass the deadline. Stored lowercased so the per-card pending check matches a mixed-case slug.
  function startPolling(slug: string) {
    setPendingSlug(toolkitKey(slug));
    pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const conns = await fetchConnections();
        if (isToolkitConnected(conns, slug)) {
          stopPolling();
          toast.success("Connected");
          return;
        }
      } catch {
        // transient; keep polling until the deadline
      }
      if (Date.now() > pollDeadline.current) stopPolling();
    }, POLL_INTERVAL_MS);
  }

  async function connect(slug: string) {
    setConnecting(slug);
    try {
      const { redirectUrl } = await apiFetch<IntegrationConnectResult>(
        `/api/agents/${agentId}/integrations/connect`,
        { method: "POST", body: JSON.stringify({ toolkit: slug }) }
      );
      window.open(redirectUrl, "_blank", "noopener,noreferrer");
      startPolling(slug);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(connectedAccountId: string) {
    setDisconnecting(connectedAccountId);
    try {
      await apiFetch(`/api/agents/${agentId}/integrations/connections/${connectedAccountId}`, {
        method: "DELETE",
      });
      toast.success("Disconnected");
      await fetchConnections();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDisconnecting(null);
    }
  }

  const activeConnections = connections.filter((c) => !c.isDisabled);
  const q = search.trim();
  const tooShort = q.length > 0 && q.length < MIN_SEARCH;
  const visibleToolkits = q.length === 0 ? DEFAULT_INTEGRATION_TOOLKITS : toolkits;
  const gridClass = embedded
    ? "grid grid-cols-1 gap-3"
    : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

  const toggle = (
    <div className="inline-flex rounded-lg border bg-card p-0.5 text-sm">
      <SubTabButton active={tab === "browse"} onClick={() => setTab("browse")}>
        Browse
      </SubTabButton>
      <SubTabButton active={tab === "connected"} onClick={() => setTab("connected")}>
        Connected
        {activeConnections.length > 0 && (
          <span className="ml-1.5 text-xs text-muted-foreground">{activeConnections.length}</span>
        )}
      </SubTabButton>
    </div>
  );

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {embedded ? (
        <div className="flex justify-end">{toggle}</div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect third-party apps so this agent can act on your behalf.
            </p>
          </div>
          {toggle}
        </div>
      )}

      {tab === "browse" ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 1,000+ apps (e.g. github, gmail, slack)"
              className="h-11 pl-9"
            />
          </div>

          {tooShort ? (
            <p className="px-1 text-sm text-muted-foreground">
              Type at least {MIN_SEARCH} characters to search.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="px-1 text-xs font-medium text-muted-foreground">
                {q.length === 0 ? "Popular integrations" : "Search results"}
              </div>
              {searching ? (
                <div className={gridClass}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[68px] animate-pulse rounded-xl border bg-muted/40" />
                  ))}
                </div>
              ) : visibleToolkits.length === 0 ? (
                <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                  No apps found for “{q}”.
                </p>
              ) : (
                <div className={gridClass}>
                  {visibleToolkits.map((t) => {
                    const connected = isToolkitConnected(connections, t.slug);
                    const busy = connecting === t.slug || pendingSlug === toolkitKey(t.slug);
                    return (
                      <div
                        key={t.slug}
                        className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary/40"
                      >
                        <ToolkitLogo logo={t.logo} name={t.name} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{t.name}</div>
                          {t.description && (
                            <div className="truncate text-xs text-muted-foreground">
                              {t.description}
                            </div>
                          )}
                        </div>
                        {connected ? (
                          <Badge variant="success" className="shrink-0 gap-1">
                            <Check className="h-3 w-3" />
                            Added
                          </Badge>
                        ) : isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0 gap-1.5 px-3 text-xs"
                            disabled={busy}
                            onClick={() => connect(t.slug)}
                          >
                            {busy ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Waiting
                              </>
                            ) : (
                              <>
                                Connect
                                <ExternalLink className="h-3.5 w-3.5" />
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {pendingSlug && (
            <p className="px-1 text-xs text-muted-foreground">
              Waiting for you to finish connecting in the other tab…
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {loadingConns ? (
            <p className="py-2 text-sm text-muted-foreground">Loading…</p>
          ) : activeConnections.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center">
              <Plug className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No apps connected yet.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setTab("browse")}>
                Browse apps
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {activeConnections.map((c, i) => {
                const slug = connToolkitSlug(c);
                const isPending = pendingSlug === toolkitKey(slug);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3 text-sm",
                      i === activeConnections.length - 1 ? "" : "border-b"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ToolkitLogo logo={slug ? composioLogoUrl(slug) : null} name={c.toolkitName || slug || "?"} />
                      <span className="truncate font-medium">
                        {c.toolkitName || c.toolkitSlug || slug || "Unknown app"}
                      </span>
                      {isActive(c) ? (
                        <Badge variant="success">Connected</Badge>
                      ) : (
                        <Badge variant="warning">{c.status || "Pending"}</Badge>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs"
                          disabled={!slug || connecting === slug || isPending}
                          onClick={() => connect(slug)}
                        >
                          {connecting === slug || isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          Add another
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                          disabled={disconnecting === c.id}
                          onClick={() => disconnect(c.id)}
                        >
                          {disconnecting === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Unplug className="h-3.5 w-3.5" />
                          )}
                          Disconnect
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3 py-1.5 font-medium transition-colors",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ToolkitLogo({ logo, name }: { logo: string | null; name: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logo}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-8 w-8 shrink-0 rounded-md object-contain"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
