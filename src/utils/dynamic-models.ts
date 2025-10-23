/**
 * Dynamic Model Discovery
 * Fetches latest available models from LLM providers
 */

import axios from 'axios';

export interface ModelInfo {
  name: string;
  value: string;
  contextWindow?: number;
  description?: string;
}

export interface ProviderModels {
  [provider: string]: ModelInfo[];
}

/**
 * Fetch available Anthropic models from models.fyi or similar aggregator
 * Note: Anthropic doesn't provide a public /v1/models API endpoint
 * We fetch from models.fyi which aggregates model information
 */
async function fetchAnthropicModels(): Promise<ModelInfo[]> {
  try {
    // Try fetching from models.fyi (community-maintained model aggregator)
    const response = await axios.get('https://models.fyi/api/models', {
      params: {
        provider: 'anthropic',
        active: true
      },
      timeout: 3000
    });

    if (response.data?.models && Array.isArray(response.data.models)) {
      // Map response to our format
      return response.data.models
        .filter((model: any) => model.provider === 'anthropic')
        .map((model: any) => ({
          name: `${model.name} (${formatContextWindow(model.context_window || 200000)})`,
          value: model.id,
          contextWindow: model.context_window,
          description: model.description
        }))
        .sort((a: ModelInfo, b: ModelInfo) => {
          // Sort: Latest Sonnet > Latest Opus > Latest Haiku > Others
          const order = ['sonnet', 'opus', 'haiku'];
          const aType = order.findIndex(type => a.value.toLowerCase().includes(type));
          const bType = order.findIndex(type => b.value.toLowerCase().includes(type));

          if (aType !== bType) return aType - bType;

          // Within same type, sort by version (newest first)
          return b.value.localeCompare(a.value);
        });
    }
  } catch (error) {
    // API call failed, fall back to curated list
    // This is expected - models.fyi might not exist or be down
  }

  return [];
}

/**
 * Format Anthropic model ID to display name
 */
function formatAnthropicModelName(modelId: string): string {
  // claude-sonnet-4-20250514 -> Claude Sonnet 4.5
  // claude-opus-4-20250514 -> Claude Opus 4.1
  // claude-3-5-sonnet-20241022 -> Claude Sonnet 3.5

  const parts = modelId.split('-');

  if (parts[0] === 'claude') {
    let version = '';
    let family = '';

    // Detect family (sonnet, opus, haiku)
    if (parts.includes('sonnet')) {
      family = 'Sonnet';
      const versionIndex = parts.findIndex(p => !isNaN(parseInt(p)));
      if (versionIndex !== -1) {
        version = parts[versionIndex];
        // Check for minor version
        if (parts[versionIndex + 1] && !isNaN(parseInt(parts[versionIndex + 1]))) {
          version += '.' + parts[versionIndex + 1];
        }
      }
    } else if (parts.includes('opus')) {
      family = 'Opus';
      const versionIndex = parts.findIndex(p => !isNaN(parseInt(p)));
      if (versionIndex !== -1) {
        version = parts[versionIndex];
        if (parts[versionIndex + 1] && !isNaN(parseInt(parts[versionIndex + 1]))) {
          version += '.' + parts[versionIndex + 1];
        }
      }
    } else if (parts.includes('haiku')) {
      family = 'Haiku';
      const versionIndex = parts.findIndex(p => !isNaN(parseInt(p)));
      if (versionIndex !== -1) {
        version = parts[versionIndex];
        if (parts[versionIndex + 1] && !isNaN(parseInt(parts[versionIndex + 1]))) {
          version += '.' + parts[versionIndex + 1];
        }
      }
    }

    return `Claude ${family} ${version}`.trim();
  }

  // Fallback: return as-is
  return modelId;
}

/**
 * Format context window to human-readable
 */
function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M context`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K context`;
  }
  return `${tokens} tokens`;
}

/**
 * Fetch OpenAI models from API
 */
