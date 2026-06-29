"use client";

import { IntegrationsTab } from "@/components/IntegrationsTab";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Thin dialog wrapper around the shared IntegrationsTab body. IntegrationsTab is keyed on
// mount, so rendering it only while `open` gives it a load-on-open / reset-on-close lifecycle.
export function IntegrationsDialog({
  open,
  onOpenChange,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}) {
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

        {open && <IntegrationsTab agentId={agentId} role="admin" embedded />}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
