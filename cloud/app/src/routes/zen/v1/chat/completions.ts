import type { APIEvent } from "@solidjs/start/server"
import { handler } from "~/util/zen"

export function POST(input: APIEvent) {
  let usage: any
  return handler(input, {
    modifyBody: (body: any) => ({
      ...body,
      stream_options: {
        include_usage: true,
      },
    }),
    setAuthHeader: (headers: Headers, apiKey: string) => {
      headers.set("authorization", `Bearer ${apiKey}`)
    },
    parseApiKey: (headers: Headers) => headers.get("authorization")?.split(" ")[1],
    onStreamPart: (chunk: string) => {
      if (!chunk.startsWith("data: ")) return

      let json
      try {
        json = JSON.parse(chunk.slice(6))
      } catch (e) {
        return
      }

      if (!json.usage) return
      usage = json.usage
    },
    getStreamUsage: () => usage,
    normalizeUsage: (usage: any) => ({
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
      cacheReadTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    }),
  })
}
