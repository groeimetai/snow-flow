import z from "zod/v4"
import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { Log } from "../util/log"
import { Lock } from "../util/lock"
import { Bus } from "../bus"
import { randomBytes } from "crypto"

/**
 * Task Queue Module - Background Task Management for Snow-Code
 *
 * Provides persistent storage and management for background tasks including:
 * - Task creation and status tracking
 * - Priority-based queuing
 * - Token budget tracking
 * - Result storage
 *
 * Storage structure:
 * ~/.local/share/snow-code/tasks/
 * ├── active/
 * │   └── <task_id>.json
 * ├── completed/
 * │   └── <task_id>.json
 * └── queue.json
 */

export namespace TaskQueue {
  const log = Log.create({ service: "task-queue" })

  // ============================================================================
  // SCHEMAS
  // ============================================================================

  export const TaskStatus = z.enum(["queued", "running", "completed", "failed", "cancelled"])
  export type TaskStatus = z.infer<typeof TaskStatus>

  export const TaskPriority = z.enum(["high", "normal", "low"])
  export type TaskPriority = z.infer<typeof TaskPriority>

  export const TaskTokens = z.object({
    used: z.number(),
    budget: z.number(),
  })
  export type TaskTokens = z.infer<typeof TaskTokens>

  export const BackgroundTask = z
    .object({
      id: z.string(),
      sessionID: z.string(),
      parentSessionID: z.string().optional(),
      projectID: z.string(),
      agentName: z.string(),
      prompt: z.string(),
      description: z.string(),
      status: TaskStatus,
      priority: TaskPriority,
      tokens: TaskTokens,
      result: z.string().optional(),
      error: z.string().optional(),
      time: z.object({
        created: z.number(),
        started: z.number().optional(),
        completed: z.number().optional(),
      }),
      metadata: z.record(z.string(), z.any()).optional(),
    })
    .meta({
      ref: "BackgroundTask",
    })
  export type BackgroundTask = z.infer<typeof BackgroundTask>

  export const QueueState = z.object({
    tasks: z.array(z.string()), // Task IDs in priority order
    time: z.object({
      updated: z.number(),
    }),
  })
  export type QueueState = z.infer<typeof QueueState>

  // ============================================================================
  // EVENTS
  // ============================================================================

  export const Event = {
    TaskCreated: Bus.event(
      "task.created",
      z.object({
        task: BackgroundTask,
      }),
    ),
    TaskStarted: Bus.event(
      "task.started",
      z.object({
        taskID: z.string(),
      }),
    ),
    TaskProgress: Bus.event(
      "task.progress",
      z.object({
        taskID: z.string(),
        tokens: TaskTokens,
      }),
    ),
    TaskCompleted: Bus.event(
      "task.completed",
      z.object({
        taskID: z.string(),
        result: z.string().optional(),
      }),
    ),
    TaskFailed: Bus.event(
      "task.failed",
      z.object({
        taskID: z.string(),
        error: z.string(),
      }),
    ),
    TaskCancelled: Bus.event(
      "task.cancelled",
      z.object({
        taskID: z.string(),
      }),
    ),
  }

  // ============================================================================
  // PATH HELPERS
  // ============================================================================

  function getTasksDir(): string {
    return path.join(Global.Path.data, "tasks")
  }

  function getActiveDir(): string {
    return path.join(getTasksDir(), "active")
  }

  function getCompletedDir(): string {
    return path.join(getTasksDir(), "completed")
  }

  function getTaskPath(taskID: string, completed = false): string {
    const dir = completed ? getCompletedDir() : getActiveDir()
    return path.join(dir, `${taskID}.json`)
  }

