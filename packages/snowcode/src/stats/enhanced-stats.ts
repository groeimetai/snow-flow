import z from "zod/v4"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Storage } from "../storage/storage"
import { Instance } from "../project/instance"
import { Log } from "../util/log"

/**
 * Enhanced Statistics Module - Advanced analytics for Snow-Code
 *
 * Provides comprehensive statistics including:
 * - Model breakdown with cost per model
 * - Daily/weekly/monthly cost tracking
 * - Tool usage analytics
 * - Session performance metrics
 * - Token efficiency analysis
 */

export namespace EnhancedStats {
  const log = Log.create({ service: "enhanced-stats" })

  // ============================================================================
  // SCHEMAS
  // ============================================================================

  export const TokenStats = z.object({
    input: z.number(),
    output: z.number(),
    reasoning: z.number(),
    cache: z.object({
      read: z.number(),
      write: z.number(),
    }),
  })
  export type TokenStats = z.infer<typeof TokenStats>

  export const ModelStats = z.object({
    modelID: z.string(),
    providerID: z.string(),
    messageCount: z.number(),
    cost: z.number(),
    tokens: TokenStats,
  })
  export type ModelStats = z.infer<typeof ModelStats>

  export const DailyStats = z.object({
    date: z.string(), // YYYY-MM-DD
    timestamp: z.number(),
    sessionCount: z.number(),
    messageCount: z.number(),
    cost: z.number(),
    tokens: TokenStats,
  })
  export type DailyStats = z.infer<typeof DailyStats>

  export const ToolStats = z.object({
    tool: z.string(),
    count: z.number(),
    avgDuration: z.number(),
    errorCount: z.number(),
    successRate: z.number(),
  })
  export type ToolStats = z.infer<typeof ToolStats>

  export const SessionMetrics = z.object({
    sessionID: z.string(),
    title: z.string(),
    messageCount: z.number(),
    cost: z.number(),
    tokens: TokenStats,
    duration: z.number(), // milliseconds
    toolCalls: z.number(),
    time: z.object({
      created: z.number(),
      updated: z.number(),
    }),
  })
  export type SessionMetrics = z.infer<typeof SessionMetrics>

  export const ComprehensiveStats = z.object({
    overview: z.object({
      totalSessions: z.number(),
      totalMessages: z.number(),
      totalCost: z.number(),
      totalTokens: TokenStats,
      dateRange: z.object({
        earliest: z.number(),
        latest: z.number(),
      }),
      days: z.number(),
      costPerDay: z.number(),
    }),
    byModel: z.array(ModelStats),
    byDay: z.array(DailyStats),
    byTool: z.array(ToolStats),
    topSessions: z.array(SessionMetrics),
    efficiency: z.object({
      cacheHitRate: z.number(),
      avgTokensPerMessage: z.number(),
      avgCostPerSession: z.number(),
      avgMessagesPerSession: z.number(),
    }),
  })
  export type ComprehensiveStats = z.infer<typeof ComprehensiveStats>

  // ============================================================================
  // CALCULATION HELPERS
  // ============================================================================

  function emptyTokens(): TokenStats {
    return {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    }
  }

  function addTokens(a: TokenStats, b: TokenStats): TokenStats {
    return {
      input: a.input + b.input,
      output: a.output + b.output,
      reasoning: a.reasoning + b.reasoning,
      cache: {
        read: a.cache.read + b.cache.read,
        write: a.cache.write + b.cache.write,
      },
    }
  }

  function formatDate(timestamp: number): string {
    const d = new Date(timestamp)
    return d.toISOString().split("T")[0]
  }

  // ============================================================================
  // MAIN CALCULATION
  // ============================================================================

