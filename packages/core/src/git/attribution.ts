import z from "zod/v4"
import { Installation } from "../installation"

/**
 * Git Attribution Module - AI Model Attribution for Git Commits
 *
 * Provides:
 * - Model attribution in commit messages
 * - Co-authored-by formatting
 * - Commit message footer generation
 * - Multiple attribution formats
 */

export namespace GitAttribution {
  // ============================================================================
  // SCHEMAS
  // ============================================================================

  export const ModelInfo = z.object({
    providerID: z.string(),
    modelID: z.string(),
    displayName: z.string().optional(),
  })
  export type ModelInfo = z.infer<typeof ModelInfo>

  export const AttributionOptions = z.object({
    /** The AI model used */
    model: ModelInfo,
    /** Include version number */
    includeVersion: z.boolean().optional(),
    /** Include link to product */
    includeLink: z.boolean().optional(),
    /** Custom product name (defaults to "Snow-Code") */
    productName: z.string().optional(),
    /** Custom product URL */
    productUrl: z.string().optional(),
  })
  export type AttributionOptions = z.infer<typeof AttributionOptions>

  // ============================================================================
  // MODEL DISPLAY NAMES
  // ============================================================================

  /** Map provider/model IDs to human-friendly display names */
  const MODEL_DISPLAY_NAMES: Record<string, Record<string, string>> = {
    anthropic: {
      "claude-opus-4-20250514": "Claude Opus 4",
      "claude-opus-4-5-20251101": "Claude Opus 4.5",
      "claude-sonnet-4-20250514": "Claude Sonnet 4",
      "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
      "claude-3-5-sonnet-latest": "Claude 3.5 Sonnet",
      "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
      "claude-3-opus-20240229": "Claude 3 Opus",
      "claude-3-sonnet-20240229": "Claude 3 Sonnet",
      "claude-3-haiku-20240307": "Claude 3 Haiku",
    },
    openai: {
      "gpt-4o": "GPT-4o",
      "gpt-4o-mini": "GPT-4o Mini",
      "gpt-4-turbo": "GPT-4 Turbo",
      "gpt-4": "GPT-4",
      "o1-preview": "o1 Preview",
      "o1-mini": "o1 Mini",
      "o3-mini": "o3 Mini",
    },
    google: {
      "gemini-2.0-flash-exp": "Gemini 2.0 Flash",
      "gemini-1.5-pro": "Gemini 1.5 Pro",
      "gemini-1.5-flash": "Gemini 1.5 Flash",
    },
  }

