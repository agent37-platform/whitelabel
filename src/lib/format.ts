export function usd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

export function usdToMicros(usdValue: number): number {
  return Math.round(usdValue * 1_000_000);
}

export type StatusVariant = "success" | "warning" | "destructive" | "muted";

export function statusVariant(status?: string | null): StatusVariant {
  switch (status) {
    case "running":
      return "success";
    case "provisioning":
    case "starting":
    case "restarting":
    case "updating":
      return "warning";
    case "failed":
    case "error":
      return "destructive";
    default:
      return "muted";
  }
}

export function isTransitional(status?: string | null): boolean {
  return ["provisioning", "starting", "restarting", "updating", "deleting"].includes(status || "");
}
