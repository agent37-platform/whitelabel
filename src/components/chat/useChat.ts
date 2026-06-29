"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, readApiError } from "@/lib/api";
import type { SessionDetail } from "@/lib/types";
import { uid, type ChatMessage, type ChatSettings, type MessageAttachment, type ToolEvent, type ToolStatus } from "./types";

export interface SendSettings extends Partial<ChatSettings> {
  files?: string[];
  // Display metadata for the same files (name/path/isImage) — rendered as chips in the user bubble.
  attachments?: MessageAttachment[];
}

interface UseChatArgs {
  agentId: string;
  sessionId: string | null;
  // Called once when a brand-new conversation mints its session id mid-stream. The provider
  // persists it (records the rail row) and promotes it to the active thread.
  onSessionCreated: (sessionId: string, title: string) => void;
  // Called when an existing thread gets a new turn, so the rail can bubble it to the top.
  onActivity?: (sessionId: string) => void;
}

// Parse a fetch SSE stream into (event, data) pairs. Handles CRLF, multi-line data, and
// `:keepalive` comment lines. There is no [DONE] sentinel — the stream just ends.
async function readSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        let event = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (!line || line.startsWith(":")) continue; // blank or keepalive comment
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;

        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
        } catch {
          data = {};
        }
        onEvent(event, data);
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// Mark the most recent running tool of a given name as completed/failed.
function closeTool(tools: ToolEvent[] | undefined, name: string | undefined, status: ToolStatus, durationMs?: number): ToolEvent[] {
  const next = [...(tools ?? [])];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].tool === name && next[i].status === "running") {
      next[i] = { ...next[i], status, durationMs };
      return next;
    }
  }
  return next;
}

