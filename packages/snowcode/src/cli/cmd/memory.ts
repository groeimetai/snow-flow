import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { EOL } from "os"
import { Memory } from "../../memory"
import { Session } from "../../session"
import { Instance } from "../../project/instance"

export const MemoryCommand = cmd({
  command: "memory [action]",
  describe: "View and manage session memory",
  builder: (yargs: Argv) => {
    return yargs
      .positional("action", {
        describe: "Action to perform",
        type: "string",
        choices: ["show", "path", "export", "worklog", "learnings"],
        default: "show",
      })
      .option("session", {
        alias: "s",
        describe: "Session ID (defaults to current/latest)",
        type: "string",
      })
      .option("format", {
        alias: "f",
        describe: "Export format",
        type: "string",
        choices: ["json", "md", "markdown"],
        default: "md",
      })
      .option("limit", {
        alias: "l",
        describe: "Limit number of entries (for worklog)",
        type: "number",
        default: 50,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const action = args.action as string
      let sessionID = args.session as string | undefined
      const projectID = Instance.project.id

      // If no session specified, let user select or use latest
      if (!sessionID) {
        const sessions = []
        for await (const session of Session.list()) {
          sessions.push(session)
        }

        if (sessions.length === 0) {
          UI.error("No sessions found")
          process.exit(1)
        }

        sessions.sort((a, b) => b.time.updated - a.time.updated)

        if (action === "path") {
          // For path action, just use latest session
          sessionID = sessions[0].id
        } else {
          UI.empty()
          prompts.intro("Session Memory")

          const selectedSession = await prompts.autocomplete({
            message: "Select session",
            maxItems: 10,
            options: sessions.map((session) => ({
              label: session.title,
              value: session.id,
              hint: `${new Date(session.time.updated).toLocaleString()} • ${session.id.slice(-8)}`,
            })),
          })

          if (prompts.isCancel(selectedSession)) {
            throw new UI.CancelledError()
          }

          sessionID = selectedSession as string
        }
      }

      switch (action) {
        case "path":
          await handlePath(projectID, sessionID!)
          break
        case "show":
          await handleShow(projectID, sessionID!)
          break
        case "export":
          await handleExport(projectID, sessionID!, args.format as string)
          break
        case "worklog":
          await handleWorklog(projectID, sessionID!, args.limit as number)
          break
        case "learnings":
          await handleLearnings(projectID, sessionID!)
          break
        default:
          UI.error(`Unknown action: ${action}`)
          process.exit(1)
      }
    })
  },
})

async function handlePath(projectID: string, sessionID: string): Promise<void> {
  const memoryPath = Memory.getPath(projectID, sessionID)
  process.stdout.write(memoryPath + EOL)
}

