import type { Argv } from "yargs"
import path from "path"
import { Bus } from "../../bus"
import { Provider } from "../../provider/provider"
import { Session } from "../../session"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { Flag } from "../../flag/flag"
import { Config } from "../../config/config"
import { bootstrap } from "../bootstrap"
import { MessageV2 } from "../../session/message-v2"
import { Identifier } from "../../id/id"
import { Agent } from "../../agent/agent"
import { Command } from "../../command"
import { SessionPrompt } from "../../session/prompt"
import { EOL } from "os"

const TOOL: Record<string, [string, string]> = {
  todowrite: ["Todo", UI.Style.TEXT_WARNING_BOLD],
  todoread: ["Todo", UI.Style.TEXT_WARNING_BOLD],
  bash: ["Bash", UI.Style.TEXT_DANGER_BOLD],
  edit: ["Edit", UI.Style.TEXT_SUCCESS_BOLD],
  glob: ["Glob", UI.Style.TEXT_INFO_BOLD],
  grep: ["Grep", UI.Style.TEXT_INFO_BOLD],
  list: ["List", UI.Style.TEXT_INFO_BOLD],
  read: ["Read", UI.Style.TEXT_HIGHLIGHT_BOLD],
  write: ["Write", UI.Style.TEXT_SUCCESS_BOLD],
  websearch: ["Search", UI.Style.TEXT_DIM_BOLD],
}

/**
 * Format tool output for display
 * MCP tools often return large JSON strings - format them nicely like Claude Code does
 */
function formatToolOutput(output: string, toolName: string): string {
  if (!output || !output.trim()) return ""

  // Try to parse as JSON and format it
  try {
    const parsed = JSON.parse(output)
    // Pretty print JSON with 2-space indentation
    return JSON.stringify(parsed, null, 2)
  } catch {
    // Not JSON, return as-is
    return output
  }
}

/**
 * Determine if tool output should be displayed
 * Some tools have verbose output that should always be shown (like bash, MCP tools)
 * Others are better represented by their title only
 */
function shouldShowToolOutput(toolName: string): boolean {
  const alwaysShow = ["bash"]
  const neverShow = ["edit", "write", "glob", "grep", "read"] // These show file paths in title

  if (alwaysShow.includes(toolName)) return true
  if (neverShow.includes(toolName)) return false

  // Show output for all MCP tools (they typically have useful structured data)
  // MCP tools are prefixed with server name, e.g., "servicenow_unified_snow_query_table"
  if (toolName.includes("_")) return true

  return false
}

