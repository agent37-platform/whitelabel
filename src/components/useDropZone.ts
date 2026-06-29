"use client";

import { useRef, useState, type DragEvent } from "react";

// Full-element file drag-and-drop: returns the overlay flag + the handlers to spread onto the
// drop zone. dragenter/dragleave fire for every child the cursor crosses and bubble up to the
// (large) zone, so we count enters minus leaves rather than inspecting relatedTarget — the latter
// is null on Safari/Firefox, which would strobe the overlay on each child boundary crossing.
export function useDropZone(onFiles: (files: FileList) => void) {
  const [dragOver, setDragOver] = useState(false);
  const depth = useRef(0);

  const dragHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      depth.current += 1;
      setDragOver(true);
    },
    onDragOver: (e: DragEvent) => {
      // preventDefault is required for the drop event to fire (and suppresses the browser's
      // default "open the file" behavior when dropping onto the zone).
      if (e.dataTransfer.types.includes("Files")) e.preventDefault();
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragOver(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragOver(false);
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    },
  };

  return { dragOver, dragHandlers };
}
