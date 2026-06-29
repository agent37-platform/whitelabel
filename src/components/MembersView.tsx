"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { apiFetch } from "@/lib/api";
import type { Invitation, Role, WorkspaceMember } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export function MembersView() {
  const { current } = useWorkspace();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [role, setRole] = useState<Role>("admin");
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    try {
      const data = await apiFetch<{ members: WorkspaceMember[]; invitations: Invitation[]; role: Role }>(
        `/api/workspaces/${current.id}/members`
      );
      setMembers(data.members);
      setInvitations(data.invitations);
      setRole(data.role);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const isAdmin = role === "admin";

  function inviteUrl(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  async function createInvite() {
    if (!current) return;
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/workspaces/${current.id}/members`, {
        method: "POST",
      });
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invite link created and copied");
      setInviteOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    if (!current) return;
    try {
      await apiFetch(`/api/workspaces/${current.id}/members/${userId}`, { method: "DELETE" });
      toast.success("Member removed");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function revokeInvite(token: string) {
    if (!current) return;
    try {
      await apiFetch(`/api/workspaces/${current.id}/invitations/${token}`, { method: "DELETE" });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!current) return <p className="text-sm text-muted-foreground">No workspace selected.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">{current.name}</p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4" />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite member</DialogTitle>
                <DialogDescription>
                  Create an invite link and share it. Anyone who opens it joins this workspace as an
                  admin.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={createInvite} disabled={busy}>
                  {busy ? "Creating..." : "Create invite link"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Added</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-t">
                    <td className="px-4 py-3 font-medium">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge>Admin</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove member"
                          onClick={() => removeMember(m.user_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isAdmin && invitations.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Pending invitations</h2>
              <div className="divide-y rounded-lg border">
                {invitations.map((inv) => (
                  <div key={inv.token} className="space-y-2 p-4">
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                        {inviteUrl(inv.token)}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteUrl(inv.token));
                          toast.success("Link copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Copy link
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label="Revoke invite"
                        onClick={() => revokeInvite(inv.token)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(inv.created_at)} · anyone with this link joins as an admin
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
