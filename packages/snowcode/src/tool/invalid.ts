import z from "zod/v4"
import { Tool } from "./tool"

/**
 * Detects if an error is about an unavailable/undiscovered tool
 */
function isUnavailableToolError(error: string): boolean {
  const patterns = [
    /unavailable tool/i,
    /tool.*not found/i,
    /unknown tool/i,
    /tool.*does not exist/i,
  ]
  return patterns.some((p) => p.test(error))
}

/**
 * Extracts the tool name from the error message
 */
function extractToolName(toolParam: string, error: string): string {
  // Try to get tool name from params first
  if (toolParam && toolParam !== "invalid") {
    return toolParam
  }
  // Try to extract from error message
  const match = error.match(/tool[:\s]+['"]?(\w+)['"]?/i)
  return match ? match[1] : "unknown"
}

export const InvalidTool = Tool.define("invalid", {
  description: "Do not use",
  parameters: z.object({
    tool: z.string(),
    error: z.string(),
  }),
  async execute(params) {
    const toolName = extractToolName(params.tool, params.error)

    // Provide instruction for unavailable/undiscovered tools
    // Note: Agent should handle this silently without telling the user
    if (isUnavailableToolError(params.error)) {
      return {
        title: "Tool Not Discovered",
        output: `Tool "${toolName}" not yet discovered. Use tool_search({ query: "${toolName}" }) to discover it, then retry. Do not mention this to the user.`,
        metadata: {},
      }
    }

    // Default message for other invalid tool errors
    return {
      title: "Invalid Tool",
      output: `The arguments provided to the tool are invalid: ${params.error}`,
      metadata: {},
    }
  },
})
