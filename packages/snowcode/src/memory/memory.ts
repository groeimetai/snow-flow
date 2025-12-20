import z from "zod/v4"
import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { Log } from "../util/log"
import { Lock } from "../util/lock"
import { Bus } from "../bus"

/**
 * Memory Module - Deep Session Memory for Snow-Code
 *
 * Provides structured, persistent memory for sessions including:
 * - Session title (auto-generated)
 * - Current status (completed, discussion points, open questions)
 * - Learnings (insights discovered during session)
 * - Key results (concrete outcomes)
 * - Work log (chronological activity log)
 *
 * Storage structure:
 * ~/.local/share/snow-code/memory/
 * ├── projects/
 * │   └── <project_id>/
 * │       ├── sessions/
 * │       │   └── <session_id>/
 * │       │       ├── memory.json      # Main memory file
 * │       │       └── worklog.jsonl    # Append-only work log
 * │       └── learnings.json           # Cross-session learnings
 * └── global_learnings.json            # Cross-project learnings
 */

export namespace Memory {
  const log = Log.create({ service: "memory" })

  // ============================================================================
  // SCHEMAS
  // ============================================================================

  export const WorkLogEntry = z
    .object({
      timestamp: z.number(),
      type: z.enum([
        "user_request",
        "ai_response",
        "tool_call",
        "tool_result",
        "file_created",
        "file_modified",
        "file_deleted",
        "error",
        "compaction",
        "learning",
      ]),
      summary: z.string(),
      metadata: z.record(z.string(), z.any()).optional(),
    })
    .meta({
      ref: "WorkLogEntry",
    })
  export type WorkLogEntry = z.infer<typeof WorkLogEntry>

  export const KeyResult = z
    .object({
      type: z.enum(["file_created", "file_modified", "file_deleted", "artifact_created", "task_completed", "other"]),
      description: z.string(),
      path: z.string().optional(),
      sysId: z.string().optional(),
      timestamp: z.number(),
    })
    .meta({
      ref: "KeyResult",
    })
  export type KeyResult = z.infer<typeof KeyResult>

  export const Learning = z
    .object({
      id: z.string(),
      category: z.enum(["codebase", "user_preference", "pattern", "api", "configuration", "other"]),
      insight: z.string(),
      context: z.string().optional(),
      timestamp: z.number(),
      sessionID: z.string().optional(),
    })
    .meta({
      ref: "Learning",
    })
  export type Learning = z.infer<typeof Learning>

  export const CurrentStatus = z
    .object({
      completed: z.array(z.string()),
      discussionPoints: z.array(z.string()),
      openQuestions: z.array(z.string()),
    })
    .meta({
      ref: "CurrentStatus",
    })
  export type CurrentStatus = z.infer<typeof CurrentStatus>

  export const SessionMemory = z
    .object({
      sessionID: z.string(),
      projectID: z.string(),
      title: z.string(),
      titleGenerated: z.boolean().default(false),
      currentStatus: CurrentStatus,
      learnings: z.array(Learning),
      keyResults: z.array(KeyResult),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "SessionMemory",
    })
  export type SessionMemory = z.infer<typeof SessionMemory>

  export const ProjectLearnings = z
    .object({
      projectID: z.string(),
      learnings: z.array(Learning),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "ProjectLearnings",
    })
  export type ProjectLearnings = z.infer<typeof ProjectLearnings>

  // ============================================================================
  // EVENTS
  // ============================================================================

  export const Event = {
    MemoryUpdated: Bus.event(
      "memory.updated",
      z.object({
        sessionID: z.string(),
        projectID: z.string(),
        field: z.enum(["title", "status", "learnings", "keyResults", "worklog"]),
      }),
    ),
    LearningAdded: Bus.event(
      "memory.learning.added",
      z.object({
        learning: Learning,
        projectID: z.string(),
        sessionID: z.string().optional(),
      }),
    ),
    WorkLogAppended: Bus.event(
      "memory.worklog.appended",
      z.object({
        sessionID: z.string(),
        entry: WorkLogEntry,
      }),
    ),
  }

  // ============================================================================
  // PATH HELPERS
  // ============================================================================

  function getSessionMemoryDir(projectID: string, sessionID: string): string {
    return path.join(Global.Path.memory, "projects", projectID, "sessions", sessionID)
  }

