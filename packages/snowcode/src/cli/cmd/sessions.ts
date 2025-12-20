import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { SessionManager } from "../../session/session-manager"
import { ForkTree } from "../../session/fork-tree"
import { Session } from "../../session"
import { Instance } from "../../project/instance"

export const SessionsCommand = cmd({
  command: "sessions [action]",
  describe: "Manage and explore sessions across all projects",
  builder: (yargs: Argv) => {
    return yargs
      .positional("action", {
        describe: "Action to perform",
        type: "string",
        choices: ["list", "recent", "search", "tree", "rename", "info", "resume"],
        default: "list",
      })
      .option("session", {
        alias: "s",
        describe: "Session ID",
        type: "string",
      })
      .option("project", {
        alias: "p",
        describe: "Project ID to filter by",
        type: "string",
      })
      .option("query", {
        alias: "q",
        describe: "Search query",
        type: "string",
      })
      .option("limit", {
        alias: "l",
        describe: "Maximum number of results",
        type: "number",
        default: 20,
      })
      .option("format", {
        alias: "f",
        describe: "Output format",
        type: "string",
        choices: ["table", "json", "tree", "compact"],
        default: "table",
      })
      .option("all", {
        alias: "a",
        describe: "Show all sessions (not just current project)",
        type: "boolean",
        default: false,
      })
      .option("sort", {
        describe: "Sort by field",
        type: "string",
        choices: ["updated", "created", "cost", "messages"],
        default: "updated",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const action = args.action as string
      const sessionID = args.session as string | undefined
      const projectID = args.project as string | undefined
      const query = args.query as string | undefined
      const limit = args.limit as number
      const format = args.format as string
      const showAll = args.all as boolean
      const sortBy = args.sort as "updated" | "created" | "cost" | "messages"

      switch (action) {
        case "list":
          await handleList({ projectID, limit, format, showAll, sortBy })
          break
        case "recent":
          await handleRecent(limit, format)
          break
        case "search":
          await handleSearch(query, limit, format)
          break
        case "tree":
          await handleTree(sessionID, projectID, format)
          break
        case "rename":
          await handleRename(sessionID)
          break
        case "info":
          await handleInfo(sessionID)
          break
        case "resume":
          await handleResume(sessionID)
          break
        default:
          UI.error(`Unknown action: ${action}`)
          process.exit(1)
      }
    })
  },
})

// ============================================================================
// HANDLERS
// ============================================================================

