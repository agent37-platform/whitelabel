import "server-only";
import type { Agent, Budget, Template, Usage } from "@/lib/types";

const BASE = (process.env.AGENT37_API_BASE_URL || "https://api.agent37.com").replace(/\/$/, "");

export class Agent37Error extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "Agent37Error";
    this.status = status;
    this.code = code;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.AGENT37_API_KEY;
  if (!key) {
    throw new Agent37Error(500, "config_error", "AGENT37_API_KEY is not set on the server");
  }

  const res = await fetch(`${BASE}/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const body = (data ?? {}) as { code?: string; message?: string };
    let message = body.message || res.statusText;
    if (res.status === 402) {
      // Almost always an unfunded wallet at create/start time — point the operator at billing.
      message = `${message} (Agent37 payment required — fund your wallet under Cloud → Billing in the dashboard, then retry.)`;
    }
    throw new Agent37Error(res.status, body.code || "error", message);
  }

  return data as T;
}

export interface CreateAgentInput {
  template?: string;
  resources?: { cpu?: number; memory?: number; disk?: number };
  user?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  budget?: { monthly_cap_micros?: number; topup_micros?: number };
}

export interface ResizeInput {
  cpu?: number;
  memory?: number;
  disk?: number;
}

export const agent37 = {
  listAgents: () => call<{ data: Agent[] }>("/instances"),
  getAgent: (id: string) => call<Agent>(`/instances/${id}`),
  createAgent: (body: CreateAgentInput) =>
    call<Agent>("/instances", { method: "POST", body: JSON.stringify(body) }),
  deleteAgent: (id: string) =>
    call<{ id: string; deleted: boolean }>(`/instances/${id}`, { method: "DELETE" }),

  start: (id: string) => call<{ id: string; status: string }>(`/instances/${id}/start`, { method: "POST" }),
  stop: (id: string) => call<{ id: string; status: string }>(`/instances/${id}/stop`, { method: "POST" }),
  restart: (id: string) => call<{ id: string; status: string }>(`/instances/${id}/restart`, { method: "POST" }),
  update: (id: string) =>
    call<{ id: string; status: string; image_ref: string }>(`/instances/${id}/update`, { method: "POST" }),
  resize: (id: string, body: ResizeInput) =>
    call<{ id: string; status: string; resources: { cpu: number; memory: number; disk: number } }>(
      `/instances/${id}/resize`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  signedUrl: (id: string, port: number, ttlSeconds?: number) =>
    call<{ url: string; port: number; expires_at: number }>(`/instances/${id}/signed-url`, {
      method: "POST",
      body: JSON.stringify({ port, ...(ttlSeconds ? { ttl_seconds: ttlSeconds } : {}) }),
    }),

  getBudget: (id: string) => call<Budget>(`/instances/${id}/budget`),
  getUsage: (id: string, month?: string) =>
    call<Usage>(`/instances/${id}/usage${month ? `?month=${encodeURIComponent(month)}` : ""}`),

  listTemplates: () => call<{ data: Template[] }>("/templates"),
};
