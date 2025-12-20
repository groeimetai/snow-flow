import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { EOL } from "os"
import { BackgroundAgent } from "../../agent/background"
import { TaskQueue } from "../../agent/task-queue"

export const TasksCommand = cmd({
  command: "tasks [action]",
  describe: "View and manage background tasks",
  builder: (yargs: Argv) => {
    return yargs
      .positional("action", {
        describe: "Action to perform",
        type: "string",
        choices: ["list", "show", "cancel", "clear", "wait"],
        default: "list",
      })
      .option("task-id", {
        alias: "t",
        describe: "Task ID for show/cancel/wait actions",
        type: "string",
      })
      .option("all", {
        alias: "a",
        describe: "Show all tasks including completed",
        type: "boolean",
        default: false,
      })
      .option("format", {
        alias: "f",
        describe: "Output format",
        type: "string",
        choices: ["table", "json"],
        default: "table",
      })
      .option("days", {
        alias: "d",
        describe: "Days for clear action (clear tasks older than X days)",
        type: "number",
        default: 7,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const action = args.action as string
      const taskID = args["task-id"] as string | undefined
      const showAll = args.all as boolean
      const format = args.format as string
      const days = args.days as number

      switch (action) {
        case "list":
          await handleList(showAll, format)
          break
        case "show":
          await handleShow(taskID)
          break
        case "cancel":
          await handleCancel(taskID)
          break
        case "clear":
          await handleClear(days)
          break
        case "wait":
          await handleWait(taskID)
          break
        default:
          UI.error(`Unknown action: ${action}`)
          process.exit(1)
      }
    })
  },
})

