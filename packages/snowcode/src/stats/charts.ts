/**
 * ASCII Charts Module - Terminal-based visualizations for Snow-Code
 *
 * Provides beautiful ASCII charts for:
 * - Bar charts (horizontal)
 * - Sparklines (mini line charts)
 * - Time series (daily cost/usage)
 * - Pie charts (model distribution)
 */

export namespace Charts {
  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const BLOCK_CHARS = ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"]
  const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
  const BOX = {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
    leftT: "├",
    rightT: "┤",
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function formatNumber(num: number, decimals = 2): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M"
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K"
    }
    return num.toFixed(decimals)
  }

  function formatCurrency(num: number): string {
    return "$" + num.toFixed(2)
  }

  function padLeft(str: string, len: number): string {
    return str.padStart(len)
  }

  function padRight(str: string, len: number): string {
    return str.padEnd(len)
  }

  // ============================================================================
  // BAR CHART
  // ============================================================================

  export interface BarChartData {
    label: string
    value: number
    color?: string
  }

  export interface BarChartOptions {
    title?: string
    width?: number
    maxBars?: number
    showPercentage?: boolean
    showValues?: boolean
    valueFormatter?: (value: number) => string
  }

  export function barChart(data: BarChartData[], options: BarChartOptions = {}): string[] {
    const {
      title,
      width = 50,
      maxBars = 15,
      showPercentage = true,
      showValues = true,
      valueFormatter = formatNumber,
    } = options

    const lines: string[] = []
    const displayData = data.slice(0, maxBars)

    if (displayData.length === 0) {
      return ["No data to display"]
    }

    const maxValue = Math.max(...displayData.map((d) => d.value))
    const total = displayData.reduce((sum, d) => sum + d.value, 0)
    const maxLabelLen = Math.max(...displayData.map((d) => d.label.length), 10)
    const barWidth = width - maxLabelLen - 15 // Space for label, value, percentage

    // Title
    if (title) {
      const titleLine = BOX.horizontal.repeat(width)
      lines.push(BOX.topLeft + titleLine + BOX.topRight)
      const paddedTitle = title.padStart((width + title.length) / 2).padEnd(width)
      lines.push(BOX.vertical + paddedTitle + BOX.vertical)
      lines.push(BOX.leftT + titleLine + BOX.rightT)
    } else {
      lines.push(BOX.topLeft + BOX.horizontal.repeat(width) + BOX.topRight)
    }

    // Bars
    for (const item of displayData) {
      const percentage = total > 0 ? (item.value / total) * 100 : 0
      const barLength = maxValue > 0 ? Math.round((item.value / maxValue) * barWidth) : 0

      // Create the bar with smooth edges
      const fullBlocks = Math.floor(barLength)
      const remainder = barLength - fullBlocks
      const partialBlock = remainder > 0 ? BLOCK_CHARS[Math.floor(remainder * 8)] : ""
      const bar = "█".repeat(fullBlocks) + partialBlock

      const label = padRight(item.label.slice(0, maxLabelLen), maxLabelLen)
      const value = showValues ? padLeft(valueFormatter(item.value), 8) : ""
      const pct = showPercentage ? padLeft(`(${percentage.toFixed(1)}%)`, 8) : ""

      lines.push(`${BOX.vertical} ${label} ${padRight(bar, barWidth)} ${value}${pct} ${BOX.vertical}`)
    }

    lines.push(BOX.bottomLeft + BOX.horizontal.repeat(width) + BOX.bottomRight)
    return lines
  }

  // ============================================================================
  // SPARKLINE
  // ============================================================================

  export function sparkline(values: number[]): string {
    if (values.length === 0) return ""

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    return values
      .map((v) => {
        const normalized = (v - min) / range
        const index = Math.min(Math.floor(normalized * 8), 7)
        return SPARKLINE_CHARS[index]
      })
      .join("")
  }

  // ============================================================================
  // TIME SERIES CHART
  // ============================================================================

  export interface TimeSeriesData {
    date: string
    value: number
  }

  export interface TimeSeriesOptions {
    title?: string
    width?: number
    height?: number
    valueFormatter?: (value: number) => string
  }

  export function timeSeriesChart(data: TimeSeriesData[], options: TimeSeriesOptions = {}): string[] {
    const { title, width = 60, height = 10, valueFormatter = formatCurrency } = options

    const lines: string[] = []

    if (data.length === 0) {
      return ["No data to display"]
    }

    const values = data.map((d) => d.value)
    const maxValue = Math.max(...values)
    const minValue = Math.min(...values)
    const range = maxValue - minValue || 1

    // Title
    if (title) {
      lines.push(title)
      lines.push("═".repeat(width))
    }

    // Y-axis labels
    const yLabelWidth = 10

    // Chart area
    const chartWidth = width - yLabelWidth - 2
    const pointsPerColumn = Math.max(1, Math.ceil(data.length / chartWidth))
    const aggregatedData: number[] = []

    for (let i = 0; i < chartWidth && i * pointsPerColumn < data.length; i++) {
      const slice = values.slice(i * pointsPerColumn, (i + 1) * pointsPerColumn)
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length
      aggregatedData.push(avg)
    }

    // Draw chart rows
    for (let row = height - 1; row >= 0; row--) {
      const threshold = minValue + (range * (row + 0.5)) / height
      const rowLabel = row === height - 1 ? valueFormatter(maxValue) : row === 0 ? valueFormatter(minValue) : ""

      let rowStr = padLeft(rowLabel, yLabelWidth) + " │"

      for (let col = 0; col < aggregatedData.length; col++) {
        const val = aggregatedData[col]
        const normalizedVal = (val - minValue) / range
        const barHeight = normalizedVal * height

        if (barHeight >= row + 0.5) {
          rowStr += "█"
        } else if (barHeight >= row) {
          rowStr += "▄"
        } else {
          rowStr += " "
        }
      }

      lines.push(rowStr)
    }

    // X-axis
    lines.push(" ".repeat(yLabelWidth) + " └" + "─".repeat(aggregatedData.length))

    // X-axis labels
    if (data.length > 0) {
      const firstDate = data[0].date.slice(5) // MM-DD
      const lastDate = data[data.length - 1].date.slice(5)
      const xAxisLabel = " ".repeat(yLabelWidth + 2) + firstDate + " ".repeat(Math.max(0, aggregatedData.length - firstDate.length - lastDate.length)) + lastDate
      lines.push(xAxisLabel)
    }

    return lines
  }

  // ============================================================================
  // TABLE
  // ============================================================================

  export interface TableColumn {
    header: string
    key: string
    width?: number
    align?: "left" | "right" | "center"
    formatter?: (value: any) => string
  }

  export interface TableOptions {
    title?: string
    maxRows?: number
  }

  export function table(data: Record<string, any>[], columns: TableColumn[], options: TableOptions = {}): string[] {
    const { title, maxRows = 20 } = options
    const lines: string[] = []
    const displayData = data.slice(0, maxRows)

    // Calculate column widths
    const colWidths = columns.map((col) => {
      const headerLen = col.header.length
      const maxDataLen = Math.max(
        ...displayData.map((row) => {
          const val = row[col.key]
          const formatted = col.formatter ? col.formatter(val) : String(val ?? "")
          return formatted.length
        }),
        0
      )
      return col.width ?? Math.max(headerLen, maxDataLen) + 2
    })

    const totalWidth = colWidths.reduce((a, b) => a + b, 0) + columns.length + 1

    // Title
    if (title) {
      lines.push(BOX.topLeft + BOX.horizontal.repeat(totalWidth - 2) + BOX.topRight)
      const paddedTitle = title.padStart((totalWidth - 2 + title.length) / 2).padEnd(totalWidth - 2)
      lines.push(BOX.vertical + paddedTitle + BOX.vertical)
      lines.push(BOX.leftT + BOX.horizontal.repeat(totalWidth - 2) + BOX.rightT)
    } else {
      lines.push(BOX.topLeft + BOX.horizontal.repeat(totalWidth - 2) + BOX.topRight)
    }

    // Header row
    let headerRow = BOX.vertical
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      const width = colWidths[i]
      const align = col.align ?? "left"
      let header = col.header

      if (align === "right") {
        header = header.padStart(width)
      } else if (align === "center") {
        const pad = Math.floor((width - header.length) / 2)
        header = " ".repeat(pad) + header + " ".repeat(width - pad - header.length)
      } else {
        header = header.padEnd(width)
      }

      headerRow += header + BOX.vertical
    }
    lines.push(headerRow)

    // Separator
    lines.push(BOX.leftT + BOX.horizontal.repeat(totalWidth - 2) + BOX.rightT)

    // Data rows
    for (const row of displayData) {
      let dataRow = BOX.vertical
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        const width = colWidths[i]
        const align = col.align ?? "left"
        const val = row[col.key]
        let formatted = col.formatter ? col.formatter(val) : String(val ?? "")

        if (formatted.length > width) {
          formatted = formatted.slice(0, width - 1) + "…"
        }

        if (align === "right") {
          formatted = formatted.padStart(width)
        } else if (align === "center") {
          const pad = Math.floor((width - formatted.length) / 2)
          formatted = " ".repeat(pad) + formatted + " ".repeat(width - pad - formatted.length)
        } else {
          formatted = formatted.padEnd(width)
        }

        dataRow += formatted + BOX.vertical
      }
      lines.push(dataRow)
    }

    lines.push(BOX.bottomLeft + BOX.horizontal.repeat(totalWidth - 2) + BOX.bottomRight)
    return lines
  }

  // ============================================================================
  // SUMMARY BOX
  // ============================================================================

  export interface SummaryItem {
    label: string
    value: string
  }

  export function summaryBox(title: string, items: SummaryItem[], width = 56): string[] {
    const lines: string[] = []

    lines.push(BOX.topLeft + BOX.horizontal.repeat(width) + BOX.topRight)

    // Title
    const paddedTitle = title.padStart((width + title.length) / 2).padEnd(width)
    lines.push(BOX.vertical + paddedTitle + BOX.vertical)
    lines.push(BOX.leftT + BOX.horizontal.repeat(width) + BOX.rightT)

    // Items
    for (const item of items) {
      const availableWidth = width - 1
      const paddingNeeded = availableWidth - item.label.length - item.value.length
      const padding = Math.max(0, paddingNeeded)
      lines.push(`${BOX.vertical}${item.label}${" ".repeat(padding)}${item.value} ${BOX.vertical}`)
    }

    lines.push(BOX.bottomLeft + BOX.horizontal.repeat(width) + BOX.bottomRight)
    return lines
  }

  // ============================================================================
  // PROGRESS BAR
  // ============================================================================

  export function progressBar(value: number, max: number, width = 30, label?: string): string {
    const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0
    const filledWidth = Math.round((percentage / 100) * width)
    const emptyWidth = width - filledWidth

    const bar = "█".repeat(filledWidth) + "░".repeat(emptyWidth)
    const pctStr = `${percentage.toFixed(1)}%`

    if (label) {
      return `${label}: [${bar}] ${pctStr}`
    }
    return `[${bar}] ${pctStr}`
  }
}
