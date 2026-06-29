import { useCallback, useState } from "react";
import { toast } from "sonner";

// Wraps an async handler with the busy-flag + error-toast boilerplate every dashboard
// mutation shares: flips `busy` for the duration and surfaces any thrown error via toast.
// The handler supplies the work and its own success feedback. Use as:
//   const { busy, run } = useAsyncAction();
//   const save = () => run(async () => { await apiFetch(...); toast.success("Saved"); });
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
