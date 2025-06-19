import { Tool } from "./tool"
import DESCRIPTION from "./task.txt"
import { z } from "zod"
import { Session } from "../session"
import { Bus } from "../bus"
import { Message } from "../session/message"

export const TaskTool = Tool.define({
  id: "task",
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

    function summary(input: Message.Info) {
      const result = []

      for (const part of input.parts) {
        if (part.type === "tool-invocation") {
          result.push({
            toolInvocation: part.toolInvocation,
            metadata: input.metadata.tool[part.toolInvocation.toolCallId],
          })
        }
      }
      return result
    }

    const unsub = Bus.subscribe(Message.Event.Updated, async (evt) => {
      if (evt.properties.info.metadata.sessionID !== session.id) return
      ctx.metadata({
        title: params.description,
        summary: summary(evt.properties.info),
      })
    })

    ctx.abort.addEventListener("abort", () => {
      Session.abort(session.id)
    })
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
    unsub()
    return {
      metadata: {
        title: params.description,
        summary: summary(result),
      },
      output: result.parts.findLast((x) => x.type === "text")!.text,
    }
  },
})
