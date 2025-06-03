import path from "path"
import { App } from "../app/app"
import { Identifier } from "../id/id"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  tool,
  type Tool as AITool,
  type LanguageModelUsage,
} from "ai"
import { z, ZodSchema } from "zod"
import { Decimal } from "decimal.js"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_TITLE from "./prompt/title.txt"
import PROMPT_SUMMARIZE from "./prompt/summarize.txt"
import PROMPT_INITIALIZE from "../session/prompt/initialize.txt"

import { Share } from "../share/share"
import { Message } from "./message"
import { Bus } from "../bus"
import { Provider } from "../provider/provider"
import { SessionContext } from "./context"
import { ListTool } from "../tool/ls"

export namespace Session {
  const log = Log.create({ service: "session" })

  export const Info = z
    .object({
      id: Identifier.schema("session"),
      share: z
        .object({
          secret: z.string(),
          url: z.string(),
        })
        .optional(),
      title: z.string(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .openapi({
      ref: "session.info",
    })
  export type Info = z.output<typeof Info>

  export const Event = {
    Updated: Bus.event(
      "session.updated",
      z.object({
        info: Info,
      }),
    ),
  }

  const state = App.state("session", () => {
    const sessions = new Map<string, Info>()
    const messages = new Map<string, Message.Info[]>()

    return {
      sessions,
      messages,
    }
  })

  export async function create() {
    const result: Info = {
      id: Identifier.descending("session"),
      title: "New Session - " + new Date().toISOString(),
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    }
    log.info("created", result)
    state().sessions.set(result.id, result)
    await Storage.writeJSON("session/info/" + result.id, result)
    share(result.id).then((share) => {
      update(result.id, (draft) => {
        draft.share = share
      })
    })
    Bus.publish(Event.Updated, {
      info: result,
    })
    return result
  }

  export async function get(id: string) {
    const result = state().sessions.get(id)
    if (result) {
      return result
    }
    const read = await Storage.readJSON<Info>("session/info/" + id)
    state().sessions.set(id, read)
    return read as Info
  }

  export async function share(id: string) {
    const session = await get(id)
    if (session.share) return session.share
    const share = await Share.create(id)
    await update(id, (draft) => {
      draft.share = share
    })
    for (const msg of await messages(id)) {
      await Share.sync("session/message/" + id + "/" + msg.id, msg)
    }
    return share
  }

  export async function update(id: string, editor: (session: Info) => void) {
    const { sessions } = state()
    const session = await get(id)
    if (!session) return
    editor(session)
    session.time.updated = Date.now()
    sessions.set(id, session)
    await Storage.writeJSON("session/info/" + id, session)
    Bus.publish(Event.Updated, {
      info: session,
    })
    return session
  }

  export async function messages(sessionID: string) {
    const result = [] as Message.Info[]
    const list = Storage.list("session/message/" + sessionID)
    for await (const p of list) {
      const read = await Storage.readJSON<Message.Info>(p).catch(() => {})
      if (!read) continue
      result.push(read)
    }
    result.sort((a, b) => (a.id > b.id ? 1 : -1))
    return result
  }

  export async function* list() {
    for await (const item of Storage.list("session/info")) {
      const sessionID = path.basename(item, ".json")
      yield get(sessionID)
    }
  }

  export function abort(sessionID: string) {
    const controller = pending.get(sessionID)
    if (!controller) return false
    controller.abort()
    pending.delete(sessionID)
    return true
  }

  async function updateMessage(msg: Message.Info) {
    await Storage.writeJSON(
      "session/message/" + msg.metadata.sessionID + "/" + msg.id,
      msg,
    )
    Bus.publish(Message.Event.Updated, {
      info: msg,
    })
  }

  export async function chat(input: {
    sessionID: string
    providerID: string
    modelID: string
    parts: Message.Part[]
  }) {
    const l = log.clone().tag("session", input.sessionID)
    l.info("chatting")
    const model = await Provider.getModel(input.providerID, input.modelID)
    let msgs = await messages(input.sessionID)
    const previous = msgs.at(-1)
    if (previous?.metadata.assistant) {
      const tokens =
        previous.metadata.assistant.tokens.input +
        previous.metadata.assistant.tokens.output
      if (
        tokens >
        (model.info.contextWindow - (model.info.maxOutputTokens ?? 0)) * 0.9
      ) {
        await summarize({
          sessionID: input.sessionID,
          providerID: input.providerID,
          modelID: input.modelID,
        })
        return chat(input)
      }
    }

    using abort = lock(input.sessionID)

    const lastSummary = msgs.findLast(
      (msg) => msg.metadata.assistant?.summary === true,
    )
    if (lastSummary)
      msgs = msgs.filter(
        (msg) => msg.role === "system" || msg.id >= lastSummary.id,
      )

    if (msgs.length === 0) {
      const app = App.info()
      const system: Message.Info = {
        id: Identifier.ascending("message"),
        role: "system",
        parts: [
          {
            type: "text",
            text: PROMPT_ANTHROPIC,
          },
          {
            type: "text",
            text: `Here is some useful information about the environment you are running in:
<env>
Working directory: ${app.path.cwd}
Is directory a git repo: ${app.git ? "yes" : "no"}
Platform: ${process.platform}
Today's date: ${new Date().toISOString()}
</env>
<project>
${app.git ? await ListTool.execute({ path: app.path.cwd }, { sessionID: input.sessionID }).then((x) => x.output) : ""}
</project>
            `,
          },
        ],
        metadata: {
          sessionID: input.sessionID,
          time: {
            created: Date.now(),
          },
          tool: {},
        },
      }
      const context = await SessionContext.find()
      if (context) {
        system.parts.push({
          type: "text",
          text: context,
        })
      }
      msgs.push(system)
      generateText({
        messages: convertToModelMessages([
          {
            role: "system",
            parts: [
              {
                type: "text",
                text: PROMPT_TITLE,
              },
            ],
          },
          {
            role: "user",
            parts: input.parts,
          },
        ]),
        model: model.language,
      }).then((result) => {
        return Session.update(input.sessionID, (draft) => {
          draft.title = result.text
        })
      })
      await updateMessage(system)
    }
    const msg: Message.Info = {
      role: "user",
      id: Identifier.ascending("message"),
      parts: input.parts,
      metadata: {
        time: {
          created: Date.now(),
        },
        sessionID: input.sessionID,
        tool: {},
      },
    }
    await updateMessage(msg)
    msgs.push(msg)

    const next: Message.Info = {
      id: Identifier.ascending("message"),
      role: "assistant",
      parts: [],
      metadata: {
        assistant: {
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
          },
          modelID: input.modelID,
          providerID: input.providerID,
        },
        time: {
          created: Date.now(),
        },
        sessionID: input.sessionID,
        tool: {},
      },
    }
    await updateMessage(next)
    const tools: Record<string, AITool> = {}
    for (const item of await Provider.tools(input.providerID)) {
      tools[item.id.replaceAll(".", "_")] = tool({
        id: item.id as any,
        description: item.description,
        parameters: item.parameters as ZodSchema,
        async execute(args, opts) {
          const start = Date.now()
          try {
            const result = await item.execute(args, {
              sessionID: input.sessionID,
            })
            next.metadata!.tool![opts.toolCallId] = {
              ...result.metadata,
              time: {
                start,
                end: Date.now(),
              },
            }
            return result.output
          } catch (e: any) {
            next.metadata!.tool![opts.toolCallId] = {
              error: true,
              message: e.toString(),
              time: {
                start,
                end: Date.now(),
              },
            }
            return e.toString()
          }
        },
      })
    }
    const result = streamText({
      onStepFinish: async (step) => {
        const assistant = next.metadata!.assistant!
        const usage = getUsage(step.usage, model.info)
        assistant.cost = usage.cost
        assistant.tokens = usage.tokens
        await updateMessage(next)
      },
      abortSignal: abort.signal,
      maxRetries: 6,
      stopWhen: stepCountIs(1000),
      messages: convertToModelMessages(msgs),
      temperature: 0,
      tools,
      model: model.language,
    })
    let text: Message.TextPart | undefined
    const reader = result.toUIMessageStream().getReader()
    while (true) {
      const result = await reader.read().catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") {
          return
        }
        throw e
      })
      if (!result) break
      const { done, value } = result
      if (done) break
      l.info("part", {
        type: value.type,
      })
      switch (value.type) {
        case "start":
          break
        case "start-step":
          text = undefined
          next.parts.push({
            type: "step-start",
          })
          break
        case "text":
          if (!text) {
            text = value
            next.parts.push(value)
            break
          }
          text.text += value.text
          break

        case "tool-call":
          next.parts.push({
            type: "tool-invocation",
            toolInvocation: {
              state: "call",
              ...value,
              // hack until zod v4
              args: value.args as any,
            },
          })
          break

        case "tool-result":
          const match = next.parts.find(
            (p) =>
              p.type === "tool-invocation" &&
              p.toolInvocation.toolCallId === value.toolCallId,
          )
          if (match && match.type === "tool-invocation") {
            match.toolInvocation = {
              args: match.toolInvocation.args,
              toolCallId: match.toolInvocation.toolCallId,
              toolName: match.toolInvocation.toolName,
              state: "result",
              result: value.result as string,
            }
          }
          break

        case "finish":
          break
        case "finish-step":
          break
        case "error":
          log.error("error", value)
          break

        default:
          l.info("unhandled", {
            type: value.type,
          })
      }
      await updateMessage(next)
    }
    next.metadata!.time.completed = Date.now()
    await updateMessage(next)
    return next
  }

  export async function summarize(input: {
    sessionID: string
    providerID: string
    modelID: string
  }) {
    using abort = lock(input.sessionID)
    const msgs = await messages(input.sessionID)
    const lastSummary = msgs.findLast(
      (msg) => msg.metadata.assistant?.summary === true,
    )?.id
    const filtered = msgs.filter(
      (msg) => msg.role !== "system" && (!lastSummary || msg.id >= lastSummary),
    )
    const model = await Provider.getModel(input.providerID, input.modelID)
    const next: Message.Info = {
      id: Identifier.ascending("message"),
      role: "assistant",
      parts: [],
      metadata: {
        tool: {},
        sessionID: input.sessionID,
        assistant: {
          summary: true,
          cost: 0,
          modelID: input.modelID,
          providerID: input.providerID,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
          },
        },
        time: {
          created: Date.now(),
        },
      },
    }
    await updateMessage(next)
    const result = await generateText({
      abortSignal: abort.signal,
      model: model.language,
      messages: convertToModelMessages([
        {
          role: "system",
          parts: [
            {
              type: "text",
              text: PROMPT_SUMMARIZE,
            },
          ],
        },
        ...filtered,
        {
          role: "user",
          parts: [
            {
              type: "text",
              text: "Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.",
            },
          ],
        },
      ]),
    })
    next.parts.push({
      type: "text",
      text: result.text,
    })
    const assistant = next.metadata!.assistant!
    const usage = getUsage(result.usage, model.info)
    assistant.cost = usage.cost
    assistant.tokens = usage.tokens
    await updateMessage(next)
  }

  const pending = new Map<string, AbortController>()
  function lock(sessionID: string) {
    log.info("locking", { sessionID })
    if (pending.has(sessionID)) throw new BusyError(sessionID)
    const controller = new AbortController()
    pending.set(sessionID, controller)
    return {
      signal: controller.signal,
      [Symbol.dispose]() {
        log.info("unlocking", { sessionID })
        pending.delete(sessionID)
      },
    }
  }

  function getUsage(usage: LanguageModelUsage, model: Provider.Model) {
    const tokens = {
      input: usage.inputTokens ?? 0,
      output: usage.outputTokens ?? 0,
      reasoning: usage.reasoningTokens ?? 0,
    }
    return {
      cost: new Decimal(0)
        .add(new Decimal(tokens.input).mul(model.cost.input))
        .add(new Decimal(tokens.output).mul(model.cost.output))
        .toNumber(),
      tokens,
    }
  }

  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`)
    }
  }

  export async function initialize(input: {
    sessionID: string
    modelID: string
    providerID: string
  }) {
    await Session.chat({
      sessionID: input.sessionID,
      providerID: input.providerID,
      modelID: input.modelID,
      parts: [
        {
          type: "text",
          text: PROMPT_INITIALIZE,
        },
      ],
    })
  }
}
