"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { MergedAgent } from "@/lib/types";
import { type ChatSession } from "./types";

interface ChatContextValue {
  agentId: string;
  // The workspace's agent list, threaded down so the composer's agent switcher can list them.
  agents: MergedAgent[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  // Whether the Chat tab is the one on screen. The open thread is kept active even off-tab (so its
  // stream survives a tab switch), so consumers gate "is this thread being viewed" UI on this.
  onChatTab: boolean;
  composerFocusToken: number;
  // Ping the composer to refocus its textarea (e.g. after an attachment lands).
  requestComposerFocus: () => void;
  loadingSessions: boolean;
  selectSession: (sessionId: string | null) => void;
  startNewChat: () => void;
  onSessionCreated: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  // Rename a thread (server-side via PATCH). Optimistic; rolls back + toasts if the build
  // doesn't support titles. Resolves whether it succeeded so callers can react if needed.
  renameSession: (sessionId: string, title: string) => Promise<void>;
  // Move a thread to the top of the rail on new activity (most-recently-used first).
  bumpSession: (sessionId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within a ChatProvider");
  return ctx;
}

// Holds the thread rail + the active selection, shared by the sidebar rail and the conversation
// pane. The rail comes straight from the Agent37 Agents API (GET /v1/sessions) — there is no local
// sessions table. Each row's label (server-side title, else the first-message preview) is resolved
// by the sessions route, so the rail paints in one fetch with no per-session hydration.
export function ChatProvider({
  agentId,
  agents,
  urlSessionId,
  onChatTab,
  navigateToSession,
  children,
}: {
  agentId: string;
  agents: MergedAgent[];
  // The open thread's id, taken from the URL (?session=) — null for a new chat. The URL is the
  // source of truth so refresh, Back/Forward, and shared links all reopen the same thread.
  urlSessionId: string | null;
  // Whether the Chat tab is the one on screen. We only adopt the URL's thread while on Chat, so
  // visiting another tab never drops the open thread or cancels its in-flight stream.
  onChatTab: boolean;
  // Writes the chat URL (?session=). Selecting/clearing a thread navigates; activeSessionId follows.
  navigateToSession: (sessionId: string | null, mode?: "push" | "replace") => void;
  children: ReactNode;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(urlSessionId);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Adopt the thread from the URL whenever it changes — a rail click, Back/Forward, or a refresh.
  // Done during render (React's "adjust state when a prop changes" pattern) so there's no extra
  // paint. We always track the URL, but only adopt it into the open thread while the Chat tab is
  // showing, so leaving to another tab keeps the open thread (and its in-flight stream) mounted
  // rather than resetting it.
  const [syncedUrlSessionId, setSyncedUrlSessionId] = useState<string | null>(urlSessionId);
  if (urlSessionId !== syncedUrlSessionId) {
    setSyncedUrlSessionId(urlSessionId);
    if (onChatTab) setActiveSessionId(urlSessionId);
  }

  // Tab switches (handled by the shell) rewrite the path WITHOUT the ?session= query, so on the
  // way back to Chat the open thread lives only in memory. Re-stamp the URL with the open thread
  // when Chat becomes visible again, so a refresh/share from here reopens the same thread.
  useEffect(() => {
    if (onChatTab && activeSessionId && urlSessionId !== activeSessionId) {
      navigateToSession(activeSessionId, "replace");
    }
    // Only react to tab-visibility flips; activeSessionId changes already drive the URL elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChatTab]);

  // Load the rail from upstream — labels and ordering arrive ready from the sessions route.
  useEffect(() => {
    let cancelled = false;

    apiFetch<{ sessions: ChatSession[] }>(`/api/agents/${agentId}/chat/sessions`)
      .then((res) => {
        if (!cancelled) setSessions(res.sessions);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const requestComposerFocus = useCallback(() => setComposerFocusToken((n) => n + 1), []);

  const selectSession = useCallback(
    (sessionId: string | null) => {
      navigateToSession(sessionId);
      requestComposerFocus();
    },
    [navigateToSession, requestComposerFocus]
  );

  const startNewChat = useCallback(() => {
    navigateToSession(null);
    requestComposerFocus();
  }, [navigateToSession, requestComposerFocus]);

  // Point the open thread at a session. While the Chat tab is showing this rides the URL (so
  // Back/Forward and refresh stay in sync); off-tab we set it directly so we don't yank the user's
  // URL back to chat or cancel an in-flight stream they've stepped away from.
  const setOpenThread = useCallback(
    (sessionId: string | null, mode: "push" | "replace" = "push") => {
      if (onChatTab) navigateToSession(sessionId, mode);
      else setActiveSessionId(sessionId);
    },
    [onChatTab, navigateToSession]
  );

  // A brand-new conversation just minted its session id mid-stream. We already have its first
  // message (the label), so add the rail row locally and promote it — no write-back: the session
  // already exists upstream and will reappear from GET /v1/sessions on the next load.
  const onSessionCreated = useCallback(
    (sessionId: string, title: string) => {
      // Give the freshly-minted thread its own URL (replace, so Back doesn't return to the blank
      // new-chat URL); off-tab it's adopted silently.
      setOpenThread(sessionId, "replace");
      setSessions((prev) =>
        prev.some((s) => s.session_id === sessionId)
          ? prev
          : [{ session_id: sessionId, title: title.trim().slice(0, 80) || null }, ...prev]
      );
    },
    [setOpenThread]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const removed = sessions.find((x) => x.session_id === sessionId);
      const wasActive = activeSessionId === sessionId;
      setSessions((s) => s.filter((x) => x.session_id !== sessionId)); // optimistic, functional
      // Deleting the open thread falls back to a new chat (the rail can delete the active thread
      // from any tab, so off-tab this stays silent rather than yanking the user's URL).
      if (wasActive) setOpenThread(null);
      try {
        await apiFetch(`/api/agents/${agentId}/chat/sessions/${sessionId}`, { method: "DELETE" });
      } catch (e) {
        // Functional rollback: re-insert only the removed row (preserving any threads added
        // concurrently) and restore the open thread.
        if (removed) setSessions((s) => (s.some((x) => x.session_id === sessionId) ? s : [removed, ...s]));
        if (wasActive) setOpenThread(sessionId);
        toast.error((e as Error).message || "Couldn't delete that chat.");
      }
    },
    [agentId, activeSessionId, sessions, setOpenThread]
  );

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      const next = title.trim().slice(0, 200);
      const prev = sessions.find((s) => s.session_id === sessionId)?.title ?? null;
      if (!next || next === prev) return;
      setSessions((s) => s.map((x) => (x.session_id === sessionId ? { ...x, title: next } : x))); // optimistic
      try {
        await apiFetch(`/api/agents/${agentId}/chat/sessions/${sessionId}`, {
          method: "PATCH",
          body: JSON.stringify({ title: next }),
        });
      } catch (e) {
        setSessions((s) => s.map((x) => (x.session_id === sessionId ? { ...x, title: prev } : x))); // rollback
        toast.error((e as Error).message || "Couldn't rename that chat.");
      }
    },
    [agentId, sessions]
  );

  // Move a thread to the top of the rail on new activity. Upstream ordering (last_active) only
  // refreshes on reload, so keep the most-recently-used thread first in the meantime.
  const bumpSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.session_id === sessionId);
      if (idx <= 0) return prev; // not present, or already at the top
      return [prev[idx], ...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      agentId,
      agents,
      sessions,
      activeSessionId,
      onChatTab,
      composerFocusToken,
      requestComposerFocus,
      loadingSessions,
      selectSession,
      startNewChat,
      onSessionCreated,
      deleteSession,
      renameSession,
      bumpSession,
    }),
    [agentId, agents, sessions, activeSessionId, onChatTab, composerFocusToken, requestComposerFocus, loadingSessions, selectSession, startNewChat, onSessionCreated, deleteSession, renameSession, bumpSession]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
