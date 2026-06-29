"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Loader2, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useChatContext } from "./ChatProvider";

// The "Chats" thread rail, rendered in the chat tab's own left column. Selecting or starting a
// thread updates the chat URL (?session=) so refresh/Back/share reopen it.
export function ChatSidebar() {
  const { sessions, activeSessionId, onChatTab, loadingSessions, selectSession, startNewChat, deleteSession, renameSession } =
    useChatContext();
  // The open thread stays "active" even when you're on another tab (so its stream isn't cancelled),
  // but it should only look selected in the rail while the Chat tab is actually showing.
  const highlightedSessionId = onChatTab ? activeSessionId : null;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDelete = sessions.find((s) => s.session_id === pendingDeleteId) ?? null;

  // Inline rename: the row's label swaps to a text input. Enter (or blur) commits; Escape cancels
  // without committing — `skipBlur` suppresses the commit the resulting blur would otherwise fire.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const skipBlur = useRef(false);

  function startRename(sessionId: string, current: string | null) {
    setEditingId(sessionId);
    setDraft(current ?? "");
  }

  function commitRename(sessionId: string, current: string | null) {
    setEditingId(null);
    const next = draft.trim();
    if (next && next !== (current ?? "")) renameSession(sessionId, next);
  }

  function onRenameKeyDown(e: KeyboardEvent<HTMLInputElement>, sessionId: string, current: string | null) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(sessionId, current);
    } else if (e.key === "Escape") {
      e.preventDefault();
      skipBlur.current = true;
      setEditingId(null);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col py-3">
        <div className="flex items-center justify-between px-3 pb-1">
          <span className="text-xs font-medium text-muted-foreground">Chats</span>
          <button
            type="button"
            onClick={startNewChat}
            aria-label="New chat"
            title="New chat"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          {loadingSessions ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No chats yet.</p>
          ) : (
            <nav className="flex flex-col gap-0.5">
              {sessions.map((s) => {
                const label = s.title || "New chat";
                return (
                  <div key={s.session_id} className="group relative">
                    {editingId === s.session_id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => onRenameKeyDown(e, s.session_id, s.title)}
                        onBlur={() => {
                          if (skipBlur.current) {
                            skipBlur.current = false;
                            return;
                          }
                          commitRename(s.session_id, s.title);
                        }}
                        aria-label="Chat name"
                        className="w-full rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground outline-none ring-1 ring-ring"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => selectSession(s.session_id)}
                          onDoubleClick={() => startRename(s.session_id, s.title)}
                          className={cn(
                            "flex w-full select-none items-center gap-2 rounded-md px-3 py-1.5 pr-14 text-left text-sm transition-colors",
                            highlightedSessionId === s.session_id
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                          )}
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startRename(s.session_id, s.title)}
                          aria-label={`Rename chat ${label}`}
                          title="Rename chat"
                          className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(s.session_id)}
                          aria-label={`Delete chat ${label}`}
                          title="Delete chat"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete chat?"
        description={`Are you sure you want to delete "${pendingDelete?.title || "New chat"}"? This cannot be undone.`}
        confirmText="Delete chat"
        destructive
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          await deleteSession(pendingDeleteId);
        }}
      />
    </>
  );
}
