import { Decimal } from "decimal.js"
import z from "zod/v4"
import { type LanguageModelUsage, type ProviderMetadata } from "ai"

import PROMPT_INITIALIZE from "../session/prompt/initialize.txt"

import { Bus } from "../bus"
import { Config } from "../config/config"
import { Flag } from "../flag/flag"
import { Identifier } from "../id/id"
import { Installation } from "../installation"
import type { ModelsDev } from "../provider/models"
import { Share } from "../share/share"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import { MessageV2 } from "./message-v2"
import { Project } from "../project/project"
import { Instance } from "../project/instance"
import { SessionPrompt } from "./prompt"
import { fn } from "@/util/fn"
import { Snapshot } from "@/snapshot"
import { CommandHook } from "../hooks"

export namespace Session {
  const log = Log.create({ service: "session" })

  const parentSessionTitlePrefix = "New session - "
  const childSessionTitlePrefix = "Child session - "

  function createDefaultTitle(isChild = false) {
    return (isChild ? childSessionTitlePrefix : parentSessionTitlePrefix) + new Date().toISOString()
  }

  export const Info = z
    .object({
      id: Identifier.schema("session"),
      projectID: z.string(),
      directory: z.string(),
      parentID: Identifier.schema("session").optional(),
      summary: z
        .object({
          diffs: Snapshot.FileDiff.array(),
        })
        .optional(),
      share: z
        .object({
          url: z.string(),
        })
        .optional(),
      title: z.string(),
      version: z.string(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
        compacting: z.number().optional(),
      }),
      revert: z
        .object({
          messageID: z.string(),
          partID: z.string().optional(),
          snapshot: z.string().optional(),
          diff: z.string().optional(),
        })
        .optional(),
    })
    .meta({
      ref: "Session",
    })
  export type Info = z.output<typeof Info>

  export const ShareInfo = z
    .object({
      secret: z.string(),
      url: z.string(),
    })
    .meta({
      ref: "SessionShare",
    })
  export type ShareInfo = z.output<typeof ShareInfo>

  export const Event = {
    Started: Bus.event(
      "session.started",
      z.object({
        info: Info,
      }),
    ),
    Updated: Bus.event(
      "session.updated",
      z.object({
        info: Info,
      }),
    ),
    Deleted: Bus.event(
      "session.deleted",
      z.object({
        info: Info,
      }),
    ),
    Error: Bus.event(
      "session.error",
      z.object({
        sessionID: z.string().optional(),
        error: MessageV2.Assistant.shape.error,
      }),
    ),
  }

  export const create = fn(
    z
      .object({
        parentID: Identifier.schema("session").optional(),
        title: z.string().optional(),
      })
      .optional() as any,
    async (input) => {
      return createNext({
        parentID: input?.parentID,
        directory: Instance.directory,
        title: input?.title,
      })
    },
  )

  export const fork = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
    }) as any,
    async (input) => {
      const session = await createNext({
        directory: Instance.directory,
      })
      const msgs = (await messages(input.sessionID)) as MessageV2.WithParts[]
      for (const msg of msgs) {
        if (input.messageID && msg.info.id >= input.messageID) break
        const cloned = (await updateMessage({
          ...msg.info,
          sessionID: session.id,
          id: Identifier.ascending("message"),
        })) as MessageV2.Info

        for (const part of msg.parts) {
          await updatePart({
            ...part,
            id: Identifier.ascending("part"),
            messageID: cloned.id,
            sessionID: session.id,
          })
        }
      }
      return session
    },
  )

  export const touch = fn(Identifier.schema("session") as any, async (sessionID) => {
    await update(sessionID, (draft) => {
      draft.time.updated = Date.now()
    })
  })

  export async function createNext(input: { id?: string; title?: string; parentID?: string; directory: string }) {
    const result: Info = {
      id: Identifier.descending("session", input.id),
      version: Installation.VERSION,
      projectID: Instance.project.id,
      directory: input.directory,
      parentID: input.parentID,
      title: input.title ?? createDefaultTitle(!!input.parentID),
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    }
    log.info("created", result)
    await Storage.write(["session", Instance.project.id, result.id], result)
    Bus.publish(Event.Started, {
      info: result,
    })

    // Execute SessionStart shell command hooks
    CommandHook.sessionStart(result.id, {
      projectDir: input.directory,
    }).catch((err) => {
      log.warn("SessionStart hook failed", { error: err.message })
    })
    const cfg = await Config.get()
    if (!result.parentID && (Flag.SNOWCODE_AUTO_SHARE || cfg.share === "auto"))
      share(result.id)
        .then((share: { url: string; secret?: string }) => {
          update(result.id, (draft) => {
            draft.share = { url: share.url }
          })
        })
        .catch(() => {
          // Silently ignore sharing errors during session creation
        })
    Bus.publish(Event.Updated, {
      info: result,
    })
    return result
  }

  export const get = fn(Identifier.schema("session") as any, async (id) => {
    const read = await Storage.read<Info>(["session", Instance.project.id, id])
    return read as Info
  })

  export const getShare = fn(Identifier.schema("session") as any, async (id) => {
    return Storage.read<ShareInfo>(["share", id])
  })

  export const share = fn(Identifier.schema("session") as any, async (id) => {
    const cfg = await Config.get()
    if (cfg.share === "disabled") {
      throw new Error("Sharing is disabled in configuration")
    }

    const session = (await get(id)) as Info
    if (session.share) return session.share
    const share = await Share.create(id)
    await update(id, (draft) => {
      draft.share = {
        url: share.url,
      }
    })
    await Storage.write(["share", id], share)
    await Share.sync("session/info/" + id, session)
    for (const msg of (await messages(id)) as MessageV2.WithParts[]) {
      await Share.sync("session/message/" + id + "/" + msg.info.id, msg.info)
      for (const part of msg.parts) {
        await Share.sync("session/part/" + id + "/" + msg.info.id + "/" + part.id, part)
      }
    }
    return share
  })

  export const unshare = fn(Identifier.schema("session") as any, async (id) => {
    const share = (await getShare(id)) as ShareInfo | undefined
    if (!share) return
    await Storage.remove(["share", id])
    await update(id, (draft) => {
      draft.share = undefined
    })
    await Share.remove(id, share.secret)
  })

  export async function update(id: string, editor: (session: Info) => void) {
    const project = Instance.project
    const result = await Storage.update<Info>(["session", project.id, id], (draft) => {
      editor(draft)
      draft.time.updated = Date.now()
    })
    Bus.publish(Event.Updated, {
      info: result,
    })
    return result
  }

  export const messages = fn(Identifier.schema("session") as any, async (sessionID) => {
    const result = [] as MessageV2.WithParts[]
    for (const p of await Storage.list(["message", sessionID])) {
      const read = await Storage.read<MessageV2.Info>(p)
      result.push({
        info: read,
        parts: (await getParts(read.id)) as MessageV2.Part[],
      })
    }
    result.sort((a, b) => (a.info.id > b.info.id ? 1 : -1))
    return result
  })

  export const getMessage = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }) as any,
    async (input) => {
      return {
        info: await Storage.read<MessageV2.Info>(["message", input.sessionID, input.messageID]),
        parts: await getParts(input.messageID),
      }
    },
  )

  export const getParts = fn(Identifier.schema("message") as any, async (messageID) => {
    const result = [] as MessageV2.Part[]
    for (const item of await Storage.list(["part", messageID])) {
      const read = await Storage.read<MessageV2.Part>(item)
      result.push(read)
    }
    result.sort((a, b) => (a.id > b.id ? 1 : -1))
    return result
  })

  export async function* list() {
    const project = Instance.project
    for (const item of await Storage.list(["session", project.id])) {
      yield Storage.read<Info>(item)
    }
  }

  export const children = fn(Identifier.schema("session") as any, async (parentID) => {
    const project = Instance.project
    const result = [] as Session.Info[]
    for (const item of await Storage.list(["session", project.id])) {
      const session = await Storage.read<Info>(item)
      if (session.parentID !== parentID) continue
      result.push(session)
    }
    return result
  })

  export const remove = fn(Identifier.schema("session") as any, async (sessionID) => {
    const project = Instance.project
    try {
      const session = (await get(sessionID)) as Info
      for (const child of (await children(sessionID)) as Info[]) {
        await remove(child.id)
      }
      await unshare(sessionID).catch(() => {})
      for (const msg of await Storage.list(["message", sessionID])) {
        for (const part of await Storage.list(["part", msg.at(-1)!])) {
          await Storage.remove(part)
        }
        await Storage.remove(msg)
      }
      await Storage.remove(["session", project.id, sessionID])
      Bus.publish(Event.Deleted, {
        info: session,
      })

      // Execute SessionEnd shell command hooks
      CommandHook.sessionEnd(sessionID, {
        projectDir: session.directory,
      }).catch((err) => {
        log.warn("SessionEnd hook failed", { error: err.message })
      })
    } catch (e) {
      log.error(e)
    }
  })

  export const updateMessage = fn(MessageV2.Info as any, async (msg) => {
    await Storage.write(["message", msg.sessionID, msg.id], msg)
    Bus.publish(MessageV2.Event.Updated, {
      info: msg,
    })
    return msg
  })

  export const removeMessage = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }) as any,
    async (input) => {
      await Storage.remove(["message", input.sessionID, input.messageID])
      Bus.publish(MessageV2.Event.Removed, {
        sessionID: input.sessionID,
        messageID: input.messageID,
      })
      return input.messageID
    },
  )

  const UpdatePartInput = z.union([
    MessageV2.Part,
    z.object({
      part: MessageV2.TextPart,
      delta: z.string(),
    }),
    z.object({
      part: MessageV2.ReasoningPart,
      delta: z.string(),
    }),
  ])

  export const updatePart = fn(UpdatePartInput as any, async (input) => {
    const part = "delta" in input ? input.part : input
    const delta = "delta" in input ? input.delta : undefined
    await Storage.write(["part", part.messageID, part.id], part)
    Bus.publish(MessageV2.Event.PartUpdated, {
      part,
      delta,
    })
    return part
  })

  // Helper to safely extract numeric values (handles objects/undefined/NaN)
  function safeNumber(value: unknown, defaultValue = 0): number {
    if (typeof value === "number" && !isNaN(value) && isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? defaultValue : parsed
    }
    return defaultValue
  }

  export const getUsage = fn(
    z.object({
      model: z.custom<ModelsDev.Model>(),
      usage: z.custom<LanguageModelUsage>(),
      metadata: z.custom<ProviderMetadata>().optional(),
      providerID: z.string().optional(),
    }) as any,
    (input) => {
      // Safely extract raw token counts (handles objects/undefined)
      const rawInputTokens = safeNumber(input.usage?.inputTokens)
      const cachedInputTokens = safeNumber(input.usage?.cachedInputTokens)

      // Provider-specific normalization for cached input tokens:
      // - OpenAI/Google: inputTokens INCLUDES cachedInputTokens (cached is a subset)
      // - Anthropic: inputTokens EXCLUDES cachedInputTokens (they are separate)
      // We normalize so that tokens.input = NEW tokens (not from cache)
      // This ensures tokens.input + tokens.cache.read = total input tokens
      //
      // Sources:
      // - OpenAI: https://github.com/vercel/ai/issues/8794
      // - Google: https://discuss.ai.google.dev/t/how-to-count-tokens-when-using-context-caching/37300
      const isInclusiveCacheProvider = input.providerID?.includes("openai") ||
                                       input.providerID?.includes("azure") ||
                                       input.providerID?.includes("openrouter") ||
                                       input.providerID?.includes("google")

      // For inclusive-cache providers: subtract cached from input to get new tokens
      // For Anthropic-style providers: input already excludes cached
      const normalizedInput = isInclusiveCacheProvider
        ? Math.max(0, rawInputTokens - cachedInputTokens)
        : rawInputTokens

      const tokens = {
        input: normalizedInput,
        output: safeNumber(input.usage?.outputTokens),
        reasoning: safeNumber(input.usage?.reasoningTokens),
        cache: {
          write: safeNumber(
            input.metadata?.["anthropic"]?.["cacheCreationInputTokens"] ??
            (input.metadata as any)?.["bedrock"]?.["usage"]?.["cacheWriteInputTokens"]
          ),
          read: cachedInputTokens,
        },
      }

      // Safely extract cost values (handles objects/undefined)
      const costInput = safeNumber(input.model?.cost?.input)
      const costOutput = safeNumber(input.model?.cost?.output)
      const costCacheRead = safeNumber(input.model?.cost?.cache_read)
      const costCacheWrite = safeNumber(input.model?.cost?.cache_write)

      return {
        cost: new Decimal(0)
          .add(new Decimal(tokens.input).mul(costInput).div(1_000_000))
          .add(new Decimal(tokens.output).mul(costOutput).div(1_000_000))
          .add(new Decimal(tokens.cache.read).mul(costCacheRead).div(1_000_000))
          .add(new Decimal(tokens.cache.write).mul(costCacheWrite).div(1_000_000))
          .toNumber(),
        tokens,
      }
    },
  )

  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`)
    }
  }

  export const initialize = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      modelID: z.string(),
      providerID: z.string(),
      messageID: Identifier.schema("message"),
    }) as any,
    async (input) => {
      await SessionPrompt.prompt({
        sessionID: input.sessionID,
        messageID: input.messageID,
        model: {
          providerID: input.providerID,
          modelID: input.modelID,
        },
        parts: [
          {
            id: Identifier.ascending("part"),
            type: "text",
            text: PROMPT_INITIALIZE.replace("${path}", Instance.worktree),
          },
        ],
      })
      await Project.setInitialized(Instance.project.id)
    },
  )
}
