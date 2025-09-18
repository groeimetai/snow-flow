import { z } from "zod/v4"

export type ToolContext = {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
}

export function tool<Args extends z.ZodRawShape>(
  input: (zod: typeof z) => {
    description: string
    args: Args
    execute: (args: z.infer<z.ZodObject<Args>>, ctx: ToolContext) => Promise<string>
  },
) {
  return input(z)
}

export type ToolDefinition = ReturnType<typeof tool>