  function getSessionMemoryPath(projectID: string, sessionID: string): string {
    return path.join(getSessionMemoryDir(projectID, sessionID), "memory.json")
  }

  function getWorkLogPath(projectID: string, sessionID: string): string {
    return path.join(getSessionMemoryDir(projectID, sessionID), "worklog.jsonl")
  }

  function getProjectLearningsPath(projectID: string): string {
    return path.join(Global.Path.memory, "projects", projectID, "learnings.json")
  }

  function getGlobalLearningsPath(): string {
    return path.join(Global.Path.memory, "global_learnings.json")
  }

  // ============================================================================
  // SESSION MEMORY OPERATIONS
  // ============================================================================

  /**
   * Get the path to the session memory file
   */
  export function getPath(projectID: string, sessionID: string): string {
    return getSessionMemoryPath(projectID, sessionID)
  }

  /**
   * Get the directory containing all memory for a session
   */
  export function getDirectory(projectID: string, sessionID: string): string {
    return getSessionMemoryDir(projectID, sessionID)
  }

  /**
   * Create a new session memory
   */
  export async function create(input: { sessionID: string; projectID: string; title?: string }): Promise<SessionMemory> {
    const memoryDir = getSessionMemoryDir(input.projectID, input.sessionID)
    await fs.mkdir(memoryDir, { recursive: true })

    const memory: SessionMemory = {
      sessionID: input.sessionID,
      projectID: input.projectID,
      title: input.title ?? `New session - ${new Date().toISOString()}`,
      titleGenerated: false,
      currentStatus: {
        completed: [],
        discussionPoints: [],
        openQuestions: [],
      },
      learnings: [],
      keyResults: [],
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    }

    await write(input.projectID, input.sessionID, memory)
    log.info("created session memory", { sessionID: input.sessionID, projectID: input.projectID })
    return memory
  }

