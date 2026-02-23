/**
 * Dynamic LLM Models Utility
 *
 * Provides dynamic listing of available LLM models from various providers.
 * This module fetches model information from provider APIs when possible.
 */

export interface ModelInfo {
  name: string
  value: string
  contextWindow?: number
  description?: string
}

// Static model definitions as fallback
const ANTHROPIC_MODELS: ModelInfo[] = [
  { name: "Claude 3.5 Sonnet", value: "anthropic/claude-3-5-sonnet-20241022", contextWindow: 200000 },
  { name: "Claude 3.5 Haiku", value: "anthropic/claude-3-5-haiku-20241022", contextWindow: 200000 },
  { name: "Claude 3 Opus", value: "anthropic/claude-3-opus-20240229", contextWindow: 200000 },
  { name: "Claude 3 Sonnet", value: "anthropic/claude-3-sonnet-20240229", contextWindow: 200000 },
  { name: "Claude 3 Haiku", value: "anthropic/claude-3-haiku-20240307", contextWindow: 200000 },
]

const OPENAI_MODELS: ModelInfo[] = [
  { name: "GPT-4 Turbo", value: "openai/gpt-4-turbo", contextWindow: 128000 },
  { name: "GPT-4o", value: "openai/gpt-4o", contextWindow: 128000 },
  { name: "GPT-4o Mini", value: "openai/gpt-4o-mini", contextWindow: 128000 },
  { name: "GPT-4", value: "openai/gpt-4", contextWindow: 8192 },
  { name: "GPT-3.5 Turbo", value: "openai/gpt-3.5-turbo", contextWindow: 16385 },
]

const GOOGLE_MODELS: ModelInfo[] = [
  { name: "Gemini 1.5 Pro", value: "google/gemini-1.5-pro", contextWindow: 1000000 },
  { name: "Gemini 1.5 Flash", value: "google/gemini-1.5-flash", contextWindow: 1000000 },
  { name: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash", contextWindow: 1000000 },
]

const OLLAMA_MODELS: ModelInfo[] = [
  { name: "Llama 3.1 70B", value: "ollama/llama3.1:70b", contextWindow: 128000 },
  { name: "Llama 3.1 8B", value: "ollama/llama3.1:8b", contextWindow: 128000 },
  { name: "Llama 3.2 3B", value: "ollama/llama3.2:3b", contextWindow: 128000 },
  { name: "Mistral 7B", value: "ollama/mistral:7b", contextWindow: 32000 },
  { name: "CodeLlama 34B", value: "ollama/codellama:34b", contextWindow: 16000 },
  { name: "Qwen 2.5 Coder 32B", value: "ollama/qwen2.5-coder:32b", contextWindow: 128000 },
]

const PROVIDER_MODELS: Record<string, ModelInfo[]> = {
  anthropic: ANTHROPIC_MODELS,
  openai: OPENAI_MODELS,
  google: GOOGLE_MODELS,
  ollama: OLLAMA_MODELS,
}

/**
 * Get models for a specific provider
 * @param provider - Provider name (anthropic, openai, google, ollama)
 * @returns Array of model information
 */
export async function getProviderModels(provider: string): Promise<ModelInfo[]> {
  const normalizedProvider = provider.toLowerCase()

  // For Ollama, try to fetch from local API
  if (normalizedProvider === "ollama") {
    try {
      const response = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(2000),
      })

      if (response.ok) {
        const data = (await response.json()) as { models?: Array<{ name: string }> }
        if (data.models && Array.isArray(data.models)) {
          return data.models.map((model: { name: string }) => ({
            name: model.name,
            value: `ollama/${model.name}`,
          }))
        }
      }
    } catch {
      // Fall back to static list
    }
  }

  return PROVIDER_MODELS[normalizedProvider] || []
}

/**
 * Get all models from all providers
 * @returns Object mapping provider names to their models
 */
export async function getAllProviderModels(): Promise<Record<string, ModelInfo[]>> {
  const providers = ["anthropic", "openai", "google", "ollama"]
  const result: Record<string, ModelInfo[]> = {}

  await Promise.all(
    providers.map(async (provider) => {
      result[provider] = await getProviderModels(provider)
    }),
  )

  return result
}
