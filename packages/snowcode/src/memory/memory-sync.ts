import { Bus } from "../bus"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Memory } from "./memory"
import { Log } from "../util/log"
import { Provider } from "../provider/provider"
import { streamText } from "ai"
import { SessionCompaction } from "../session/compaction"

/**
 * Memory Sync Module - Real-time Session Memory Updates
 *
 * Listens to session and message events and automatically updates
 * the session memory with:
 * - Work log entries for user requests and AI responses
 * - Key results from tool calls (file operations, etc.)
 * - Auto-generated session titles
 * - Status updates based on conversation flow
 */

export namespace MemorySync {
  const log = Log.create({ service: "memory.sync" })

  // Track active subscriptions
  let subscriptions: (() => void)[] = []
  let isInitialized = false

  // Debounced title generation to avoid excessive API calls
  const pendingTitleGenerations = new Map<string, NodeJS.Timeout>()
  const TITLE_GENERATION_DELAY = 5000 // 5 seconds after last message

  /**
   * Initialize memory sync - call this once at startup
   */
  export function initialize(): void {
    if (isInitialized) {
      log.warn("MemorySync already initialized")
      return
    }

    log.info("initializing memory sync")

    // Subscribe to session events
    subscriptions.push(
      Bus.subscribe(Session.Event.Started, async (event) => {
        try {
          await Memory.create({
            sessionID: event.properties.info.id,
            projectID: event.properties.info.projectID,
            title: event.properties.info.title,
          })
          log.info("created memory for new session", { sessionID: event.properties.info.id })
        } catch (e) {
          log.error("failed to create memory for session", { error: e })
        }
      }),
    )

    subscriptions.push(
      Bus.subscribe(Session.Event.Deleted, async (event) => {
        try {
          await Memory.remove(event.properties.info.projectID, event.properties.info.id)
        } catch (e) {
          log.error("failed to remove memory for session", { error: e })
        }
      }),
    )

    // Subscribe to message events
    subscriptions.push(
      Bus.subscribe(MessageV2.Event.Updated, async (event) => {
        try {
          await handleMessageUpdate(event.properties.info)
        } catch (e) {
          log.error("failed to handle message update", { error: e })
        }
      }),
    )

    // Subscribe to part updates for tool results
    subscriptions.push(
      Bus.subscribe(MessageV2.Event.PartUpdated, async (event) => {
        try {
          await handlePartUpdate(event.properties.part)
        } catch (e) {
          log.error("failed to handle part update", { error: e })
        }
      }),
    )

    // Subscribe to compaction events
    subscriptions.push(
      Bus.subscribe(SessionCompaction.Event.Compacted, async (event) => {
        try {
          const sessionID = event.properties.sessionID
          // We need to get the session to find the projectID
          // This is a simplification - in reality you'd want to track this
          log.info("session compacted, promoting learnings", { sessionID })
        } catch (e) {
          log.error("failed to handle compaction", { error: e })
        }
      }),
    )

    isInitialized = true
    log.info("memory sync initialized")
  }

  /**
   * Shutdown memory sync
   */
  export function shutdown(): void {
    log.info("shutting down memory sync")
    subscriptions.forEach((unsub) => unsub())
    subscriptions = []
    pendingTitleGenerations.forEach((timeout) => clearTimeout(timeout))
    pendingTitleGenerations.clear()
    isInitialized = false
  }

  /**
   * Handle message updates - log to work log and trigger title generation
   */
  async function handleMessageUpdate(info: MessageV2.Info): Promise<void> {
    const sessionID = info.sessionID

    // Get session to find projectID
    let projectID: string
    try {
      const session = await Session.get(sessionID)
      projectID = session.projectID
    } catch {
      log.warn("could not find session for message", { sessionID })
      return
    }

    if (info.role === "user") {
      // Log user request
      await Memory.appendWorkLog(projectID, sessionID, {
        type: "user_request",
        summary: extractSummary(info),
        metadata: { messageID: info.id },
      })

      // Schedule title generation if this is an early message
      scheduleTitleGeneration(projectID, sessionID)
    } else if (info.role === "assistant") {
      // Log AI response when complete
      if (info.time.completed) {
        await Memory.appendWorkLog(projectID, sessionID, {
          type: "ai_response",
          summary: `AI responded (${info.tokens.output} tokens)`,
          metadata: {
            messageID: info.id,
            tokens: info.tokens,
            cost: info.cost,
          },
        })
      }
    }
  }

  /**
   * Handle part updates - track tool calls and file operations
   */
  async function handlePartUpdate(part: MessageV2.Part): Promise<void> {
    if (part.type !== "tool") return

    const toolPart = part as MessageV2.ToolPart
    if (toolPart.state.status !== "completed") return

    const sessionID = part.sessionID

    // Get session to find projectID
    let projectID: string
    try {
      const session = await Session.get(sessionID)
      projectID = session.projectID
    } catch {
      return
    }

    // Log tool call
    await Memory.appendWorkLog(projectID, sessionID, {
      type: "tool_result",
      summary: `Tool: ${toolPart.tool} completed`,
      metadata: {
        tool: toolPart.tool,
        partID: part.id,
      },
    })

    // Track file operations as key results
    const toolName = toolPart.tool.toLowerCase()
    if (toolName === "write" || toolName === "edit") {
      const input = toolPart.state.input as { file_path?: string; path?: string }
      const filePath = input.file_path || input.path
      if (filePath) {
        await Memory.addKeyResult(projectID, sessionID, {
          type: toolName === "write" ? "file_created" : "file_modified",
          description: `${toolName === "write" ? "Created" : "Modified"} file`,
          path: filePath,
        })
      }
    }
  }

