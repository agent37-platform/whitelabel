"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, Unplug } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type {
  IntegrationConnection,
  IntegrationConnectionsResult,
  IntegrationConnectResult,
  IntegrationToolkit,
  IntegrationToolkitsResult,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH = 3;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 45000;

function connToolkitSlug(c: IntegrationConnection): string {
  return (c.toolkitSlug || "").toLowerCase();
}

function isActive(c: IntegrationConnection): boolean {
  return (c.status || "").toUpperCase() === "ACTIVE";
}

function isToolkitConnected(conns: IntegrationConnection[], slug: string): boolean {
  return conns.some((c) => connToolkitSlug(c) === slug.toLowerCase() && isActive(c));
}

export function IntegrationsDialog({
  open,
  onOpenChange,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}) {
  const [search, setSearch] = useState("");
  const [toolkits, setToolkits] = useState<IntegrationToolkit[]>([]);
  const [searching, setSearching] = useState(false);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loadingConns, setLoadingConns] = useState(false);
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

  // Load connections when the dialog opens; reset everything when it closes.
  useEffect(() => {
    if (!open) {
      stopPolling();
      setSearch("");
      setToolkits([]);
      return;
    }
    setLoadingConns(true);
    fetchConnections()
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoadingConns(false));
  }, [open, fetchConnections, stopPolling]);

  // Cleanup any poll on unmount.
  useEffect(() => () => stopPolling(), [stopPolling]);

  // Debounced toolkit search.
  useEffect(() => {
    if (!open) return;
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
  }, [search, open, agentId]);

  function startPolling(slug: string) {
    setPendingSlug(slug);
    pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const conns = await fetchConnections();
        const connected = isToolkitConnected(conns, slug);
        if (connected) {
          stopPolling();
          toast.success("Connected");
          return;
        }
      } catch {
        // transient; keep polling until the deadline
      }
      if (Date.now() > pollDeadline.current) {
        stopPolling();
      }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect apps</DialogTitle>
          <DialogDescription>
            Connect third-party apps so this agent can act on your behalf. Connecting opens the
            app&apos;s sign-in in a new tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Connected accounts */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Connected</h3>
            {loadingConns ? (
              <p className="py-2 text-sm text-muted-foreground">Loading...</p>
            ) : activeConnections.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No apps connected yet.</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                {activeConnections.map((c, i) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${
                      i === activeConnections.length - 1 ? "" : "border-b"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">
                        {c.toolkitName || c.toolkitSlug || connToolkitSlug(c) || "Unknown app"}
                      </span>
                      {isActive(c) ? (
                        <Badge variant="success">Connected</Badge>
                      ) : (
                        <Badge variant="warning">{c.status || "Pending"}</Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={connecting === connToolkitSlug(c)}
                        onClick={() => connect(connToolkitSlug(c))}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add another
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search + results */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Add an app</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search apps (e.g. github, gmail, slack)"
                className="pl-8"
              />
            </div>

            {search.trim().length > 0 && search.trim().length < MIN_SEARCH ? (
              <p className="px-1 py-1 text-xs text-muted-foreground">
                Type at least {MIN_SEARCH} characters to search.
              </p>
            ) : searching ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">Searching...</p>
            ) : toolkits.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {toolkits.map((t) => {
                  const connected = isToolkitConnected(connections, t.slug);
                  const isPending = pendingSlug === t.slug.toLowerCase();
                  return (
                    <div
                      key={t.slug}
                      className="flex items-center justify-between gap-2 rounded-md border p-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {t.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.logo}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded"
                          />
                        ) : (
                          <div className="h-6 w-6 shrink-0 rounded bg-muted" />
                        )}
                        <span className="truncate text-sm font-medium">{t.name}</span>
                      </div>
                      {connected ? (
                        <Badge variant="success" className="shrink-0 gap-1">
                          <Check className="h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 px-2.5 text-xs"
                          disabled={connecting === t.slug || isPending}
                          onClick={() => connect(t.slug)}
                        >
                          {connecting === t.slug || isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : search.trim().length >= MIN_SEARCH ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">No apps found.</p>
            ) : null}

            {pendingSlug && (
              <p className="px-1 pt-1 text-xs text-muted-foreground">
                Waiting for you to finish connecting in the other tab...
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
