export type Role = "admin";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceWithRole extends Workspace {
  role: Role;
}

export interface WorkspaceMember {
  user_id: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Invitation {
  token: string;
  workspace_id: string;
  role: Role;
  created_at: string;
  expires_at: string;
}

export interface AgentRow {
  agent37_id: string;
  workspace_id: string;
  name: string | null;
  status: string | null;
  template: string | null;
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  created_by: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  status: string;
  status_reason: {
    code: string;
    message: string;
    operation: string;
    at: number;
  } | null;
  template: string;
  image_ref: string;
  resources: { cpu: number; memory: number; disk: number };
  ports: { port: number; default: boolean; url: string }[];
  user: string | null;
  name: string | null;
  metadata: Record<string, unknown> | null;
  paid_through: number | null;
  past_due: boolean;
  created: number | null;
}

export interface Template {
  name: string;
  scope: "system" | "workspace";
  image_ref: string;
  agents: string[];
  description: string;
  ports: { port: number; default: boolean }[];
  created: number | null;
  updated: number | null;
}

export interface Budget {
  monthly_cap_micros: number;
  monthly_consumed_micros: number;
  monthly_remaining_micros: number;
  monthly_period: string;
  topup_remaining_micros: number;
  updated_at: number | null;
}

export interface Usage {
  period: string;
  total_micros: number;
  by_integration: {
    llm: { cost_micros: number; calls: number; input_tokens: number; output_tokens: number };
    brave: { cost_micros: number; calls: number };
    composio: { cost_micros: number; calls: number };
  };
}

export interface MergedAgent extends AgentRow {
  live_status: string | null;
  status_reason: Agent["status_reason"];
  past_due: boolean;
  ports: Agent["ports"];
  update_available: boolean;
}
