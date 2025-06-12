import { Tool } from "./tool"
import DESCRIPTION from "./task.txt"
import { z } from "zod"
import { Session } from "../session"

export const TaskTool = Tool.define({
  id: "opencode.task",
  description: DESCRIPTION,
  parameters: z.object({
    description: z
      .string()
      .describe("A short (3-5 words) description of the task"),
    prompt: z.string().describe("The task for the agent to perform"),
  }),
  async execute(params, ctx) {
    const session = await Session.create(ctx.sessionID)
    const msg = await Session.getMessage(ctx.sessionID, ctx.messageID)
    const metadata = msg.metadata.assistant!

    const result = await Session.chat({
      sessionID: session.id,
      modelID: metadata.modelID,
      providerID: metadata.providerID,
      parts: [
        {
          type: "text",
          text: params.prompt,
        },
      ],
    })

    return {
      metadata: {
        title: params.description,
      },
      output: result.parts.findLast((x) => x.type === "text")!.text,
    }
  },
})
