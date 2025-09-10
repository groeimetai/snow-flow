import type { APIEvent } from "@solidjs/start/server"
import { handler } from "~/util/zen"

export function POST(input: APIEvent) {
  let usage: any
  return handler(input, {
    setAuthHeader: (headers: Headers, apiKey: string) => {
      headers.set("authorization", `Bearer ${apiKey}`)
    },
    parseApiKey: (headers: Headers) => headers.get("authorization")?.split(" ")[1],
    onStreamPart: (chunk: string) => {
      const [event, data] = chunk.split("\n")
      if (event !== "event: response.completed") return
      if (!data.startsWith("data: ")) return

      let json
      try {
        json = JSON.parse(data.slice(6))
      } catch (e) {
        return
      }

      if (!json.response?.usage) return
      usage = json.response.usage
    },
    getStreamUsage: () => usage,
    normalizeUsage: (usage: any) => {
      const inputTokens = usage.input_tokens ?? 0
      const outputTokens = usage.output_tokens ?? 0
      const reasoningTokens = usage.output_tokens_details?.reasoning_tokens ?? 0
      const cacheReadTokens = usage.input_tokens_details?.cached_tokens ?? 0
      return {
        inputTokens: inputTokens - cacheReadTokens,
        outputTokens: outputTokens - reasoningTokens,
        reasoningTokens,
        cacheReadTokens,
      }
    },
  })
}
