import { ConfigMarkdown } from "@/config/markdown"
import { Config } from "../config/config"
import { MCP } from "../mcp"
import { UI } from "./ui"

/**
 * Helper to detect AbortError even after serialization (e.g., via SSE/JSON)
 * The instanceof check fails for serialized errors, so we also use duck typing
 */
function isAbortError(input: unknown): boolean {
  // Direct instanceof check for proper DOMException
  if (input instanceof DOMException && input.name === "AbortError") {
    return true
  }

  // Duck typing for serialized/reconstructed errors
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>
    // Check for AbortError name
    if (obj.name === "AbortError") return true
    // Check for common abort-related messages
    if (typeof obj.message === "string") {
      const msg = obj.message.toLowerCase()
      if (msg.includes("aborted") || msg.includes("the operation was aborted")) {
        return true
      }
    }
  }

  return false
}

export function FormatError(input: unknown) {
  // AbortError means user cancelled (ESC key) - return empty string to suppress output
  if (isAbortError(input)) {
    return ""
  }

  if (MCP.Failed.isInstance(input))
    return `MCP server "${input.data.name}" failed. Note, snow-code does not support MCP authentication yet.`
  if (Config.JsonError.isInstance(input)) {
    return (
      `Config file at ${input.data.path} is not valid JSON(C)` +
      (input.data.message ? `: ${input.data.message}` : "")
    )
  }
  if (Config.ConfigDirectoryTypoError.isInstance(input)) {
    return `Directory "${input.data.dir}" in ${input.data.path} is not valid. Use "${input.data.suggestion}" instead. This is a common typo.`
  }
  if (ConfigMarkdown.FrontmatterError.isInstance(input)) {
    return `Failed to parse frontmatter in ${input.data.path}:\n${input.data.message}`
  }
  if (Config.InvalidError.isInstance(input))
    return [
      `Config file at ${input.data.path} is invalid` +
        (input.data.message ? `: ${input.data.message}` : ""),
      ...(input.data.issues?.map((issue) => "↳ " + issue.message + " " + issue.path.join(".")) ??
        []),
    ].join("\n")

  if (UI.CancelledError.isInstance(input)) return ""
}
