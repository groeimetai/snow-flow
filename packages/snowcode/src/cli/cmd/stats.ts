import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { EnhancedStats, Charts, StatsExport } from "../../stats"

export const StatsCommand = cmd({
  command: "stats [view]",
  describe: "View usage statistics and analytics",
  builder: (yargs: Argv) => {
    return yargs
      .positional("view", {
        describe: "Statistics view to display",
        type: "string",
        choices: ["overview", "models", "daily", "tools", "sessions", "all"],
        default: "overview",
      })
      .option("days", {
        alias: "d",
        describe: "Number of days to analyze",
        type: "number",
        default: 30,
      })
      .option("export", {
        alias: "e",
        describe: "Export format",
        type: "string",
        choices: ["json", "csv", "markdown"],
      })
      .option("format", {
        alias: "f",
        describe: "Output format",
        type: "string",
        choices: ["table", "json", "sparkline"],
        default: "table",
      })
      .option("limit", {
        alias: "l",
        describe: "Maximum number of items to show",
        type: "number",
        default: 10,
      })
      .option("quick", {
        alias: "q",
        describe: "Show quick summary only (today/week)",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const view = args.view as string
      const days = args.days as number
      const exportFormat = args.export as string | undefined
      const format = args.format as string
      const limit = args.limit as number
      const quick = args.quick as boolean

      // Quick stats mode
      if (quick) {
        const quickStats = await EnhancedStats.quickStats()
        displayQuickStats(quickStats)
        return
      }

      // Calculate full stats
      const stats = await EnhancedStats.calculate({ days, limit })

      // Export if requested
      if (exportFormat) {
        await handleExport(stats, exportFormat)
        return
      }

      // JSON format
      if (format === "json") {
        process.stdout.write(JSON.stringify(stats, null, 2) + EOL)
        return
      }

      // Display based on view
      switch (view) {
        case "overview":
          displayOverview(stats)
          break
        case "models":
          displayModels(stats, format)
          break
        case "daily":
          displayDaily(stats, format)
          break
        case "tools":
          displayTools(stats, limit)
          break
        case "sessions":
          displaySessions(stats, limit)
          break
        case "all":
          displayAll(stats, format, limit)
          break
      }
    })
  },
})

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