export const RunCommand = cmd({
  command: "run [message..]",
  describe: "run opencode with a message",
  builder: (yargs: Argv) => {
    return yargs
      .positional("message", {
        describe: "message to send",
        type: "string",
        array: true,
        default: [],
      })
      .option("command", {
        describe: "the command to run, use message for args",
        type: "string",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        describe: "session id to continue",
        type: "string",
      })
      .option("share", {
        type: "boolean",
        describe: "share the session",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("format", {
        type: "string",
        choices: ["default", "json"],
        default: "default",
        describe: "format: default (formatted) or json (raw JSON events)",
      })
      .option("file", {
        alias: ["f"],
        type: "string",
        array: true,
        describe: "file(s) to attach to message",
      })
  },
  handler: async (args) => {
    let message = args.message.join(" ")

    let fileParts: any[] = []
    if (args.file) {
      const files = Array.isArray(args.file) ? args.file : [args.file]

      for (const filePath of files) {
        const resolvedPath = path.resolve(process.cwd(), filePath)
        const file = Bun.file(resolvedPath)
        const stats = await file.stat().catch(() => {})
        if (!stats) {
          UI.error(`File not found: ${filePath}`)
          process.exit(1)
        }
        if (!(await file.exists())) {
          UI.error(`File not found: ${filePath}`)
          process.exit(1)
        }

        const stat = await file.stat()
        const mime = stat.isDirectory() ? "application/x-directory" : "text/plain"

        fileParts.push({
          type: "file",
          url: `file://${resolvedPath}`,
          filename: path.basename(resolvedPath),
          mime,
        })
      }
    }

    if (!process.stdin.isTTY) message += "\n" + (await Bun.stdin.text())

    if (message.trim().length === 0 && !args.command) {
      UI.error("You must provide a message or a command")
      process.exit(1)
    }

    await bootstrap(process.cwd(), async () => {
      if (args.command) {
        const exists = await Command.get(args.command)
        if (!exists) {
          UI.error(`Command "${args.command}" not found`)
          process.exit(1)
        }
      }
      const session = await (async () => {
        if (args.continue) {
          const it = Session.list()
          try {
            for await (const s of it) {
              if (s.parentID === undefined) {
                return s
              }
            }
            return
          } finally {
            await it.return()
          }
        }

        if (args.session) return Session.get(args.session)

        return Session.create({})
      })()

      if (!session) {
        UI.error("Session not found")
        process.exit(1)
      }

      const cfg = await Config.get()
      if (cfg.share === "auto" || Flag.OPENCODE_AUTO_SHARE || args.share) {
        try {
          await Session.share(session.id)
          UI.println(UI.Style.TEXT_INFO_BOLD + "~  https://snowcode.dev/s/" + session.id.slice(-8))
        } catch (error) {
          if (error instanceof Error && error.message.includes("disabled")) {
            UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message)
          } else {
            throw error
          }
        }
      }

      const agent = await (async () => {
        if (args.agent) return Agent.get(args.agent)
        const build = Agent.get("build")
        if (build) return build
        return Agent.list().then((x) => x[0])
      })()

      const { providerID, modelID } = await (async () => {
        if (args.model) return Provider.parseModel(args.model)
        if (agent.model) return agent.model
        return await Provider.defaultModel()
      })()

      function printEvent(color: string, type: string, title: string) {
        UI.println(
          color + `|`,
          UI.Style.TEXT_NORMAL + UI.Style.TEXT_DIM + ` ${type.padEnd(7, " ")}`,
          "",
          UI.Style.TEXT_NORMAL + title,
        )
      }

      function outputJsonEvent(type: string, data: any) {
        if (args.format === "json") {
          const jsonEvent = {
            type,
            timestamp: Date.now(),
            sessionID: session?.id,
            ...data,
          }
          process.stdout.write(JSON.stringify(jsonEvent) + EOL)
          return true
        }
        return false
      }

      const messageID = Identifier.ascending("message")

      // Track streaming output for each tool call
      const streamingOutputs = new Map<string, { lastOutput: string; linesPrinted: number }>()

      Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
        if (evt.properties.part.sessionID !== session.id) return
        if (evt.properties.part.messageID === messageID) return
        const part = evt.properties.part

        // Handle tool running state - show streaming output like Claude Code
        if (part.type === "tool" && part.state.status === "running") {
          const [tool, color] = TOOL[part.tool] ?? [part.tool, UI.Style.TEXT_INFO_BOLD]

          // Only print the event header once when the tool starts
          if (!streamingOutputs.has(part.callID)) {
            const title =
              part.state.title ||
              (Object.keys(part.state.input).length > 0 ? JSON.stringify(part.state.input) : "Unknown")
            printEvent(color, tool, title)
            streamingOutputs.set(part.callID, { lastOutput: "", linesPrinted: 0 })
          }

          // Stream output for tools that should show it
          if (shouldShowToolOutput(part.tool) && part.state.metadata?.output) {
            const output = part.state.metadata.output as string
            const tracker = streamingOutputs.get(part.callID)!

            // Only show new output (incremental)
            if (output !== tracker.lastOutput) {
              const newContent = output.substring(tracker.lastOutput.length)
              const lines = newContent.split('\n')

              // Show last 3 lines like Claude Code does
              const lastThreeLines = lines.slice(-3).filter(line => line.trim())
              if (lastThreeLines.length > 0) {
                // Clear previous lines if we've printed before
                if (tracker.linesPrinted > 0) {
                  process.stdout.write('\x1b[' + tracker.linesPrinted + 'A') // Move cursor up
                  process.stdout.write('\x1b[J') // Clear from cursor to end
                }

                // Print the last 3 lines with dimmed styling
                for (const line of lastThreeLines) {
                  UI.println(UI.Style.TEXT_DIM + '  ' + line)
                }

                tracker.lastOutput = output
                tracker.linesPrinted = lastThreeLines.length
              }
            }
          }
        }

        if (part.type === "tool" && part.state.status === "completed") {
          if (outputJsonEvent("tool_use", { part })) return

          const [tool, color] = TOOL[part.tool] ?? [part.tool, UI.Style.TEXT_INFO_BOLD]
          const title =
            part.state.title ||
            (Object.keys(part.state.input).length > 0 ? JSON.stringify(part.state.input) : "Unknown")

          // Clear streaming output if it exists
          const tracker = streamingOutputs.get(part.callID)
          if (tracker && tracker.linesPrinted > 0) {
            process.stdout.write('\x1b[' + tracker.linesPrinted + 'A') // Move cursor up
            process.stdout.write('\x1b[J') // Clear from cursor to end
          }

          // Print final event header if not already printed
          if (!streamingOutputs.has(part.callID)) {
            printEvent(color, tool, title)
          }

          // Clean up tracking
          streamingOutputs.delete(part.callID)

          // Show final output for tools that benefit from it (bash, MCP tools, etc.)
          if (shouldShowToolOutput(part.tool) && part.state.output && part.state.output.trim()) {
            UI.println()
            const formattedOutput = formatToolOutput(part.state.output, part.tool)

            // For very large outputs (> 500 lines), show truncated version
            const lines = formattedOutput.split('\n')
            if (lines.length > 500) {
              UI.println(UI.Style.TEXT_DIM + `[Output truncated - showing first 100 and last 50 lines of ${lines.length} total]`)
              UI.println()
              UI.println(lines.slice(0, 100).join('\n'))
              UI.println()
              UI.println(UI.Style.TEXT_DIM + `[... ${lines.length - 150} lines hidden ...]`)
              UI.println()
              UI.println(lines.slice(-50).join('\n'))
            } else {
              UI.println(formattedOutput)
            }
            UI.println()
          }
        }

        if (part.type === "step-start") {
          if (outputJsonEvent("step_start", { part })) return
        }

        if (part.type === "step-finish") {
          if (outputJsonEvent("step_finish", { part })) return
        }

        if (part.type === "text") {
          const text = part.text
          const isPiped = !process.stdout.isTTY

          if (part.time?.end) {
            if (outputJsonEvent("text", { part })) return
            if (!isPiped) UI.println()
            process.stdout.write((isPiped ? text : UI.markdown(text)) + EOL)
            if (!isPiped) UI.println()
          }
        }
      })

      let errorMsg: string | undefined
      Bus.subscribe(Session.Event.Error, async (evt) => {
        const { sessionID, error } = evt.properties
        if (sessionID !== session.id || !error) return
        let err = String(error.name)

        if ("data" in error && error.data && "message" in error.data) {
          err = error.data.message
        }
        errorMsg = errorMsg ? errorMsg + EOL + err : err

        if (outputJsonEvent("error", { error })) return
        UI.error(err)
      })

      await (async () => {
        if (args.command) {
          return await SessionPrompt.command({
            messageID,
            sessionID: session.id,
            agent: agent.name,
            model: providerID + "/" + modelID,
            command: args.command,
            arguments: message,
          })
        }
        return await SessionPrompt.prompt({
          sessionID: session.id,
          messageID,
          model: {
            providerID,
            modelID,
          },
          agent: agent.name,
          parts: [
            ...fileParts,
            {
              id: Identifier.ascending("part"),
              type: "text",
              text: message,
            },
          ],
        })
      })()
      if (errorMsg) process.exit(1)
    })
  },
})
