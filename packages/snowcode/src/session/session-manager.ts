import z from "zod/v4"
import path from "path"
import { Session } from "./index"
import { MessageV2 } from "./message-v2"
import { Storage } from "../storage/storage"
import { Project } from "../project/project"
import { Log } from "../util/log"
import { Bus } from "../bus"

/**
 * Session Manager - Enhanced session operations for Snow-Code
 *
 * Provides:
 * - Global session listing (across all projects)
 * - Session rename/retitle
 * - Session search and filtering
 * - Fork tree navigation
 * - Session metadata and statistics
 */

export namespace SessionManager {
  const log = Log.create({ service: "session-manager" })

  // ============================================================================
  // SCHEMAS
  // ============================================================================

  export const SessionSummary = z.object({
    id: z.string(),
    projectID: z.string(),
    projectPath: z.string(),
    title: z.string(),
    parentID: z.string().optional(),
    hasChildren: z.boolean(),
    childCount: z.number(),
    messageCount: z.number(),
    cost: z.number(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
    }),
    time: z.object({
      created: z.number(),
      updated: z.number(),
    }),
    shared: z.boolean(),
  })
  export type SessionSummary = z.infer<typeof SessionSummary>

  export const GlobalSessionList = z.object({
    sessions: z.array(SessionSummary),
    projects: z.array(
      z.object({
        id: z.string(),
        path: z.string(),
        sessionCount: z.number(),
      })
    ),
    total: z.number(),
  })
  export type GlobalSessionList = z.infer<typeof GlobalSessionList>

  // ============================================================================
  // EVENTS
  // ============================================================================

  export const Event = {
    SessionRenamed: Bus.event(
      "session.renamed",
      z.object({
        sessionID: z.string(),
        projectID: z.string(),
        oldTitle: z.string(),
        newTitle: z.string(),
      })
    ),
  }

  // ============================================================================
  // GLOBAL SESSION OPERATIONS
  // ============================================================================

  /**
   * List all sessions across all projects
   */
  export async function listGlobal(options?: {
    limit?: number
    search?: string
    projectID?: string
    sortBy?: "updated" | "created" | "cost" | "messages"
    sortOrder?: "asc" | "desc"
  }): Promise<GlobalSessionList> {
    const limit = options?.limit ?? 50
    const search = options?.search?.toLowerCase()
    const filterProjectID = options?.projectID
    const sortBy = options?.sortBy ?? "updated"
    const sortOrder = options?.sortOrder ?? "desc"

    const projects = await Project.list()
    const projectMap = new Map<string, Project.Info>()
    for (const p of projects) {
      projectMap.set(p.id, p)
    }

    const allSessions: SessionSummary[] = []
    const projectStats = new Map<string, number>()

    for (const project of projects) {
      if (filterProjectID && project.id !== filterProjectID) continue

      const sessionPaths = await Storage.list(["session", project.id])
      let projectSessionCount = 0

      for (const sessionPath of sessionPaths) {
        try {
          const session = await Storage.read<Session.Info>(sessionPath)
          if (!session) continue

          projectSessionCount++

          // Apply search filter
          if (search && !session.title.toLowerCase().includes(search)) {
            continue
          }

          // Get session statistics
          const stats = await getSessionStats(session.id)
          const children = await getChildCount(project.id, session.id)

          allSessions.push({
            id: session.id,
            projectID: project.id,
            projectPath: project.worktree,
            title: session.title,
            parentID: session.parentID,
            hasChildren: children > 0,
            childCount: children,
            messageCount: stats.messageCount,
            cost: stats.cost,
            tokens: stats.tokens,
            time: session.time,
            shared: !!session.share,
          })
        } catch (e) {
          log.error("failed to read session", { path: sessionPath, error: e })
        }
      }

      projectStats.set(project.id, projectSessionCount)
    }

    // Sort sessions
    allSessions.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case "updated":
          comparison = a.time.updated - b.time.updated
          break
        case "created":
          comparison = a.time.created - b.time.created
          break
        case "cost":
          comparison = a.cost - b.cost
          break
        case "messages":
          comparison = a.messageCount - b.messageCount
          break
      }
      return sortOrder === "desc" ? -comparison : comparison
    })

    // Build project list
    const projectList = projects.map((p) => ({
      id: p.id,
      path: p.worktree,
      sessionCount: projectStats.get(p.id) ?? 0,
    }))

    return {
      sessions: allSessions.slice(0, limit),
      projects: projectList,
      total: allSessions.length,
    }
  }

  /**
   * Get a session by ID (searches across all projects)
   */
  export async function getGlobal(sessionID: string): Promise<{
    session: Session.Info
    project: Project.Info
  } | null> {
    const projects = await Project.list()

    for (const project of projects) {
      try {
        const session = await Storage.read<Session.Info>(["session", project.id, sessionID])
        if (session) {
          return { session, project }
        }
      } catch {
        continue
      }
    }

    return null
  }

  /**
   * Find recent sessions across all projects
   */
  export async function findRecent(limit = 10): Promise<SessionSummary[]> {
    const result = await listGlobal({ limit, sortBy: "updated", sortOrder: "desc" })
    return result.sessions
  }

  /**
   * Search sessions by title
   */
  export async function search(query: string, limit = 20): Promise<SessionSummary[]> {
    const result = await listGlobal({ limit, search: query })
    return result.sessions
  }

  // ============================================================================
  // SESSION MODIFICATIONS
  // ============================================================================

  /**
   * Rename a session
   */
  export async function rename(
    sessionID: string,
    newTitle: string,
    projectID?: string
  ): Promise<Session.Info | null> {
    // Find the session
    let pid = projectID
    if (!pid) {
      const found = await getGlobal(sessionID)
      if (!found) return null
      pid = found.project.id
    }

    const oldSession = await Storage.read<Session.Info>(["session", pid, sessionID])
    if (!oldSession) return null

    const oldTitle = oldSession.title

    const updated = await Storage.update<Session.Info>(["session", pid, sessionID], (draft) => {
      draft.title = newTitle
      draft.time.updated = Date.now()
    })

    log.info("session renamed", { sessionID, oldTitle, newTitle })
    Bus.publish(Event.SessionRenamed, {
      sessionID,
      projectID: pid,
      oldTitle,
      newTitle,
    })

    return updated
  }

  /**
   * Update session title automatically based on content
   */
  export async function autoTitle(
    sessionID: string,
    projectID?: string
  ): Promise<string | null> {
    // Find the session
    let pid = projectID
    if (!pid) {
      const found = await getGlobal(sessionID)
      if (!found) return null
      pid = found.project.id
    }

    // Get first user message
    const messages = await Storage.list(["message", sessionID])
    for (const msgPath of messages.slice(0, 5)) {
      const msg = await Storage.read<MessageV2.Info>(msgPath)
      if (msg?.role === "user") {
        // Get the first text part
        const parts = await Storage.list(["part", msg.id])
        for (const partPath of parts) {
          const part = await Storage.read<MessageV2.Part>(partPath)
          if (part?.type === "text" && part.text) {
            // Use first line or first 50 chars as title
            const text = part.text.trim()
            const firstLine = text.split("\n")[0]
            const title = firstLine.length > 50 ? firstLine.slice(0, 47) + "..." : firstLine
            await rename(sessionID, title, pid)
            return title
          }
        }
      }
    }

    return null
  }

  // ============================================================================
  // SESSION STATISTICS
  // ============================================================================

  async function getSessionStats(sessionID: string): Promise<{
    messageCount: number
    cost: number
    tokens: { input: number; output: number }
  }> {
    let messageCount = 0
    let cost = 0
    let inputTokens = 0
    let outputTokens = 0

    const messagePaths = await Storage.list(["message", sessionID])
    for (const msgPath of messagePaths) {
      try {
        const msg = await Storage.read<MessageV2.Info>(msgPath)
        if (!msg) continue
        messageCount++

        if (msg.role === "assistant") {
          const assistant = msg as MessageV2.Assistant
          cost += assistant.cost ?? 0
          inputTokens += assistant.tokens?.input ?? 0
          outputTokens += assistant.tokens?.output ?? 0
        }
      } catch {
        continue
      }
    }

    return {
      messageCount,
      cost,
      tokens: { input: inputTokens, output: outputTokens },
    }
  }

  async function getChildCount(projectID: string, sessionID: string): Promise<number> {
    let count = 0
    const sessionPaths = await Storage.list(["session", projectID])

    for (const sessionPath of sessionPaths) {
      try {
        const session = await Storage.read<Session.Info>(sessionPath)
        if (session?.parentID === sessionID) {
          count++
        }
      } catch {
        continue
      }
    }

    return count
  }

  // ============================================================================
  // FORK OPERATIONS
  // ============================================================================

  /**
   * Get all children of a session (direct forks)
   */
  export async function getChildren(
    sessionID: string,
    projectID?: string
  ): Promise<SessionSummary[]> {
    let pid = projectID
    if (!pid) {
      const found = await getGlobal(sessionID)
      if (!found) return []
      pid = found.project.id
    }

    const project = (await Project.list()).find((p) => p.id === pid)
    if (!project) return []

    const children: SessionSummary[] = []
    const sessionPaths = await Storage.list(["session", pid])

    for (const sessionPath of sessionPaths) {
      try {
        const session = await Storage.read<Session.Info>(sessionPath)
        if (session?.parentID === sessionID) {
          const stats = await getSessionStats(session.id)
          const childCount = await getChildCount(pid, session.id)

          children.push({
            id: session.id,
            projectID: pid,
            projectPath: project.worktree,
            title: session.title,
            parentID: session.parentID,
            hasChildren: childCount > 0,
            childCount,
            messageCount: stats.messageCount,
            cost: stats.cost,
            tokens: stats.tokens,
            time: session.time,
            shared: !!session.share,
          })
        }
      } catch {
        continue
      }
    }

    // Sort by creation time
    children.sort((a, b) => a.time.created - b.time.created)
    return children
  }

  /**
   * Get the ancestry chain of a session (from root to current)
   */
  export async function getAncestry(
    sessionID: string,
    projectID?: string
  ): Promise<SessionSummary[]> {
    let pid = projectID
    if (!pid) {
      const found = await getGlobal(sessionID)
      if (!found) return []
      pid = found.project.id
    }

    const project = (await Project.list()).find((p) => p.id === pid)
    if (!project) return []

    const ancestry: SessionSummary[] = []
    let currentID: string | undefined = sessionID

    while (currentID) {
      try {
        const sessionData: Session.Info | undefined = await Storage.read<Session.Info>(["session", pid, currentID])
        if (!sessionData) break

        const stats = await getSessionStats(sessionData.id)
        const childCount = await getChildCount(pid, sessionData.id)

        ancestry.unshift({
          id: sessionData.id,
          projectID: pid,
          projectPath: project.worktree,
          title: sessionData.title,
          parentID: sessionData.parentID,
          hasChildren: childCount > 0,
          childCount,
          messageCount: stats.messageCount,
          cost: stats.cost,
          tokens: stats.tokens,
          time: sessionData.time,
          shared: !!sessionData.share,
        })

        currentID = sessionData.parentID
      } catch {
        break
      }
    }

    return ancestry
  }

  /**
   * Get root sessions (sessions without parents)
   */
  export async function getRootSessions(projectID?: string): Promise<SessionSummary[]> {
    const result = await listGlobal({ projectID, limit: 1000 })
    return result.sessions.filter((s) => !s.parentID)
  }
}
