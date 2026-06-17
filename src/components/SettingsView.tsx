"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function SettingsView() {
  const { current, refresh, setCurrentId } = useWorkspace();
  const [name, setName] = useState(current?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(current?.name ?? "");
  }, [current?.id, current?.name]);

  if (!current) return <p className="text-sm text-muted-foreground">No workspace selected.</p>;

  const isAdmin = current.role === "admin";

  async function save() {
    if (!current) return;
    setBusy(true);
    try {
      await apiFetch(`/api/workspaces/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      await refresh();
      toast.success("Workspace renamed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!current) return;
    await apiFetch(`/api/workspaces/${current.id}`, { method: "DELETE" });
    const ws = await refresh();
    setCurrentId(ws[0]?.id ?? "");
    toast.success("Workspace deleted");
    window.location.href = "/dashboard";
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">{current.name}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ws-name">Workspace name</Label>
        <div className="flex gap-2">
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
          />
          {isAdmin && (
            <Button onClick={save} disabled={busy || !name.trim() || name.trim() === current.name}>
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Workspace ID</Label>
        <div className="flex gap-2">
          <Input readOnly value={current.id} className="font-mono text-xs" />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(current.id);
              toast.success("Copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-lg border border-destructive/40 p-4">
          <h2 className="text-sm font-medium">Delete workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently deletes this workspace and all of its agents. Only the workspace owner can
            do this.
          </p>
          <Button variant="destructive" className="mt-3" onClick={() => setDeleting(true)}>
            Delete workspace
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete workspace?"
        description="This deletes the workspace and tears down all of its agents. This cannot be undone."
        confirmText="Delete workspace"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
