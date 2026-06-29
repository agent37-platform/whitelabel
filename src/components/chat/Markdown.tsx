"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";

// Streaming-aware markdown: Streamdown tolerates incomplete markdown (unclosed fences, partial
// tables) so we can feed it the running output buffer on every delta without flicker.
export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return <Streamdown className="chat-markdown text-sm leading-relaxed">{content}</Streamdown>;
});
