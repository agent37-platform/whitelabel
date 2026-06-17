"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { branding } from "@/config/branding";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "agent37wl_workspace";

export function AcceptInvite({
  token,
  workspaceName,
  role,
}: {
  token: string;
  workspaceName: string;
  role: string;
}) {
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      const { workspace_id } = await apiFetch<{ workspace_id: string }>(`/api/invitations/${token}`, {
        method: "POST",
      });
      localStorage.setItem(STORAGE_KEY, workspace_id);
      window.location.href = "/dashboard";
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{branding.appName}</h1>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">You&apos;ve been invited to join</p>
          <p className="mt-1 text-lg font-medium">{workspaceName}</p>
          <p className="mt-1 text-sm text-muted-foreground">as {role}</p>
          <Button className="mt-4 w-full" onClick={accept} disabled={busy}>
            {busy ? "Joining..." : "Accept invitation"}
          </Button>
        </div>
      </div>
    </main>
  );
}
