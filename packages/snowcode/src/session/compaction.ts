import { streamText, type ModelMessage, LoadAPIKeyError, type StreamTextResult, type Tool as AITool } from "ai"
import { Session } from "."
import { Identifier } from "../id/id"
import { Instance } from "../project/instance"
import { Provider } from "../provider/provider"
import { defer } from "../util/defer"
import { MessageV2 } from "./message-v2"
import { SystemPrompt } from "./system"
import { Bus } from "../bus"
import z from "zod/v4"
import type { ModelsDev } from "../provider/models"
import { SessionPrompt } from "./prompt"
import { Flag } from "../flag/flag"
import { Token } from "../util/token"
import { Log } from "../util/log"
import { SessionLock } from "./lock"
import { ProviderTransform } from "@/provider/transform"
import { SessionRetry } from "./retry"

export namespace SessionCompaction {
  const log = Log.create({ service: "session.compaction" })

  export const Event = {
    Compacted: Bus.event(
      "session.compacted",
      z.object({
        sessionID: z.string(),
      }),
    ),
  }

  export function isOverflow(input: { tokens: MessageV2.Assistant["tokens"]; model: ModelsDev.Model }) {
    if (Flag.SNOWCODE_DISABLE_AUTOCOMPACT) return false
    const context = input.model.limit.context
    if (context === 0) return false
    const count = input.tokens.input + input.tokens.cache.read + input.tokens.output
    const output = Math.min(input.model.limit.output, SessionPrompt.OUTPUT_TOKEN_MAX) || SessionPrompt.OUTPUT_TOKEN_MAX
    const usable = context - output
    return count > usable
  }

  /**
   * Estimate total tokens from current conversation messages.
   * This is used for pre-emptive overflow detection before sending to API.
   * More accurate than relying on last response's token count since it includes
   * new tool outputs that haven't been counted yet.
   */
  export function estimateConversationTokens(input: {
    systemPrompts: string[]
    messages: MessageV2.WithParts[]
  }): number {
    let total = 0

    // Estimate system prompts
    for (const prompt of input.systemPrompts) {
      total += Token.estimate(prompt)
    }

    // Estimate messages
    for (const msg of input.messages) {
      // Estimate message parts
      for (const part of msg.parts) {
        switch (part.type) {
          case "text":
            total += Token.estimate(part.text || "")
            break
          case "file":
            // FilePart has url and optional source with text
            if (part.source?.text?.value) {
              total += Token.estimate(part.source.text.value)
            }
            break
          case "tool":
            // Tool state varies - input is only in running/completed/error states
            if (part.state.status === "running" || part.state.status === "completed" || part.state.status === "error") {
              total += Token.estimate(JSON.stringify(part.state.input || {}))
            }
            // Tool output (this is what was missing!)
            if (part.state.status === "completed") {
              total += Token.estimate(part.state.output)
            }
            // Tool error messages
            if (part.state.status === "error") {
              total += Token.estimate(part.state.error || "")
            }
            break
          case "reasoning":
            total += Token.estimate(part.text || "")
            break
          case "agent":
            // Agent parts have content that gets rendered
            if ("content" in part && typeof part.content === "string") {
              total += Token.estimate(part.content)
            }
            break
          case "retry":
            // Retry parts have error info
            if ("error" in part && part.error) {
              total += Token.estimate(JSON.stringify(part.error))
            }
            break
          // patch, snapshot, step-start, step-finish are typically small metadata
          // and don't significantly contribute to token count
        }
      }
    }

    return total
  }

  /**
   * Check if estimated conversation tokens would overflow context limit.
   * Use this BEFORE sending to API to catch overflow from new tool outputs.
   */
  export function isEstimatedOverflow(input: {
    systemPrompts: string[]
    messages: MessageV2.WithParts[]
    model: ModelsDev.Model
  }): { overflow: boolean; estimated: number; limit: number } {
    if (Flag.SNOWCODE_DISABLE_AUTOCOMPACT) return { overflow: false, estimated: 0, limit: 0 }

    const context = input.model.limit.context
    if (context === 0) return { overflow: false, estimated: 0, limit: 0 }

    const output = Math.min(input.model.limit.output, SessionPrompt.OUTPUT_TOKEN_MAX) || SessionPrompt.OUTPUT_TOKEN_MAX
    const usable = context - output
    const estimated = estimateConversationTokens({
      systemPrompts: input.systemPrompts,
      messages: input.messages,
    })

    // Add 10% buffer for safety (estimation isn't perfect)
    const withBuffer = Math.floor(estimated * 1.1)

    return {
      overflow: withBuffer > usable,
      estimated: withBuffer,
      limit: usable,
    }
  }

