import { Upload } from "lucide-react";

// Full-pane drop affordance, rendered over Chat or Files while a file is dragged in.
// pointer-events-none so the drag/drop events fall through to the container's handlers.
export function DropOverlay({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card/90 px-10 py-8 text-primary shadow-sm">
        <Upload className="h-7 w-7" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
