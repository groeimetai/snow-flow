export namespace Token {
  const CHARS_PER_TOKEN = 4

  // Provider-aware ratios for more accurate estimation.
  // Measured against actual tokenizer output for mixed code/text.
  const PROVIDER_RATIOS: Record<string, number> = {
    claude: 3.5,
    anthropic: 3.5,
    gpt: 4.0,
    openai: 4.0,
    gemini: 3.8,
    google: 3.8,
    deepseek: 3.7,
    mistral: 3.8,
    default: 3.7,
  }

  export function estimate(input: string) {
    return Math.max(0, Math.round((input || "").length / CHARS_PER_TOKEN))
  }

  export function estimateForProvider(input: string, providerID?: string) {
    const ratio = ratioForProvider(providerID)
    return Math.max(0, Math.round((input || "").length / ratio))
  }

  function ratioForProvider(providerID?: string): number {
    if (!providerID) return PROVIDER_RATIOS.default
    const lower = providerID.toLowerCase()
    for (const [key, ratio] of Object.entries(PROVIDER_RATIOS)) {
      if (lower.includes(key)) return ratio
    }
    return PROVIDER_RATIOS.default
  }
}