export function useChat({ agentId, sessionId, onSessionCreated, onActivity }: UseChatArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const responseIdRef = useRef<string | null>(null);
  const activeSessionRef = useRef<string | null>(sessionId);
  // Set just before we promote a freshly-created session, so the load effect doesn't clobber
  // the in-flight stream with a history fetch when `sessionId` flips to the new id.
  const skipLoadRef = useRef<string | null>(null);

  // Cancel a turn upstream so the agent actually stops working — dropping the local SSE alone
  // does NOT stop server-side generation (only the cancel endpoint does).
  const cancelUpstream = useCallback(
    (rid: string | null) => {
      if (rid) apiFetch(`/api/agents/${agentId}/chat/responses/${rid}/cancel`, { method: "POST" }).catch(() => {});
    },
    [agentId]
  );

  // Load history when the selected thread changes; reset for a fresh chat.
  useEffect(() => {
    activeSessionRef.current = sessionId;

    // `null` is both skipLoadRef's "unset" sentinel AND the New Chat sessionId; guard against
    // null so the New Chat transition (sessionId -> null) is NOT swallowed here and falls
    // through to clear messages + abort the stream below.
    if (skipLoadRef.current !== null && skipLoadRef.current === sessionId) {
      skipLoadRef.current = null;
      return; // we just created this session mid-stream — keep the live messages
    }

    // Switching threads / starting a new chat stops the in-flight stream, locally AND upstream.
    const prevRid = responseIdRef.current;
    abortRef.current?.abort();
    cancelUpstream(prevRid);
    setError(null);
    setIsStreaming(false); // clean state on every switch (the aborted send's finally also fires)

    if (!sessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingHistory(true);
    apiFetch<SessionDetail>(`/api/agents/${agentId}/chat/sessions/${sessionId}`)
      .then((res) => {
        if (cancelled) return;
        setMessages(
          (res.history ?? []).map((h) => ({
            id: h.id || uid("h"),
            role: h.role,
            content: h.content ?? "",
            thinking: h.thinking,
          }))
        );
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, sessionId, cancelUpstream]);

  const send = useCallback(
    async (text: string, settings: SendSettings = {}) => {
      const trimmed = text.trim();
      const files = settings.files ?? [];
      if ((!trimmed && files.length === 0) || isStreaming) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: uid("u"),
        role: "user",
        content: trimmed,
        attachments: settings.attachments?.length ? settings.attachments : undefined,
      };
      const assistant: ChatMessage = { id: uid("a"), role: "assistant", content: "", tools: [] };
      setMessages((prev) => [...prev, userMsg, assistant]);
      setIsStreaming(true);

      const abort = new AbortController();
      abortRef.current = abort;
      responseIdRef.current = null;
      const wasNewChat = !activeSessionRef.current;
      // Bubble an existing thread to the top of the rail as soon as it gets a new turn.
      if (!wasNewChat && activeSessionRef.current) onActivity?.(activeSessionRef.current);

      // The assistant message is the last one appended above and nothing else is pushed during
      // the turn, so patch it in place by index — no per-token array scan to find it by id.
      const patchAssistant = (fn: (m: ChatMessage) => ChatMessage) => {
        setMessages((prev) => {
          const last = prev.length - 1;
          if (last < 0 || prev[last].id !== assistant.id) return prev;
          const next = [...prev];
          next[last] = fn(next[last]);
          return next;
        });
      };

      // Mark any still-running tools as completed — covers dropped/unpaired completed events
      // (e.g. a malformed event with no `tool` name) so spinners can't hang after the turn ends.
      const finalizeTools = () =>
        patchAssistant((m) => ({
          ...m,
          tools: (m.tools ?? []).map((t) => (t.status === "running" ? { ...t, status: "completed" as const } : t)),
        }));

      let streamError: string | null = null;

      try {
        const res = await fetch(`/api/agents/${agentId}/chat/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: trimmed,
            session_id: activeSessionRef.current ?? undefined,
            model: settings.model ?? undefined,
            provider: settings.provider ?? undefined,
            reasoning_effort: settings.reasoningEffort ?? undefined,
            files: files.length ? files : undefined,
          }),
          signal: abort.signal,
        });

        if (!res.ok || !res.body) {
          // A 409 means the previous turn is still wrapping up (session busy) — soften it. The
          // status carries the semantics, so we don't have to match the error text.
          if (res.status === 409) {
            throw new Error("Your agent is still finishing the previous message. Give it a moment and try again.");
          }
          throw new Error(await readApiError(res, "Chat failed"));
        }

        await readSSE(
          res.body,
          (event, data) => {
            switch (event) {
              case "response.created": {
                responseIdRef.current = str(data.id) ?? null;
                const newSession = str(data.session_id);
                if (wasNewChat && newSession) {
                  activeSessionRef.current = newSession;
                  skipLoadRef.current = newSession;
                  onSessionCreated(newSession, trimmed.slice(0, 80));
                }
                break;
              }
              case "response.reasoning.delta": {
                const t = str(data.text);
                if (t) patchAssistant((m) => ({ ...m, thinking: (m.thinking ?? "") + t }));
                break;
              }
              case "response.output_text.delta": {
                const t = str(data.text);
                if (t) patchAssistant((m) => ({ ...m, content: m.content + t }));
                break;
              }
              case "response.tool_call.started":
                patchAssistant((m) => ({
                  ...m,
                  tools: [...(m.tools ?? []), { tool: str(data.tool) ?? "tool", status: "running", label: str(data.label) }],
                }));
                break;
              case "response.tool_call.completed":
                patchAssistant((m) => ({
                  ...m,
                  tools: closeTool(m.tools, str(data.tool) ?? "tool", "completed", typeof data.duration_ms === "number" ? data.duration_ms : undefined),
                }));
                break;
              case "response.tool_call.failed":
                patchAssistant((m) => ({ ...m, tools: closeTool(m.tools, str(data.tool) ?? "tool", "error") }));
                break;
              case "response.completed": {
                const final = str(data.output_text);
                if (final) patchAssistant((m) => ({ ...m, content: final }));
                break;
              }
              case "response.failed": {
                const err = data.error as { message?: string } | undefined;
                streamError = err?.message || "The agent failed to respond.";
                break;
              }
            }
          },
          abort.signal
        );

        finalizeTools(); // single sweep once the stream ends — covers terminal events and a bare stream-end alike

        if (streamError) {
          setError(streamError);
          patchAssistant((m) => ({
            ...m,
            content: m.content || `_${streamError}_`,
          }));
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message || "Something went wrong.");
        }
      } finally {
        setIsStreaming(false);
        if (abortRef.current === abort) abortRef.current = null;
        responseIdRef.current = null;
      }
    },
    [agentId, isStreaming, onSessionCreated, onActivity]
  );

  // Stop the current turn: abort the local stream and cancel it upstream so the agent stops work.
  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    cancelUpstream(responseIdRef.current);
  }, [cancelUpstream]);

  // Stop any stream when the hook unmounts — locally and upstream (no orphaned billable compute).
  useEffect(
    () => () => {
      abortRef.current?.abort();
      cancelUpstream(responseIdRef.current);
    },
    [cancelUpstream]
  );

  return { messages, isStreaming, loadingHistory, error, send, stop };
}