  export async function calculate(options?: {
    projectID?: string
    days?: number
    limit?: number
  }): Promise<ComprehensiveStats> {
    const projectID = options?.projectID ?? Instance.project.id
    const daysFilter = options?.days ?? 30
    const limit = options?.limit ?? 10
    const cutoffTime = Date.now() - daysFilter * 24 * 60 * 60 * 1000

    // Accumulators
    const modelMap = new Map<string, ModelStats>()
    const dailyMap = new Map<string, DailyStats>()
    const toolMap = new Map<string, { count: number; totalDuration: number; errors: number }>()
    const sessionMetrics: SessionMetrics[] = []

    let totalSessions = 0
    let totalMessages = 0
    let totalCost = 0
    let totalTokens = emptyTokens()
    let earliestTime = Date.now()
    let latestTime = 0

    // Iterate through all sessions
    for (const sessionPath of await Storage.list(["session", projectID])) {
      const session = await Storage.read<Session.Info>(sessionPath)
      if (!session) continue

      // Apply date filter
      if (session.time.created < cutoffTime) continue

      totalSessions++

      if (session.time.created < earliestTime) earliestTime = session.time.created
      if (session.time.updated > latestTime) latestTime = session.time.updated

      // Session-level metrics
      let sessionCost = 0
      let sessionTokens = emptyTokens()
      let sessionMessageCount = 0
      let sessionToolCalls = 0

      // Process messages
      const messages = await Session.messages(session.id) as MessageV2.WithParts[]
      for (const msg of messages) {
        if (msg.info.role !== "assistant") continue

        const assistant = msg.info as MessageV2.Assistant
        sessionMessageCount++
        totalMessages++

        // Cost and tokens
        const cost = assistant.cost ?? 0
        const tokens = assistant.tokens ?? emptyTokens()

        sessionCost += cost
        sessionTokens = addTokens(sessionTokens, tokens)
        totalCost += cost
        totalTokens = addTokens(totalTokens, tokens)

        // Model breakdown
        const modelKey = `${assistant.providerID}/${assistant.modelID}`
        const existing = modelMap.get(modelKey)
        if (existing) {
          existing.messageCount++
          existing.cost += cost
          existing.tokens = addTokens(existing.tokens, tokens)
        } else {
          modelMap.set(modelKey, {
            modelID: assistant.modelID,
            providerID: assistant.providerID,
            messageCount: 1,
            cost,
            tokens: { ...tokens },
          })
        }

        // Daily breakdown
        const dateKey = formatDate(assistant.time.created)
        const dayStats = dailyMap.get(dateKey)
        if (dayStats) {
          dayStats.messageCount++
          dayStats.cost += cost
          dayStats.tokens = addTokens(dayStats.tokens, tokens)
        } else {
          dailyMap.set(dateKey, {
            date: dateKey,
            timestamp: new Date(dateKey).getTime(),
            sessionCount: 0, // Will be updated later
            messageCount: 1,
            cost,
            tokens: { ...tokens },
          })
        }

        // Tool usage
        for (const part of msg.parts) {
          if (part.type !== "tool") continue
          sessionToolCalls++

          const toolPart = part as MessageV2.ToolPart
          const toolName = toolPart.tool
          const toolData = toolMap.get(toolName) ?? { count: 0, totalDuration: 0, errors: 0 }

          toolData.count++

          if (toolPart.state.status === "completed") {
            const duration = toolPart.state.time.end - toolPart.state.time.start
            toolData.totalDuration += duration
          } else if (toolPart.state.status === "error") {
            toolData.errors++
          }

          toolMap.set(toolName, toolData)
        }
      }

      // Update daily session count
      const sessionDateKey = formatDate(session.time.created)
      const sessionDayStats = dailyMap.get(sessionDateKey)
      if (sessionDayStats) {
        sessionDayStats.sessionCount++
      }

      // Add to session metrics
      sessionMetrics.push({
        sessionID: session.id,
        title: session.title,
        messageCount: sessionMessageCount,
        cost: sessionCost,
        tokens: sessionTokens,
        duration: session.time.updated - session.time.created,
        toolCalls: sessionToolCalls,
        time: session.time,
      })
    }

    // Sort and limit sessions by cost
    sessionMetrics.sort((a, b) => b.cost - a.cost)
    const topSessions = sessionMetrics.slice(0, limit)

    // Convert maps to arrays
    const byModel = Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost)
    const byDay = Array.from(dailyMap.values()).sort((a, b) => a.timestamp - b.timestamp)
    const byTool: ToolStats[] = Array.from(toolMap.entries())
      .map(([tool, data]) => ({
        tool,
        count: data.count,
        avgDuration: data.count > 0 ? data.totalDuration / data.count : 0,
        errorCount: data.errors,
        successRate: data.count > 0 ? ((data.count - data.errors) / data.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Calculate efficiency metrics
    const totalInputTokens = totalTokens.input + totalTokens.cache.read
    const cacheHitRate = totalInputTokens > 0 ? (totalTokens.cache.read / totalInputTokens) * 100 : 0

    const days = Math.max(1, Math.ceil((latestTime - earliestTime) / (24 * 60 * 60 * 1000)))
    const costPerDay = days > 0 ? totalCost / days : 0

    return {
      overview: {
        totalSessions,
        totalMessages,
        totalCost,
        totalTokens,
        dateRange: {
          earliest: earliestTime,
          latest: latestTime,
        },
        days,
        costPerDay,
      },
      byModel,
      byDay,
      byTool,
      topSessions,
      efficiency: {
        cacheHitRate,
        avgTokensPerMessage:
          totalMessages > 0 ? (totalTokens.input + totalTokens.output) / totalMessages : 0,
        avgCostPerSession: totalSessions > 0 ? totalCost / totalSessions : 0,
        avgMessagesPerSession: totalSessions > 0 ? totalMessages / totalSessions : 0,
      },
    }
  }

  // ============================================================================
  // QUICK STATS (for status bar)
  // ============================================================================

  export async function quickStats(projectID?: string): Promise<{
    todayCost: number
    todayMessages: number
    weekCost: number
    weekMessages: number
  }> {
    const pid = projectID ?? Instance.project.id
    const now = Date.now()
    const todayStart = new Date().setHours(0, 0, 0, 0)
    const weekStart = now - 7 * 24 * 60 * 60 * 1000

    let todayCost = 0
    let todayMessages = 0
    let weekCost = 0
    let weekMessages = 0

    for (const sessionPath of await Storage.list(["session", pid])) {
      const session = await Storage.read<Session.Info>(sessionPath)
      if (!session || session.time.created < weekStart) continue

      const messages = await Session.messages(session.id) as MessageV2.WithParts[]
      for (const msg of messages) {
        if (msg.info.role !== "assistant") continue
        const assistant = msg.info as MessageV2.Assistant
        const cost = assistant.cost ?? 0

        weekCost += cost
        weekMessages++

        if (assistant.time.created >= todayStart) {
          todayCost += cost
          todayMessages++
        }
      }
    }

    return { todayCost, todayMessages, weekCost, weekMessages }
  }
}
