export interface Shape {
  label: string;
  cpu: number;
  memory: number;
  diskMin: number;
  diskMax: number;
}

export const SHAPE_PRESETS: Shape[] = [
  { label: "Small · 1 vCPU / 3 GB", cpu: 1, memory: 3, diskMin: 6, diskMax: 20 },
  { label: "Standard · 2 vCPU / 4 GB", cpu: 2, memory: 4, diskMin: 6, diskMax: 20 },
  { label: "Pro · 4 vCPU / 8 GB", cpu: 4, memory: 8, diskMin: 20, diskMax: 40 },
  { label: "Max · 8 vCPU / 16 GB", cpu: 8, memory: 16, diskMin: 40, diskMax: 80 },
];

export const DEFAULT_AGENT = {
  template: "agent37-hermes",
  cpu: 2,
  memory: 4,
  disk: 6,
  monthlyCapUsd: 5,
} as const;

export interface AgentTypeOption {
  id: string;
  template: string;
  label: string;
  description: string;
  recommended?: boolean;
}

// The agent types offered on the create screen. This is the curated catalog —
// branded cards, in your control. To offer your own custom image, publish + register
// it (see template/release.sh) and uncomment the "custom" entry below, matching its
// `template` to the TEMPLATE_NAME in template/release.sh.
export const AGENT_TYPES: AgentTypeOption[] = [
  {
    id: "hermes",
    template: "agent37-hermes",
    label: "Hermes",
    description: "General agent: chat, browsing, code, files.",
    recommended: true,
  },
  {
    id: "openclaw",
    template: "agent37-openclaw",
    label: "OpenClaw",
    description: "General agent: headless browser, code, files.",
  },
  // {
  //   id: "custom",
  //   template: "your-template-name", // must match TEMPLATE_NAME in template/release.sh
  //   label: "My Agent",
  //   description: "Your own image and model.",
  // },
];

export const AGENT_TEMPLATES = AGENT_TYPES.map((a) => a.template);

// Labels for the "open in new tab" buttons. Ports come from the live instance
// (instance.ports), never this map — this only prettifies known port numbers; any
// unrecognized port falls back to "Port {n}". Covers stock Hermes/OpenClaw and the
// remapped ports a custom workspace template uses (it can't reuse the reserved
// 3737/7681/8080/9119, so template/release.sh declares 3738/7682/9120/8081).
export const PORT_LABELS: Record<number, string> = {
  9119: "Dashboard",
  7681: "Terminal",
  8080: "Files",
  18789: "OpenClaw",
  9120: "Dashboard",
  7682: "Terminal",
  8081: "Files",
  3738: "Gateway",
};