async function fetchOpenAIModels(): Promise<ModelInfo[]> {
  try {
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'dummy-key'}`
      },
      timeout: 3000
    });

    if (response.data?.data) {
      // Filter to only GPT-4+ models for code generation
      const relevantModels = response.data.data
        .filter((model: any) =>
          model.id.startsWith('gpt-4') ||
          model.id.startsWith('o1') ||
          model.id.startsWith('gpt-3.5-turbo')
        )
        .map((model: any) => ({
          name: formatOpenAIModelName(model.id),
          value: model.id
        }))
        .sort((a: ModelInfo, b: ModelInfo) => {
          // Sort: o1 > gpt-4o > gpt-4 > gpt-3.5
          const order = ['o1-preview', 'o1', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5'];
          const aIndex = order.findIndex(prefix => a.value.startsWith(prefix));
          const bIndex = order.findIndex(prefix => b.value.startsWith(prefix));

          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return b.value.localeCompare(a.value);
        });

      return relevantModels.slice(0, 5); // Top 5 most relevant
    }
  } catch (error) {
    console.error('Failed to fetch OpenAI models from API:', error instanceof Error ? error.message : error);
  }

  return [];
}

/**
 * Format OpenAI model ID to display name
 */
function formatOpenAIModelName(modelId: string): string {
  const nameMap: Record<string, string> = {
    'gpt-4o': 'GPT-4o (Best balance, 128K context)',
    'gpt-4o-mini': 'GPT-4o-mini (Faster, cheaper, 128K context)',
    'o1': 'o1 (Advanced reasoning, 200K context)',
    'o1-mini': 'o1-mini (Faster reasoning, 128K context)',
    'gpt-4-turbo': 'GPT-4 Turbo (128K context)',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo (16K context)'
  };

  return nameMap[modelId] || modelId;
}

/**
 * Fallback model lists (used when API calls fail)
 *
 * 🔄 HOW TO UPDATE ANTHROPIC MODELS:
 * 1. Check https://docs.anthropic.com/en/docs/about-claude/models
 * 2. Verify exact model IDs in Anthropic Console or API docs
 * 3. Update values below with correct model IDs
 * 4. The display names can use marketing versions (4.5, 4.1) but IDs must match API
 *
 * Last Updated: 2025-10-23
 * Note: Model IDs use YYYYMMDD date suffix, not version numbers
 */
const FALLBACK_MODELS: ProviderModels = {
  'anthropic': [
    // Sonnet 4.5 - Latest balanced model (verify date suffix from Anthropic docs)
    { name: 'Claude Sonnet 4.5 (Best balance, 200K context)', value: 'claude-sonnet-4-5-20250514' },
    // Haiku 4.5 - Latest fast model
    { name: 'Claude Haiku 4.5 (Fastest, 200K context)', value: 'claude-haiku-4-5-20250514' },
    // Opus 4.1 - Latest most capable model
    { name: 'Claude Opus 4.1 (Most capable, 200K context)', value: 'claude-opus-4-1-20250514' },
    // Sonnet 3.5 - Previous generation (stable)
    { name: 'Claude Sonnet 3.5 (Legacy, 200K context)', value: 'claude-3-5-sonnet-20241022' }
  ],
  'openai': [
    { name: 'GPT-4o (Best balance, 128K context)', value: 'gpt-4o' },
    { name: 'GPT-4o-mini (Faster, cheaper, 128K context)', value: 'gpt-4o-mini' },
    { name: 'o1 (Advanced reasoning, 200K context)', value: 'o1' },
    { name: 'o1-mini (Faster reasoning, 128K context)', value: 'o1-mini' }
  ],
  'google': [
    { name: 'Gemini 2.0 Flash Exp (Fast, 1M context)', value: 'gemini-2.0-flash-exp' },
    { name: 'Gemini 1.5 Pro (Most capable, 2M context)', value: 'gemini-1.5-pro' },
    { name: 'Gemini 1.5 Flash (Balanced, 1M context)', value: 'gemini-1.5-flash' }
  ],
  'ollama': [
    { name: 'Llama 3.3 70B (Best open model)', value: 'llama3.3:70b' },
    { name: 'Qwen 2.5 Coder 32B (Best for coding)', value: 'qwen2.5-coder:32b' },
    { name: 'DeepSeek R1 (Reasoning model)', value: 'deepseek-r1' }
  ]
};

/**
 * Get models for a provider (tries API first, falls back to hardcoded)
 */
export async function getProviderModels(provider: string): Promise<ModelInfo[]> {
  let models: ModelInfo[] = [];

  switch (provider) {
    case 'anthropic':
      models = await fetchAnthropicModels();
      break;
    case 'openai':
      models = await fetchOpenAIModels();
      break;
    case 'google':
      // Google doesn't have a public models API yet, use fallback
      break;
    case 'ollama':
      // Ollama models are local, use fallback
      break;
  }

  // If API call failed or returned empty, use fallback
  if (models.length === 0 && FALLBACK_MODELS[provider]) {
    console.log(`Using fallback models for ${provider}`);
    return FALLBACK_MODELS[provider];
  }

  return models;
}

/**
 * Get all provider models (for batch operations)
 */
export async function getAllProviderModels(): Promise<ProviderModels> {
  const providers = ['anthropic', 'openai', 'google', 'ollama'];
  const result: ProviderModels = {};

  await Promise.all(
    providers.map(async (provider) => {
      result[provider] = await getProviderModels(provider);
    })
  );

  return result;
}

/**
 * Check if a model is valid for a provider
 */
export async function isValidModel(provider: string, modelId: string): Promise<boolean> {
  const models = await getProviderModels(provider);
  return models.some(m => m.value === modelId);
}

/**
 * Get recommended model for a provider
 */
export async function getRecommendedModel(provider: string): Promise<string | null> {
  const models = await getProviderModels(provider);
  return models.length > 0 ? models[0].value : null;
}