async function handleList(showAll: boolean, format: string): Promise<void> {
  const tasks = showAll ? await BackgroundAgent.list() : await BackgroundAgent.listActive()

  if (tasks.length === 0) {
    console.log("No background tasks found")
    return
  }

  if (format === "json") {
    process.stdout.write(JSON.stringify(tasks, null, 2) + EOL)
    return
  }

  const width = 80

  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + centerText("BACKGROUND TASKS", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  // Header
  const header =
    " " +
    "ID".padEnd(12) +
    "Agent".padEnd(12) +
    "Status".padEnd(12) +
    "Tokens".padEnd(15) +
    "Duration".padEnd(12) +
    "Description"
  console.log("│" + header.slice(0, width).padEnd(width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  for (const task of tasks) {
    const id = task.id.slice(-8)
    const agent = task.agentName.slice(0, 10)
    const status = getStatusIcon(task.status) + " " + task.status.slice(0, 8)
    const tokens = formatTokens(task.tokens.used, task.tokens.budget)
    const duration = formatDuration(task)
    const desc = task.description.slice(0, 20)

    const row = " " + id.padEnd(12) + agent.padEnd(12) + status.padEnd(12) + tokens.padEnd(15) + duration.padEnd(12) + desc

    console.log("│" + row.slice(0, width).padEnd(width) + "│")
  }

  console.log("└" + "─".repeat(width) + "┘")

  // Summary
  const running = tasks.filter((t) => t.status === "running").length
  const queued = tasks.filter((t) => t.status === "queued").length
  const completed = tasks.filter((t) => t.status === "completed").length
  const failed = tasks.filter((t) => t.status === "failed").length

  console.log(`\nSummary: ${running} running, ${queued} queued, ${completed} completed, ${failed} failed`)
}

async function handleShow(taskID: string | undefined): Promise<void> {
  if (!taskID) {
    // Let user select a task
    const tasks = await BackgroundAgent.list()
    if (tasks.length === 0) {
      console.log("No tasks found")
      return
    }

    UI.empty()
    prompts.intro("Select Task")

    const selectedTask = await prompts.autocomplete({
      message: "Select task to view",
      maxItems: 10,
      options: tasks.map((task) => ({
        label: `${task.description} (${task.status})`,
        value: task.id,
        hint: `${task.agentName} • ${task.id.slice(-8)}`,
      })),
    })

    if (prompts.isCancel(selectedTask)) {
      throw new UI.CancelledError()
    }

    taskID = selectedTask as string
  }

  const task = await BackgroundAgent.getStatus(taskID)
  if (!task) {
    UI.error(`Task not found: ${taskID}`)
    process.exit(1)
  }

  const width = 60

  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + centerText("TASK DETAILS", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  console.log(formatRow("ID", task.id, width))
  console.log(formatRow("Agent", task.agentName, width))
  console.log(formatRow("Status", `${getStatusIcon(task.status)} ${task.status}`, width))
  console.log(formatRow("Priority", task.priority, width))
  console.log(formatRow("Description", task.description, width))
  console.log("├" + "─".repeat(width) + "┤")

  console.log(formatRow("Tokens Used", task.tokens.used.toLocaleString(), width))
  console.log(formatRow("Token Budget", task.tokens.budget.toLocaleString(), width))
  console.log(formatRow("Created", new Date(task.time.created).toLocaleString(), width))

  if (task.time.started) {
    console.log(formatRow("Started", new Date(task.time.started).toLocaleString(), width))
  }
  if (task.time.completed) {
    console.log(formatRow("Completed", new Date(task.time.completed).toLocaleString(), width))
  }

  console.log("├" + "─".repeat(width) + "┤")
  console.log(formatRow("Session ID", task.sessionID.slice(-12), width))
  if (task.parentSessionID) {
    console.log(formatRow("Parent Session", task.parentSessionID.slice(-12), width))
  }

  if (task.result) {
    console.log("├" + "─".repeat(width) + "┤")
    console.log("│" + " Result:".padEnd(width) + "│")
    const resultLines = task.result.split("\n").slice(0, 10)
    for (const line of resultLines) {
      console.log("│" + `   ${line.slice(0, width - 4)}`.padEnd(width) + "│")
    }
    if (task.result.split("\n").length > 10) {
      console.log("│" + "   ... (truncated)".padEnd(width) + "│")
    }
  }

  if (task.error) {
    console.log("├" + "─".repeat(width) + "┤")
    console.log("│" + " Error:".padEnd(width) + "│")
    console.log("│" + `   ${task.error.slice(0, width - 4)}`.padEnd(width) + "│")
  }

  console.log("└" + "─".repeat(width) + "┘")

  console.log("\nPrompt:")
  console.log("─".repeat(40))
  console.log(task.prompt.slice(0, 500))
  if (task.prompt.length > 500) {
    console.log("... (truncated)")
  }
}

async function handleCancel(taskID: string | undefined): Promise<void> {
  if (!taskID) {
    // Let user select a task to cancel
    const tasks = await BackgroundAgent.listActive()
    if (tasks.length === 0) {
      console.log("No active tasks to cancel")
      return
    }

    UI.empty()
    prompts.intro("Cancel Task")

    const selectedTask = await prompts.autocomplete({
      message: "Select task to cancel",
      maxItems: 10,
      options: tasks.map((task) => ({
        label: `${task.description} (${task.status})`,
        value: task.id,
        hint: `${task.agentName} • ${task.id.slice(-8)}`,
      })),
    })

    if (prompts.isCancel(selectedTask)) {
      throw new UI.CancelledError()
    }

    taskID = selectedTask as string
  }

  const success = await BackgroundAgent.cancel(taskID)
  if (success) {
    console.log(`Task ${taskID.slice(-8)} cancelled`)
  } else {
    UI.error(`Could not cancel task ${taskID.slice(-8)} - task may already be completed`)
  }
}

async function handleClear(days: number): Promise<void> {
  UI.empty()
  prompts.intro("Clear Completed Tasks")

  const confirm = await prompts.confirm({
    message: `Clear completed tasks older than ${days} days?`,
  })

  if (prompts.isCancel(confirm) || !confirm) {
    console.log("Cancelled")
    return
  }

  const cleared = await BackgroundAgent.cleanup(days)
  console.log(`Cleared ${cleared} old completed tasks`)
}

async function handleWait(taskID: string | undefined): Promise<void> {
  if (!taskID) {
    // Let user select a task to wait for
    const tasks = await BackgroundAgent.listActive()
    if (tasks.length === 0) {
      console.log("No active tasks to wait for")
      return
    }

    UI.empty()
    prompts.intro("Wait for Task")

    const selectedTask = await prompts.autocomplete({
      message: "Select task to wait for",
      maxItems: 10,
      options: tasks.map((task) => ({
        label: `${task.description} (${task.status})`,
        value: task.id,
        hint: `${task.agentName} • ${task.id.slice(-8)}`,
      })),
    })

    if (prompts.isCancel(selectedTask)) {
      throw new UI.CancelledError()
    }

    taskID = selectedTask as string
  }

  console.log(`Waiting for task ${taskID.slice(-8)}...`)

  try {
    const result = await BackgroundAgent.awaitResult(taskID)
    console.log("\nTask completed!")
    if (result) {
      console.log("\nResult:")
      console.log("─".repeat(40))
      console.log(result)
    }
  } catch (error) {
    UI.error(`Task failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

// Helper functions
function centerText(text: string, width: number): string {
  const padding = Math.max(0, (width - text.length) / 2)
  return " ".repeat(Math.floor(padding)) + text + " ".repeat(Math.ceil(padding))
}

function formatRow(label: string, value: string, width: number): string {
  const content = ` ${label}: ${value}`
  return "│" + content.slice(0, width).padEnd(width) + "│"
}

function getStatusIcon(status: TaskQueue.TaskStatus): string {
  switch (status) {
    case "queued":
      return "⏳"
    case "running":
      return "🔄"
    case "completed":
      return "✅"
    case "failed":
      return "❌"
    case "cancelled":
      return "🚫"
    default:
      return "•"
  }
}

function formatTokens(used: number, budget: number): string {
  const usedK = (used / 1000).toFixed(1)
  const budgetK = (budget / 1000).toFixed(0)
  return `${usedK}K/${budgetK}K`
}

function formatDuration(task: TaskQueue.BackgroundTask): string {
  const start = task.time.started ?? task.time.created
  const end = task.time.completed ?? Date.now()
  const durationMs = end - start

  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(0)}s`
  if (durationMs < 3600000) {
    const mins = Math.floor(durationMs / 60000)
    const secs = Math.floor((durationMs % 60000) / 1000)
    return `${mins}m ${secs}s`
  }
  const hours = Math.floor(durationMs / 3600000)
  const mins = Math.floor((durationMs % 3600000) / 60000)
  return `${hours}h ${mins}m`
}
