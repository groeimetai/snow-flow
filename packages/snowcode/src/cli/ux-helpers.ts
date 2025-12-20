import * as prompts from "@clack/prompts"
import { UI } from "./ui"

/**
 * UX Helpers - Enhanced user experience utilities for Snow-Code CLI
 *
 * Provides:
 * - Recommended options in prompts (shown first with hint)
 * - Smart defaults based on context
 * - Consistent prompt styling
 * - Progress indicators
 * - Confirmation patterns
 */

export namespace UXHelpers {
  // ============================================================================
  // PROMPT OPTIONS WITH RECOMMENDATIONS
  // ============================================================================

  export interface SelectOption<T> {
    label: string
    value: T
    hint?: string
    recommended?: boolean
  }

  /**
   * Sort options with recommended first, then add hint
   */
  export function sortWithRecommended<T>(options: SelectOption<T>[]): SelectOption<T>[] {
    // Find recommended options
    const recommended = options.filter((o) => o.recommended)
    const others = options.filter((o) => !o.recommended)

    // Add "(Recommended)" hint to recommended options
    const withHints = recommended.map((o) => ({
      ...o,
      hint: o.hint ? `${o.hint} (Recommended)` : "Recommended",
    }))

    return [...withHints, ...others]
  }

  /**
   * Enhanced select prompt with recommended options shown first
   */
  export async function selectWithRecommended<T>(
    message: string,
    options: SelectOption<T>[],
    config?: {
      maxItems?: number
    }
  ): Promise<T> {
    const sortedOptions = sortWithRecommended(options)

    const result = await prompts.select({
      message,
      maxItems: config?.maxItems ?? 10,
      options: sortedOptions.map((o) => ({
        label: o.label,
        value: o.value as unknown,
        ...(o.hint ? { hint: o.hint } : {}),
      })) as Array<{ label: string; value: unknown; hint?: string }>,
    })

    if (prompts.isCancel(result)) {
      throw new UI.CancelledError()
    }

    return result as T
  }

  /**
   * Enhanced autocomplete prompt with recommended options shown first
   */
  export async function autocompleteWithRecommended<T>(
    message: string,
    options: SelectOption<T>[],
    config?: {
      maxItems?: number
      placeholder?: string
    }
  ): Promise<T> {
    const sortedOptions = sortWithRecommended(options)

    const result = await prompts.autocomplete({
      message,
      maxItems: config?.maxItems ?? 10,
      placeholder: config?.placeholder,
      options: sortedOptions.map((o) => ({
        label: o.label,
        value: o.value as unknown,
        ...(o.hint ? { hint: o.hint } : {}),
      })) as Array<{ label: string; value: unknown; hint?: string }>,
    })

    if (prompts.isCancel(result)) {
      throw new UI.CancelledError()
    }

    return result as T
  }

  // ============================================================================
  // SMART CONFIRMATION
  // ============================================================================

  export interface ConfirmOptions {
    message: string
    defaultValue?: boolean
    destructive?: boolean
  }

  /**
   * Confirmation with smart defaults
   * - Destructive actions default to false
   * - Safe actions default to true
   */
  export async function confirm(options: ConfirmOptions): Promise<boolean> {
    const { message, defaultValue, destructive } = options

    // Destructive actions should default to false for safety
    const initialValue = defaultValue ?? (destructive ? false : true)

    const result = await prompts.confirm({
      message: destructive ? `⚠️  ${message}` : message,
      initialValue,
    })

    if (prompts.isCancel(result)) {
      throw new UI.CancelledError()
    }

    return result as boolean
  }

  // ============================================================================
  // PROGRESS INDICATORS
  // ============================================================================

  export interface ProgressTask<T> {
    title: string
    task: () => Promise<T>
  }

  /**
   * Run tasks with progress spinner
   */
  export async function withProgress<T>(
    title: string,
    task: () => Promise<T>
  ): Promise<T> {
    const s = prompts.spinner()
    s.start(title)

    try {
      const result = await task()
      s.stop(`${title} ✓`)
      return result
    } catch (error) {
      s.stop(`${title} ✗`)
      throw error
    }
  }

