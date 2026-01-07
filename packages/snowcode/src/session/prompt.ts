import path from "path"
import os from "os"
import fs from "fs/promises"
import z from "zod/v4"
import { Identifier } from "../id/id"
import { MessageV2 } from "./message-v2"
import { Log } from "../util/log"
import { SessionRevert } from "./revert"
import { Session } from "."
import { Agent } from "../agent/agent"
import { Provider } from "../provider/provider"
import {
  generateText,
  streamText,
  type ModelMessage,
  type Tool as AITool,
  tool,
  wrapLanguageModel,
  type StreamTextResult,
  stepCountIs,
  jsonSchema,
  NoOutputGeneratedError,
} from "ai"
import { SessionCompaction } from "./compaction"
import { SessionLock } from "./lock"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { ProviderTransform } from "../provider/transform"
import { SystemPrompt } from "./system"
import { Plugin } from "../plugin"
import { SessionRetry } from "./retry"

import PROMPT_PLAN from "../session/prompt/plan.txt"
import BUILD_SWITCH from "../session/prompt/build-switch.txt"
import { ModelsDev } from "../provider/models"
import { defer } from "../util/defer"
import { mergeDeep, pipe } from "remeda"
import { ToolRegistry } from "../tool/registry"
import { ToolSearch } from "../tool/tool-search"
import { Wildcard } from "../util/wildcard"
import { MCP } from "../mcp"
import { LSP } from "../lsp"
import { ReadTool } from "../tool/read"
import { ListTool } from "../tool/ls"
import { TaskTool } from "../tool/task"
import { FileTime } from "../file/time"
import { Permission } from "../permission"
import { Snapshot } from "../snapshot"
import { ulid } from "ulid"
import { spawn } from "child_process"
import { Command } from "../command"
import { CommandHook } from "../hooks"
import { $, fileURLToPath } from "bun"
import { ConfigMarkdown } from "../config/markdown"
import { SessionSummary } from "./summary"
import { TokenDebug } from "../util/token-debug"
import { LargeOutputHandler } from "../util/large-output-handler"
import { formatToolOutput } from "../utils/smart-output-formatter"

export namespace SessionPrompt {
  const log = Log.create({ service: "session.prompt" })
  export const OUTPUT_TOKEN_MAX = 32_000
  const MAX_RETRIES = 10
  const DOOM_LOOP_THRESHOLD = 3

  /**
   * Maximum characters for tool output to prevent token overflow
   * ~100K chars is approximately 25K tokens
   */
  const MAX_TOOL_OUTPUT_CHARS = 100_000

  /**
   * Truncates tool output if it exceeds the maximum allowed length.
   * Preserves the beginning and end of the output for context.
   */
  function truncateToolOutput(output: string): string {
    if (output.length <= MAX_TOOL_OUTPUT_CHARS) {
      return output
    }

    const half = Math.floor(MAX_TOOL_OUTPUT_CHARS / 2)
    const truncatedLength = output.length - MAX_TOOL_OUTPUT_CHARS
    log.warn("truncating large tool output", {
      originalLength: output.length,
      truncatedLength,
      maxAllowed: MAX_TOOL_OUTPUT_CHARS,
    })

    return (
      output.substring(0, half) +
      `\n\n... [TRUNCATED ${truncatedLength.toLocaleString()} characters to prevent token overflow] ...\n\n` +
      output.substring(output.length - half)
    )
  }

  export const Event = {
    Idle: Bus.event(
      "session.idle",
      z.object({
        sessionID: z.string(),
      }),
    ),
  }

  const state = Instance.state(
    () => {
      const queued = new Map<
        string,
        {
          messageID: string
          callback: (input: MessageV2.WithParts) => void
        }[]
      >()

      return {
        queued,
      }
    },
    async (current) => {
      current.queued.clear()
    },
  )

