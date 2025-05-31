import type { Provider } from "./provider"

export const PROVIDER_DATABASE: Provider.Info[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        cost: {
          input: 3.0 / 1_000_000,
          output: 15.0 / 1_000_000,
          inputCached: 3.75 / 1_000_000,
          outputCached: 0.3 / 1_000_000,
        },
        contextWindow: 200_000,
        maxOutputTokens: 50_000,
        attachment: true,
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    models: [
      {
        id: "codex-mini-latest",
        name: "Codex Mini",
        cost: {
          input: 1.5 / 1_000_000,
          inputCached: 0.375 / 1_000_000,
          output: 6.0 / 1_000_000,
          outputCached: 0.0 / 1_000_000,
        },
        contextWindow: 200_000,
        maxOutputTokens: 100_000,
        attachment: true,
        reasoning: true,
      },
    ],
  },
  {
    id: "google",
    name: "Google",
    models: [
      {
        id: "gemini-2.5-pro-preview-03-25",
        name: "Gemini 2.5 Pro",
        cost: {
          input: 1.25 / 1_000_000,
          inputCached: 0 / 1_000_000,
          output: 10 / 1_000_000,
          outputCached: 0 / 1_000_000,
        },
        contextWindow: 1_000_000,
        maxOutputTokens: 50_000,
        attachment: true,
      },
    ],
  },
]