  /**
   * Schedule title generation with debouncing
   */
  function scheduleTitleGeneration(projectID: string, sessionID: string): void {
    const key = `${projectID}:${sessionID}`

    // Clear existing timeout
    const existing = pendingTitleGenerations.get(key)
    if (existing) {
      clearTimeout(existing)
    }

    // Schedule new generation
    const timeout = setTimeout(async () => {
      pendingTitleGenerations.delete(key)
      await maybeGenerateTitle(projectID, sessionID)
    }, TITLE_GENERATION_DELAY)

    pendingTitleGenerations.set(key, timeout)
  }

  /**
   * Generate a title for the session if not already generated
   */
  async function maybeGenerateTitle(projectID: string, sessionID: string): Promise<void> {
    try {
      const memory = await Memory.read(projectID, sessionID)
      if (!memory || memory.titleGenerated) return

      // Get messages to analyze
      const messages = (await Session.messages(sessionID)) as MessageV2.WithParts[]
      if (messages.length < 2) return // Need at least one exchange

      // Extract user messages for context
      const userMessages = messages
        .filter((m) => m.info.role === "user")
        .slice(0, 3) // First 3 user messages
        .map((m) => extractTextFromParts(m.parts))
        .filter(Boolean)
        .join("\n---\n")

      if (!userMessages.trim()) return

      // Generate title using small model
      const title = await generateTitle(userMessages)
      if (title) {
        await Memory.updateTitle(projectID, sessionID, title, true)
        log.info("generated session title", { sessionID, title })
      }
    } catch (e) {
      log.error("failed to generate title", { error: e, sessionID })
    }
  }

  /**
   * Generate a session title using a small model
   */
  async function generateTitle(context: string): Promise<string | null> {
    try {
      // Get a small/fast model for title generation
      const defaultModel = await Provider.defaultModel()
      const model = await Provider.getSmallModel(defaultModel.providerID)
      if (!model) {
        log.warn("no small model available for title generation")
        return null
      }

      const response = await streamText({
        model: model.language,
        maxRetries: 0,
        maxOutputTokens: 50,
        messages: [
          {
            role: "user",
            content: `Generate a very short (3-6 words) descriptive title for this conversation. Return ONLY the title, no quotes or explanation.

Context:
${context.slice(0, 1000)}`,
          },
        ],
      })

      let title = ""
      for await (const chunk of response.fullStream) {
        if (chunk.type === "text-delta") title += chunk.text
      }

      title = title.trim().replace(/^["']|["']$/g, "") // Remove quotes
      return title.length > 0 && title.length < 100 ? title : null
    } catch (e) {
      log.error("failed to generate title", { error: e })
      return null
    }
  }

  /**
   * Extract a summary from a message
   */
  function extractSummary(info: MessageV2.Info): string {
    // This is a simplified extraction - in practice you'd look at the parts
    return `User message (${info.id.slice(-8)})`
  }

  /**
   * Extract text content from message parts
   */
  function extractTextFromParts(parts: MessageV2.Part[]): string {
    return parts
      .filter((p): p is MessageV2.TextPart => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .slice(0, 500) // Limit length
  }

  /**
   * Manually trigger title generation for a session
   */
  export async function regenerateTitle(projectID: string, sessionID: string): Promise<string | null> {
    const messages = (await Session.messages(sessionID)) as MessageV2.WithParts[]
    const userMessages = messages
      .filter((m) => m.info.role === "user")
      .slice(0, 5)
      .map((m) => extractTextFromParts(m.parts))
      .filter(Boolean)
      .join("\n---\n")

    if (!userMessages.trim()) return null

    const title = await generateTitle(userMessages)
    if (title) {
      await Memory.updateTitle(projectID, sessionID, title, true)
    }
    return title
  }

  /**
   * Add a discussion point to current status
   */
  export async function addDiscussionPoint(projectID: string, sessionID: string, point: string): Promise<void> {
    await Memory.update(projectID, sessionID, (memory) => {
      if (!memory.currentStatus.discussionPoints.includes(point)) {
        memory.currentStatus.discussionPoints.push(point)
      }
    })
  }

  /**
   * Add an open question to current status
   */
  export async function addOpenQuestion(projectID: string, sessionID: string, question: string): Promise<void> {
    await Memory.update(projectID, sessionID, (memory) => {
      if (!memory.currentStatus.openQuestions.includes(question)) {
        memory.currentStatus.openQuestions.push(question)
      }
    })
  }

  /**
   * Mark a question as resolved (move from openQuestions to completed)
   */
  export async function resolveQuestion(projectID: string, sessionID: string, question: string): Promise<void> {
    await Memory.update(projectID, sessionID, (memory) => {
      const index = memory.currentStatus.openQuestions.indexOf(question)
      if (index !== -1) {
        memory.currentStatus.openQuestions.splice(index, 1)
        memory.currentStatus.completed.push(`Resolved: ${question}`)
      }
    })
  }

  /**
   * Promote all session learnings to project level
   */
  export async function promoteSessionLearnings(projectID: string, sessionID: string): Promise<number> {
    const memory = await Memory.read(projectID, sessionID)
    if (!memory) return 0

    let promoted = 0
    for (const learning of memory.learnings) {
      await Memory.promoteLearningToProject(projectID, learning)
      promoted++
    }

    log.info("promoted session learnings to project", { sessionID, count: promoted })
    return promoted
  }
}
