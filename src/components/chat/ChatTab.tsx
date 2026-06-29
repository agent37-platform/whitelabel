"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { agentTabPath, parseAgentTab } from "@/lib/dashboard-tabs";
import type { MergedAgent } from "@/lib/types";
import { ChatProvider } from "./ChatProvider";
import { ChatSidebar } from "./ChatSidebar";
import { ChatView } from "./ChatView";

// The native Chat tab. Mounted-but-hidden by AgentWorkspace, so it must accept the live agent list
// and target the agent in the URL (the `agentId` prop) on every call. It lays out a two-column pane
// (thread rail + conversation) with SSE streaming, attachments, model + effort pickers, and
// cancel-on-stop/unmount. Two multi-agent specifics: the composer carries an agent switcher (see
// ChatComposer), and the open thread is persisted as a `?session=` QUERY PARAM (not a path segment
// — the agent route only accepts 0–1 tab segments) via history.pushState/replaceState so refresh /
// Back / share reopen it.
export function ChatTab({
  agentId,
  agents,
}: {
  agentId: string;
  agents: MergedAgent[];
}) {
  const pathname = usePathname();
  // The Chat tab is "on screen" when the URL resolves to it. AgentWorkspace switches tabs via
  // history.pushState (which usePathname reflects), so this tracks visibility without a prop.
  const onChatTab = useMemo(
    () => parseAgentTab(pathname.split("/").filter(Boolean).slice(3)) === "chat",
    [pathname]
  );

  // The open thread rides the URL as `?session=`. Read it on mount (refresh / shared link) and on
  // Back/Forward (popstate). Initialised null then read in an effect so the server-rendered markup
  // matches the client's first paint (no hydration mismatch from reading window during render).
  const [urlSessionId, setUrlSessionId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setUrlSessionId(new URLSearchParams(window.location.search).get("session"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const chatPath = agentTabPath(agentId, "chat");
  // Write the open thread into the chat URL without adding a path segment. pushState for an explicit
  // switch (so Back returns to the previous thread); replaceState when promoting a freshly-minted
  // session or re-stamping the URL on tab return (so Back doesn't bounce through transient states).
  const navigateToSession = useCallback(
    (sessionId: string | null, mode: "push" | "replace" = "push") => {
      const url = sessionId ? `${chatPath}?session=${encodeURIComponent(sessionId)}` : chatPath;
      if (typeof window !== "undefined") {
        if (mode === "replace") window.history.replaceState(null, "", url);
        else window.history.pushState(null, "", url);
      }
      setUrlSessionId(sessionId);
    },
    [chatPath]
  );

  return (
    <ChatProvider
      agentId={agentId}
      agents={agents}
      urlSessionId={urlSessionId}
      onChatTab={onChatTab}
      navigateToSession={navigateToSession}
    >
      <div className="flex h-full min-h-0">
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
          <ChatSidebar />
        </aside>
        <div className="min-w-0 flex-1">
          <ChatView />
        </div>
      </div>
    </ChatProvider>
  );
}