function displayQuickStats(stats: {
  todayCost: number
  todayMessages: number
  weekCost: number
  weekMessages: number
}): void {
  const width = 40

  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + centerText("QUICK STATS", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")
  console.log(formatRow("Today Cost", `$${stats.todayCost.toFixed(2)}`, width))
  console.log(formatRow("Today Messages", stats.todayMessages.toString(), width))
  console.log(formatRow("Week Cost", `$${stats.weekCost.toFixed(2)}`, width))
  console.log(formatRow("Week Messages", stats.weekMessages.toString(), width))
  console.log("└" + "─".repeat(width) + "┘")
}

function displayOverview(stats: EnhancedStats.ComprehensiveStats): void {
  const { overview, efficiency } = stats
  const width = 56

  // Overview section
  const overviewItems = Charts.summaryBox("OVERVIEW", [
    { label: "Sessions", value: overview.totalSessions.toLocaleString() },
    { label: "Messages", value: overview.totalMessages.toLocaleString() },
    { label: "Days Active", value: overview.days.toString() },
    {
      label: "Period",
      value: `${formatDate(overview.dateRange.earliest)} - ${formatDate(overview.dateRange.latest)}`,
    },
  ])
  overviewItems.forEach((line) => console.log(line))
  console.log()

  // Cost & Tokens section
  const costItems = Charts.summaryBox("COST & TOKENS", [
    { label: "Total Cost", value: `$${overview.totalCost.toFixed(2)}` },
    { label: "Cost/Day", value: `$${overview.costPerDay.toFixed(2)}` },
    { label: "Input Tokens", value: formatNumber(overview.totalTokens.input) },
    { label: "Output Tokens", value: formatNumber(overview.totalTokens.output) },
    { label: "Reasoning Tokens", value: formatNumber(overview.totalTokens.reasoning) },
    { label: "Cache Read", value: formatNumber(overview.totalTokens.cache.read) },
    { label: "Cache Write", value: formatNumber(overview.totalTokens.cache.write) },
  ])
  costItems.forEach((line) => console.log(line))
  console.log()

  // Efficiency section
  const effItems = Charts.summaryBox("EFFICIENCY", [
    { label: "Cache Hit Rate", value: `${efficiency.cacheHitRate.toFixed(1)}%` },
    { label: "Avg Tokens/Message", value: formatNumber(efficiency.avgTokensPerMessage) },
    { label: "Avg Cost/Session", value: `$${efficiency.avgCostPerSession.toFixed(4)}` },
    { label: "Avg Messages/Session", value: efficiency.avgMessagesPerSession.toFixed(1) },
  ])
  effItems.forEach((line) => console.log(line))
}

function displayModels(stats: EnhancedStats.ComprehensiveStats, format: string): void {
  const { byModel } = stats

  if (byModel.length === 0) {
    console.log("No model usage data available")
    return
  }

  if (format === "sparkline") {
    // Simple sparkline view
    const values = byModel.map((m) => m.cost)
    console.log("Model Costs: " + Charts.sparkline(values))
    console.log()
  }

  // Bar chart
  const chartData = byModel.slice(0, 10).map((m) => ({
    label: m.modelID.slice(0, 15),
    value: m.cost,
  }))

  const chartLines = Charts.barChart(chartData, {
    title: "MODEL USAGE BY COST",
    width: 70,
    valueFormatter: (v) => `$${v.toFixed(2)}`,
  })
  chartLines.forEach((line) => console.log(line))
  console.log()

  // Table
  const tableLines = Charts.table(
    byModel.slice(0, 10),
    [
      { header: "Provider", key: "providerID", width: 12 },
      { header: "Model", key: "modelID", width: 25 },
      { header: "Messages", key: "messageCount", align: "right", width: 10 },
      {
        header: "Cost",
        key: "cost",
        align: "right",
        width: 10,
        formatter: (v) => `$${v.toFixed(2)}`,
      },
      {
        header: "Input",
        key: "tokens",
        align: "right",
        width: 10,
        formatter: (t) => formatNumber(t.input),
      },
      {
        header: "Output",
        key: "tokens",
        align: "right",
        width: 10,
        formatter: (t) => formatNumber(t.output),
      },
    ],
    { title: "MODEL DETAILS" }
  )
  tableLines.forEach((line) => console.log(line))
}

function displayDaily(stats: EnhancedStats.ComprehensiveStats, format: string): void {
  const { byDay } = stats

  if (byDay.length === 0) {
    console.log("No daily data available")
    return
  }

  // Time series chart
  const timeSeriesData = byDay.map((d) => ({ date: d.date, value: d.cost }))
  const chartLines = Charts.timeSeriesChart(timeSeriesData, {
    title: "DAILY COST",
    width: 70,
    height: 12,
  })
  chartLines.forEach((line) => console.log(line))
  console.log()

  // Sparkline summary
  const costSparkline = Charts.sparkline(byDay.map((d) => d.cost))
  const msgSparkline = Charts.sparkline(byDay.map((d) => d.messageCount))
  console.log(`Cost trend:     ${costSparkline}`)
  console.log(`Message trend:  ${msgSparkline}`)
  console.log()

  // Table for last 14 days
  const recentDays = byDay.slice(-14)
  const tableLines = Charts.table(
    recentDays,
    [
      { header: "Date", key: "date", width: 12 },
      { header: "Sessions", key: "sessionCount", align: "right", width: 10 },
      { header: "Messages", key: "messageCount", align: "right", width: 10 },
      { header: "Cost", key: "cost", align: "right", width: 10, formatter: (v) => `$${v.toFixed(2)}` },
      {
        header: "Input",
        key: "tokens",
        align: "right",
        width: 10,
        formatter: (t) => formatNumber(t.input),
      },
    ],
    { title: "LAST 14 DAYS" }
  )
  tableLines.forEach((line) => console.log(line))
}

function displayTools(stats: EnhancedStats.ComprehensiveStats, limit: number): void {
  const { byTool } = stats

  if (byTool.length === 0) {
    console.log("No tool usage data available")
    return
  }

  // Bar chart
  const chartData = byTool.slice(0, limit).map((t) => ({
    label: t.tool.slice(0, 15),
    value: t.count,
  }))

  const chartLines = Charts.barChart(chartData, {
    title: "TOOL USAGE",
    width: 70,
    valueFormatter: (v) => v.toLocaleString(),
  })
  chartLines.forEach((line) => console.log(line))
  console.log()

  // Table
  const tableLines = Charts.table(
    byTool.slice(0, limit),
    [
      { header: "Tool", key: "tool", width: 20 },
      { header: "Count", key: "count", align: "right", width: 10 },
      {
        header: "Avg Time",
        key: "avgDuration",
        align: "right",
        width: 12,
        formatter: (v) => `${(v / 1000).toFixed(1)}s`,
      },
      { header: "Errors", key: "errorCount", align: "right", width: 8 },
      {
        header: "Success",
        key: "successRate",
        align: "right",
        width: 10,
        formatter: (v) => `${v.toFixed(1)}%`,
      },
    ],
    { title: "TOOL DETAILS" }
  )
  tableLines.forEach((line) => console.log(line))

  // Total tools
  const totalCalls = byTool.reduce((sum, t) => sum + t.count, 0)
  const totalErrors = byTool.reduce((sum, t) => sum + t.errorCount, 0)
  console.log(`\nTotal tool calls: ${totalCalls.toLocaleString()}, Errors: ${totalErrors}`)
}

function displaySessions(stats: EnhancedStats.ComprehensiveStats, limit: number): void {
  const { topSessions } = stats

  if (topSessions.length === 0) {
    console.log("No session data available")
    return
  }

  const tableLines = Charts.table(
    topSessions.slice(0, limit),
    [
      {
        header: "ID",
        key: "sessionID",
        width: 14,
        formatter: (v) => v.slice(-12),
      },
      {
        header: "Title",
        key: "title",
        width: 30,
        formatter: (v) => (v.length > 28 ? v.slice(0, 25) + "..." : v),
      },
      { header: "Messages", key: "messageCount", align: "right", width: 10 },
      {
        header: "Cost",
        key: "cost",
        align: "right",
        width: 10,
        formatter: (v) => `$${v.toFixed(2)}`,
      },
      {
        header: "Duration",
        key: "duration",
        align: "right",
        width: 12,
        formatter: (v) => formatDuration(v),
      },
      { header: "Tools", key: "toolCalls", align: "right", width: 8 },
    ],
    { title: "TOP SESSIONS BY COST" }
  )
  tableLines.forEach((line) => console.log(line))
}

function displayAll(stats: EnhancedStats.ComprehensiveStats, format: string, limit: number): void {
  displayOverview(stats)
  console.log("\n")

  displayModels(stats, format)
  console.log("\n")

  displayDaily(stats, format)
  console.log("\n")

  displayTools(stats, limit)
  console.log("\n")

  displaySessions(stats, limit)
}

async function handleExport(
  stats: EnhancedStats.ComprehensiveStats,
  exportFormat: string
): Promise<void> {
  let filepath: string | string[]

  switch (exportFormat) {
    case "json":
      filepath = await StatsExport.saveJSON(stats)
      console.log(`Exported to: ${filepath}`)
      break
    case "csv":
      filepath = await StatsExport.saveCSV(stats, "all")
      console.log(`Exported CSV files:`)
      for (const f of filepath) {
        console.log(`  ${f}`)
      }
      break
    case "markdown":
      filepath = await StatsExport.saveMarkdown(stats)
      console.log(`Exported to: ${filepath}`)
      break
    default:
      UI.error(`Unknown export format: ${exportFormat}`)
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function centerText(text: string, width: number): string {
  const padding = Math.max(0, (width - text.length) / 2)
  return " ".repeat(Math.floor(padding)) + text + " ".repeat(Math.ceil(padding))
}

function formatRow(label: string, value: string, width: number): string {
  const availableWidth = width - 1
  const paddingNeeded = availableWidth - label.length - value.length
  const padding = Math.max(0, paddingNeeded)
  return `│${label}${" ".repeat(padding)}${value} │`
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toLocaleString()
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`
  if (ms < 3600000) {
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return `${mins}m ${secs}s`
  }
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${mins}m`
}

// Legacy interface for backwards compatibility
export interface SessionStats {
  totalSessions: number
  totalMessages: number
  totalCost: number
  totalTokens: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
  toolUsage: Record<string, number>
  dateRange: {
    earliest: number
    latest: number
  }
  days: number
  costPerDay: number
}

export function displayStats(stats: SessionStats) {
  const width = 56

  function renderRow(label: string, value: string): string {
    const availableWidth = width - 1
    const paddingNeeded = availableWidth - label.length - value.length
    const padding = Math.max(0, paddingNeeded)
    return `│${label}${" ".repeat(padding)}${value} │`
  }

  // Overview section
  console.log("┌────────────────────────────────────────────────────────┐")
  console.log("│                       OVERVIEW                         │")
  console.log("├────────────────────────────────────────────────────────┤")
  console.log(renderRow("Sessions", stats.totalSessions.toLocaleString()))
  console.log(renderRow("Messages", stats.totalMessages.toLocaleString()))
  console.log(renderRow("Days", stats.days.toString()))
  console.log("└────────────────────────────────────────────────────────┘")
  console.log()

  // Cost & Tokens section
  console.log("┌────────────────────────────────────────────────────────┐")
  console.log("│                    COST & TOKENS                       │")
  console.log("├────────────────────────────────────────────────────────┤")
  const cost = isNaN(stats.totalCost) ? 0 : stats.totalCost
  const costPerDay = isNaN(stats.costPerDay) ? 0 : stats.costPerDay
  console.log(renderRow("Total Cost", `$${cost.toFixed(2)}`))
  console.log(renderRow("Cost/Day", `$${costPerDay.toFixed(2)}`))
  console.log(renderRow("Input", formatNumber(stats.totalTokens.input)))
  console.log(renderRow("Output", formatNumber(stats.totalTokens.output)))
  console.log(renderRow("Cache Read", formatNumber(stats.totalTokens.cache.read)))
  console.log(renderRow("Cache Write", formatNumber(stats.totalTokens.cache.write)))
  console.log("└────────────────────────────────────────────────────────┘")
  console.log()

  // Tool Usage section
  if (Object.keys(stats.toolUsage).length > 0) {
    const sortedTools = Object.entries(stats.toolUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    console.log("┌────────────────────────────────────────────────────────┐")
    console.log("│                      TOOL USAGE                        │")
    console.log("├────────────────────────────────────────────────────────┤")

    const maxCount = Math.max(...sortedTools.map(([, count]) => count))
    const totalToolUsage = Object.values(stats.toolUsage).reduce((a, b) => a + b, 0)

    for (const [tool, count] of sortedTools) {
      const barLength = Math.max(1, Math.floor((count / maxCount) * 20))
      const bar = "█".repeat(barLength)
      const percentage = ((count / totalToolUsage) * 100).toFixed(1)

      const content = ` ${tool.padEnd(10)} ${bar.padEnd(20)} ${count.toString().padStart(3)} (${percentage.padStart(4)}%)`
      const padding = Math.max(0, width - content.length)
      console.log(`│${content}${" ".repeat(padding)} │`)
    }
    console.log("└────────────────────────────────────────────────────────┘")
  }
  console.log()
}