  /**
   * Get human-friendly display name for a model
   */
  export function getModelDisplayName(providerID: string, modelID: string): string {
    const providerModels = MODEL_DISPLAY_NAMES[providerID]
    if (providerModels?.[modelID]) {
      return providerModels[modelID]
    }
    // Fallback: Clean up model ID
    return modelID
      .replace(/-/g, " ")
      .replace(/(\d{4})(\d{2})(\d{2})/, "") // Remove date stamps
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  // ============================================================================
  // EMAIL ADDRESSES FOR CO-AUTHORED-BY
  // ============================================================================

  /** Email addresses for AI models in Co-authored-by format */
  const MODEL_EMAILS: Record<string, string> = {
    anthropic: "noreply@anthropic.com",
    openai: "noreply@openai.com",
    google: "noreply@google.com",
    opencode: "noreply@opencode.ai",
    snowcode: "noreply@snow-flow.dev",
  }

  /**
   * Get email for a provider (for Co-authored-by)
   */
  export function getProviderEmail(providerID: string): string {
    return MODEL_EMAILS[providerID] ?? `noreply@${providerID}.ai`
  }

  // ============================================================================
  // ATTRIBUTION FORMATTING
  // ============================================================================

  /**
   * Generate a Co-Authored-By line for git commits
   *
   * @example
   * // Returns: "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
   * coAuthoredBy({ providerID: "anthropic", modelID: "claude-opus-4-5-20251101" })
   */
  export function coAuthoredBy(model: ModelInfo): string {
    const displayName = model.displayName ?? getModelDisplayName(model.providerID, model.modelID)
    const email = getProviderEmail(model.providerID)
    return `Co-Authored-By: ${displayName} <${email}>`
  }

  /**
   * Generate a Generated-by line for commit messages
   *
   * @example
   * // Returns: "Generated with [Snow-Code](https://snow-flow.dev)"
   * generatedBy({ includeLink: true })
   */
  export function generatedBy(options?: {
    productName?: string
    productUrl?: string
    includeLink?: boolean
  }): string {
    const productName = options?.productName ?? "Snow-Code"
    const productUrl = options?.productUrl ?? "https://snow-flow.dev"

    if (options?.includeLink !== false) {
      return `Generated with [${productName}](${productUrl})`
    }
    return `Generated with ${productName}`
  }

  /**
   * Generate full commit message footer with AI attribution
   *
   * @example
   * // Returns multi-line string with emoji, link, and co-author
   * commitFooter({
   *   model: { providerID: "anthropic", modelID: "claude-opus-4-5-20251101" },
   *   includeVersion: true
   * })
   */
  export function commitFooter(options: AttributionOptions): string {
    const lines: string[] = []

    // Generated by line with emoji
    const productName = options.productName ?? "Snow-Code"
    const productUrl = options.productUrl ?? "https://snow-flow.dev"

    if (options.includeLink !== false) {
      lines.push(`🤖 ${generatedBy({ productName, productUrl, includeLink: true })}`)
    } else {
      lines.push(`🤖 ${generatedBy({ productName, productUrl, includeLink: false })}`)
    }

    // Version info
    if (options.includeVersion !== false) {
      lines.push(`Version: ${Installation.VERSION}`)
    }

    // Empty line before Co-Authored-By
    lines.push("")

    // Co-Authored-By
    lines.push(coAuthoredBy(options.model))

    return lines.join("\n")
  }

  /**
   * Generate a complete commit message with summary and AI attribution
   *
   * @param summary - The commit summary (first line)
   * @param body - Optional extended description
   * @param options - Attribution options
   */
  export function formatCommitMessage(
    summary: string,
    body: string | undefined,
    options: AttributionOptions
  ): string {
    const parts: string[] = [summary]

    if (body) {
      parts.push("") // Empty line
      parts.push(body)
    }

    parts.push("") // Empty line before footer
    parts.push(commitFooter(options))

    return parts.join("\n")
  }

  // ============================================================================
  // COMPACT FORMATS
  // ============================================================================

  /**
   * Generate a compact one-line attribution
   *
   * @example
   * // Returns: "[Snow-Code + Claude Opus 4.5]"
   * compactAttribution({ providerID: "anthropic", modelID: "claude-opus-4-5-20251101" })
   */
  export function compactAttribution(model: ModelInfo, productName = "Snow-Code"): string {
    const displayName = model.displayName ?? getModelDisplayName(model.providerID, model.modelID)
    return `[${productName} + ${displayName}]`
  }

  /**
   * Generate model tag for inline use
   *
   * @example
   * // Returns: "[ai:claude-opus-4.5]"
   * modelTag({ providerID: "anthropic", modelID: "claude-opus-4-5-20251101" })
   */
  export function modelTag(model: ModelInfo): string {
    const shortName = (model.displayName ?? getModelDisplayName(model.providerID, model.modelID))
      .toLowerCase()
      .replace(/\s+/g, "-")
    return `[ai:${shortName}]`
  }

  // ============================================================================
  // TRAILERS
  // ============================================================================

  /**
   * Generate git trailer format for automation
   *
   * @example
   * // Returns:
   * // "AI-Model: anthropic/claude-opus-4-5-20251101"
   * // "AI-Tool: Snow-Code/1.0.0"
   * gitTrailers(model)
   */
  export function gitTrailers(model: ModelInfo, productName = "Snow-Code"): string[] {
    return [
      `AI-Model: ${model.providerID}/${model.modelID}`,
      `AI-Tool: ${productName}/${Installation.VERSION}`,
    ]
  }

  /**
   * Parse git trailers from a commit message
   */
  export function parseTrailers(message: string): { model?: ModelInfo; tool?: string } {
    const result: { model?: ModelInfo; tool?: string } = {}

    const modelMatch = message.match(/AI-Model:\s*([^/]+)\/(.+)$/m)
    if (modelMatch) {
      result.model = {
        providerID: modelMatch[1],
        modelID: modelMatch[2],
      }
    }

    const toolMatch = message.match(/AI-Tool:\s*(.+)$/m)
    if (toolMatch) {
      result.tool = toolMatch[1]
    }

    return result
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Check if a commit message already has AI attribution
   */
  export function hasAttribution(message: string): boolean {
    return (
      message.includes("Co-Authored-By:") ||
      message.includes("Generated with") ||
      message.includes("AI-Model:") ||
      message.includes("[ai:")
    )
  }

  /**
   * Strip existing AI attribution from a message
   */
  export function stripAttribution(message: string): string {
    return message
      .replace(/\n?🤖.*$/gm, "")
      .replace(/\n?Generated with.*$/gm, "")
      .replace(/\n?Co-Authored-By:.*$/gm, "")
      .replace(/\n?AI-Model:.*$/gm, "")
      .replace(/\n?AI-Tool:.*$/gm, "")
      .replace(/\n?Version:.*$/gm, "")
      .replace(/\[ai:[^\]]+\]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
}
