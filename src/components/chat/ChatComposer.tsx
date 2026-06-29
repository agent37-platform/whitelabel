"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachButton, AttachmentTray } from "./Attachments";
import { EffortMenu } from "./EffortMenu";
import { ModelMenu } from "./ModelMenu";
import type { ChatAttachments } from "./useChatAttachments";
import { useChatModels } from "./useChatModels";
import { findModel, prettyModelLabel, type ChatSettings } from "./types";
import type { SendSettings } from "./useChat";

interface Props {
  agentId: string;
  isStreaming: boolean;
  // Attachment state is owned by ChatView (so the whole pane is a drop zone) and passed in.
  att: ChatAttachments;
  onSend: (text: string, settings: SendSettings) => void;
  onStop: () => void;
  // Prominent welcome-state composer (vs the compact docked composer).
  large?: boolean;
  focusToken?: number;
}

export function ChatComposer({ agentId, isStreaming, att, onSend, onStop, large = false, focusToken = 0 }: Props) {
  const [text, setText] = useState("");
  // model + provider are always chosen together (one selection); effort is independent. Group
  // them as the composer's outgoing ChatSettings so send is just `{ ...settings, files }`.
  const [settings, setSettings] = useState<ChatSettings>({ model: null, provider: null, reasoningEffort: null });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { groups, defaultModel, loading } = useChatModels(agentId);

  useEffect(() => {
    if (focusToken === 0) return;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusToken]);

  // The model switcher is a persistent control, shown once the instance reports at least one model
  // (the older metered gateway exposes a single "default"; current builds expose the full catalog).
  // It stays hidden until the list resolves and hides if the call returns nothing (e.g. fetch
  // failed) — the agent default still runs, and there's no appear-then-vanish flicker. Every group
  // carries at least one model (useChatModels only creates a group when it has one), so a non-empty
  // `groups` is exactly "has models".
  const defaultLabel = useMemo(() => {
    const def = findModel(groups, defaultModel);
    return def ? prettyModelLabel(def.label) : loading ? "Loading…" : "Default";
  }, [groups, defaultModel, loading]);

  const canSend = (text.trim().length > 0 || att.hasFiles) && !att.blocksSend && !isStreaming;

  const grow = (el: HTMLTextAreaElement) => {
    const minHeight = large ? 76 : 44;
    const maxHeight = large ? 180 : 160;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, maxHeight))}px`;
  };

  const submit = () => {
    if (isStreaming) return;
    const trimmed = text.trim();
    if ((!trimmed && !att.hasFiles) || att.blocksSend) return;
    const attachments = att.takeAttachments();
    onSend(trimmed, { ...settings, files: attachments.map((a) => a.path), attachments });
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={cn(
        "mx-auto w-full rounded-[20px] border border-border/80 bg-card shadow-[0_8px_30px_rgb(15_23_42_/_0.06)] transition-[border-color,box-shadow] focus-within:border-ring/50 focus-within:shadow-[0_10px_34px_rgb(15_23_42_/_0.1)]",
        large ? "max-w-2xl" : "max-w-3xl"
      )}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          grow(e.target);
        }}
        onKeyDown={onKeyDown}
        onPaste={att.handlePaste}
        rows={1}
        placeholder="Ask anything..."
        className={cn(
          "w-full resize-none bg-transparent px-5 pb-2 pt-4 text-foreground placeholder:text-muted-foreground focus:outline-none",
          large ? "min-h-[76px] max-h-[180px] text-[15px] leading-6" : "min-h-[44px] max-h-[160px] text-sm leading-relaxed"
        )}
      />
      <AttachmentTray files={att.files} onRemove={att.removeFile} onRetry={att.retryFile} />
      <div className="flex items-center gap-2 px-3 pb-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <AttachButton onFiles={att.addFiles} disabled={isStreaming} />
          {groups.length > 0 && (
            <ModelMenu
              groups={groups}
              model={settings.model}
              defaultModel={defaultModel}
              defaultLabel={defaultLabel}
              disabled={isStreaming}
              onChange={(model, provider) => setSettings((s) => ({ ...s, model, provider }))}
            />
          )}
          <EffortMenu
            value={settings.reasoningEffort}
            disabled={isStreaming}
            onChange={(reasoningEffort) => setSettings((s) => ({ ...s, reasoningEffort }))}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop response"
              title="Stop response"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80"
            >
              <Square className="h-3 w-3" fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              title="Send message"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              {att.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
