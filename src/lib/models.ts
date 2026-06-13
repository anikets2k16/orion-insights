export type ModelMeta = {
  name: string;
  provider: "openai" | "anthropic";
  tier: "fast" | "premium" | "reasoning";
  recommended_for: string[];
};

export const AVAILABLE_MODELS: ModelMeta[] = [
  {
    name: "gpt-4o-2024-08-06",
    provider: "openai",
    tier: "premium",
    recommended_for: ["report", "analysis"],
  },
  {
    name: "gpt-4o-mini-2024-07-18",
    provider: "openai",
    tier: "fast",
    recommended_for: ["retrieval", "clarification", "guardrail"],
  },
  {
    name: "claude-3-7-sonnet-20250219",
    provider: "anthropic",
    tier: "reasoning",
    recommended_for: ["insight", "analysis"],
  },
  {
    name: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    tier: "premium",
    recommended_for: ["analysis", "report"],
  },
  {
    name: "claude-3-haiku-20240307",
    provider: "anthropic",
    tier: "fast",
    recommended_for: ["guardrail"],
  },
];

export const AGENT_ROLES = ["retrieval", "analysis", "insight", "report"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];