  function getQueuePath(): string {
    return path.join(getTasksDir(), "queue.json")
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  let initialized = false

  async function ensureInitialized(): Promise<void> {
    if (initialized) return

    await fs.mkdir(getActiveDir(), { recursive: true })
    await fs.mkdir(getCompletedDir(), { recursive: true })

    // Initialize queue if it doesn't exist
    const queuePath = getQueuePath()
    try {
      await fs.access(queuePath)
    } catch {
      const initialQueue: QueueState = {
        tasks: [],
        time: { updated: Date.now() },
      }
      await Bun.write(queuePath, JSON.stringify(initialQueue, null, 2))
    }

    initialized = true
    log.info("task queue initialized")
  }

  // ============================================================================
  // TASK OPERATIONS
  // ============================================================================

  /**
   * Create a new background task
   */
  export async function create(input: {
    sessionID: string
    parentSessionID?: string
    projectID: string
    agentName: string
    prompt: string
    description: string
    priority?: TaskPriority
    tokenBudget?: number
    metadata?: Record<string, any>
  }): Promise<BackgroundTask> {
    await ensureInitialized()

    const task: BackgroundTask = {
      id: `task_${Date.now()}_${randomBytes(4).toString("hex")}`,
      sessionID: input.sessionID,
      parentSessionID: input.parentSessionID,
      projectID: input.projectID,
      agentName: input.agentName,
      prompt: input.prompt,
      description: input.description,
      status: "queued",
      priority: input.priority ?? "normal",
      tokens: {
        used: 0,
        budget: input.tokenBudget ?? 100_000,
      },
      time: {
        created: Date.now(),
      },
      metadata: input.metadata,
    }

    // Write task file
    const taskPath = getTaskPath(task.id)
    using _ = await Lock.write("task-queue")
    await Bun.write(taskPath, JSON.stringify(task, null, 2))

    // Add to queue
    await addToQueue(task.id, task.priority)

    log.info("created background task", { taskID: task.id, agent: input.agentName })
    Bus.publish(Event.TaskCreated, { task })

    return task
  }

  /**
   * Get a task by ID
   */
  export async function get(taskID: string): Promise<BackgroundTask | null> {
    await ensureInitialized()

    // Try active first, then completed
    for (const completed of [false, true]) {
      const taskPath = getTaskPath(taskID, completed)
      try {
        using _ = await Lock.read(taskPath)
        const content = await Bun.file(taskPath).json()
        return BackgroundTask.parse(content)
      } catch {
        continue
      }
    }

    return null
  }

  /**
   * Update a task
   */
  export async function update(
    taskID: string,
    updater: (task: BackgroundTask) => void,
  ): Promise<BackgroundTask | null> {
    await ensureInitialized()

    const task = await get(taskID)
    if (!task) return null

    updater(task)

    const taskPath = getTaskPath(taskID, task.status === "completed" || task.status === "failed")
    using _ = await Lock.write("task-queue")
    await Bun.write(taskPath, JSON.stringify(task, null, 2))

    return task
  }

  /**
   * Mark a task as started
   */
  export async function markStarted(taskID: string): Promise<void> {
    await update(taskID, (task) => {
      task.status = "running"
      task.time.started = Date.now()
    })
    Bus.publish(Event.TaskStarted, { taskID })
  }

  /**
   * Update task progress (tokens used)
   */
  export async function updateProgress(taskID: string, tokensUsed: number): Promise<void> {
    const task = await update(taskID, (t) => {
      t.tokens.used = tokensUsed
    })
    if (task) {
      Bus.publish(Event.TaskProgress, {
        taskID,
        tokens: task.tokens,
      })
    }
  }

  /**
   * Mark a task as completed
   */
  export async function markCompleted(taskID: string, result: string): Promise<void> {
    await ensureInitialized()

    const task = await get(taskID)
    if (!task) return

    task.status = "completed"
    task.result = result
    task.time.completed = Date.now()

    // Move from active to completed
    const activePath = getTaskPath(taskID, false)
    const completedPath = getTaskPath(taskID, true)

    using _ = await Lock.write("task-queue")

    await Bun.write(completedPath, JSON.stringify(task, null, 2))
    await fs.unlink(activePath).catch(() => {})

    // Remove from queue
    await removeFromQueue(taskID)

    log.info("task completed", { taskID, duration: task.time.completed - (task.time.started ?? task.time.created) })
    Bus.publish(Event.TaskCompleted, { taskID, result })
  }

  /**
   * Mark a task as failed
   */
  export async function markFailed(taskID: string, error: string): Promise<void> {
    await ensureInitialized()

    const task = await get(taskID)
    if (!task) return

    task.status = "failed"
    task.error = error
    task.time.completed = Date.now()

    // Move from active to completed
    const activePath = getTaskPath(taskID, false)
    const completedPath = getTaskPath(taskID, true)

    using _ = await Lock.write("task-queue")

    await Bun.write(completedPath, JSON.stringify(task, null, 2))
    await fs.unlink(activePath).catch(() => {})

    // Remove from queue
    await removeFromQueue(taskID)

    log.error("task failed", { taskID, error })
    Bus.publish(Event.TaskFailed, { taskID, error })
  }

  /**
   * Cancel a task
   */
  export async function cancel(taskID: string): Promise<boolean> {
    const task = await get(taskID)
    if (!task) return false

    if (task.status === "completed" || task.status === "failed") {
      return false // Can't cancel finished tasks
    }

    await update(taskID, (t) => {
      t.status = "cancelled"
      t.time.completed = Date.now()
    })

    await removeFromQueue(taskID)

    log.info("task cancelled", { taskID })
    Bus.publish(Event.TaskCancelled, { taskID })

    return true
  }

  // ============================================================================
  // QUEUE OPERATIONS
  // ============================================================================

  /**
   * Add a task to the queue
   */
  async function addToQueue(taskID: string, priority: TaskPriority): Promise<void> {
    const queuePath = getQueuePath()
    using _ = await Lock.write("task-queue")

    let queue: QueueState
    try {
      const content = await Bun.file(queuePath).json()
      queue = QueueState.parse(content)
    } catch {
      queue = { tasks: [], time: { updated: Date.now() } }
    }

    // Insert based on priority
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    const insertIndex = queue.tasks.findIndex(async (existingID) => {
      const existing = await get(existingID)
      if (!existing) return true
      return priorityOrder[priority] < priorityOrder[existing.priority]
    })

    if (insertIndex === -1) {
      queue.tasks.push(taskID)
    } else {
      queue.tasks.splice(insertIndex, 0, taskID)
    }

    queue.time.updated = Date.now()
    await Bun.write(queuePath, JSON.stringify(queue, null, 2))
  }

  /**
   * Remove a task from the queue
   */
  async function removeFromQueue(taskID: string): Promise<void> {
    const queuePath = getQueuePath()
    using _ = await Lock.write("task-queue")

    let queue: QueueState
    try {
      const content = await Bun.file(queuePath).json()
      queue = QueueState.parse(content)
    } catch {
      return
    }

    queue.tasks = queue.tasks.filter((id) => id !== taskID)
    queue.time.updated = Date.now()
    await Bun.write(queuePath, JSON.stringify(queue, null, 2))
  }

  /**
   * Get the next task in the queue
   */
  export async function getNextQueued(): Promise<BackgroundTask | null> {
    await ensureInitialized()

    const queuePath = getQueuePath()
    using _ = await Lock.read(queuePath)

    let queue: QueueState
    try {
      const content = await Bun.file(queuePath).json()
      queue = QueueState.parse(content)
    } catch {
      return null
    }

    for (const taskID of queue.tasks) {
      const task = await get(taskID)
      if (task && task.status === "queued") {
        return task
      }
    }

    return null
  }

  // ============================================================================
  // LIST OPERATIONS
  // ============================================================================

  /**
   * List all active (queued or running) tasks
   */
  export async function listActive(): Promise<BackgroundTask[]> {
    await ensureInitialized()

    const activeDir = getActiveDir()
    const tasks: BackgroundTask[] = []

    try {
      const files = await fs.readdir(activeDir)
      for (const file of files) {
        if (!file.endsWith(".json")) continue
        const taskPath = path.join(activeDir, file)
        try {
          using _ = await Lock.read(taskPath)
          const content = await Bun.file(taskPath).json()
          tasks.push(BackgroundTask.parse(content))
        } catch {
          continue
        }
      }
    } catch {
      return []
    }

    // Sort by priority then by creation time
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    tasks.sort((a, b) => {
      const prioDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (prioDiff !== 0) return prioDiff
      return a.time.created - b.time.created
    })

    return tasks
  }

  /**
   * List completed tasks (including failed)
   */
  export async function listCompleted(limit = 50): Promise<BackgroundTask[]> {
    await ensureInitialized()

    const completedDir = getCompletedDir()
    const tasks: BackgroundTask[] = []

    try {
      const files = await fs.readdir(completedDir)
      for (const file of files.slice(-limit * 2)) {
        // Read more than limit to account for sorting
        if (!file.endsWith(".json")) continue
        const taskPath = path.join(completedDir, file)
        try {
          using _ = await Lock.read(taskPath)
          const content = await Bun.file(taskPath).json()
          tasks.push(BackgroundTask.parse(content))
        } catch {
          continue
        }
      }
    } catch {
      return []
    }

    // Sort by completion time descending
    tasks.sort((a, b) => (b.time.completed ?? 0) - (a.time.completed ?? 0))

    return tasks.slice(0, limit)
  }

  /**
   * List all tasks (active + recent completed)
   */
  export async function listAll(completedLimit = 10): Promise<BackgroundTask[]> {
    const active = await listActive()
    const completed = await listCompleted(completedLimit)
    return [...active, ...completed]
  }

  /**
   * Get running task count
   */
  export async function getRunningCount(): Promise<number> {
    const active = await listActive()
    return active.filter((t) => t.status === "running").length
  }

  /**
   * Clear completed tasks older than specified days
   */
  export async function clearOldCompleted(daysOld = 7): Promise<number> {
    await ensureInitialized()

    const completedDir = getCompletedDir()
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000
    let cleared = 0

    try {
      const files = await fs.readdir(completedDir)
      for (const file of files) {
        if (!file.endsWith(".json")) continue
        const taskPath = path.join(completedDir, file)
        try {
          const content = await Bun.file(taskPath).json()
          const task = BackgroundTask.parse(content)
          if ((task.time.completed ?? 0) < cutoff) {
            await fs.unlink(taskPath)
            cleared++
          }
        } catch {
          continue
        }
      }
    } catch {
      return 0
    }

    log.info("cleared old completed tasks", { count: cleared, daysOld })
    return cleared
  }
}
