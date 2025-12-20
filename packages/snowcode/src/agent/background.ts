import { Log } from "../util/log"
import { Bus } from "../bus"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { SessionLock } from "../session/lock"
import { Agent } from "./agent"
import { TaskQueue } from "./task-queue"
import { Identifier } from "../id/id"
import { MessageV2 } from "../session/message-v2"
import { Instance } from "../project/instance"
import z from "zod/v4"

/**
 * Background Agent Manager - Async Agent Execution for Snow-Code
 *
 * Enables agents to run in the background without blocking the main chat.
 * Features:
 * - Spawn agents to background
 * - Monitor running tasks
 * - Auto-inject results back into context
 * - Graceful cancellation
 */

export namespace BackgroundAgent {
  const log = Log.create({ service: "background-agent" })

  // Track running background tasks with their abort controllers
  const runningTasks = new Map<string, AbortController>()

  // Maximum concurrent background tasks
  const MAX_CONCURRENT_TASKS = 3

  // ============================================================================
  // EVENTS
  // ============================================================================

  export const Event = {
    AgentStarted: Bus.event(
      "background.agent.started",
      z.object({
        taskID: z.string(),
        agentName: z.string(),
        sessionID: z.string(),
      }),
    ),
    AgentProgress: Bus.event(
      "background.agent.progress",
      z.object({
        taskID: z.string(),
        tokensUsed: z.number(),
        tokenBudget: z.number(),
      }),
    ),
    AgentCompleted: Bus.event(
      "background.agent.completed",
      z.object({
        taskID: z.string(),
        result: z.string(),
        sessionID: z.string(),
      }),
    ),
    AgentFailed: Bus.event(
      "background.agent.failed",
      z.object({
        taskID: z.string(),
        error: z.string(),
      }),
    ),
  }

  // ============================================================================
  // SPAWN OPERATIONS
  // ============================================================================

  /**
   * Spawn an agent to run in the background
   */
  export async function spawn(input: {
    agentName: string
    prompt: string
    description: string
    parentSessionID?: string
    priority?: TaskQueue.TaskPriority
    tokenBudget?: number
    modelID?: string
    providerID?: string
  }): Promise<TaskQueue.BackgroundTask> {
    const agent = await Agent.get(input.agentName)
    if (!agent) {
      throw new Error(`Unknown agent: ${input.agentName}`)
    }

    // Create a new session for this background task
    const session = await Session.create({
      parentID: input.parentSessionID,
      title: `[Background] ${input.description} (@${agent.name})`,
    })

    // Create the task in the queue
    const task = await TaskQueue.create({
      sessionID: session.id,
      parentSessionID: input.parentSessionID,
      projectID: Instance.project.id,
      agentName: input.agentName,
      prompt: input.prompt,
      description: input.description,
      priority: input.priority,
      tokenBudget: input.tokenBudget,
      metadata: {
        modelID: input.modelID,
        providerID: input.providerID,
      },
    })

    log.info("spawned background agent", {
      taskID: task.id,
      agent: input.agentName,
      sessionID: session.id,
    })

    // Start processing if we have capacity
    processQueue()

    return task
  }

  /**
   * Process the task queue - start next task if capacity available
   */
  async function processQueue(): Promise<void> {
    const runningCount = await TaskQueue.getRunningCount()
    if (runningCount >= MAX_CONCURRENT_TASKS) {
      log.info("queue at capacity", { running: runningCount, max: MAX_CONCURRENT_TASKS })
      return
    }

    const nextTask = await TaskQueue.getNextQueued()
    if (!nextTask) {
      log.info("no queued tasks")
      return
    }

    // Start the task
    executeTask(nextTask)
  }

