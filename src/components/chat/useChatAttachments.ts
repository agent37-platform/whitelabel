"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from "react";
import { readApiError } from "@/lib/api";
import { uid, type MessageAttachment } from "./types";
import { useDropZone } from "../useDropZone";

export interface PendingFile {
  id: string;
  file: File;
  previewUrl: string | null; // object URL for images, for the tray thumbnail
  status: "uploading" | "uploaded" | "error";
  path?: string; // instance path returned by the upload, passed to the turn's `files`
  error?: string;
}

// Drag-drop / paste / click attachments. Each file uploads immediately to the instance
// (POST /api/agents/{id}/chat/files) and the returned path is collected at send time.
export function useChatAttachments(agentId: string, onFocusRequest?: () => void) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const filesRef = useRef<PendingFile[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const patch = (id: string, p: Partial<PendingFile>) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...p } : f)));

  const startUpload = useCallback(
    async (pf: PendingFile) => {
      const ctrl = new AbortController();
      controllers.current.set(pf.id, ctrl);
      const form = new FormData();
      form.append("file", pf.file, pf.file.name);
      let aborted = false;
      try {
        const res = await fetch(`/api/agents/${agentId}/chat/files`, {
          method: "POST",
          body: form,
          signal: ctrl.signal,
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, "Upload failed"));
        }
        const data = (await res.json()) as { path?: string };
        patch(pf.id, { status: "uploaded", path: data.path });
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          aborted = true;
          return;
        }
        patch(pf.id, { status: "error", error: (e as Error).message });
      } finally {
        controllers.current.delete(pf.id);
        if (!aborted) onFocusRequest?.();
      }
    },
    [agentId, onFocusRequest]
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const pfs: PendingFile[] = Array.from(incoming).map((file) => ({
        id: uid("f"),
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        status: "uploading" as const,
      }));
      if (!pfs.length) return;
      setFiles((prev) => [...prev, ...pfs]);
      onFocusRequest?.();
      pfs.forEach(startUpload);
    },
    [onFocusRequest, startUpload]
  );

  const removeFile = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const retryFile = useCallback(
    (id: string) => {
      const f = filesRef.current.find((x) => x.id === id);
      if (!f) return;
      patch(id, { status: "uploading", error: undefined });
      startUpload({ ...f, status: "uploading", error: undefined });
    },
    [startUpload]
  );

  const clearFiles = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setFiles((prev) => {
      prev.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      return [];
    });
  }, []);

  // Collect uploaded attachments (path + display name) for the outgoing turn, then clear the
  // tray. The path rides in the turn's `files`; name/isImage drive the chip in the sent bubble.
  const takeAttachments = useCallback((): MessageAttachment[] => {
    const atts = filesRef.current
      .filter((f): f is PendingFile & { path: string } => !!f.path)
      .map((f) => ({ name: f.file.name, path: f.path, isImage: f.file.type.startsWith("image/") }));
    clearFiles();
    return atts;
  }, [clearFiles]);

  // Whole-pane drag-drop; spread onto the drop zone in ChatView.
  const { dragOver, dragHandlers } = useDropZone(addFiles);

  const handlePaste = (e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items ?? []).filter((i) => i.kind === "file");
    if (!items.length) return;
    const picked = items.map((i) => i.getAsFile()).filter((f): f is File => !!f);
    if (picked.length) {
      e.preventDefault();
      addFiles(picked);
    }
  };

  useEffect(() => () => clearFiles(), [clearFiles]);

  const uploading = files.some((f) => f.status === "uploading");
  const hasError = files.some((f) => f.status === "error");

  return {
    files,
    dragOver,
    addFiles,
    removeFile,
    retryFile,
    takeAttachments,
    clearFiles, // ChatView calls this on thread switch so a staged file can't leak into another chat
    dragHandlers,
    handlePaste,
    uploading,
    hasFiles: files.length > 0,
    // Send is blocked while uploads are in flight or failed (so paths are ready at send time).
    blocksSend: uploading || hasError,
  };
}

// The shared attachment state, lifted to ChatView so the whole pane is a drop zone and passed
// down to the composer (tray, attach button, paste). One instance for the whole chat pane —
// ChatView resets it (clearFiles) on every thread switch so a staged file stays with its chat.
export type ChatAttachments = ReturnType<typeof useChatAttachments>;