  export const PromptInput = z.object({
    sessionID: Identifier.schema("session"),
    messageID: Identifier.schema("message").optional(),
    model: z
      .object({
        providerID: z.string(),
        modelID: z.string(),
      })
      .optional(),
    agent: z.string().optional(),
    system: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
    parts: z.array(
      z.discriminatedUnion("type", [
        MessageV2.TextPart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "TextPartInput",
          }),
        MessageV2.FilePart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "FilePartInput",
          }),
        MessageV2.AgentPart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "AgentPartInput",
          }),
      ]),
    ),
  })
  export type PromptInput = z.infer<typeof PromptInput>
  export async function prompt(input: PromptInput): Promise<MessageV2.WithParts> {
    const l = log.clone().tag("session", input.sessionID)
    l.info("🔵 PROMPT FUNCTION CALLED - BINARY IS UPDATED! 🔵")
    l.info("prompt")

    const session = await Session.get(input.sessionID)
    await SessionRevert.cleanup(session)

    const userMsg = await createUserMessage(input)
    await Session.touch(input.sessionID)

    if (isBusy(input.sessionID)) {
      return new Promise((resolve) => {
        const queue = state().queued.get(input.sessionID) ?? []
        queue.push({
          messageID: userMsg.info.id,
          callback: resolve,
        })
        state().queued.set(input.sessionID, queue)
      })
    }
    const agent = await Agent.get(input.agent ?? "build")
    const model = await resolveModel({
      agent,
      model: input.model,
    }).then((x) => Provider.getModel(x.providerID, x.modelID))

    using abort = lock(input.sessionID)

    const system = await resolveSystemPrompt({
      providerID: model.providerID,
      modelID: model.info.id,
      agent,
      system: input.system,
    })

    const processor = await createProcessor({
      sessionID: input.sessionID,
      model: model.info,
      providerID: model.providerID,
      agent: agent.name,
      system,
      abort: abort.signal,
    })

    // Tools are now resolved inside the loop to support dynamic tool loading
    // via tool_search - when tools are enabled, they become available in the next iteration

    const params = await Plugin.trigger(
      "chat.params",
      {
        model: model.info,
        provider: await Provider.getProvider(model.providerID),
        message: userMsg,
      },
      {
        temperature: model.info.temperature
          ? (agent.temperature ?? ProviderTransform.temperature(model.providerID, model.modelID))
          : undefined,
        topP: agent.topP ?? ProviderTransform.topP(model.providerID, model.modelID),
        options: {
          ...ProviderTransform.options(model.providerID, model.modelID, input.sessionID),
          ...model.info.options,
          ...agent.options,
        },
      },
    )

    let step = 0
    let compactionAttempted = false
    mainLoop: while (true) {
    try {
    while (true) {
      // Re-resolve tools at each iteration to pick up newly enabled tools from tool_search
      // This enables dynamic tool loading: tool_search enables tools, next iteration loads them
      const tools = await resolveTools({
        agent,
        sessionID: input.sessionID,
        modelID: model.modelID,
        providerID: model.providerID,
        tools: input.tools,
        processor,
      })

      const msgs: MessageV2.WithParts[] = pipe(
        await getMessages({
          sessionID: input.sessionID,
          model: model.info,
          providerID: model.providerID,
          signal: abort.signal,
        }),
        (messages) => insertReminders({ messages, agent }),
      )

      // Check if we would exceed the context limit before sending to API
      // This prevents "prompt too long" errors by auto-compacting proactively
      // Uses token estimation on CURRENT messages (including new tool outputs)
      // instead of relying on last response's token count
      if (!compactionAttempted) {
        const overflowCheck = SessionCompaction.isEstimatedOverflow({
          systemPrompts: system,
          messages: msgs,
          model: model.info,
        })

        if (overflowCheck.overflow) {
          log.info("context limit exceeded (estimated), auto-compacting before API call", {
            estimatedTokens: overflowCheck.estimated,
            limit: overflowCheck.limit,
            percentage: Math.round((overflowCheck.estimated / overflowCheck.limit) * 100) + "%",
          })

          // Run compaction synchronously and retry
          await SessionCompaction.run({
            sessionID: input.sessionID,
            providerID: model.providerID,
            modelID: model.info.id,
            signal: abort.signal,
          })

          compactionAttempted = true
          continue // Retry with compacted messages
        }
      }

      step++
      await processor.next(msgs.findLast((m) => m.info.role === "user")?.info.id!)
      if (step === 1) {
        ensureTitle({
          session,
          history: msgs,
          message: userMsg,
          providerID: model.providerID,
          modelID: model.info.id,
        })
        SessionSummary.summarize({
          sessionID: input.sessionID,
          messageID: userMsg.info.id,
        })
      }
      await using _ = defer(async () => {
        await processor.end()
      })

      // Debug: Log request with full token breakdown
      const requestStartTime = Date.now()
      const requestID = userMsg.info.id
      await TokenDebug.logRequest({
        sessionID: input.sessionID,
        requestID,
        providerID: model.providerID,
        modelID: model.info.id,
        contextLimit: model.info.limit.context,
        outputLimit: model.info.limit.output,
        systemPrompts: system,
        messages: msgs.map((m) => ({
          info: { id: m.info.id, role: m.info.role as "user" | "assistant" },
          parts: m.parts,
        })),
        tools: Object.fromEntries(
          Object.entries(tools).map(([id, t]) => [
            id,
            { description: (t as any).description, inputSchema: (t as any).inputSchema },
          ]),
        ),
      })

      const doStream = async () =>
        streamText({
          onError(error) {
            // Don't log NoOutputGeneratedError - it's expected when stream is aborted (ESC key)
            if (NoOutputGeneratedError.isInstance(error.error)) {
              log.debug("stream aborted - no output generated")
              return
            }
            log.error("stream error", {
              error,
            })
          },
          async experimental_repairToolCall(input) {
            const lower = input.toolCall.toolName.toLowerCase()
            if (lower !== input.toolCall.toolName && tools[lower]) {
              log.info("repairing tool call", {
                tool: input.toolCall.toolName,
                repaired: lower,
              })
              return {
                ...input.toolCall,
                toolName: lower,
              }
            }
            return {
              ...input.toolCall,
              input: JSON.stringify({
                tool: input.toolCall.toolName,
                error: input.error.message,
              }),
              toolName: "invalid",
            }
          },
          headers:
            model.providerID === "opencode"
              ? {
                  "x-opencode-session": input.sessionID,
                  "x-opencode-request": userMsg.info.id,
                }
              : undefined,
          // set to 0, we handle loop
          maxRetries: 0,
          activeTools: Object.keys(tools).filter((x) => x !== "invalid"),
          maxOutputTokens: ProviderTransform.maxOutputTokens(
            model.providerID,
            params.options,
            model.info.limit.output,
            OUTPUT_TOKEN_MAX,
          ),
          abortSignal: abort.signal,
          providerOptions: ProviderTransform.providerOptions(model.npm, model.providerID, params.options),
          stopWhen: stepCountIs(1),
          temperature: params.temperature,
          topP: params.topP,
          messages: [
            ...system.map(
              (x): ModelMessage => ({
                role: "system",
                content: x,
              }),
            ),
            ...(await MessageV2.toModelMessage(
              msgs.filter((m) => {
                if (m.info.role !== "assistant" || m.info.error === undefined) {
                  return true
                }
                if (
                  MessageV2.AbortedError.isInstance(m.info.error) &&
                  m.parts.some((part) => part.type !== "step-start" && part.type !== "reasoning")
                ) {
                  return true
                }

                return false
              }),
            )),
          ],
          tools: model.info.tool_call === false ? undefined : tools,
          model: wrapLanguageModel({
            model: model.language,
            middleware: [
              {
                async transformParams(args) {
                  if (args.type === "stream") {
                    // @ts-expect-error
                    args.params.prompt = ProviderTransform.message(args.params.prompt, model.providerID, model.modelID)
                  }
                  return args.params
                },
              },
            ],
          }),
        })

      let stream = await doStream()
      let result = await processor.process(stream, {
        count: 0,
        max: MAX_RETRIES,
      })
      if (result.shouldRetry) {
        for (let retry = 1; retry < MAX_RETRIES; retry++) {
          const lastRetryPart = result.parts.findLast((p) => p.type === "retry")

          if (lastRetryPart) {
            const delayMs = SessionRetry.getRetryDelayInMs(lastRetryPart.error, retry)

            log.info("retrying with backoff", {
              attempt: retry,
              delayMs,
            })

            const stop = await SessionRetry.sleep(delayMs, abort.signal)
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
          result = await processor.process(stream, {
            count: retry,
            max: MAX_RETRIES,
          })
          if (!result.shouldRetry) {
            break
          }
        }
      }
      await processor.end()

      // Debug: Log response with actual token usage
      await TokenDebug.logResponse({
        sessionID: input.sessionID,
        requestID,
        tokens: result.info.tokens,
        cost: result.info.cost,
        finishReason: (await stream.finishReason) || "unknown",
        startTime: requestStartTime,
      })

      const queued = state().queued.get(input.sessionID) ?? []

      if (!result.blocked && !result.info.error) {
        if ((await stream.finishReason) === "tool-calls") {
          continue
        }

        const unprocessed = queued.filter((x) => x.messageID > result.info.id)
        if (unprocessed.length) {
          continue
        }
      }
      for (const item of queued) {
        item.callback(result)
      }
      state().queued.delete(input.sessionID)
      SessionCompaction.prune({ sessionID: input.sessionID, providerID: model.providerID })

      return result
    }
    } catch (e) {
      // Check if this is a token overflow error that we can recover from via compaction
      const isTokenOverflow =
        e instanceof Error &&
        (e.message.includes("prompt is too long") ||
          e.message.includes("maximum context length") ||
          e.message.includes("context_length_exceeded") ||
          e.message.includes("max_tokens"))

      if (isTokenOverflow && !compactionAttempted) {
        log.info("token overflow detected in API response, triggering compaction and retry", {
          error: e instanceof Error ? e.message : String(e),
        })

        try {
          // Run compaction to reduce context size
          await SessionCompaction.run({
            sessionID: input.sessionID,
            providerID: model.providerID,
            modelID: model.info.id,
            signal: abort.signal,
          })

          compactionAttempted = true

          // Reset step counter for retry
          step = 0

          // Continue the main loop to retry with compacted messages
          continue mainLoop
        } catch (compactionError) {
          log.error("compaction failed during token overflow recovery", { error: compactionError })
          // Fall through to normal error handling
        }
      }

      // Ensure the assistant message is properly completed even if an error occurs
      // This prevents the TUI from getting stuck in a "busy" state
      log.error("prompt error - ensuring message completion", { error: e })

      const error = MessageV2.fromError(e, { providerID: model.providerID })

      // Force complete the message with the error
      await processor.forceCompleteWithError(error)

      // Publish the error event so TUI can show it
      Bus.publish(Session.Event.Error, {
        sessionID: input.sessionID,
        error: error,
      })

      // Re-throw the error for the caller to handle
      throw e
    }
    } // end mainLoop
  }

  async function getMessages(input: {
    sessionID: string
    model: ModelsDev.Model
    providerID: string
    signal: AbortSignal
  }) {
    let msgs = await Session.messages(input.sessionID).then(MessageV2.filterCompacted)

    // Check for overflow using token estimation on ALL messages
    // This catches overflow from tool outputs that haven't been counted yet
    const overflowCheck = SessionCompaction.isEstimatedOverflow({
      systemPrompts: [], // System prompts checked separately, buffer handles this
      messages: msgs as MessageV2.WithParts[],
      model: input.model,
    })

    if (overflowCheck.overflow) {
      const summaryMsg = await SessionCompaction.run({
        sessionID: input.sessionID,
        providerID: input.providerID,
        modelID: input.model.id,
        signal: input.signal,
      })
      const resumeMsgID = Identifier.ascending("message")
      const resumeMsg = {
        info: await Session.updateMessage({
          id: resumeMsgID,
          role: "user",
          sessionID: input.sessionID,
          time: {
            created: Date.now(),
          },
        }),
        parts: [
          await Session.updatePart({
            type: "text",
            sessionID: input.sessionID,
            messageID: resumeMsgID,
            id: Identifier.ascending("part"),
            text: "Use the above summary generated from your last session to resume from where you left off.",
            time: {
              start: Date.now(),
              end: Date.now(),
            },
            synthetic: true,
          }),
        ],
      }
      msgs = [summaryMsg, resumeMsg]
    }
    return msgs
  }

  async function resolveModel(input: { model: PromptInput["model"]; agent: Agent.Info }) {
    if (input.model) {
      return input.model
    }
    if (input.agent.model) {
      return input.agent.model
    }
    return Provider.defaultModel()
  }

  async function resolveSystemPrompt(input: {
    system?: string
    agent: Agent.Info
    providerID: string
    modelID: string
  }) {
    let system = SystemPrompt.header(input.providerID)
    system.push(
      ...(() => {
        if (input.system) return [input.system]
        if (input.agent.prompt) return [input.agent.prompt]
        return SystemPrompt.provider(input.modelID)
      })(),
    )
    system.push(...(await SystemPrompt.environment()))
    system.push(...(await SystemPrompt.custom()))
    // max 2 system prompt messages for caching purposes
    const [first, ...rest] = system
    system = [first, rest.join("\n")]
    return system
  }

  async function resolveTools(input: {
    agent: Agent.Info
    sessionID: string
    modelID: string
    providerID: string
    tools?: Record<string, boolean>
    processor: Processor
  }) {
    log.info(`✨ RESOLVETOOLS CALLED - Starting tool resolution for ${input.providerID}/${input.modelID}`)
    const tools: Record<string, AITool> = {}
    const enabledTools = pipe(
      input.agent.tools,
      mergeDeep(await ToolRegistry.enabled(input.providerID, input.modelID, input.agent)),
      mergeDeep(input.tools ?? {}),
    )

    // Get session-enabled deferred tools (tools discovered via tool_search)
    const sessionEnabledTools = await ToolSearch.getEnabledTools(input.sessionID)

    // Auto-enable activity tracking tools - these must ALWAYS be available
    // Without these, the agent cannot track activities before using tool_search
    const mcpToolsForAutoEnable = await MCP.tools()
    const activityToolPatterns = ["activity_start", "activity_complete", "activity_update", "activity_add_artifact"]
    for (const [toolName] of Object.entries(mcpToolsForAutoEnable)) {
      if (activityToolPatterns.some(pattern => toolName.includes(pattern))) {
        sessionEnabledTools.add(toolName)
        log.debug(`Auto-enabled activity tool: ${toolName}`)
      }
    }

    log.info(`✨ Session has ${sessionEnabledTools.size} enabled deferred tools`)

    // Load only immediate (non-deferred) tools by default
    // This implements the "Tool Search Tool" pattern from Anthropic's advanced tool use guide
    // See: https://www.anthropic.com/engineering/advanced-tool-use
    const immediateTools = await ToolRegistry.immediateTools()
    const deferredTools = await ToolRegistry.deferredTools()

    // Combine immediate tools with session-enabled deferred tools
    const toolsToLoad = [
      ...immediateTools,
      ...deferredTools.filter((t) => sessionEnabledTools.has(t.id)),
    ]

    log.info(`✨ Loading ${toolsToLoad.length} built-in tools (${immediateTools.length} immediate + ${deferredTools.filter((t) => sessionEnabledTools.has(t.id)).length} enabled deferred)`)

    for (const toolInfo of toolsToLoad) {
      const item = await toolInfo.init()
      if (Wildcard.all(toolInfo.id, enabledTools) === false) continue

      log.debug(`Processing tool: ${toolInfo.id}`)

      // Skip tools with invalid parameters
      if (!item.parameters) {
        log.warn(`Tool ${toolInfo.id} has no parameters, skipping`)
        continue
      }

      log.debug(`Tool ${toolInfo.id} has parameters, converting to JSON schema...`)

      let schema
      try {
        schema = ProviderTransform.schema(input.providerID, input.modelID, z.toJSONSchema(item.parameters))
        log.debug(`Tool ${toolInfo.id} JSON schema generated successfully`)
      } catch (error: any) {
        log.error(`Failed to generate JSON schema for tool ${toolInfo.id}: ${error?.message || String(error)}`)
        log.error(`Error stack: ${error?.stack}`)
        log.debug(`Tool ${toolInfo.id} parameters type: ${typeof item.parameters}`)
        log.debug(`Tool ${toolInfo.id} parameters constructor: ${item.parameters?.constructor?.name}`)
        continue
      }

      tools[toolInfo.id] = tool({
        id: toolInfo.id as any,
        description: item.description,
        inputSchema: jsonSchema(schema as any),
        async execute(args, options) {
          // Update tool state to show hook is running
          const toolPart = input.processor.partFromToolCall(options.toolCallId)
          if (toolPart) {
            await Session.updatePart({
              ...toolPart,
              state: {
                ...toolPart.state,
                status: "running",
                input: args,
                metadata: {
                  ...(toolPart.state.metadata as object || {}),
                  hookPhase: "PreToolUse",
                },
                time: { start: Date.now() },
              },
            })
          }

          // Execute PreToolUse hooks (includes default approval hooks)
          const preHookResult = await CommandHook.preToolUse(toolInfo.id, args, {
            sessionID: input.sessionID,
            messageID: input.processor.message.id,
            callID: options.toolCallId,
          })
          if (!preHookResult.allow) {
            log.warn("Tool blocked by PreToolUse hook", {
              tool: toolInfo.id,
              reason: preHookResult.output || preHookResult.error,
            })
            return {
              title: "Blocked by hook",
              metadata: { blocked: true },
              output: `Tool execution blocked: ${preHookResult.output || preHookResult.error || "Blocked by PreToolUse hook"}`,
            }
          }

          // Clear hook phase after PreToolUse completes
          if (toolPart) {
            await Session.updatePart({
              ...toolPart,
              state: {
                ...toolPart.state,
                status: "running",
                input: args,
                metadata: {
                  ...(toolPart.state.metadata as object || {}),
                  hookPhase: undefined,
                },
                time: { start: Date.now() },
              },
            })
          }

          await Plugin.trigger(
            "tool.execute.before",
            {
              tool: toolInfo.id,
              sessionID: input.sessionID,
              callID: options.toolCallId,
            },
            {
              args,
            },
          )
          item.parameters.parse(args)
          const result = await item.execute(args, {
            sessionID: input.sessionID,
            abort: options.abortSignal!,
            messageID: input.processor.message.id,
            callID: options.toolCallId,
            extra: {
              modelID: input.modelID,
              providerID: input.providerID,
            },
            agent: input.agent.name,
            metadata: async (val) => {
              const match = input.processor.partFromToolCall(options.toolCallId)
              if (match && match.state.status === "running") {
                await Session.updatePart({
                  ...match,
                  state: {
                    title: val.title,
                    metadata: val.metadata,
                    status: "running",
                    input: args,
                    time: {
                      start: Date.now(),
                    },
                  },
                })
              }
            },
          })
          await Plugin.trigger(
            "tool.execute.after",
            {
              tool: toolInfo.id,
              sessionID: input.sessionID,
              callID: options.toolCallId,
            },
            result,
          )

          // Execute PostToolUse shell command hooks
          await CommandHook.postToolUse(toolInfo.id, args, result, {
            sessionID: input.sessionID,
          })

          return result
        },
        toModelOutput(result) {
          return {
            type: "text",
            value: result.output,
          }
        },
      })
    }

    // MCP tools are treated as deferred by default (they cause major token bloat)
    // Only load MCP tools that have been explicitly enabled via tool_search
    const mcpTools = await MCP.tools()
    const mcpToolEntries = Object.entries(mcpTools)
    const enabledMcpTools = mcpToolEntries.filter(([key]) => sessionEnabledTools.has(key))

    log.info(`✨ Loading ${enabledMcpTools.length} MCP tools (${mcpToolEntries.length} total available, deferred by default)`)

    // Register all MCP tools in the search index if not already done
    // This allows tool_search to discover them
    // Activity tools are marked as NOT deferred since they're always available
    const alwaysAvailablePatterns = ["activity_start", "activity_complete", "activity_update", "activity_add_artifact"]
    for (const [key, item] of mcpToolEntries) {
      const isAlwaysAvailable = alwaysAvailablePatterns.some(pattern => key.includes(pattern))
      await ToolSearch.registerTool({
        id: key,
        description: ((item as any).description || "MCP tool").substring(0, 200),
        category: key.includes("_") ? key.split("_")[0] : "mcp",
        keywords: key.split(/[-_]/).filter((w) => w.length > 2),
        deferred: !isAlwaysAvailable,  // Activity tools are NOT deferred
      })
    }

    for (const [key, item] of enabledMcpTools) {
      if (Wildcard.all(key, enabledTools) === false) continue
      const originalExecute = item.execute
      if (!originalExecute) continue

      // Create a wrapper tool instead of mutating the MCP tool directly
      // This is required for AI SDK v6 compatibility where MCP tools may be immutable
      tools[key] = tool({
        id: key as any,
        description: (item as any).description || `MCP tool: ${key}`,
        inputSchema: (item as any).inputSchema || (item as any).parameters,
        async execute(args, opts) {
          // Execute PreToolUse shell command hooks for MCP tools
          const preHookResult = await CommandHook.preToolUse(key, args, {
            sessionID: input.sessionID,
          })
          if (!preHookResult.allow) {
            log.warn("MCP tool blocked by PreToolUse hook", {
              tool: key,
              reason: preHookResult.output || preHookResult.error,
            })
            return {
              title: "Blocked by hook",
              metadata: { blocked: true },
              output: `Tool execution blocked: ${preHookResult.output || preHookResult.error || "Blocked by PreToolUse hook"}`,
            }
          }

          await Plugin.trigger(
            "tool.execute.before",
            {
              tool: key,
              sessionID: input.sessionID,
              callID: opts.toolCallId,
            },
            {
              args,
            },
          )
          const result = await originalExecute(args, opts)

          await Plugin.trigger(
            "tool.execute.after",
            {
              tool: key,
              sessionID: input.sessionID,
              callID: opts.toolCallId,
            },
            result,
          )

          // Execute PostToolUse shell command hooks for MCP tools
          await CommandHook.postToolUse(key, args, result, {
            sessionID: input.sessionID,
          })

          const output = (result.content || [])
            .filter((x: any) => x.type === "text")
            .map((x: any) => x.text)
            .join("\n\n")

          return {
            title: "",
            metadata: (result as any).metadata ?? {},
            output,
          }
        },
      })
    }
    return tools
  }

  async function createUserMessage(input: PromptInput) {
    const info: MessageV2.Info = {
      id: input.messageID ?? Identifier.ascending("message"),
      role: "user",
      sessionID: input.sessionID,
      time: {
        created: Date.now(),
      },
    }

    const parts = await Promise.all(
      input.parts.map(async (part): Promise<MessageV2.Part[]> => {
        if (part.type === "file") {
          const url = new URL(part.url)
          switch (url.protocol) {
            case "data:":
              if (part.mime === "text/plain") {
                return [
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Called the Read tool with the following input: ${JSON.stringify({ filePath: part.filename })}`,
                  },
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: Buffer.from(part.url, "base64url").toString(),
                  },
                  {
                    ...part,
                    id: part.id ?? Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                  },
                ]
              }
              break
            case "file:":
              log.info("file", { mime: part.mime })
              // have to normalize, symbol search returns absolute paths
              // Decode the pathname since URL constructor doesn't automatically decode it
              const filepath = fileURLToPath(part.url)
              const stat = await Bun.file(filepath).stat()

              if (stat.isDirectory()) {
                part.mime = "application/x-directory"
              }

              if (part.mime === "text/plain") {
                let offset: number | undefined = undefined
                let limit: number | undefined = undefined
                const range = {
                  start: url.searchParams.get("start"),
                  end: url.searchParams.get("end"),
                }
                if (range.start != null) {
                  const filePathURI = part.url.split("?")[0]
                  let start = parseInt(range.start)
                  let end = range.end ? parseInt(range.end) : undefined
                  // some LSP servers (eg, gopls) don't give full range in
                  // workspace/symbol searches, so we'll try to find the
                  // symbol in the document to get the full range
                  if (start === end) {
                    const symbols = await LSP.documentSymbol(filePathURI)
                    for (const symbol of symbols) {
                      let range: LSP.Range | undefined
                      if ("range" in symbol) {
                        range = symbol.range
                      } else if ("location" in symbol) {
                        range = symbol.location.range
                      }
                      if (range?.start?.line && range?.start?.line === start) {
                        start = range.start.line
                        end = range?.end?.line ?? start
                        break
                      }
                    }
                  }
                  offset = Math.max(start - 1, 0)
                  if (end) {
                    limit = end - offset
                  }
                }
                const args = { filePath: filepath, offset, limit }
                const result = await ReadTool.init().then((t) =>
                  t.execute(args, {
                    sessionID: input.sessionID,
                    abort: new AbortController().signal,
                    agent: input.agent!,
                    messageID: info.id,
                    extra: { bypassCwdCheck: true },
                    metadata: async () => {},
                  }),
                )
                return [
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Called the Read tool with the following input: ${JSON.stringify(args)}`,
                  },
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: result.output,
                  },
                  {
                    ...part,
                    id: part.id ?? Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                  },
                ]
              }

              if (part.mime === "application/x-directory") {
                const args = { path: filepath }
                const result = await ListTool.init().then((t) =>
                  t.execute(args, {
                    sessionID: input.sessionID,
                    abort: new AbortController().signal,
                    agent: input.agent!,
                    messageID: info.id,
                    extra: { bypassCwdCheck: true },
                    metadata: async () => {},
                  }),
                )
                return [
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Called the list tool with the following input: ${JSON.stringify(args)}`,
                  },
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: result.output,
                  },
                  {
                    ...part,
                    id: part.id ?? Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                  },
                ]
              }

              const file = Bun.file(filepath)
              FileTime.read(input.sessionID, filepath)
              return [
                {
                  id: Identifier.ascending("part"),
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  text: `Called the Read tool with the following input: {\"filePath\":\"${filepath}\"}`,
                  synthetic: true,
                },
                {
                  id: part.id ?? Identifier.ascending("part"),
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "file",
                  url: `data:${part.mime};base64,` + Buffer.from(await file.bytes()).toString("base64"),
                  mime: part.mime,
                  filename: part.filename!,
                  source: part.source,
                },
              ]
          }
        }

        if (part.type === "agent") {
          return [
            {
              id: Identifier.ascending("part"),
              ...part,
              messageID: info.id,
              sessionID: input.sessionID,
            },
            {
              id: Identifier.ascending("part"),
              messageID: info.id,
              sessionID: input.sessionID,
              type: "text",
              synthetic: true,
              text:
                "Use the above message and context to generate a prompt and call the task tool with subagent: " +
                part.name,
            },
          ]
        }

        return [
          {
            id: Identifier.ascending("part"),
            ...part,
            messageID: info.id,
            sessionID: input.sessionID,
          },
        ]
      }),
    ).then((x) => x.flat())

    await Plugin.trigger(
      "chat.message",
      {},
      {
        message: info,
        parts,
      },
    )

    await Session.updateMessage(info)
    for (const part of parts) {
      await Session.updatePart(part)
    }

    return {
      info,
      parts,
    }
  }

  function insertReminders(input: { messages: MessageV2.WithParts[]; agent: Agent.Info }) {
    const userMessage = input.messages.findLast((msg) => msg.info.role === "user")
    if (!userMessage) return input.messages
    if (input.agent.name === "plan") {
      userMessage.parts.push({
        id: Identifier.ascending("part"),
        messageID: userMessage.info.id,
        sessionID: userMessage.info.sessionID,
        type: "text",
        text: PROMPT_PLAN,
        synthetic: true,
      })
    }
    const wasPlan = input.messages.some((msg) => msg.info.role === "assistant" && msg.info.mode === "plan")
    if (wasPlan && input.agent.name === "build") {
      userMessage.parts.push({
        id: Identifier.ascending("part"),
        messageID: userMessage.info.id,
        sessionID: userMessage.info.sessionID,
        type: "text",
        text: BUILD_SWITCH,
        synthetic: true,
      })
    }
    return input.messages
  }

  export type Processor = Awaited<ReturnType<typeof createProcessor>>
  async function createProcessor(input: {
    sessionID: string
    providerID: string
    model: ModelsDev.Model
    system: string[]
    agent: string
    abort: AbortSignal
  }) {
    const toolcalls: Record<string, MessageV2.ToolPart> = {}
    let snapshot: string | undefined
    let blocked = false

    async function createMessage(parentID: string) {
      const msg: MessageV2.Info = {
        id: Identifier.ascending("message"),
        parentID,
        role: "assistant",
        system: input.system,
        mode: input.agent,
        path: {
          cwd: Instance.directory,
          root: Instance.worktree,
        },
        cost: 0,
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        modelID: input.model.id,
        providerID: input.providerID,
        time: {
          created: Date.now(),
        },
        sessionID: input.sessionID,
      }
      await Session.updateMessage(msg)
      return msg
    }

    let assistantMsg: MessageV2.Assistant | undefined

    const result = {
      async end() {
        if (assistantMsg) {
          assistantMsg.time.completed = Date.now()
          await Session.updateMessage(assistantMsg)
          assistantMsg = undefined
        }
      },
      async next(parentID: string) {
        if (assistantMsg) {
          throw new Error("end previous assistant message first")
        }
        assistantMsg = await createMessage(parentID)
        return assistantMsg
      },
      get message() {
        if (!assistantMsg) throw new Error("call next() first before accessing message")
        return assistantMsg
      },
      /** Safe getter that returns undefined instead of throwing if no message exists */
      get currentMessage(): MessageV2.Assistant | undefined {
        return assistantMsg
      },
      /** Force complete the current message with an error - used for error recovery */
      async forceCompleteWithError(error: MessageV2.Assistant["error"]) {
        if (assistantMsg) {
          assistantMsg.error = error
          assistantMsg.time.completed = Date.now()
          await Session.updateMessage(assistantMsg)
          assistantMsg = undefined
        }
      },
      partFromToolCall(toolCallID: string) {
        return toolcalls[toolCallID]
      },
      async process(stream: StreamTextResult<Record<string, AITool>, never>, retries: { count: number; max: number }) {
        log.info("process")
        if (!assistantMsg) throw new Error("call next() first before processing")
        let shouldRetry = false
        try {
          let currentText: MessageV2.TextPart | undefined
          let reasoningMap: Record<string, MessageV2.ReasoningPart> = {}

          for await (const value of stream.fullStream) {
            input.abort.throwIfAborted()
            log.info("part", {
              type: value.type,
            })
            switch (value.type) {
              case "start":
                break

              case "reasoning-start":
                if (value.id in reasoningMap) {
                  continue
                }
                reasoningMap[value.id] = {
                  id: Identifier.ascending("part"),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  type: "reasoning",
                  text: "",
                  time: {
                    start: Date.now(),
                  },
                  metadata: value.providerMetadata,
                }
                break

              case "reasoning-delta":
                if (value.id in reasoningMap) {
                  const part = reasoningMap[value.id]
                  part.text += value.text
                  if (value.providerMetadata) part.metadata = value.providerMetadata
                  if (part.text) await Session.updatePart({ part, delta: value.text })
                }
                break

              case "reasoning-end":
                if (value.id in reasoningMap) {
                  const part = reasoningMap[value.id]
                  part.text = part.text.trimEnd()

                  part.time = {
                    ...part.time,
                    end: Date.now(),
                  }
                  if (value.providerMetadata) part.metadata = value.providerMetadata
                  await Session.updatePart(part)
                  delete reasoningMap[value.id]
                }
                break

              case "tool-input-start":
                const part = await Session.updatePart({
                  id: toolcalls[value.id]?.id ?? Identifier.ascending("part"),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  type: "tool",
                  tool: value.toolName,
                  callID: value.id,
                  state: {
                    status: "pending",
                  },
                })
                toolcalls[value.id] = part as MessageV2.ToolPart
                break

              case "tool-input-delta":
                break

              case "tool-input-end":
                break

              case "tool-call": {
                const match = toolcalls[value.toolCallId]
                if (match) {
                  const part = await Session.updatePart({
                    ...match,
                    tool: value.toolName,
                    state: {
                      status: "running",
                      input: value.input,
                      time: {
                        start: Date.now(),
                      },
                    },
                    metadata: value.providerMetadata,
                  })
                  toolcalls[value.toolCallId] = part as MessageV2.ToolPart

                  const parts = await Session.getParts(assistantMsg.id)
                  const lastThree = parts.slice(-DOOM_LOOP_THRESHOLD)
                  if (
                    lastThree.length === DOOM_LOOP_THRESHOLD &&
                    lastThree.every(
                      (p) =>
                        p.type === "tool" &&
                        p.tool === value.toolName &&
                        p.state.status !== "pending" &&
                        JSON.stringify(p.state.input) === JSON.stringify(value.input),
                    )
                  ) {
                    await Permission.ask({
                      type: "doom-loop",
                      pattern: value.toolName,
                      sessionID: assistantMsg.sessionID,
                      messageID: assistantMsg.id,
                      callID: value.toolCallId,
                      title: `Possible doom loop: "${value.toolName}" called ${DOOM_LOOP_THRESHOLD} times with identical arguments`,
                      metadata: {
                        tool: value.toolName,
                        input: value.input,
                      },
                    })
                  }
                }
                break
              }
              case "tool-result": {
                const match = toolcalls[value.toolCallId]
                if (match && match.state.status === "running") {
                  // Process large outputs - save to file if too big for context
                  const processedOutput = await LargeOutputHandler.processOutput({
                    toolName: match.tool,
                    output: value.output.output,
                    callId: value.toolCallId,
                  })

                  if (processedOutput.wasTruncated) {
                    log.info("large tool output saved to file", {
                      tool: match.tool,
                      originalTokens: processedOutput.originalTokens,
                      filePath: processedOutput.filePath,
                    })
                  }

                  // Format tool output for human-readable display
                  const formatted = formatToolOutput(match.tool, value.output.output);

                  await Session.updatePart({
                    ...match,
                    state: {
                      status: "completed",
                      input: value.input,
                      // Show formatted summary instead of raw JSON
                      output: formatted.summary,
                      // Keep raw data available for AI context if needed
                      outputRaw: value.output.output,
                      metadata: value.output.metadata,
                      title: value.output.title,
                      time: {
                        start: match.state.time.start,
                        end: Date.now(),
                      },
                      attachments: value.output.attachments,
                    },
                  })

                  delete toolcalls[value.toolCallId]
                }
                break
              }

              case "tool-error": {
                const match = toolcalls[value.toolCallId]
                if (match && match.state.status === "running") {
                  await Session.updatePart({
                    ...match,
                    state: {
                      status: "error",
                      input: value.input,
                      error: (value.error as any).toString(),
                      metadata: value.error instanceof Permission.RejectedError ? value.error.metadata : undefined,
                      time: {
                        start: match.state.time.start,
                        end: Date.now(),
                      },
                    },
                  })

                  if (value.error instanceof Permission.RejectedError) {
                    blocked = true
                  }
                  delete toolcalls[value.toolCallId]
                }
                break
              }
              case "error":
                throw value.error

              case "start-step":
                snapshot = await Snapshot.track()
                await Session.updatePart({
                  id: Identifier.ascending("part"),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  snapshot,
                  type: "step-start",
                })
                break

              case "finish-step":
                const usage = Session.getUsage({
                  model: input.model,
                  usage: value.usage,
                  metadata: value.providerMetadata,
                })
                assistantMsg.cost += usage.cost
                assistantMsg.tokens = usage.tokens
                // Safely convert finishReason to string (handles objects)
                const finishReason = typeof value.finishReason === "string"
                  ? value.finishReason
                  : typeof value.finishReason === "object" && value.finishReason !== null
                    ? JSON.stringify(value.finishReason)
                    : String(value.finishReason ?? "unknown")
                await Session.updatePart({
                  id: Identifier.ascending("part"),
                  reason: finishReason,
                  snapshot: await Snapshot.track(),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  type: "step-finish",
                  tokens: usage.tokens,
                  cost: usage.cost,
                })
                await Session.updateMessage(assistantMsg)
                if (snapshot) {
                  const patch = await Snapshot.patch(snapshot)
                  if (patch.files.length) {
                    await Session.updatePart({
                      id: Identifier.ascending("part"),
                      messageID: assistantMsg.id,
                      sessionID: assistantMsg.sessionID,
                      type: "patch",
                      hash: patch.hash,
                      files: patch.files,
                    })
                  }
                  snapshot = undefined
                }
                SessionSummary.summarize({
                  sessionID: input.sessionID,
                  messageID: assistantMsg.parentID,
                })
                break

              case "text-start":
                currentText = {
                  id: Identifier.ascending("part"),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  type: "text",
                  text: "",
                  time: {
                    start: Date.now(),
                  },
                  metadata: value.providerMetadata,
                }
                break

              case "text-delta":
                if (currentText) {
                  currentText.text += value.text
                  if (value.providerMetadata) currentText.metadata = value.providerMetadata
                  if (currentText.text)
                    await Session.updatePart({
                      part: currentText,
                      delta: value.text,
                    })
                }
                break

              case "text-end":
                if (currentText) {
                  currentText.text = currentText.text.trimEnd()
                  currentText.time = {
                    start: Date.now(),
                    end: Date.now(),
                  }
                  if (value.providerMetadata) currentText.metadata = value.providerMetadata
                  await Session.updatePart(currentText)
                }
                currentText = undefined
                break

              case "finish":
                assistantMsg.time.completed = Date.now()
                await Session.updateMessage(assistantMsg)
                break

              default:
                log.info("unhandled", {
                  ...value,
                })
                continue
            }
          }
        } catch (e) {
          log.error("process", {
            error: e,
          })
          const error = MessageV2.fromError(e, { providerID: input.providerID })

          // Check if this is a token overflow error that can be recovered via compaction
          const isTokenOverflow = MessageV2.APIError.isInstance(error) &&
            (error.data.message.includes("prompt is too long") ||
             error.data.message.includes("too many tokens") ||
             error.data.message.includes("context length") ||
             error.data.message.includes("maximum context") ||
             error.data.message.includes("exceeds the model"))

          if (isTokenOverflow && retries.count < 2) {
            // Try to recover by running compaction
            log.info("token overflow detected, attempting compaction recovery", {
              message: error.data.message,
              attempt: retries.count + 1,
            })
            try {
              await SessionCompaction.run({
                sessionID: assistantMsg.sessionID,
                providerID: input.providerID,
                modelID: input.model.id,
                signal: input.abort,
              })
              shouldRetry = true
              await Session.updatePart({
                id: Identifier.ascending("part"),
                messageID: assistantMsg.id,
                sessionID: assistantMsg.sessionID,
                type: "retry",
                attempt: retries.count + 1,
                time: {
                  created: Date.now(),
                },
                error: {
                  ...error,
                  data: {
                    ...error.data,
                    message: error.data.message + " (attempting automatic compaction...)",
                  },
                },
              })
            } catch (compactionError) {
              log.error("compaction recovery failed", { error: compactionError })
              // Add helpful guidance to the error message
              assistantMsg.error = {
                ...error,
                data: {
                  ...error.data,
                  message: error.data.message + "\n\n💡 Tip: The context is too large. Try starting a new session, or ask me to summarize previous content.",
                },
              }
              Bus.publish(Session.Event.Error, {
                sessionID: assistantMsg.sessionID,
                error: assistantMsg.error,
              })
            }
          } else if (retries.count < retries.max && MessageV2.APIError.isInstance(error) && error.data.isRetryable) {
            shouldRetry = true
            await Session.updatePart({
              id: Identifier.ascending("part"),
              messageID: assistantMsg.id,
              sessionID: assistantMsg.sessionID,
              type: "retry",
              attempt: retries.count + 1,
              time: {
                created: Date.now(),
              },
              error,
            })
          } else {
            // For token overflow errors that couldn't be recovered, add helpful guidance
            if (isTokenOverflow) {
              assistantMsg.error = {
                ...error,
                data: {
                  ...error.data,
                  message: error.data.message + "\n\n💡 Tip: The context is too large even after compaction. Please start a new session or fork from an earlier point.",
                },
              }
            } else {
              assistantMsg.error = error
            }
            Bus.publish(Session.Event.Error, {
              sessionID: assistantMsg.sessionID,
              error: assistantMsg.error,
            })
          }
        }
        const p = await Session.getParts(assistantMsg.id)
        for (const part of p) {
          if (part.type === "tool" && part.state.status !== "completed" && part.state.status !== "error") {
            Session.updatePart({
              ...part,
              state: {
                status: "error",
                error: "Tool execution aborted",
                time: {
                  start: Date.now(),
                  end: Date.now(),
                },
                input: {},
              },
            })
          }
        }
        if (!shouldRetry) {
          assistantMsg.time.completed = Date.now()
        }
        await Session.updateMessage(assistantMsg)
        return { info: assistantMsg, parts: p, blocked, shouldRetry }
      },
    }
    return result
  }

  function isBusy(sessionID: string) {
    return SessionLock.isLocked(sessionID)
  }

  function lock(sessionID: string) {
    const handle = SessionLock.acquire({
      sessionID,
    })
    log.info("locking", { sessionID })
    return {
      signal: handle.signal,
      abort: handle.abort,
      async [Symbol.dispose]() {
        handle[Symbol.dispose]()
        log.info("unlocking", { sessionID })

        const session = await Session.get(sessionID)
        if (session.parentID) return

        Bus.publish(Event.Idle, {
          sessionID,
        })
      },
    }
  }

  export const ShellInput = z.object({
    sessionID: Identifier.schema("session"),
    agent: z.string(),
    command: z.string(),
  })
  export type ShellInput = z.infer<typeof ShellInput>
  export async function shell(input: ShellInput) {
    using abort = lock(input.sessionID)
    const session = await Session.get(input.sessionID)
    if (session.revert) {
      SessionRevert.cleanup(session)
    }
    const userMsg: MessageV2.User = {
      id: Identifier.ascending("message"),
      sessionID: input.sessionID,
      time: {
        created: Date.now(),
      },
      role: "user",
    }
    await Session.updateMessage(userMsg)
    const userPart: MessageV2.Part = {
      type: "text",
      id: Identifier.ascending("part"),
      messageID: userMsg.id,
      sessionID: input.sessionID,
      text: "The following tool was executed by the user",
      synthetic: true,
    }
    await Session.updatePart(userPart)

    const msg: MessageV2.Assistant = {
      id: Identifier.ascending("message"),
      sessionID: input.sessionID,
      parentID: userMsg.id,
      system: [],
      mode: input.agent,
      cost: 0,
      path: {
        cwd: Instance.directory,
        root: Instance.worktree,
      },
      time: {
        created: Date.now(),
      },
      role: "assistant",
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      modelID: "",
      providerID: "",
    }
    await Session.updateMessage(msg)
    const part: MessageV2.Part = {
      type: "tool",
      id: Identifier.ascending("part"),
      messageID: msg.id,
      sessionID: input.sessionID,
      tool: "bash",
      callID: ulid(),
      state: {
        status: "running",
        time: {
          start: Date.now(),
        },
        input: {
          command: input.command,
        },
      },
    }
    await Session.updatePart(part)
    const shell = process.env["SHELL"] ?? "bash"
    const shellName = path.basename(shell)

    const invocations: Record<string, { args: string[] }> = {
      nu: {
        args: ["-c", input.command],
      },
      fish: {
        args: ["-c", input.command],
      },
      zsh: {
        args: [
          "-c",
          "-l",
          `
            [[ -f ~/.zshenv ]] && source ~/.zshenv >/dev/null 2>&1 || true
            [[ -f "\${ZDOTDIR:-$HOME}/.zshrc" ]] && source "\${ZDOTDIR:-$HOME}/.zshrc" >/dev/null 2>&1 || true
            ${input.command}
          `,
        ],
      },
      bash: {
        args: [
          "-c",
          "-l",
          `
            [[ -f ~/.bashrc ]] && source ~/.bashrc >/dev/null 2>&1 || true
            ${input.command}
          `,
        ],
      },
      // Fallback: any shell that doesn't match those above
      "": {
        args: ["-c", "-l", `${input.command}`],
      },
    }

    const matchingInvocation = invocations[shellName] ?? invocations[""]
    const args = matchingInvocation?.args

    const proc = spawn(shell, args, {
      cwd: Instance.directory,
      signal: abort.signal,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        TERM: "dumb",
      },
    })

    abort.signal.addEventListener("abort", () => {
      if (!proc.pid) return
      process.kill(-proc.pid)
    })

    let output = ""

    proc.stdout?.on("data", (chunk) => {
      output += chunk.toString()
      if (part.state.status === "running") {
        part.state.metadata = {
          output: output,
          description: "",
        }
        Session.updatePart(part)
      }
    })

    proc.stderr?.on("data", (chunk) => {
      output += chunk.toString()
      if (part.state.status === "running") {
        part.state.metadata = {
          output: output,
          description: "",
        }
        Session.updatePart(part)
      }
    })

    await new Promise<void>((resolve) => {
      proc.on("close", () => {
        resolve()
      })
    })
    msg.time.completed = Date.now()
    await Session.updateMessage(msg)
    if (part.state.status === "running") {
      part.state = {
        status: "completed",
        time: {
          ...part.state.time,
          end: Date.now(),
        },
        input: part.state.input,
        title: "",
        metadata: {
          output,
          description: "",
        },
        output,
      }
      await Session.updatePart(part)
    }
    return { info: msg, parts: [part] }
  }

  export const CommandInput = z.object({
    messageID: Identifier.schema("message").optional(),
    sessionID: Identifier.schema("session"),
    agent: z.string().optional(),
    model: z.string().optional(),
    arguments: z.string(),
    command: z.string(),
  })
  export type CommandInput = z.infer<typeof CommandInput>
  const bashRegex = /!`([^`]+)`/g
  const argsRegex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g
  const placeholderRegex = /\$(\d+)/g
  const quoteTrimRegex = /^["']|["']$/g
  /**
   * Regular expression to match @ file references in text
   * Matches @ followed by file paths, excluding commas, periods at end of sentences, and backticks
   * Does not match when preceded by word characters or backticks (to avoid email addresses and quoted references)
   */

  export async function command(input: CommandInput) {
    log.info("command", input)
    const command = await Command.get(input.command)
    const agentName = command.agent ?? input.agent ?? "build"

    const raw = input.arguments.match(argsRegex) ?? []
    const args = raw.map((arg) => arg.replace(quoteTrimRegex, ""))

    const placeholders = command.template.match(placeholderRegex) ?? []
    let last = 0
    for (const item of placeholders) {
      const value = Number(item.slice(1))
      if (value > last) last = value
    }

    // Let the final placeholder swallow any extra arguments so prompts read naturally
    const withArgs = command.template.replaceAll(placeholderRegex, (_, index) => {
      const position = Number(index)
      const argIndex = position - 1
      if (argIndex >= args.length) return ""
      if (position === last) return args.slice(argIndex).join(" ")
      return args[argIndex]
    })
    let template = withArgs.replaceAll("$ARGUMENTS", input.arguments)

    const shell = ConfigMarkdown.shell(template)
    if (shell.length > 0) {
      const results = await Promise.all(
        shell.map(async ([, cmd]) => {
          try {
            return await $`${{ raw: cmd }}`.nothrow().text()
          } catch (error) {
            return `Error executing command: ${error instanceof Error ? error.message : String(error)}`
          }
        }),
      )
      let index = 0
      template = template.replace(bashRegex, () => results[index++])
    }

    const parts = [
      {
        type: "text",
        text: template,
      },
    ] as PromptInput["parts"]

    const files = ConfigMarkdown.files(template)
    await Promise.all(
      files.map(async (match) => {
        const name = match[1]
        const filepath = name.startsWith("~/")
          ? path.join(os.homedir(), name.slice(2))
          : path.resolve(Instance.worktree, name)

        const stats = await fs.stat(filepath).catch(() => undefined)
        if (!stats) {
          const agent = await Agent.get(name)
          if (agent) {
            parts.push({
              type: "agent",
              name: agent.name,
            })
          }
          return
        }

        if (stats.isDirectory()) {
          parts.push({
            type: "file",
            url: `file://${filepath}`,
            filename: name,
            mime: "application/x-directory",
          })
          return
        }

        parts.push({
          type: "file",
          url: `file://${filepath}`,
          filename: name,
          mime: "text/plain",
        })
      }),
    )

    const model = await (async () => {
      if (command.model) {
        return Provider.parseModel(command.model)
      }
      if (command.agent) {
        const cmdAgent = await Agent.get(command.agent)
        if (cmdAgent.model) {
          return cmdAgent.model
        }
      }
      if (input.model) {
        return Provider.parseModel(input.model)
      }
      return await Provider.defaultModel()
    })()

    const agent = await Agent.get(agentName)
    if ((agent.mode === "subagent" && command.subtask !== false) || command.subtask === true) {
      using abort = lock(input.sessionID)

      const userMsg: MessageV2.User = {
        id: Identifier.ascending("message"),
        sessionID: input.sessionID,
        time: {
          created: Date.now(),
        },
        role: "user",
      }
      await Session.updateMessage(userMsg)
      const userPart: MessageV2.Part = {
        type: "text",
        id: Identifier.ascending("part"),
        messageID: userMsg.id,
        sessionID: input.sessionID,
        text: "The following tool was executed by the user",
        synthetic: true,
      }
      await Session.updatePart(userPart)

      const assistantMsg: MessageV2.Assistant = {
        id: Identifier.ascending("message"),
        sessionID: input.sessionID,
        parentID: userMsg.id,
        system: [],
        mode: agentName,
        cost: 0,
        path: {
          cwd: Instance.directory,
          root: Instance.worktree,
        },
        time: {
          created: Date.now(),
        },
        role: "assistant",
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        modelID: model.modelID,
        providerID: model.providerID,
      }
      await Session.updateMessage(assistantMsg)

      const args = {
        description: "Consulting " + agent.name,
        subagent_type: agent.name,
        prompt: template,
      }
      const toolPart: MessageV2.ToolPart = {
        type: "tool",
        id: Identifier.ascending("part"),
        messageID: assistantMsg.id,
        sessionID: input.sessionID,
        tool: "task",
        callID: ulid(),
        state: {
          status: "running",
          time: {
            start: Date.now(),
          },
          input: {
            description: args.description,
            subagent_type: args.subagent_type,
            // truncate prompt to preserve context
            prompt: args.prompt.length > 100 ? args.prompt.substring(0, 97) + "..." : args.prompt,
          },
        },
      }
      await Session.updatePart(toolPart)

      const result = await TaskTool.init().then((t) =>
        t.execute(args, {
          sessionID: input.sessionID,
          abort: abort.signal,
          agent: agent.name,
          messageID: assistantMsg.id,
          extra: {},
          metadata: async (metadata) => {
            if (toolPart.state.status === "running") {
              toolPart.state.metadata = metadata.metadata
              toolPart.state.title = metadata.title
              await Session.updatePart(toolPart)
            }
          },
        }),
      )

      assistantMsg.time.completed = Date.now()
      await Session.updateMessage(assistantMsg)
      if (toolPart.state.status === "running") {
        toolPart.state = {
          status: "completed",
          time: {
            ...toolPart.state.time,
            end: Date.now(),
          },
          input: toolPart.state.input,
          title: "",
          metadata: result.metadata,
          output: result.output,
        }
        await Session.updatePart(toolPart)
      }

      return { info: assistantMsg, parts: [toolPart] }
    }

    return prompt({
      sessionID: input.sessionID,
      messageID: input.messageID,
      model,
      agent: agentName,
      parts,
    })
  }

  async function ensureTitle(input: {
    session: Session.Info
    message: MessageV2.WithParts
    history: MessageV2.WithParts[]
    providerID: string
    modelID: string
  }) {
    if (input.session.parentID) return
    const isFirst =
      input.history.filter((m) => m.info.role === "user" && !m.parts.every((p) => "synthetic" in p && p.synthetic))
        .length === 1
    if (!isFirst) return
    const small =
      (await Provider.getSmallModel(input.providerID)) ?? (await Provider.getModel(input.providerID, input.modelID))
    const options = {
      ...ProviderTransform.options(small.providerID, small.modelID, input.session.id),
      ...small.info.options,
    }
    if (small.providerID === "openai" || small.modelID.includes("gpt-5")) {
      options["reasoningEffort"] = "minimal"
    }
    if (small.providerID === "google") {
      options["thinkingConfig"] = {
        thinkingBudget: 0,
      }
    }
    const titleMessages = await MessageV2.toModelMessage([
      {
        info: {
          id: Identifier.ascending("message"),
          role: "user",
          sessionID: input.session.id,
          time: {
            created: Date.now(),
          },
        },
        parts: input.message.parts,
      },
    ])
    generateText({
      maxOutputTokens: small.info.reasoning ? 1500 : 20,
      providerOptions: ProviderTransform.providerOptions(small.npm, small.providerID, options),
      messages: [
        ...SystemPrompt.title(small.providerID).map(
          (x): ModelMessage => ({
            role: "system",
            content: x,
          }),
        ),
        ...titleMessages,
      ],
      model: small.language,
    })
      .then((result) => {
        if (result.text)
          return Session.update(input.session.id, (draft) => {
            const cleaned = result.text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").split("\n")[0]
            const title = cleaned.length > 100 ? cleaned.substring(0, 97) + "..." : cleaned
            draft.title = title.trim()
          })
      })
      .catch((error) => {
        log.error("failed to generate title", { error, model: small.info.id })
      })
  }
}
