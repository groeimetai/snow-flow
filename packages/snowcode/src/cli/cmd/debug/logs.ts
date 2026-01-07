import { Global } from "../../../global"
import { Log } from "../../../util/log"
import { UI } from "../../ui"
import { cmd } from "../cmd"
import fs from "fs/promises"
import path from "path"

export const LogsCommand = cmd({
  command: "logs",
  describe: "view or tail log files",
  builder: (yargs) =>
    yargs
      .option("tail", {
        alias: ["t"],
        type: "number",
        describe: "show last N lines (default: 50)",
        default: 50,
      })
      .option("follow", {
        alias: ["f"],
        type: "boolean",
        describe: "follow log output in real-time",
        default: false,
      })
      .option("list", {
        alias: ["l"],
        type: "boolean",
        describe: "list available log files",
        default: false,
      })
      .option("clear", {
        type: "boolean",
        describe: "clear all log files",
        default: false,
      }),
  handler: async (args) => {
    const logDir = Global.Path.log

    // List log files
    if (args.list) {
      UI.println(UI.Style.TEXT_YELLOW + "Available log files:" + UI.Style.RESET)
      try {
        const files = await fs.readdir(logDir)
        const logFiles = files.filter((f) => f.endsWith(".log")).sort().reverse()
        if (logFiles.length === 0) {
          UI.println(UI.Style.TEXT_DIM + "  No log files found" + UI.Style.RESET)
        } else {
          for (const file of logFiles.slice(0, 20)) {
            const filePath = path.join(logDir, file)
            const stats = await fs.stat(filePath).catch(() => null)
            const size = stats ? `${(stats.size / 1024).toFixed(2)} KB` : "?"
            const current = Log.file()?.endsWith(file) ? UI.Style.TEXT_GREEN + " (current)" + UI.Style.RESET : ""
            UI.println(`  ${file} - ${size}${current}`)
          }
        }
      } catch {
        UI.println(UI.Style.TEXT_RED + "  Failed to read log directory" + UI.Style.RESET)
      }
      return
    }

    // Clear logs
    if (args.clear) {
      UI.println(UI.Style.TEXT_YELLOW + "Clearing log files..." + UI.Style.RESET)
      try {
        const files = await fs.readdir(logDir)
        const logFiles = files.filter((f) => f.endsWith(".log"))
        for (const file of logFiles) {
          await fs.unlink(path.join(logDir, file)).catch(() => {})
        }
        UI.println(UI.Style.TEXT_GREEN + `  Cleared ${logFiles.length} log files` + UI.Style.RESET)
      } catch {
        UI.println(UI.Style.TEXT_RED + "  Failed to clear logs" + UI.Style.RESET)
      }
      return
    }

    // Get current log file or most recent
    let logFile = Log.file()
    if (!logFile) {
      try {
        const files = await fs.readdir(logDir)
        const logFiles = files.filter((f) => f.endsWith(".log")).sort().reverse()
        if (logFiles.length > 0) {
          logFile = path.join(logDir, logFiles[0])
        }
      } catch {}
    }

    if (!logFile) {
      UI.println(UI.Style.TEXT_RED + "No log file found" + UI.Style.RESET)
      return
    }

    UI.println(UI.Style.TEXT_DIM + `Log file: ${logFile}` + UI.Style.RESET)
    UI.empty()

    // Follow mode
    if (args.follow) {
      UI.println(UI.Style.TEXT_YELLOW + "Following log output (Ctrl+C to stop)..." + UI.Style.RESET)
      UI.empty()

      const proc = Bun.spawn({
        cmd: ["tail", "-f", logFile],
        stdout: "inherit",
        stderr: "inherit",
      })

      process.on("SIGINT", () => {
        proc.kill()
        process.exit(0)
      })

      await proc.exited
      return
    }

    // Show last N lines
    try {
      const content = await fs.readFile(logFile, "utf-8")
      const lines = content.trim().split("\n")
      const tailLines = lines.slice(-args.tail)

      for (const line of tailLines) {
        // Colorize log levels
        let coloredLine = line
        if (line.includes("ERROR")) {
          coloredLine = UI.Style.TEXT_RED + line + UI.Style.RESET
        } else if (line.includes("WARN")) {
          coloredLine = UI.Style.TEXT_YELLOW + line + UI.Style.RESET
        } else if (line.includes("DEBUG")) {
          coloredLine = UI.Style.TEXT_DIM + line + UI.Style.RESET
        }
        UI.println(coloredLine)
      }

      UI.empty()
      UI.println(UI.Style.TEXT_DIM + `Showing last ${tailLines.length} of ${lines.length} lines` + UI.Style.RESET)
    } catch (e) {
      UI.println(UI.Style.TEXT_RED + "Failed to read log file" + UI.Style.RESET)
    }
  },
})
