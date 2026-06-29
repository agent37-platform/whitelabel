"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { ModelsResponse } from "@/lib/types";
import type { ModelGroup, ModelOption } from "./types";

export interface ChatModelsState {
  groups: ModelGroup[];
  defaultModel: string | null;
  loading: boolean;
}

// Loads the agent's available models (GET /v1/models) and groups them by provider for the
// composer's model switcher. Failures degrade to an empty list (the agent default still runs).
export function useChatModels(agentId: string): ChatModelsState {
  const [state, setState] = useState<ChatModelsState>({
    groups: [],
    defaultModel: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    apiFetch<ModelsResponse>(`/api/agents/${agentId}/chat/models`)
      .then((res) => {
        if (cancelled) return;
        const byProvider = new Map<string, ModelOption[]>();
        for (const m of res.data ?? []) {
          // Current builds report the provider slug as `owned_by`; the older metered build used
          // `provider`. Group + send whichever the instance provides.
          const provider = m.owned_by ?? m.provider ?? "model";
          const arr = byProvider.get(provider) ?? [];
          arr.push({ id: m.id, label: m.label, provider });
          byProvider.set(provider, arr);
        }
        // Prefer the explicit default; fall back to whichever model is flagged is_default.
        const defaultModel = res.default_model ?? (res.data ?? []).find((m) => m.is_default)?.id ?? null;
        const groups = [...byProvider.entries()].map(([provider, models]) => ({ provider, models }));
        // Open the menu on the default model's provider: float the group that owns it to the top.
        if (defaultModel) {
          groups.sort((a, b) => {
            const aHas = a.models.some((m) => m.id === defaultModel) ? 0 : 1;
            const bHas = b.models.some((m) => m.id === defaultModel) ? 0 : 1;
            return aHas - bHas;
          });
        }
        setState({ groups, defaultModel, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return state;
}
