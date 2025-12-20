import path from "path"
import fs from "fs/promises"
import { EnhancedStats } from "./enhanced-stats"
import { Global } from "../global"
import { Log } from "../util/log"

/**
 * Stats Export Module - Export statistics to various formats
 *
 * Supports:
 * - JSON export (full data)
 * - CSV export (tabular data)
 * - Markdown export (formatted report)
 */

export namespace StatsExport {
  const log = Log.create({ service: "stats-export" })

  // ============================================================================
  // JSON EXPORT
  // ============================================================================

  export async function toJSON(stats: EnhancedStats.ComprehensiveStats): Promise<string> {
    return JSON.stringify(stats, null, 2)
  }

  export async function saveJSON(
    stats: EnhancedStats.ComprehensiveStats,
    filename?: string
  ): Promise<string> {
    const exportDir = path.join(Global.Path.data, "exports")
    await fs.mkdir(exportDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fname = filename ?? `stats-${timestamp}.json`
    const filepath = path.join(exportDir, fname)

    await fs.writeFile(filepath, await toJSON(stats), "utf-8")
    log.info("exported stats to JSON", { path: filepath })
    return filepath
  }

  // ============================================================================
  // CSV EXPORT
  // ============================================================================

  function escapeCSV(value: any): string {
    if (value === null || value === undefined) return ""
    const str = String(value)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  function toCSVRow(values: any[]): string {
    return values.map(escapeCSV).join(",")
  }

  export function modelStatsToCSV(stats: EnhancedStats.ComprehensiveStats): string {
    const headers = [
      "Provider",
      "Model",
      "Messages",
      "Cost",
      "Input Tokens",
      "Output Tokens",
      "Reasoning Tokens",
      "Cache Read",
      "Cache Write",
    ]

    const rows = stats.byModel.map((m) => [
      m.providerID,
      m.modelID,
      m.messageCount,
      m.cost.toFixed(4),
      m.tokens.input,
      m.tokens.output,
      m.tokens.reasoning,
      m.tokens.cache.read,
      m.tokens.cache.write,
    ])

    return [toCSVRow(headers), ...rows.map(toCSVRow)].join("\n")
  }

  export function dailyStatsToCSV(stats: EnhancedStats.ComprehensiveStats): string {
    const headers = [
      "Date",
      "Sessions",
      "Messages",
      "Cost",
      "Input Tokens",
      "Output Tokens",
      "Cache Read",
      "Cache Write",
    ]

    const rows = stats.byDay.map((d) => [
      d.date,
      d.sessionCount,
      d.messageCount,
      d.cost.toFixed(4),
      d.tokens.input,
      d.tokens.output,
      d.tokens.cache.read,
      d.tokens.cache.write,
    ])

    return [toCSVRow(headers), ...rows.map(toCSVRow)].join("\n")
  }

  export function toolStatsToCSV(stats: EnhancedStats.ComprehensiveStats): string {
    const headers = ["Tool", "Count", "Avg Duration (ms)", "Errors", "Success Rate (%)"]

    const rows = stats.byTool.map((t) => [
      t.tool,
      t.count,
      t.avgDuration.toFixed(0),
      t.errorCount,
      t.successRate.toFixed(1),
    ])

    return [toCSVRow(headers), ...rows.map(toCSVRow)].join("\n")
  }

  export function sessionStatsToCSV(stats: EnhancedStats.ComprehensiveStats): string {
    const headers = [
      "Session ID",
      "Title",
      "Messages",
      "Cost",
      "Duration (min)",
      "Tool Calls",
      "Created",
    ]

    const rows = stats.topSessions.map((s) => [
      s.sessionID,
      s.title,
      s.messageCount,
      s.cost.toFixed(4),
      (s.duration / 60000).toFixed(1),
      s.toolCalls,
      new Date(s.time.created).toISOString(),
    ])

    return [toCSVRow(headers), ...rows.map(toCSVRow)].join("\n")
  }

  export async function saveCSV(
    stats: EnhancedStats.ComprehensiveStats,
    type: "model" | "daily" | "tool" | "session" | "all" = "all"
  ): Promise<string[]> {
    const exportDir = path.join(Global.Path.data, "exports")
    await fs.mkdir(exportDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const savedFiles: string[] = []

    const exportCSV = async (name: string, content: string) => {
      const filepath = path.join(exportDir, `stats-${name}-${timestamp}.csv`)
      await fs.writeFile(filepath, content, "utf-8")
      savedFiles.push(filepath)
    }

    if (type === "all" || type === "model") {
      await exportCSV("models", modelStatsToCSV(stats))
    }
    if (type === "all" || type === "daily") {
      await exportCSV("daily", dailyStatsToCSV(stats))
    }
    if (type === "all" || type === "tool") {
      await exportCSV("tools", toolStatsToCSV(stats))
    }
    if (type === "all" || type === "session") {
      await exportCSV("sessions", sessionStatsToCSV(stats))
    }

    log.info("exported stats to CSV", { files: savedFiles })
    return savedFiles
  }

  // ============================================================================
  // MARKDOWN EXPORT
  // ============================================================================

  export function toMarkdown(stats: EnhancedStats.ComprehensiveStats): string {
    const lines: string[] = []
    const { overview, byModel, byDay, byTool, topSessions, efficiency } = stats

    // Title
    lines.push("# Snow-Code Statistics Report")
    lines.push("")
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push("")

    // Overview
    lines.push("## Overview")
    lines.push("")
    lines.push("| Metric | Value |")
    lines.push("|--------|-------|")
    lines.push(`| Total Sessions | ${overview.totalSessions.toLocaleString()} |`)
    lines.push(`| Total Messages | ${overview.totalMessages.toLocaleString()} |`)
    lines.push(`| Total Cost | $${overview.totalCost.toFixed(2)} |`)
    lines.push(`| Cost per Day | $${overview.costPerDay.toFixed(2)} |`)
    lines.push(`| Days Active | ${overview.days} |`)
    lines.push(`| Date Range | ${new Date(overview.dateRange.earliest).toLocaleDateString()} - ${new Date(overview.dateRange.latest).toLocaleDateString()} |`)
    lines.push("")

    // Token Summary
    lines.push("## Token Usage")
    lines.push("")
    lines.push("| Type | Count |")
    lines.push("|------|-------|")
    lines.push(`| Input | ${overview.totalTokens.input.toLocaleString()} |`)
    lines.push(`| Output | ${overview.totalTokens.output.toLocaleString()} |`)
    lines.push(`| Reasoning | ${overview.totalTokens.reasoning.toLocaleString()} |`)
    lines.push(`| Cache Read | ${overview.totalTokens.cache.read.toLocaleString()} |`)
    lines.push(`| Cache Write | ${overview.totalTokens.cache.write.toLocaleString()} |`)
    lines.push("")

    // Efficiency
    lines.push("## Efficiency Metrics")
    lines.push("")
    lines.push("| Metric | Value |")
    lines.push("|--------|-------|")
    lines.push(`| Cache Hit Rate | ${efficiency.cacheHitRate.toFixed(1)}% |`)
    lines.push(`| Avg Tokens per Message | ${efficiency.avgTokensPerMessage.toFixed(0)} |`)
    lines.push(`| Avg Cost per Session | $${efficiency.avgCostPerSession.toFixed(4)} |`)
    lines.push(`| Avg Messages per Session | ${efficiency.avgMessagesPerSession.toFixed(1)} |`)
    lines.push("")

    // Model Breakdown
    if (byModel.length > 0) {
      lines.push("## Model Usage")
      lines.push("")
      lines.push("| Provider | Model | Messages | Cost |")
      lines.push("|----------|-------|----------|------|")
      for (const m of byModel.slice(0, 10)) {
        lines.push(`| ${m.providerID} | ${m.modelID} | ${m.messageCount} | $${m.cost.toFixed(2)} |`)
      }
      lines.push("")
    }

    // Daily Breakdown
    if (byDay.length > 0) {
      lines.push("## Daily Activity")
      lines.push("")
      lines.push("| Date | Sessions | Messages | Cost |")
      lines.push("|------|----------|----------|------|")
      for (const d of byDay.slice(-14)) {
        // Last 14 days
        lines.push(`| ${d.date} | ${d.sessionCount} | ${d.messageCount} | $${d.cost.toFixed(2)} |`)
      }
      lines.push("")
    }

    // Tool Usage
    if (byTool.length > 0) {
      lines.push("## Tool Usage")
      lines.push("")
      lines.push("| Tool | Count | Success Rate |")
      lines.push("|------|-------|--------------|")
      for (const t of byTool.slice(0, 15)) {
        lines.push(`| ${t.tool} | ${t.count} | ${t.successRate.toFixed(1)}% |`)
      }
      lines.push("")
    }

    // Top Sessions
    if (topSessions.length > 0) {
      lines.push("## Top Sessions by Cost")
      lines.push("")
      lines.push("| Title | Messages | Cost |")
      lines.push("|-------|----------|------|")
      for (const s of topSessions.slice(0, 10)) {
        const title = s.title.length > 40 ? s.title.slice(0, 37) + "..." : s.title
        lines.push(`| ${title} | ${s.messageCount} | $${s.cost.toFixed(2)} |`)
      }
      lines.push("")
    }

    lines.push("---")
    lines.push("*Report generated by Snow-Code*")

    return lines.join("\n")
  }

  export async function saveMarkdown(
    stats: EnhancedStats.ComprehensiveStats,
    filename?: string
  ): Promise<string> {
    const exportDir = path.join(Global.Path.data, "exports")
    await fs.mkdir(exportDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fname = filename ?? `stats-report-${timestamp}.md`
    const filepath = path.join(exportDir, fname)

    await fs.writeFile(filepath, toMarkdown(stats), "utf-8")
    log.info("exported stats to Markdown", { path: filepath })
    return filepath
  }
}