  /**
   * Execute a background task
   */
  async function executeTask(task: TaskQueue.BackgroundTask): Promise<void> {
    const abortController = new AbortController()
    runningTasks.set(task.id, abortController)

    try {
      await TaskQueue.markStarted(task.id)

      Bus.publish(Event.AgentStarted, {
        taskID: task.id,
        agentName: task.agentName,
        sessionID: task.sessionID,
      })

      const agent = await Agent.get(task.agentName)
      if (!agent) {
        throw new Error(`Agent not found: ${task.agentName}`)
      }

      // Get model configuration
      const modelID = task.metadata?.modelID ?? agent.model?.modelID
      const providerID = task.metadata?.providerID ?? agent.model?.providerID

      if (!modelID || !providerID) {
        throw new Error("No model configured for background agent")
      }

      const messageID = Identifier.ascending("message")

      // Track token usage
      let totalTokens = 0
      const tokenTracker = Bus.subscribe(MessageV2.Event.Updated, (evt) => {
        if (evt.properties.info.sessionID !== task.sessionID) return
        if (evt.properties.info.role !== "assistant") return

        const msg = evt.properties.info as MessageV2.Assistant
        totalTokens = msg.tokens.input + msg.tokens.output + msg.tokens.reasoning

        TaskQueue.updateProgress(task.id, totalTokens)
        Bus.publish(Event.AgentProgress, {
          taskID: task.id,
          tokensUsed: totalTokens,
          tokenBudget: task.tokens.budget,
        })

        // Check budget
        if (totalTokens > task.tokens.budget) {
          log.warn("task exceeded token budget, aborting", {
            taskID: task.id,
            used: totalTokens,
            budget: task.tokens.budget,
          })
          abortController.abort()
        }
      })

      // Listen for abort
      abortController.signal.addEventListener("abort", () => {
        SessionLock.abort(task.sessionID)
      })

      // Execute the prompt
      const result = await SessionPrompt.prompt({
        messageID,
        sessionID: task.sessionID,
        model: {
          modelID,
          providerID,
        },
        agent: agent.name,
        tools: {
          todowrite: false,
          todoread: false,
          task: false, // Don't allow nested background tasks
          ...agent.tools,
        },
        parts: [
          {
            id: Identifier.ascending("part"),
            type: "text",
            text: task.prompt,
          },
        ],
      })

      tokenTracker()

      // Extract result text
      const resultText =
        (result.parts.findLast((x: any) => x.type === "text") as MessageV2.TextPart | undefined)?.text ?? ""

      await TaskQueue.markCompleted(task.id, resultText)

      Bus.publish(Event.AgentCompleted, {
        taskID: task.id,
        result: resultText,
        sessionID: task.sessionID,
      })

      log.info("background task completed", {
        taskID: task.id,
        tokensUsed: totalTokens,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (abortController.signal.aborted) {
        await TaskQueue.cancel(task.id)
      } else {
        await TaskQueue.markFailed(task.id, errorMessage)
        Bus.publish(Event.AgentFailed, {
          taskID: task.id,
          error: errorMessage,
        })
      }

      log.error("background task failed", {
        taskID: task.id,
        error: errorMessage,
      })
    } finally {
      runningTasks.delete(task.id)
      // Process next task in queue
      processQueue()
    }
  }

  // ============================================================================
  // CONTROL OPERATIONS
  // ============================================================================

  /**
   * Cancel a running background task
   */
  export async function cancel(taskID: string): Promise<boolean> {
    const controller = runningTasks.get(taskID)
    if (controller) {
      controller.abort()
      runningTasks.delete(taskID)
      return true
    }

    // If not running, try to cancel from queue
    return TaskQueue.cancel(taskID)
  }

  /**
   * Get status of a background task
   */
  export async function getStatus(taskID: string): Promise<TaskQueue.BackgroundTask | null> {
    return TaskQueue.get(taskID)
  }

  /**
   * List all background tasks
   */
  export async function list(): Promise<TaskQueue.BackgroundTask[]> {
    return TaskQueue.listAll()
  }

  /**
   * List only active (queued or running) tasks
   */
  export async function listActive(): Promise<TaskQueue.BackgroundTask[]> {
    return TaskQueue.listActive()
  }

  /**
   * Check if a task is currently running
   */
  export function isRunning(taskID: string): boolean {
    return runningTasks.has(taskID)
  }

  /**
   * Get count of running tasks
   */
  export function getRunningCount(): number {
    return runningTasks.size
  }

  /**
   * Wait for a task to complete
   */
  export async function awaitResult(taskID: string, timeoutMs = 300000): Promise<string | null> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const task = await TaskQueue.get(taskID)
      if (!task) return null

      if (task.status === "completed") {
        return task.result ?? null
      }

      if (task.status === "failed" || task.status === "cancelled") {
        throw new Error(task.error ?? `Task ${task.status}`)
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    throw new Error("Task timed out")
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Initialize background agent manager
   */
  export function initialize(): void {
    log.info("initializing background agent manager")

    // Resume any tasks that were running when the process stopped
    resumeInterruptedTasks()

    // Start processing queue
    processQueue()
  }

  /**
   * Resume tasks that were interrupted
   */
  async function resumeInterruptedTasks(): Promise<void> {
    const activeTasks = await TaskQueue.listActive()

    for (const task of activeTasks) {
      if (task.status === "running") {
        // Task was interrupted - mark as failed and requeue
        log.warn("found interrupted task, marking as failed", { taskID: task.id })
        await TaskQueue.markFailed(task.id, "Task was interrupted by process restart")
      }
    }
  }

  /**
   * Shutdown - cancel all running tasks
   */
  export async function shutdown(): Promise<void> {
    log.info("shutting down background agent manager")

    for (const [taskID, controller] of runningTasks) {
      controller.abort()
      await TaskQueue.markFailed(taskID, "Shutdown requested")
    }

    runningTasks.clear()
  }

  /**
   * Clear old completed tasks
   */
  export async function cleanup(daysOld = 7): Promise<number> {
    return TaskQueue.clearOldCompleted(daysOld)
  }
}