async function handleShow(projectID: string, sessionID: string): Promise<void> {
  const memory = await Memory.read(projectID, sessionID)

  if (!memory) {
    UI.error(`No memory found for session: ${sessionID}`)
    process.exit(1)
  }

  const width = 60

  // Header
  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + centerText("SESSION MEMORY", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  // Title and metadata
  console.log(formatRow("Title", memory.title, width))
  console.log(formatRow("Session", sessionID.slice(-12), width))
  console.log(formatRow("Created", new Date(memory.time.created).toLocaleString(), width))
  console.log(formatRow("Updated", new Date(memory.time.updated).toLocaleString(), width))
  console.log("├" + "─".repeat(width) + "┤")

  // Current Status
  console.log("│" + centerText("CURRENT STATUS", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  if (memory.currentStatus.completed.length > 0) {
    console.log("│" + " Completed:".padEnd(width) + "│")
    for (const item of memory.currentStatus.completed.slice(-5)) {
      console.log("│" + `   ✓ ${truncate(item, width - 6)}`.padEnd(width) + "│")
    }
  }

  if (memory.currentStatus.discussionPoints.length > 0) {
    console.log("│" + " Discussion Points:".padEnd(width) + "│")
    for (const item of memory.currentStatus.discussionPoints.slice(-3)) {
      console.log("│" + `   • ${truncate(item, width - 6)}`.padEnd(width) + "│")
    }
  }

  if (memory.currentStatus.openQuestions.length > 0) {
    console.log("│" + " Open Questions:".padEnd(width) + "│")
    for (const item of memory.currentStatus.openQuestions.slice(-3)) {
      console.log("│" + `   ? ${truncate(item, width - 6)}`.padEnd(width) + "│")
    }
  }

  // Key Results
  if (memory.keyResults.length > 0) {
    console.log("├" + "─".repeat(width) + "┤")
    console.log("│" + centerText("KEY RESULTS", width) + "│")
    console.log("├" + "─".repeat(width) + "┤")
    for (const result of memory.keyResults.slice(-5)) {
      const icon = getResultIcon(result.type)
      const text = result.path ? `${result.description} (${result.path})` : result.description
      console.log("│" + ` ${icon} ${truncate(text, width - 4)}`.padEnd(width) + "│")
    }
  }

  // Learnings
  if (memory.learnings.length > 0) {
    console.log("├" + "─".repeat(width) + "┤")
    console.log("│" + centerText("LEARNINGS", width) + "│")
    console.log("├" + "─".repeat(width) + "┤")
    for (const learning of memory.learnings.slice(-5)) {
      console.log("│" + ` [${learning.category}]`.padEnd(width) + "│")
      console.log("│" + `   ${truncate(learning.insight, width - 4)}`.padEnd(width) + "│")
    }
  }

  console.log("└" + "─".repeat(width) + "┘")
  console.log()

  // Show memory path
  const memoryPath = Memory.getPath(projectID, sessionID)
  console.log(`Memory file: ${memoryPath}`)
}

async function handleExport(projectID: string, sessionID: string, format: string): Promise<void> {
  if (format === "json") {
    const memory = await Memory.read(projectID, sessionID)
    const worklog = await Memory.readWorkLog(projectID, sessionID)

    if (!memory) {
      UI.error(`No memory found for session: ${sessionID}`)
      process.exit(1)
    }

    const exportData = {
      memory,
      worklog,
    }
    process.stdout.write(JSON.stringify(exportData, null, 2) + EOL)
  } else {
    // Markdown format
    const markdown = await Memory.exportAsMarkdown(projectID, sessionID)
    process.stdout.write(markdown + EOL)
  }
}

async function handleWorklog(projectID: string, sessionID: string, limit: number): Promise<void> {
  const worklog = await Memory.getRecentWorkLog(projectID, sessionID, limit)

  if (worklog.length === 0) {
    console.log("No work log entries found")
    return
  }

  const width = 80

  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + centerText("WORK LOG", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  for (const entry of worklog) {
    const time = new Date(entry.timestamp).toLocaleTimeString()
    const icon = getWorkLogIcon(entry.type)
    const line = ` ${time} ${icon} [${entry.type.padEnd(12)}] ${truncate(entry.summary, width - 35)}`
    console.log("│" + line.padEnd(width) + "│")
  }

  console.log("└" + "─".repeat(width) + "┘")
  console.log(`\nShowing ${worklog.length} entries`)
}

async function handleLearnings(projectID: string, sessionID: string): Promise<void> {
  const memory = await Memory.read(projectID, sessionID)
  const projectLearnings = await Memory.getProjectLearnings(projectID)

  const width = 70

  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + centerText("LEARNINGS", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  if (memory && memory.learnings.length > 0) {
    console.log("│" + centerText("Session Learnings", width) + "│")
    console.log("├" + "─".repeat(width) + "┤")
    for (const learning of memory.learnings) {
      console.log("│" + ` [${learning.category}]`.padEnd(width) + "│")
      console.log("│" + `   ${truncate(learning.insight, width - 4)}`.padEnd(width) + "│")
      if (learning.context) {
        console.log("│" + `   Context: ${truncate(learning.context, width - 12)}`.padEnd(width) + "│")
      }
      console.log("│" + "".padEnd(width) + "│")
    }
  }

  if (projectLearnings.length > 0) {
    console.log("├" + "─".repeat(width) + "┤")
    console.log("│" + centerText("Project Learnings", width) + "│")
    console.log("├" + "─".repeat(width) + "┤")
    for (const learning of projectLearnings.slice(-10)) {
      console.log("│" + ` [${learning.category}]`.padEnd(width) + "│")
      console.log("│" + `   ${truncate(learning.insight, width - 4)}`.padEnd(width) + "│")
      console.log("│" + "".padEnd(width) + "│")
    }
  }

  console.log("└" + "─".repeat(width) + "┘")
}

// Helper functions
function centerText(text: string, width: number): string {
  const padding = Math.max(0, (width - text.length) / 2)
  return " ".repeat(Math.floor(padding)) + text + " ".repeat(Math.ceil(padding))
}

function formatRow(label: string, value: string, width: number): string {
  const content = ` ${label}: ${value}`
  return "│" + content.padEnd(width) + "│"
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

function getResultIcon(type: string): string {
  switch (type) {
    case "file_created":
      return "📄"
    case "file_modified":
      return "📝"
    case "file_deleted":
      return "🗑️"
    case "artifact_created":
      return "🎨"
    case "task_completed":
      return "✅"
    default:
      return "•"
  }
}

function getWorkLogIcon(type: string): string {
  switch (type) {
    case "user_request":
      return "👤"
    case "ai_response":
      return "🤖"
    case "tool_call":
      return "🔧"
    case "tool_result":
      return "📦"
    case "file_created":
      return "📄"
    case "file_modified":
      return "📝"
    case "file_deleted":
      return "🗑️"
    case "error":
      return "❌"
    case "compaction":
      return "📦"
    case "learning":
      return "💡"
    default:
      return "•"
  }
}
