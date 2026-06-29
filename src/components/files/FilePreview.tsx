"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { contentUrl, previewKind, type FileEntry } from "./types";

// Preview one file in a dialog. Rendering is chosen by extension:
//  - image  -> <img> (an <img> never executes script, even for same-origin sources)
//  - pdf    -> the browser's PDF viewer in an <iframe>
//  - text   -> fetched and shown escaped in a <pre>
//  - sandbox (html/svg) -> a SANDBOXED <iframe> with all permissions stripped, so embedded
//    scripts can't run and can't reach this origin's session — the XSS guard for active documents
//  - none   -> no inline preview; offer the download instead
export function FilePreview({
  agentId,
  entry,
  onClose,
}: {
  agentId: string;
  entry: FileEntry | null;
  onClose: () => void;
}) {
  const open = !!entry;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{entry.name}</DialogTitle>
            </DialogHeader>
            <PreviewBody agentId={agentId} entry={entry} />
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <a href={contentUrl(agentId, entry.path, "attachment")} download={entry.name}>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ agentId, entry }: { agentId: string; entry: FileEntry }) {
  const kind = previewKind(entry.name);
  const inline = contentUrl(agentId, entry.path, "inline");
  const frame = "max-h-[70vh] min-h-[50vh] w-full rounded-md border bg-background";

  if (kind === "image") {
    return (
      <div className="flex max-h-[70vh] justify-center overflow-auto rounded-md border bg-secondary/30 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- streamed via our BFF, not a remote asset */}
        <img src={inline} alt={entry.name} className="max-h-[66vh] max-w-full object-contain" />
      </div>
    );
  }

  if (kind === "pdf") {
    return <iframe src={inline} title={entry.name} className={frame} />;
  }

  // html / svg: never render as an active document on our origin — strip every iframe permission.
  if (kind === "sandbox") {
    return <iframe src={inline} title={entry.name} sandbox="" className={frame} />;
  }

  if (kind === "text") {
    return <TextPreview url={inline} />;
  }

  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-md border bg-secondary/30 text-sm text-muted-foreground">
      <p>No preview available for this file type.</p>
      <p>Use Download to open it locally.</p>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(null);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Couldn't load file (${res.status})`);
        // Cap the rendered slice so a huge log can't lock the tab.
        const body = await res.text();
        return body.length > 500_000 ? `${body.slice(0, 500_000)}\n\n… (truncated)` : body;
      })
      .then((body) => !cancelled && setText(body))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;
  if (text == null)
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  return (
    <pre className="max-h-[70vh] overflow-auto rounded-md border bg-secondary/30 p-4 text-xs leading-relaxed text-foreground">
      {text}
    </pre>
  );
}