async function handleList(options: {
  projectID?: string
  limit: number
  format: string
  showAll: boolean
  sortBy: "updated" | "created" | "cost" | "messages"
}): Promise<void> {
  const { projectID, limit, format, showAll, sortBy } = options

  const filterProjectID = showAll ? undefined : (projectID ?? Instance.project.id)

  const result = await SessionManager.listGlobal({
    projectID: filterProjectID,
    limit,
    sortBy,
    sortOrder: "desc",
  })

  if (result.sessions.length === 0) {
    console.log("No sessions found")
    return
  }

  if (format === "json") {
    process.stdout.write(JSON.stringify(result, null, 2) + EOL)
    return
  }

  if (format === "compact") {
    for (const s of result.sessions) {
      const date = new Date(s.time.updated).toLocaleDateString()
      const title = s.title.length > 40 ? s.title.slice(0, 37) + "..." : s.title
      const fork = s.parentID ? " (fork)" : ""
      console.log(`${s.id.slice(-8)} │ ${date} │ ${title}${fork}`)
    }
    return
  }

  // Table format
  const width = 90

  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + centerText("SESSIONS", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  // Header
  const header =
    " " +
    "ID".padEnd(10) +
    "Updated".padEnd(12) +
    "Messages".padEnd(10) +
    "Cost".padEnd(10) +
    "Title"
  console.log("│" + header.slice(0, width).padEnd(width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  for (const s of result.sessions) {
    const id = s.id.slice(-8)
    const updated = formatDate(s.time.updated)
    const msgs = s.messageCount.toString()
    const cost = `$${s.cost.toFixed(2)}`
    const forkIcon = s.parentID ? "⎇ " : ""
    const sharedIcon = s.shared ? " 🔗" : ""
    const childIcon = s.hasChildren ? ` (+${s.childCount})` : ""
    const title = s.title.slice(0, 35)

    const row =
      " " +
      id.padEnd(10) +
      updated.padEnd(12) +
      msgs.padEnd(10) +
      cost.padEnd(10) +
      forkIcon +
      title +
      sharedIcon +
      childIcon

    console.log("│" + row.slice(0, width).padEnd(width) + "│")
  }

  console.log("└" + "─".repeat(width) + "┘")

  // Summary
  if (showAll && result.projects.length > 1) {
    console.log(`\nProjects: ${result.projects.length}`)
    for (const p of result.projects.slice(0, 5)) {
      console.log(`  ${p.path} (${p.sessionCount} sessions)`)
    }
  }

  console.log(`\nShowing ${result.sessions.length} of ${result.total} sessions`)
}

async function handleRecent(limit: number, format: string): Promise<void> {
  const sessions = await SessionManager.findRecent(limit)

  if (sessions.length === 0) {
    console.log("No recent sessions found")
    return
  }

  if (format === "json") {
    process.stdout.write(JSON.stringify(sessions, null, 2) + EOL)
    return
  }

  console.log("Recent Sessions:")
  console.log("─".repeat(60))

  for (const s of sessions) {
    const id = s.id.slice(-8)
    const time = formatRelativeTime(new Date(s.time.updated))
    const title = s.title.length > 40 ? s.title.slice(0, 37) + "..." : s.title
    const projectPath = s.projectPath.length > 20 ? "..." + s.projectPath.slice(-17) : s.projectPath

    console.log(`${id} │ ${time.padEnd(12)} │ ${title}`)
    console.log(`         │ ${projectPath}`)
    console.log("")
  }
}

async function handleSearch(
  query: string | undefined,
  limit: number,
  format: string
): Promise<void> {
  if (!query) {
    UI.empty()
    prompts.intro("Search Sessions")

    const input = await prompts.text({
      message: "Search query",
      placeholder: "Enter search term...",
    })

    if (prompts.isCancel(input)) {
      throw new UI.CancelledError()
    }

    query = input as string
  }

  const sessions = await SessionManager.search(query, limit)

  if (sessions.length === 0) {
    console.log(`No sessions found matching "${query}"`)
    return
  }

  if (format === "json") {
    process.stdout.write(JSON.stringify(sessions, null, 2) + EOL)
    return
  }

  console.log(`Search results for "${query}":`)
  console.log("─".repeat(60))

  for (const s of sessions) {
    const id = s.id.slice(-8)
    const date = formatDate(s.time.updated)
    const title = s.title.length > 45 ? s.title.slice(0, 42) + "..." : s.title

    console.log(`${id} │ ${date} │ ${title}`)
  }

  console.log(`\nFound ${sessions.length} sessions`)
}

async function handleTree(
  sessionID: string | undefined,
  projectID: string | undefined,
  format: string
): Promise<void> {
  const pid = projectID ?? Instance.project.id

  if (sessionID) {
    // Show subtree for specific session
    const subtree = await ForkTree.buildSubtree(sessionID, pid)
    if (!subtree) {
      UI.error("Session not found")
      return
    }

    console.log("Session Fork Tree:")
    console.log("─".repeat(60))

    if (format === "compact") {
      const lines = ForkTree.renderIndented([subtree], sessionID)
      lines.forEach((line) => console.log(line))
    } else {
      const lines = ForkTree.render([subtree], {
        showCost: true,
        showMessages: true,
        showTime: true,
        currentSessionID: sessionID,
      })
      lines.forEach((line) => console.log(line))
    }

    // Show ancestry path
    const ancestry = await SessionManager.getAncestry(sessionID, pid)
    if (ancestry.length > 1) {
      console.log("\nPath from root:")
      console.log(ForkTree.renderPath(ancestry))
    }
  } else {
    // Show full project tree
    const tree = await ForkTree.buildTree(pid)

    if (tree.length === 0) {
      console.log("No sessions found in this project")
      return
    }

    console.log("Project Session Tree:")
    console.log("─".repeat(60))

    if (format === "compact") {
      const lines = ForkTree.renderIndented(tree)
      lines.forEach((line) => console.log(line))
    } else if (format === "tree") {
      const lines = ForkTree.renderBoxed(tree, {
        showCost: true,
        showMessages: true,
      })
      lines.forEach((line) => console.log(line))
    } else {
      const lines = ForkTree.render(tree, {
        showCost: true,
        showMessages: true,
        showTime: true,
      })
      lines.forEach((line) => console.log(line))
    }

    console.log(`\nTotal: ${ForkTree.countNodes(tree)} sessions, max depth: ${ForkTree.maxDepth(tree)}`)
  }
}

async function handleRename(sessionID: string | undefined): Promise<void> {
  if (!sessionID) {
    // Let user select a session
    const recent = await SessionManager.findRecent(20)
    if (recent.length === 0) {
      console.log("No sessions found")
      return
    }

    UI.empty()
    prompts.intro("Rename Session")

    const selectedSession = await prompts.autocomplete({
      message: "Select session to rename",
      maxItems: 10,
      options: recent.map((s) => ({
        label: s.title,
        value: s.id,
        hint: `${s.id.slice(-8)} • ${formatRelativeTime(new Date(s.time.updated))}`,
      })),
    })

    if (prompts.isCancel(selectedSession)) {
      throw new UI.CancelledError()
    }

    sessionID = selectedSession as string
  }

  // Get current session
  const found = await SessionManager.getGlobal(sessionID)
  if (!found) {
    UI.error("Session not found")
    return
  }

  console.log(`Current title: ${found.session.title}`)

  const newTitle = await prompts.text({
    message: "New title",
    placeholder: "Enter new session title...",
    defaultValue: found.session.title,
  })

  if (prompts.isCancel(newTitle)) {
    throw new UI.CancelledError()
  }

  const updated = await SessionManager.rename(sessionID, newTitle as string, found.project.id)
  if (updated) {
    console.log(`Session renamed to: ${updated.title}`)
  } else {
    UI.error("Failed to rename session")
  }
}

async function handleInfo(sessionID: string | undefined): Promise<void> {
  if (!sessionID) {
    // Let user select a session
    const recent = await SessionManager.findRecent(20)
    if (recent.length === 0) {
      console.log("No sessions found")
      return
    }

    UI.empty()
    prompts.intro("Session Info")

    const selectedSession = await prompts.autocomplete({
      message: "Select session",
      maxItems: 10,
      options: recent.map((s) => ({
        label: s.title,
        value: s.id,
        hint: `${s.id.slice(-8)} • ${s.messageCount} msgs`,
      })),
    })

    if (prompts.isCancel(selectedSession)) {
      throw new UI.CancelledError()
    }

    sessionID = selectedSession as string
  }

  const found = await SessionManager.getGlobal(sessionID)
  if (!found) {
    UI.error("Session not found")
    return
  }

  const { session, project } = found

  // Get stats
  const children = await SessionManager.getChildren(sessionID, project.id)
  const ancestry = await SessionManager.getAncestry(sessionID, project.id)

  const width = 60

  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + centerText("SESSION INFO", width) + "│")
  console.log("├" + "─".repeat(width) + "┤")

  console.log(formatRow("ID", session.id, width))
  console.log(formatRow("Title", session.title, width))
  console.log(formatRow("Project", project.worktree, width))
  console.log("├" + "─".repeat(width) + "┤")

  console.log(formatRow("Created", new Date(session.time.created).toLocaleString(), width))
  console.log(formatRow("Updated", new Date(session.time.updated).toLocaleString(), width))
  console.log("├" + "─".repeat(width) + "┤")

  if (session.parentID) {
    const parentInfo = await SessionManager.getGlobal(session.parentID)
    const parentTitle = parentInfo?.session.title ?? session.parentID.slice(-8)
    console.log(formatRow("Forked from", parentTitle, width))
  }

  console.log(formatRow("Forks", children.length.toString(), width))
  console.log(formatRow("Depth", (ancestry.length - 1).toString(), width))

  if (session.share) {
    console.log("├" + "─".repeat(width) + "┤")
    console.log(formatRow("Shared", "Yes", width))
    console.log(formatRow("Share URL", session.share.url, width))
  }

  console.log("└" + "─".repeat(width) + "┘")

  // Show ancestry path
  if (ancestry.length > 1) {
    console.log("\nAncestry:")
    console.log(ForkTree.renderPath(ancestry))
  }

  // Show children
  if (children.length > 0) {
    console.log("\nForks:")
    for (const child of children.slice(0, 5)) {
      console.log(`  ├── ${child.title.slice(0, 40)}`)
    }
    if (children.length > 5) {
      console.log(`  └── ... and ${children.length - 5} more`)
    }
  }
}

async function handleResume(sessionID: string | undefined): Promise<void> {
  if (!sessionID) {
    // Show recent sessions to pick from
    const recent = await SessionManager.findRecent(20)
    if (recent.length === 0) {
      console.log("No sessions found")
      return
    }

    UI.empty()
    prompts.intro("Resume Session")

    const selectedSession = await prompts.autocomplete({
      message: "Select session to resume",
      maxItems: 15,
      options: recent.map((s) => ({
        label: s.title,
        value: s.id,
        hint: `${s.projectPath.split("/").pop()} • ${formatRelativeTime(new Date(s.time.updated))} • ${s.messageCount} msgs`,
      })),
    })

    if (prompts.isCancel(selectedSession)) {
      throw new UI.CancelledError()
    }

    sessionID = selectedSession as string
  }

  const found = await SessionManager.getGlobal(sessionID)
  if (!found) {
    UI.error("Session not found")
    return
  }

  // Output the resume command
  console.log("\nTo resume this session, run:")
  console.log(`  cd "${found.project.worktree}" && snow-code --session ${sessionID}`)
  console.log("\nOr with TUI attach:")
  console.log(`  snow-code attach http://localhost:4096 --session ${sessionID}`)
}

// ============================================================================
// HELPERS
// ============================================================================

function centerText(text: string, width: number): string {
  const padding = Math.max(0, (width - text.length) / 2)
  return " ".repeat(Math.floor(padding)) + text + " ".repeat(Math.ceil(padding))
}

function formatRow(label: string, value: string, width: number): string {
  const content = ` ${label}: ${value}`
  return "│" + content.slice(0, width).padEnd(width) + "│"
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleDateString()
}

function formatRelativeTime(date: Date): string {
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