  /**
   * Run multiple tasks sequentially with progress
   */
  export async function withProgressSequence<T extends readonly ProgressTask<any>[]>(
    tasks: T
  ): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]["task"]>> }> {
    const results: any[] = []

    for (const { title, task } of tasks) {
      const result = await withProgress(title, task)
      results.push(result)
    }

    return results as any
  }

  // ============================================================================
  // INPUT HELPERS
  // ============================================================================

  export interface TextInputOptions {
    message: string
    placeholder?: string
    defaultValue?: string
    validate?: (value: string) => string | undefined
  }

  /**
   * Enhanced text input with validation
   */
  export async function textInput(options: TextInputOptions): Promise<string> {
    const result = await prompts.text({
      message: options.message,
      placeholder: options.placeholder,
      defaultValue: options.defaultValue,
      validate: options.validate
        ? (value: string | undefined) => {
            if (value === undefined) return undefined
            return options.validate!(value)
          }
        : undefined,
    })

    if (prompts.isCancel(result)) {
      throw new UI.CancelledError()
    }

    return result as string
  }

  /**
   * Password input (masked)
   */
  export async function passwordInput(message: string): Promise<string> {
    const result = await prompts.password({
      message,
    })

    if (prompts.isCancel(result)) {
      throw new UI.CancelledError()
    }

    return result as string
  }

  // ============================================================================
  // MULTI-SELECT
  // ============================================================================

  /**
   * Enhanced multi-select with recommended options
   */
  export async function multiSelectWithRecommended<T>(
    message: string,
    options: SelectOption<T>[],
    config?: {
      maxItems?: number
      required?: boolean
    }
  ): Promise<T[]> {
    const sortedOptions = sortWithRecommended(options)

    const result = await prompts.multiselect({
      message,
      maxItems: config?.maxItems ?? 10,
      required: config?.required ?? false,
      options: sortedOptions.map((o) => ({
        label: o.label,
        value: o.value as unknown,
        ...(o.hint ? { hint: o.hint } : {}),
      })) as Array<{ label: string; value: unknown; hint?: string }>,
    })

    if (prompts.isCancel(result)) {
      throw new UI.CancelledError()
    }

    return result as T[]
  }

  // ============================================================================
  // GROUPS AND SECTIONS
  // ============================================================================

  /**
   * Start a new CLI section with intro
   */
  export function startSection(title: string): void {
    UI.empty()
    prompts.intro(title)
  }

  /**
   * End a CLI section with outro
   */
  export function endSection(message: string): void {
    prompts.outro(message)
  }

  /**
   * Log info message
   */
  export function info(message: string): void {
    prompts.log.info(message)
  }

  /**
   * Log success message
   */
  export function success(message: string): void {
    prompts.log.success(message)
  }

  /**
   * Log warning message
   */
  export function warn(message: string): void {
    prompts.log.warn(message)
  }

  /**
   * Log error message
   */
  export function error(message: string): void {
    prompts.log.error(message)
  }

  // ============================================================================
  // FORMATTING HELPERS
  // ============================================================================

  /**
   * Format a key-value pair for display
   */
  export function formatKeyValue(key: string, value: string, keyWidth = 15): string {
    return `${key.padEnd(keyWidth)}: ${value}`
  }

  /**
   * Format a list of key-value pairs
   */
  export function formatKeyValueList(
    items: Array<{ key: string; value: string }>,
    keyWidth = 15
  ): string[] {
    return items.map((i) => formatKeyValue(i.key, i.value, keyWidth))
  }

  /**
   * Format duration in human-readable format
   */
  export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) {
      const mins = Math.floor(ms / 60000)
      const secs = Math.floor((ms % 60000) / 1000)
      return `${mins}m ${secs}s`
    }
    const hours = Math.floor(ms / 3600000)
    const mins = Math.floor((ms % 3600000) / 60000)
    return `${hours}h ${mins}m`
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  export function formatRelativeTime(date: Date): string {
    const now = Date.now()
    const diff = now - date.getTime()

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    const weeks = Math.floor(diff / 604800000)

    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    if (weeks < 4) return `${weeks}w ago`
    return date.toLocaleDateString()
  }

  /**
   * Format file size
   */
  export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  /**
   * Format number with locale separators
   */
  export function formatNumber(num: number): string {
    return num.toLocaleString()
  }

  /**
   * Format currency
   */
  export function formatCurrency(amount: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount)
  }

  // ============================================================================
  // TABLE HELPERS
  // ============================================================================

  export interface TableColumn {
    header: string
    key: string
    width?: number
    align?: "left" | "right" | "center"
  }

  /**
   * Print a simple table
   */
  export function printTable(
    data: Record<string, any>[],
    columns: TableColumn[]
  ): void {
    // Calculate column widths
    const widths = columns.map((col) => {
      const headerLen = col.header.length
      const maxDataLen = Math.max(
        ...data.map((row) => String(row[col.key] ?? "").length),
        0
      )
      return col.width ?? Math.max(headerLen, maxDataLen) + 2
    })

    // Print header
    const header = columns
      .map((col, i) => col.header.padEnd(widths[i]))
      .join(" │ ")
    console.log(header)
    console.log("─".repeat(header.length))

    // Print rows
    for (const row of data) {
      const line = columns
        .map((col, i) => {
          const value = String(row[col.key] ?? "")
          const width = widths[i]
          if (col.align === "right") return value.padStart(width)
          if (col.align === "center") {
            const pad = Math.floor((width - value.length) / 2)
            return " ".repeat(pad) + value + " ".repeat(width - pad - value.length)
          }
          return value.padEnd(width)
        })
        .join(" │ ")
      console.log(line)
    }
  }
}
