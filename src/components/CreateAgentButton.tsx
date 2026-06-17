"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function CreateAgentButton({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await apiFetch("/api/agents", {
        method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      toast.success("Agent is provisioning");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={create} disabled={busy}>
      <Plus className="h-4 w-4" />
      {busy ? "Creating..." : "Create agent"}
    </Button>
  );
}
