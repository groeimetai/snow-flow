import { Provider } from "@/provider/provider"
import { fn } from "@/util/fn"
import z from "zod"
import { Session } from "."
import { MessageV2 } from "./message-v2"
import { Log } from "@/util/log"
import { Bus } from "@/bus"
import { LLM } from "./llm"
import { Agent } from "@/agent/agent"

export namespace SessionSuggestion {
  const log = Log.create({ service: "session.suggestion" })

  export const generate = fn(
    z.object({ sessionID: z.string() }),
    async (input) => {
      const messages = await Session.messages({ sessionID: input.sessionID })
      if (messages.length === 0) return

      const recent = messages.slice(-5)
      const context = recent
        .flatMap((m) => m.parts)
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n---\n")

      if (!context.trim()) return

      const lastUser = messages.findLast((m) => m.info.role === "user")
      if (!lastUser || lastUser.info.role !== "user") return
      const userInfo = lastUser.info

      const agent = await Agent.get("suggestion")
      if (!agent) return

      const model = agent.model
        ? await Provider.getModel(agent.model.providerID, agent.model.modelID)
        : ((await Provider.getSmallModel(userInfo.model.providerID)) ??
          (await Provider.getModel(userInfo.model.providerID, userInfo.model.modelID)))

      const stream = await LLM.stream({
        agent,
        user: userInfo,
        tools: {},
        model,
        small: true,
        messages: [
          {
            role: "user" as const,
            content: `Recent conversation:\n${context}`,
          },
        ],
        abort: new AbortController().signal,
        sessionID: input.sessionID,
        system: [],
        retries: 2,
      })

      const result = (await stream.text).trim()
      if (!result) return

      log.info("suggestion", { sessionID: input.sessionID, suggestion: result })

      Bus.publish(Session.Event.Suggestion, {
        sessionID: input.sessionID,
        suggestion: result,
      })
    },
  )
}
