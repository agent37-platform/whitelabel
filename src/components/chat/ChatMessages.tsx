"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, FileText, Image as ImageIcon, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import type { ChatMessage, MessageAttachment, ToolEvent } from "./types";

// Files that rode along with a user turn, shown as compact chips above the message bubble.
function MessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {attachments.map((a, k) => (
        <span
          key={`${a.path}-${k}`}
          title={a.name}
          className="flex items-center gap-1.5 rounded-lg border bg-secondary/60 px-2 py-1 text-xs text-foreground"
        >
          {a.isImage ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="max-w-[12rem] truncate">{a.name}</span>
        </span>
      ))}
    </div>
  );
}

function ThinkingBlock({ content, live }: { content: string; live: boolean }) {
  const [open, setOpen] = useState(live);
  if (!content) return null;
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{live ? "Thinking…" : "Thought process"}</span>
        {live && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>
      {open && (
        <div className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
          {content}
        </div>
      )}
    </div>
  );
}

function ToolChip({ tool }: { tool: ToolEvent }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
        tool.status === "error" ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"
      )}
    >
      <Wrench className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium capitalize">{tool.tool.replace(/_/g, " ")}</span>
      {tool.label && <span className="max-w-[12rem] truncate font-mono opacity-70">{tool.label}</span>}
      {tool.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {tool.status === "completed" && <Check className="h-3.5 w-3.5" />}
      {tool.durationMs != null && <span className="ml-auto tabular-nums opacity-60">{(tool.durationMs / 1000).toFixed(1)}s</span>}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

export function ChatMessages({ messages, isStreaming }: { messages: ChatMessage[]; isStreaming: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-5 py-6">
      {messages.map((m, i) => {
        if (m.role === "user") {
          const attachments = m.attachments ?? [];
          return (
            <div key={m.id} className="flex justify-end">
              <div className="flex max-w-[85%] flex-col items-end gap-1.5">
                {attachments.length > 0 && <MessageAttachments attachments={attachments} />}
                {m.content && (
                  <div className="whitespace-pre-wrap break-words rounded-[18px] bg-secondary px-3.5 py-2 text-sm text-foreground">
                    {m.content}
                  </div>
                )}
              </div>
            </div>
          );
        }

        const lastAssistant = i === messages.length - 1 && m.role === "assistant";
        const tools = m.tools ?? [];
        const showDots =
          lastAssistant && isStreaming && !m.content && !m.thinking && !tools.some((t) => t.status === "running");

        return (
          <div key={m.id} className="flex justify-start">
            <div className="min-w-0 max-w-full">
              {m.thinking && <ThinkingBlock content={m.thinking} live={lastAssistant && isStreaming && !m.content} />}
              {tools.length > 0 && (
                <div className="mb-3 space-y-2">
                  {tools.map((t, k) => (
                    <ToolChip key={`${t.tool}-${k}`} tool={t} />
                  ))}
                </div>
              )}
              {m.content ? <Markdown content={m.content} /> : showDots ? <TypingDots /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