  export const PRUNE_MINIMUM = 20_000
  export const PRUNE_PROTECT = 40_000
  const MAX_RETRIES = 10
  const MIN_OUTPUT_FOR_SUMMARY = 1000 // Only summarize outputs longer than this
  const MAX_OUTPUT_FOR_SUMMARY = 15000 // Truncate very large outputs before summarizing

  /**
   * Summarizes a tool output using a small model to preserve key information
   * when compacting old tool results. This prevents complete information loss
   * and reduces the need to re-run tools.
   */
  async function summarizeToolOutput(output: string, providerID: string): Promise<string | undefined> {
    // Skip small outputs - just keep them as-is in the summary field
    if (output.length < MIN_OUTPUT_FOR_SUMMARY) {
      return output
    }

    // Get a small/fast model for summarization
    const model = await Provider.getSmallModel(providerID)
    if (!model) {
      log.warn("no small model available for summarization, skipping", { providerID })
      return undefined
    }

    try {
      const truncatedOutput = output.substring(0, MAX_OUTPUT_FOR_SUMMARY)
      const response = await streamText({
        model: model.language,
        maxRetries: 0,
        maxOutputTokens: 300,
        messages: [
          {
            role: "user",
            content: `Summarize this tool output concisely (2-3 sentences), preserving key facts like file paths, sys_ids, record numbers, error messages, and important values:\n\n${truncatedOutput}`,
          },
        ],
      })

      let summary = ""
      for await (const chunk of response.fullStream) {
        if (chunk.type === "text-delta") summary += chunk.text
      }
      return `[SUMMARIZED] ${summary.trim()}`
    } catch (e) {
      log.error("failed to summarize tool output", { error: e })
      return undefined
    }
  }

  // goes backwards through parts until there are 40_000 tokens worth of tool
  // calls. then erases output of previous tool calls. idea is to throw away old
  // tool calls that are no longer relevant.
  export async function prune(input: { sessionID: string; providerID?: string }) {
    if (Flag.SNOWCODE_DISABLE_PRUNE) return
    log.info("pruning")
    const msgs = await Session.messages(input.sessionID)
    let total = 0
    let pruned = 0
    const toPrune: MessageV2.ToolPart[] = []
    let turns = 0

    loop: for (let msgIndex = (msgs as MessageV2.WithParts[]).length - 1; msgIndex >= 0; msgIndex--) {
      const msg = (msgs as MessageV2.WithParts[])[msgIndex]
      if (msg.info.role === "user") turns++
      if (turns < 2) continue
      if (msg.info.role === "assistant" && msg.info.summary) break loop
      for (let partIndex = msg.parts.length - 1; partIndex >= 0; partIndex--) {
        const part = msg.parts[partIndex]
        if (part.type === "tool")
          if (part.state.status === "completed") {
            if (part.state.time.compacted) break loop
            const estimate = Token.estimate(part.state.output)
            total += estimate
            if (total > PRUNE_PROTECT) {
              pruned += estimate
              toPrune.push(part)
            }
          }
      }
    }
    log.info("found", { pruned, total })
    if (pruned > PRUNE_MINIMUM) {
      for (const part of toPrune) {
        if (part.state.status === "completed") {
          // Summarize the output before compacting if providerID is available
          if (input.providerID && !part.state.outputSummary) {
            const summary = await summarizeToolOutput(part.state.output, input.providerID)
            if (summary) {
              part.state.outputSummary = summary
            }
          }
          part.state.time.compacted = Date.now()
          await Session.updatePart(part)
        }
      }
      log.info("pruned", { count: toPrune.length })
    }
  }

