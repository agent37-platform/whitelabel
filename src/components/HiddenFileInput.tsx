import type { RefObject } from "react";

// A hidden <input type="file"> driven by a ref-triggered picker. Clears its value after each
// pick so re-selecting the same file fires onChange again. Shared by the Chat attach button and
// the Files upload menu. Set `webkitdirectory` on the ref (for folder uploads) from the caller.
export function HiddenFileInput({
  inputRef,
  onFiles,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      multiple
      hidden
      onChange={(e) => {
        if (e.target.files?.length) onFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );
}
