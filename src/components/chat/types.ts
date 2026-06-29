// Shared client-side types for the web Chat tab.

export type ToolStatus = "running" | "completed" | "error";

export interface ToolEvent {
  tool: string;
  status: ToolStatus;
  label?: string;
  durationMs?: number;
}

// A file that rode along with a user turn, shown as a chip in the sent message bubble.
// `path` is the instance path passed to the turn's `files`; `name` is the original filename.
export interface MessageAttachment {
  name: string;
  path: string;
  isImage: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  tools?: ToolEvent[];
  attachments?: MessageAttachment[];
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
}

export interface ModelGroup {
  provider: string;
  models: ModelOption[];
}

// Case-insensitive provider equality. The gateway reports default_provider with different casing
// than the per-model provider (e.g. "custom:Agent37" vs "custom:agent37"), so matching a model to
// the default — or to the (model, provider) selection — must compare loosely.
export function sameProvider(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

// Find a model across the provider groups (null id => agent default => no match). When a provider
// is given it must match too (case-insensitively) — distinct providers can expose the same model
// id, so id alone is not a unique selector.
export function findModel(
  groups: ModelGroup[],
  id: string | null,
  provider?: string | null
): ModelOption | undefined {
  if (!id) return undefined;
  for (const g of groups) {
    const m = g.models.find((m) => m.id === id && (provider == null || sameProvider(m.provider, provider)));
    if (m) return m;
  }
  return undefined;
}

// Human-friendly provider names for the model menu's section headers. The metered gateway
// reports `custom:agent37`; BYO / multi-model agents report bare slugs like `anthropic` / `openai`.
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  "google-vertex": "Google Vertex",
  xai: "xAI",
  mistral: "Mistral",
  meta: "Meta",
  deepseek: "DeepSeek",
  cohere: "Cohere",
  groq: "Groq",
  perplexity: "Perplexity",
  openrouter: "OpenRouter",
  azure: "Azure",
  bedrock: "Bedrock",
};

// Pretty section label for a provider id: drop any `custom:` prefix and title-case the rest
// (so `custom:agent37` -> "Agent37"); known providers keep their canonical casing (OpenAI, xAI…).
export function prettyProvider(provider: string): string {
  const key = provider.replace(/^custom:/i, "").toLowerCase();
  if (PROVIDER_LABELS[key]) return PROVIDER_LABELS[key];
  const titled = key
    .split(/[\s_/-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  return titled || "Custom";
}

// The metered gateway labels its single model "default"; surface it as "Default". Real model
// labels ("Claude Sonnet 4.5", "GPT-5.2") are already display-ready and pass through unchanged.
export function prettyModelLabel(label: string): string {
  return label.toLowerCase() === "default" ? "Default" : label;
}

// Agent37's reasoning_effort enum (POST /v1/responses). null => use the agent's default.
export const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const REASONING_LABELS: Record<ReasoningEffort, string> = {
  none: "None",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "X-High",
};

// Composer selection. null fields mean "use the agent default" (param omitted on send).
export interface ChatSettings {
  model: string | null;
  provider: string | null;
  reasoningEffort: ReasoningEffort | null;
}

let counter = 0;
// Monotonic-ish client id for optimistic messages / pending files.
export function uid(prefix = "c"): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

// One conversation in the Chat tab's thread rail. The Agent37 Agents API (GET /v1/sessions) is
// the source of truth for the list + ordering; the sessions route resolves `title` as the
// server-side title (when set, e.g. via rename) or the session's first-message preview.
export interface ChatSession {
  session_id: string;
  title: string | null;
}