  export async function run(input: { sessionID: string; providerID: string; modelID: string; signal?: AbortSignal }) {
    if (!input.signal) SessionLock.assertUnlocked(input.sessionID)
    await using lock = input.signal === undefined ? SessionLock.acquire({ sessionID: input.sessionID }) : undefined
    const signal = input.signal ?? lock!.signal

    await Session.update(input.sessionID, (draft) => {
      draft.time.compacting = Date.now()
    })
    await using _ = defer(async () => {
      await Session.update(input.sessionID, (draft) => {
        draft.time.compacting = undefined
      })
    })
    const toSummarize = (await Session.messages(input.sessionID).then(MessageV2.filterCompacted)) as MessageV2.WithParts[]
    const model = await Provider.getModel(input.providerID, input.modelID)
    const system = [
      ...SystemPrompt.summarize(model.providerID),
      ...(await SystemPrompt.environment()),
      ...(await SystemPrompt.custom()),
    ]

    const msg = (await Session.updateMessage({
      id: Identifier.ascending("message"),
      role: "assistant",
      parentID: toSummarize.findLast((m: MessageV2.WithParts) => m.info.role === "user")?.info.id!,
      sessionID: input.sessionID,
      system,
      mode: "build",
      path: {
        cwd: Instance.directory,
        root: Instance.worktree,
      },
      cost: 0,
      tokens: {
        output: 0,
        input: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      modelID: input.modelID,
      providerID: model.providerID,
      time: {
        created: Date.now(),
      },
    })) as MessageV2.Assistant

    const part = (await Session.updatePart({
      type: "text",
      sessionID: input.sessionID,
      messageID: msg.id,
      id: Identifier.ascending("part"),
      text: "",
      time: {
        start: Date.now(),
      },
    })) as MessageV2.TextPart

    const doStream = async () =>
      streamText({
        // set to 0, we handle loop
        maxRetries: 0,
        model: model.language,
        providerOptions: ProviderTransform.providerOptions(model.npm, model.providerID, model.info.options),
        abortSignal: signal,
        onError(error) {
          log.error("stream error", {
            error,
          })
        },
        messages: [
          ...system.map(
            (x): ModelMessage => ({
              role: "system",
              content: x,
            }),
          ),
          ...(await MessageV2.toModelMessage(toSummarize)),
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.",
              },
            ],
          },
        ],
      })

    // TODO: reduce duplication between compaction.ts & prompt.ts
    const process = async (
      stream: StreamTextResult<Record<string, AITool>, never>,
      retries: { count: number; max: number },
    ) => {
      let shouldRetry = false
      try {
        for await (const value of stream.fullStream) {
          signal.throwIfAborted()
          switch (value.type) {
            case "text-delta":
              part.text += value.text
              if (value.providerMetadata) part.metadata = value.providerMetadata
              if (part.text) await Session.updatePart(part)
              continue
            case "text-end": {
              part.text = part.text.trimEnd()
              part.time = {
                start: Date.now(),
                end: Date.now(),
              }
              if (value.providerMetadata) part.metadata = value.providerMetadata
              await Session.updatePart(part)
              continue
            }
            case "finish-step": {
              const usage = Session.getUsage({
                model: model.info,
                usage: value.usage,
                metadata: value.providerMetadata,
              })
              msg.cost += (usage as any).cost
              msg.tokens = (usage as any).tokens
              await Session.updateMessage(msg)
              continue
            }
            case "error":
              throw value.error
            default:
              continue
          }
        }
      } catch (e) {
        log.error("compaction error", {
          error: e,
        })
        const error = MessageV2.fromError(e, { providerID: input.providerID })
        if (retries.count < retries.max && MessageV2.APIError.isInstance(error) && error.data.isRetryable) {
          shouldRetry = true
          await Session.updatePart({
            id: Identifier.ascending("part"),
            messageID: msg.id,
            sessionID: msg.sessionID,
            type: "retry",
            attempt: retries.count + 1,
            time: {
              created: Date.now(),
            },
            error,
          })
        } else {
          msg.error = error
          Bus.publish(Session.Event.Error, {
            sessionID: msg.sessionID,
            error: msg.error,
          })
        }
      }

      const parts = await Session.getParts(msg.id)
      return {
        info: msg,
        parts,
        shouldRetry,
      }
    }

    let stream = await doStream()
    let result = await process(stream, {
      count: 0,
      max: MAX_RETRIES,
    })
    if (result.shouldRetry) {
      for (let retry = 1; retry < MAX_RETRIES; retry++) {
        const lastRetryPart = (result.parts as any[]).findLast((p: any) => p.type === "retry")

        if (lastRetryPart) {
          const delayMs = SessionRetry.getRetryDelayInMs(lastRetryPart.error, retry)

          log.info("retrying with backoff", {
            attempt: retry,
            delayMs,
          })

          const stop = await SessionRetry.sleep(delayMs, signal)
            .then(() => false)
            .catch((error) => {
              if (error instanceof DOMException && error.name === "AbortError") {
                const err = new MessageV2.AbortedError(
                  { message: error.message },
                  {
                    cause: error,
                  },
                ).toObject()
                result.info.error = err
                Bus.publish(Session.Event.Error, {
                  sessionID: result.info.sessionID,
                  error: result.info.error,
                })
                return true
              }
              throw error
            })

          if (stop) break
        }

        stream = await doStream()
        result = await process(stream, {
          count: retry,
          max: MAX_RETRIES,
        })
        if (!result.shouldRetry) {
          break
        }
      }
    }

    msg.time.completed = Date.now()

    if (
      !msg.error ||
      (MessageV2.AbortedError.isInstance(msg.error) &&
        (result.parts as any[]).some((part: any) => part.type === "text" && part.text.length > 0))
    ) {
      msg.summary = true
      Bus.publish(Event.Compacted, {
        sessionID: input.sessionID,
      })
    }
    await Session.updateMessage(msg)

    return {
      info: msg,
      parts: result.parts,
    }
  }
}
