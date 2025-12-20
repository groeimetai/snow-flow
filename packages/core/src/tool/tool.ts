import z from "zod/v4"
import type { MessageV2 } from "../session/message-v2"

export namespace Tool {
  interface Metadata {
    [key: string]: any
  }

  export type Context<M extends Metadata = Metadata> = {
    sessionID: string
    messageID: string
    agent: string
    abort: AbortSignal
    callID?: string
    extra?: { [key: string]: any }
    metadata(input: { title?: string; metadata?: M }): void
  }
  export interface Info<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> {
    id: string
    /**
     * If true, this tool will not be loaded into the context by default.
     * Users must first discover it via tool_search, after which it becomes available.
     * This reduces token usage significantly for large tool libraries.
     *
     * @see https://www.anthropic.com/engineering/advanced-tool-use
     */
    deferred?: boolean
    /**
     * Category for grouping in tool search results
     */
    category?: string
    /**
     * Keywords for improved search matching
     */
    keywords?: string[]
    init: () => Promise<{
      description: string
      parameters: Parameters
      execute(
        args: z.infer<Parameters>,
        ctx: Context,
      ): Promise<{
        title: string
        metadata: M
        output: string
        attachments?: MessageV2.FilePart[]
      }>
    }>
  }

  export function define<Parameters extends z.ZodType, Result extends Metadata>(
    id: string,
    init: Info<Parameters, Result>["init"] | Awaited<ReturnType<Info<Parameters, Result>["init"]>>,
  ): Info<Parameters, Result> {
    return {
      id,
      init: async () => {
        if (init instanceof Function) return init()
        return init
      },
    }
  }
}