  /**
   * Read session memory, returns null if not found
   */
  export async function read(projectID: string, sessionID: string): Promise<SessionMemory | null> {
    const memoryPath = getSessionMemoryPath(projectID, sessionID)
    try {
      using _ = await Lock.read(memoryPath)
      const content = await Bun.file(memoryPath).json()
      return SessionMemory.parse(content)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }
      log.error("failed to read session memory", { error: e, projectID, sessionID })
      throw e
    }
  }

  /**
   * Get session memory, creating if it doesn't exist
   */
  export async function getOrCreate(projectID: string, sessionID: string): Promise<SessionMemory> {
    const existing = await read(projectID, sessionID)
    if (existing) return existing
    return create({ sessionID, projectID })
  }

  /**
   * Write session memory
   */
  export async function write(projectID: string, sessionID: string, memory: SessionMemory): Promise<void> {
    const memoryPath = getSessionMemoryPath(projectID, sessionID)
    const memoryDir = getSessionMemoryDir(projectID, sessionID)

    await fs.mkdir(memoryDir, { recursive: true })

    using _ = await Lock.write("memory")
    memory.time.updated = Date.now()
    await Bun.write(memoryPath, JSON.stringify(memory, null, 2))
  }

  /**
   * Update session memory with a mutation function
   */
  export async function update(
    projectID: string,
    sessionID: string,
    updater: (memory: SessionMemory) => void,
  ): Promise<SessionMemory> {
    const memory = await getOrCreate(projectID, sessionID)
    updater(memory)
    memory.time.updated = Date.now()
    await write(projectID, sessionID, memory)
    return memory
  }

  /**
   * Update session title
   */
  export async function updateTitle(
    projectID: string,
    sessionID: string,
    title: string,
    generated = false,
  ): Promise<void> {
    await update(projectID, sessionID, (memory) => {
      memory.title = title
      memory.titleGenerated = generated
    })
    Bus.publish(Event.MemoryUpdated, {
      sessionID,
      projectID,
      field: "title",
    })
  }

  /**
   * Update current status
   */
  export async function updateStatus(
    projectID: string,
    sessionID: string,
    status: Partial<CurrentStatus>,
  ): Promise<void> {
    await update(projectID, sessionID, (memory) => {
      if (status.completed !== undefined) memory.currentStatus.completed = status.completed
      if (status.discussionPoints !== undefined) memory.currentStatus.discussionPoints = status.discussionPoints
      if (status.openQuestions !== undefined) memory.currentStatus.openQuestions = status.openQuestions
    })
    Bus.publish(Event.MemoryUpdated, {
      sessionID,
      projectID,
      field: "status",
    })
  }

  /**
   * Add a completed item to status
   */
  export async function addCompleted(projectID: string, sessionID: string, item: string): Promise<void> {
    await update(projectID, sessionID, (memory) => {
      if (!memory.currentStatus.completed.includes(item)) {
        memory.currentStatus.completed.push(item)
      }
    })
    Bus.publish(Event.MemoryUpdated, {
      sessionID,
      projectID,
      field: "status",
    })
  }

  /**
   * Add a key result
   */
  export async function addKeyResult(projectID: string, sessionID: string, result: Omit<KeyResult, "timestamp">): Promise<void> {
    const keyResult: KeyResult = {
      ...result,
      timestamp: Date.now(),
    }
    await update(projectID, sessionID, (memory) => {
      memory.keyResults.push(keyResult)
    })
    Bus.publish(Event.MemoryUpdated, {
      sessionID,
      projectID,
      field: "keyResults",
    })
  }

  // ============================================================================
  // WORK LOG OPERATIONS
  // ============================================================================

  /**
   * Append an entry to the work log (append-only JSONL file)
   */
  export async function appendWorkLog(
    projectID: string,
    sessionID: string,
    entry: Omit<WorkLogEntry, "timestamp">,
  ): Promise<void> {
    const workLogPath = getWorkLogPath(projectID, sessionID)
    const memoryDir = getSessionMemoryDir(projectID, sessionID)

    await fs.mkdir(memoryDir, { recursive: true })

    const fullEntry: WorkLogEntry = {
      ...entry,
      timestamp: Date.now(),
    }

    using _ = await Lock.write("worklog")
    await fs.appendFile(workLogPath, JSON.stringify(fullEntry) + "\n")

    Bus.publish(Event.WorkLogAppended, {
      sessionID,
      entry: fullEntry,
    })
  }

  /**
   * Read all work log entries
   */
  export async function readWorkLog(projectID: string, sessionID: string): Promise<WorkLogEntry[]> {
    const workLogPath = getWorkLogPath(projectID, sessionID)
    try {
      using _ = await Lock.read(workLogPath)
      const content = await Bun.file(workLogPath).text()
      const lines = content.trim().split("\n").filter(Boolean)
      return lines.map((line) => WorkLogEntry.parse(JSON.parse(line)))
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return []
      }
      log.error("failed to read work log", { error: e, projectID, sessionID })
      throw e
    }
  }

  /**
   * Get recent work log entries
   */
  export async function getRecentWorkLog(
    projectID: string,
    sessionID: string,
    limit = 50,
  ): Promise<WorkLogEntry[]> {
    const entries = await readWorkLog(projectID, sessionID)
    return entries.slice(-limit)
  }

  // ============================================================================
  // LEARNINGS OPERATIONS
  // ============================================================================

  /**
   * Add a learning to the session
   */
  export async function addLearning(
    projectID: string,
    sessionID: string,
    learning: Omit<Learning, "id" | "timestamp" | "sessionID">,
  ): Promise<Learning> {
    const fullLearning: Learning = {
      ...learning,
      id: `learning_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      sessionID,
    }

    await update(projectID, sessionID, (memory) => {
      memory.learnings.push(fullLearning)
    })

    Bus.publish(Event.LearningAdded, {
      learning: fullLearning,
      projectID,
      sessionID,
    })

    Bus.publish(Event.MemoryUpdated, {
      sessionID,
      projectID,
      field: "learnings",
    })

    return fullLearning
  }

  /**
   * Promote a learning to project-level learnings
   */
  export async function promoteLearningToProject(projectID: string, learning: Learning): Promise<void> {
    const learningsPath = getProjectLearningsPath(projectID)
    const learningsDir = path.dirname(learningsPath)

    await fs.mkdir(learningsDir, { recursive: true })

    let projectLearnings: ProjectLearnings
    try {
      using _ = await Lock.read(learningsPath)
      const content = await Bun.file(learningsPath).json()
      projectLearnings = ProjectLearnings.parse(content)
    } catch {
      projectLearnings = {
        projectID,
        learnings: [],
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      }
    }

    // Check for duplicates
    const isDuplicate = projectLearnings.learnings.some(
      (l) => l.insight === learning.insight && l.category === learning.category,
    )
    if (!isDuplicate) {
      projectLearnings.learnings.push(learning)
      projectLearnings.time.updated = Date.now()

      using _ = await Lock.write("project-learnings")
      await Bun.write(learningsPath, JSON.stringify(projectLearnings, null, 2))

      log.info("promoted learning to project", { projectID, learningId: learning.id })
    }
  }

  /**
   * Get all project-level learnings
   */
  export async function getProjectLearnings(projectID: string): Promise<Learning[]> {
    const learningsPath = getProjectLearningsPath(projectID)
    try {
      using _ = await Lock.read(learningsPath)
      const content = await Bun.file(learningsPath).json()
      const projectLearnings = ProjectLearnings.parse(content)
      return projectLearnings.learnings
    } catch {
      return []
    }
  }

  // ============================================================================
  // EXPORT & UTILITY OPERATIONS
  // ============================================================================

  /**
   * Export session memory as markdown
   */
  export async function exportAsMarkdown(projectID: string, sessionID: string): Promise<string> {
    const memory = await read(projectID, sessionID)
    if (!memory) {
      throw new Error(`Session memory not found: ${sessionID}`)
    }

    const workLog = await readWorkLog(projectID, sessionID)

    let md = `# ${memory.title}\n\n`
    md += `**Session ID:** ${memory.sessionID}\n`
    md += `**Project ID:** ${memory.projectID}\n`
    md += `**Created:** ${new Date(memory.time.created).toISOString()}\n`
    md += `**Updated:** ${new Date(memory.time.updated).toISOString()}\n\n`

    md += `## Current Status\n\n`

    if (memory.currentStatus.completed.length > 0) {
      md += `### Completed\n`
      memory.currentStatus.completed.forEach((item) => {
        md += `- ${item}\n`
      })
      md += `\n`
    }

    if (memory.currentStatus.discussionPoints.length > 0) {
      md += `### Discussion Points\n`
      memory.currentStatus.discussionPoints.forEach((item) => {
        md += `- ${item}\n`
      })
      md += `\n`
    }

    if (memory.currentStatus.openQuestions.length > 0) {
      md += `### Open Questions\n`
      memory.currentStatus.openQuestions.forEach((item) => {
        md += `- ${item}\n`
      })
      md += `\n`
    }

    if (memory.keyResults.length > 0) {
      md += `## Key Results\n\n`
      memory.keyResults.forEach((result) => {
        md += `- **[${result.type}]** ${result.description}`
        if (result.path) md += ` (${result.path})`
        md += `\n`
      })
      md += `\n`
    }

    if (memory.learnings.length > 0) {
      md += `## Learnings\n\n`
      memory.learnings.forEach((learning) => {
        md += `### ${learning.category}\n`
        md += `${learning.insight}\n`
        if (learning.context) md += `*Context: ${learning.context}*\n`
        md += `\n`
      })
    }

    if (workLog.length > 0) {
      md += `## Work Log\n\n`
      workLog.forEach((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString()
        md += `- **${time}** [${entry.type}] ${entry.summary}\n`
      })
    }

    return md
  }

  /**
   * Check if session memory exists
   */
  export async function exists(projectID: string, sessionID: string): Promise<boolean> {
    const memoryPath = getSessionMemoryPath(projectID, sessionID)
    try {
      await fs.access(memoryPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete session memory
   */
  export async function remove(projectID: string, sessionID: string): Promise<void> {
    const memoryDir = getSessionMemoryDir(projectID, sessionID)
    try {
      await fs.rm(memoryDir, { recursive: true, force: true })
      log.info("removed session memory", { sessionID, projectID })
    } catch (e) {
      log.error("failed to remove session memory", { error: e, projectID, sessionID })
    }
  }

  /**
   * List all sessions with memory for a project
   */
  export async function listSessions(projectID: string): Promise<string[]> {
    const sessionsDir = path.join(Global.Path.memory, "projects", projectID, "sessions")
    try {
      const entries = await fs.readdir(sessionsDir)
      return entries
    } catch {
      return []
    }
  }
}
