"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  File as FileIcon,
  Folder,
  FolderPlus,
  FolderUp,
  Grid2X2,
  Link2,
  List,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DropOverlay } from "@/components/DropOverlay";
import { HiddenFileInput } from "@/components/HiddenFileInput";
import { useAsyncAction } from "@/components/useAsyncAction";
import { FilePreview } from "./FilePreview";
import { useFileBrowser } from "./useFileBrowser";
import { archiveUrl, breadcrumbs, contentUrl, formatBytes, formatMtime, isDir, type FileEntry } from "./types";

type ViewMode = "list" | "grid";

// The Files pane, rendered full-height in the dashboard main when the Files tab is active (kept
// mounted/hidden across tab switches, like ChatView, so the current directory survives). The whole
// pane is a drop zone for uploads. Look + primitives mirror the Chat tab: same shadcn Dialog/Input,
// lucide icons, sonner toasts (raised inside the hook), and the hover-action pattern.
export function FilesView({ agentId }: { agentId: string }) {
  const fb = useFileBrowser(agentId);
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);

  // `webkitdirectory` isn't in React's input typings, so set it on the DOM node directly. It makes
  // the picker select a whole folder; each file then reports its path under it via webkitRelativePath.
  useEffect(() => {
    folderUploadRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  // Inline rename — the row's name swaps to an input (Enter-commits / Escape-cancels). `skipBlur`
  // suppresses the commit the Escape-triggered blur would fire.
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const skipBlurRef = useRef(false);

  function startRename(entry: FileEntry) {
    setSelectedPath(entry.path);
    setEditingPath(entry.path);
    setDraft(entry.name);
  }
  function commitRename(entry: FileEntry) {
    setEditingPath(null);
    setSelectedPath(null);
    fb.rename(entry, draft);
  }
  function onRenameKeyDown(e: KeyboardEvent<HTMLInputElement>, entry: FileEntry) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(entry);
    } else if (e.key === "Escape") {
      e.preventDefault();
      skipBlurRef.current = true;
      setEditingPath(null);
    }
  }

  function openEntry(entry: FileEntry) {
    if (isDir(entry)) {
      setSelectedPath(null);
      fb.openEntry(entry);
    } else {
      setSelectedPath(entry.path);
      setPreview(entry);
    }
  }

  function selectEntry(entry: FileEntry) {
    setSelectedPath(entry.path);
  }

  function onEntryKeyDown(e: KeyboardEvent<HTMLElement>, entry: FileEntry) {
    if (e.key === "Enter") {
      e.preventDefault();
      openEntry(entry);
    } else if (e.key === " ") {
      e.preventDefault();
      selectEntry(entry);
    }
  }

  // Selection is anchored to the listing, so clear it (and any in-progress rename) whenever the
  // directory changes out from under it.
  function resetSelection() {
    setSelectedPath(null);
    setEditingPath(null);
  }

  function navigate(path: string) {
    resetSelection();
    fb.navigate(path);
  }

  function goUp() {
    resetSelection();
    fb.goUp();
  }

  function selectForDelete(entry: FileEntry) {
    setSelectedPath(entry.path);
    setPendingDelete(entry);
  }

  function clearSelection() {
    if (!editingPath) setSelectedPath(null);
  }

  // Shared row/card interaction: click selects, double-click opens, Space/Enter from the keyboard.
  // `stopPropagation` keeps the click from bubbling to the container's clear-selection handler.
  function entryHandlers(entry: FileEntry) {
    return {
      tabIndex: 0,
      onClick: (e: ReactMouseEvent<HTMLElement>) => {
        e.stopPropagation();
        selectEntry(entry);
      },
      onDoubleClick: (e: ReactMouseEvent<HTMLElement>) => {
        e.stopPropagation();
        openEntry(entry);
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => onEntryKeyDown(e, entry),
    };
  }

  const crumbs = fb.path ? breadcrumbs(fb.path) : [];
  const selectedEntry = useMemo(
    () => (selectedPath == null ? null : fb.visibleEntries.find((entry) => entry.path === selectedPath) ?? null),
    [fb.visibleEntries, selectedPath]
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col" {...fb.dragHandlers}>
      {fb.dragOver && <DropOverlay label="Drop files to upload here" />}

      <header className="shrink-0 border-b bg-background px-4 py-3 md:px-6 lg:px-8">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goUp}
              disabled={!fb.parentPath}
              aria-label="Up one folder"
              title="Up one folder"
              className="h-10 shrink-0"
            >
              <ArrowUp className="h-4 w-4" />
              Up
            </Button>
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 shadow-sm">
              <Folder className="h-4 w-4 shrink-0 text-primary" />
              <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm" aria-label="Folder path">
                {crumbs.length === 0 ? (
                  <span className="text-muted-foreground">Loading folder</span>
                ) : (
                  crumbs.map((c, i) => (
                    <span key={c.path} className="flex shrink-0 items-center">
                      {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      <button
                        type="button"
                        onClick={() => navigate(c.path)}
                        aria-current={i === crumbs.length - 1 ? "page" : undefined}
                        className={cn(
                          "max-w-[11rem] truncate rounded px-1.5 py-0.5 transition-colors hover:bg-secondary",
                          i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {c.label}
                      </button>
                    </span>
                  ))
                )}
              </nav>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1 xl:ml-auto">
            {selectedEntry && (
              <SelectedActions
                agentId={agentId}
                entry={selectedEntry}
                onRename={startRename}
                onDelete={selectForDelete}
              />
            )}
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <ToolbarIconButton
              onClick={() => fb.setShowHidden((v) => !v)}
              label={fb.showHidden ? "Hide hidden files" : "Show hidden files"}
            >
              {fb.showHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </ToolbarIconButton>
            <ToolbarIconButton onClick={fb.refresh} label="Refresh">
              <RefreshCw className={cn("h-4 w-4", fb.loading && "animate-spin")} />
            </ToolbarIconButton>
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewFolderOpen(true)}
              disabled={!fb.path}
              className="h-9"
            >
              <FolderPlus className="h-4 w-4" />
              New folder
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={!fb.path || fb.uploading} className="h-9">
                  {fb.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => uploadRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Files
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => folderUploadRef.current?.click()}>
                  <FolderUp className="h-4 w-4" />
                  Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <HiddenFileInput inputRef={uploadRef} onFiles={fb.uploadFiles} />
            <HiddenFileInput inputRef={folderUploadRef} onFiles={fb.uploadFolder} />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {fb.loading && fb.entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : fb.error ? (
          <div className="p-6 md:px-10">
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{fb.error}</p>
          </div>
        ) : (
          <div className="w-full p-4 md:p-6 lg:p-8" onClick={clearSelection}>
            {fb.visibleEntries.length === 0 ? (
              <EmptyFolder
                canCreate={!!fb.path}
                uploading={fb.uploading}
                onNewFolder={() => setNewFolderOpen(true)}
                onUpload={() => uploadRef.current?.click()}
              />
            ) : viewMode === "list" ? (
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full min-w-[700px] table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-28" />
                    <col className="w-56" />
                  </colgroup>
                  <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 text-right font-medium">Size</th>
                      <th className="px-4 py-3 font-medium">Last modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fb.visibleEntries.map((entry) => {
                      const editing = editingPath === entry.path;
                      const selected = selectedEntry?.path === entry.path;
                      return (
                        <tr
                          key={entry.path}
                          aria-selected={selected}
                          className={cn(
                            "cursor-default select-none border-b border-border/70 outline-none last:border-0 hover:bg-secondary/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                            selected && "bg-primary/10 text-foreground hover:bg-primary/10"
                          )}
                          {...entryHandlers(entry)}
                        >
                          <td className="min-w-0 px-4 py-3">
                            {editing ? (
                              <RenameInput
                                entry={entry}
                                draft={draft}
                                setDraft={setDraft}
                                onRenameKeyDown={onRenameKeyDown}
                                commitRename={commitRename}
                                skipBlurRef={skipBlurRef}
                              />
                            ) : (
                              <EntryName entry={entry} selected={selected} />
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                            {formatBytes(entry.size)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {formatMtime(entry.modified)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
                {fb.visibleEntries.map((entry) => {
                  const editing = editingPath === entry.path;
                  const selected = selectedEntry?.path === entry.path;
                  return (
                    <div
                      key={entry.path}
                      aria-selected={selected}
                      className={cn(
                        "group flex min-h-44 cursor-default select-none flex-col rounded-lg border bg-card p-3 outline-none transition-colors hover:border-primary/35 hover:bg-secondary/25 focus-visible:ring-2 focus-visible:ring-ring",
                        selected && "border-primary/35 bg-primary/10 hover:border-primary/35 hover:bg-primary/10"
                      )}
                      {...entryHandlers(entry)}
                    >
                      <div className="min-w-0 flex-1">
                        {editing ? (
                          <RenameInput
                            entry={entry}
                            draft={draft}
                            setDraft={setDraft}
                            onRenameKeyDown={onRenameKeyDown}
                            commitRename={commitRename}
                            skipBlurRef={skipBlurRef}
                          />
                        ) : (
                          <EntryName entry={entry} layout="grid" selected={selected} />
                        )}
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div className="truncate">{formatMtime(entry.modified) || "No modified date"}</div>
                        <div>{isDir(entry) ? "Folder" : formatBytes(entry.size) || "Unknown size"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {fb.truncated && (
              <p className="mt-3 px-3 text-xs text-muted-foreground">
                Showing the first 1000 entries. Open a subfolder to narrow the listing.
              </p>
            )}
            {!fb.showHidden && fb.hiddenCount > 0 && (
              <p className="mt-3 px-3 text-xs text-muted-foreground">
                {fb.hiddenCount} hidden {fb.hiddenCount === 1 ? "item" : "items"} not shown.
              </p>
            )}
          </div>
        )}
      </div>

      <FilePreview agentId={agentId} entry={preview} onClose={() => setPreview(null)} />

      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreate={async (name) => {
          await fb.createDir(name);
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this item?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will be permanently deleted${
                isDir(pendingDelete) ? ", along with everything inside it" : ""
              }. This cannot be undone.`
            : undefined
        }
        confirmText="Delete"
        destructive
        onConfirm={async () => {
          if (pendingDelete) await fb.remove(pendingDelete);
        }}
      />
    </div>
  );
}

const VIEW_MODES = [
  { mode: "list" as const, Icon: List, label: "List view" },
  { mode: "grid" as const, Icon: Grid2X2, label: "Grid view" },
];

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div className="inline-flex h-9 rounded-md border bg-background p-0.5" role="group" aria-label="File view">
      {VIEW_MODES.map(({ mode, Icon, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          aria-label={label}
          title={label}
          onClick={() => onChange(mode)}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded transition-colors",
            value === mode ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function ToolbarIconButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground"
    >
      {children}
    </Button>
  );
}

function SelectedActions({
  agentId,
  entry,
  onRename,
  onDelete,
}: {
  agentId: string;
  entry: FileEntry;
  onRename: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
}) {
  return (
    <div className="mr-1 flex items-center gap-1 border-r pr-2">
      <Button asChild variant="outline" size="icon" className="size-9" title="Download">
        <a
          href={isDir(entry) ? archiveUrl(agentId, entry.path) : contentUrl(agentId, entry.path, "attachment")}
          download={isDir(entry) ? `${entry.name}.tar.gz` : entry.name}
          aria-label={isDir(entry) ? `Download ${entry.name} as a .tar.gz archive` : `Download ${entry.name}`}
        >
          <Download className="h-4 w-4" />
        </a>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRename(entry)}
        className="size-9"
        aria-label={`Rename ${entry.name}`}
        title="Rename"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onDelete(entry)}
        className="size-9 hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${entry.name}`}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EntryName({
  entry,
  layout = "list",
  selected,
}: {
  entry: FileEntry;
  layout?: ViewMode;
  selected: boolean;
}) {
  const dir = isDir(entry);

  return (
    <div
      className={cn(
        "min-w-0 text-left",
        layout === "grid"
          ? "flex w-full flex-col items-start gap-3"
          : "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3"
      )}
    >
      <EntryGlyph entry={entry} large={layout === "grid"} selected={selected} />
      <span
        className={cn(
          "min-w-0 truncate",
          layout === "grid" ? "w-full text-sm" : "text-sm",
          dir ? "font-medium text-foreground" : "text-foreground",
          entry.hidden && "text-muted-foreground"
        )}
      >
        {entry.name}
      </span>
    </div>
  );
}

function EntryGlyph({ entry, large = false, selected = false }: { entry: FileEntry; large?: boolean; selected?: boolean }) {
  const dir = isDir(entry);
  const iconClassName = cn(large ? "h-7 w-7" : "h-4 w-4", "shrink-0");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        large ? "size-12" : "size-7",
        dir ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
        selected && "bg-background text-primary"
      )}
    >
      {dir ? (
        <Folder className={iconClassName} />
      ) : entry.type === "symlink" ? (
        <Link2 className={iconClassName} />
      ) : (
        <FileIcon className={iconClassName} />
      )}
    </span>
  );
}

function RenameInput({
  entry,
  draft,
  setDraft,
  onRenameKeyDown,
  commitRename,
  skipBlurRef,
}: {
  entry: FileEntry;
  draft: string;
  setDraft: (draft: string) => void;
  onRenameKeyDown: (e: KeyboardEvent<HTMLInputElement>, entry: FileEntry) => void;
  commitRename: (entry: FileEntry) => void;
  skipBlurRef: { current: boolean };
}) {
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        e.stopPropagation();
        onRenameKeyDown(e, entry);
      }}
      onBlur={() => {
        if (skipBlurRef.current) {
          skipBlurRef.current = false;
          return;
        }
        commitRename(entry);
      }}
      aria-label="File name"
      className="w-full rounded-md bg-background px-2 py-1.5 text-sm text-foreground outline-none ring-1 ring-ring"
    />
  );
}

function EmptyFolder({
  canCreate,
  uploading,
  onNewFolder,
  onUpload,
}: {
  canCreate: boolean;
  uploading: boolean;
  onNewFolder: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-lg border border-dashed bg-secondary/20 p-8 text-center">
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-md bg-background text-primary shadow-sm">
        <Folder className="h-7 w-7" />
      </span>
      <p className="text-sm font-medium text-foreground">This folder is empty.</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={onUpload} disabled={!canCreate || uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload files
        </Button>
        <Button variant="outline" size="sm" onClick={onNewFolder} disabled={!canCreate}>
          <FolderPlus className="h-4 w-4" />
          New folder
        </Button>
      </div>
    </div>
  );
}

function NewFolderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const { busy, run } = useAsyncAction();

  function submit() {
    const clean = name.trim();
    if (!clean) return;
    run(async () => {
      await onCreate(clean);
      setName("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!busy) {
          if (!o) setName("");
          onOpenChange(o);
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Folder name"
          aria-label="Folder name"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
