import { Global } from "../../global"
import { Provider } from "../../provider/provider"
import { Server } from "../../server/server"
import { UI } from "../ui"
import { cmd } from "./cmd"
import path from "path"
import fs from "fs/promises"
import { Installation } from "../../installation"
import { Config } from "../../config/config"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import { Ide } from "../../ide"

import { Flag } from "../../flag/flag"
import { Session } from "../../session"
import { $ } from "bun"
import { bootstrap } from "../bootstrap"

// Re-export for use by debug command
export { Log }

declare global {
  const SNOWCODE_TUI_PATH: string
}

if (typeof SNOWCODE_TUI_PATH !== "undefined") {
  await import(SNOWCODE_TUI_PATH as string, {
    with: { type: "file" },
  })
}

export const TuiCommand = cmd({
  command: "$0 [project]",
  describe: "start snow-code tui",
  builder: (yargs) =>
    yargs
      .positional("project", {
        type: "string",
        describe: "path to start snow-code in",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
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
      .option("prompt", {
        alias: ["p"],
        type: "string",
        describe: "prompt to use",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("port", {
        type: "number",
        describe: "port to listen on",
        default: 0,
      })
      .option("hostname", {
        alias: ["h"],
        type: "string",
        describe: "hostname to listen on",
        default: "127.0.0.1",
      })
      .option("debug", {
        alias: ["d"],
        type: "boolean",
        describe: "enable debug mode (verbose logging, debug tokens, tools, MCP)",
        default: false,
      })
      .option("debug-level", {
        type: "string",
        describe: "set log level (DEBUG, INFO, WARN, ERROR)",
        choices: ["DEBUG", "INFO", "WARN", "ERROR"],
      })
      .option("debug-file", {
        type: "string",
        describe: "path for debug JSON output file (default: .snow-flow-debug.json)",
      }),
  handler: async (args) => {
    const cwd = args.project ? path.resolve(args.project) : process.cwd()

    // Set log level if specified (works independently of --debug flag)
    if (args["debug-level"]) {
      Log.setLevel(args["debug-level"] as Log.Level)
    }

    // Show debug mode status and initialize debug file
    if (args.debug || args["debug-file"]) {
      UI.println(UI.Style.TEXT_YELLOW + "Debug mode enabled" + UI.Style.RESET)
      UI.println(UI.Style.TEXT_DIM + "  SNOWCODE_DEBUG=true (all debug flags)" + UI.Style.RESET)
      if (args["debug-level"]) {
        UI.println(UI.Style.TEXT_DIM + `  SNOWCODE_LOG_LEVEL=${args["debug-level"]}` + UI.Style.RESET)
      }

      // Set debug file env var if custom path provided
      if (args["debug-file"]) {
        process.env["SNOWCODE_DEBUG_FILE"] = path.resolve(args["debug-file"])
      }

      // Initialize debug JSON file in working directory
      // Pass forceEnable=true since we know debug is requested
      await Log.initDebugFile(cwd, true)
      const debugFile = Log.debugFile()
      if (debugFile) {
        UI.println(UI.Style.TEXT_DIM + `  Debug file: ${debugFile}` + UI.Style.RESET)
      }
      UI.empty()
    }

    while (true) {
      try {
        process.chdir(cwd)
      } catch (e) {
        UI.error("Failed to change directory to " + cwd)
        return
      }
      const result = await bootstrap(cwd, async () => {
        const sessionID = await (async () => {
          if (args.continue) {
            const it = Session.list()
            try {
              for await (const s of it) {
                if (s.parentID === undefined) {
                  return s.id
                }
              }
              return
            } finally {
              await it.return()
            }
          }
          if (args.session) {
            return args.session
          }
          return undefined
        })()
        const providers = await Provider.list()
        if (Object.keys(providers).length === 0) {
          return "needs_provider"
        }

        const server = Server.listen({
          port: args.port,
          hostname: args.hostname,
        })

        let cmd = [] as string[]

        // Platform binaries: TUI is in node_modules/@groeimetai/snow-flow-{platform}-{arch}/bin/tui
        const platformMap: Record<string, string> = {
          darwin: "darwin",
          linux: "linux",
          win32: "win32"
        }
        const archMap: Record<string, string> = {
          x64: "x64",
          arm64: "arm64",
          arm: "arm"
        }
        const platform = platformMap[process.platform] || process.platform
        const arch = archMap[process.arch] || process.arch
        const tuiExt = process.platform === "win32" ? ".exe" : ""
        const platformPkgName = `@groeimetai/snow-flow-${platform}-${arch}`

        // Try multiple possible locations for the platform binary
        const possiblePaths = [
          // Try using Node's module resolution (most reliable)
          (() => {
            try {
              const pkgPath = require.resolve(`${platformPkgName}/package.json`)
              return path.join(path.dirname(pkgPath), "bin", `tui${tuiExt}`)
            } catch {
              return null
            }
          })(),
          // Relative to package root (calculated from import.meta.dir)
          path.join(path.dirname(path.dirname(path.dirname(import.meta.dir))), "node_modules", platformPkgName, "bin", `tui${tuiExt}`),
          // Relative to current executable
          path.join(path.dirname(process.argv[1]), "..", "node_modules", platformPkgName, "bin", `tui${tuiExt}`),
        ].filter(Boolean) as string[]

        let platformBinaryPath: string | undefined
        for (const tryPath of possiblePaths) {
          if (await Bun.file(tryPath).exists()) {
            platformBinaryPath = tryPath
            break
          }
        }

        if (platformBinaryPath) {
          cmd = [platformBinaryPath]
          UI.println(UI.Style.TEXT_DIM + `Using TUI from platform binary: ${platformBinaryPath}`)
        } else {
          // Fallback: try embedded files (for development builds)
          const tui = Bun.embeddedFiles.find((item) => (item as File).name.includes("tui")) as File
          if (tui) {
            let binaryName = tui.name
            if (process.platform === "win32" && !binaryName.endsWith(".exe")) {
              binaryName += ".exe"
            }
            const binary = path.join(Global.Path.cache, "tui", binaryName)
            const file = Bun.file(binary)
            if (!(await file.exists())) {
              await Bun.write(file, tui, { mode: 0o755 })
              if (process.platform !== "win32") await fs.chmod(binary, 0o755)
            }
            cmd = [binary]
          } else {
            UI.error("TUI binary not found - platform binary may be incomplete")
            UI.println("Expected location: " + platformBinaryPath)
            UI.println("Try reinstalling: npm install -g @groeimetai/snow-flow-snowcode")
            return "done"
          }
        }
        Log.Default.info("tui", {
          cmd,
        })
        const proc = Bun.spawn({
          cmd: [
            ...cmd,
            ...(args.model ? ["--model", args.model] : []),
            ...(args.prompt ? ["--prompt", args.prompt] : []),
            ...(args.agent ? ["--agent", args.agent] : []),
            ...(sessionID ? ["--session", sessionID] : []),
          ],
          cwd,
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
          env: {
            ...process.env,
            CGO_ENABLED: "0",
            SNOWCODE_SERVER: server.url.toString(),
            OPENCODE_SERVER: server.url.toString(), // Fallback for compatibility
            // Debug mode environment variables
            ...((args.debug || args["debug-file"]) ? {
              SNOWCODE_DEBUG: "true",
              SNOWCODE_DEBUG_TOKENS: "true",
              SNOWCODE_DEBUG_TOOLS: "true",
              SNOWCODE_DEBUG_MCP: "true",
              SNOWCODE_DEBUG_PROVIDERS: "true",
              SNOWCODE_DEBUG_SESSIONS: "true",
              SNOWCODE_DEBUG_COST: "true",
            } : {}),
            ...(args["debug-level"] ? { SNOWCODE_LOG_LEVEL: args["debug-level"] } : {}),
            ...(args["debug-file"] ? { SNOWCODE_DEBUG_FILE: path.resolve(args["debug-file"]) } : {}),
          },
          onExit: () => {
            server.stop()
          },
        })

        ;(async () => {
          // Skip auto-update in local development mode
          if (Installation.isLocal()) return
          const config = await Config.get()
          if (config.autoupdate === false || Flag.SNOWCODE_DISABLE_AUTOUPDATE) return
          const latest = await Installation.latest().catch(() => {})
          if (!latest || typeof latest !== 'string' || !latest.trim()) return
          if (Installation.VERSION === latest) return
          const method = await Installation.method()
          if (method === "unknown") return
          await Installation.upgrade(method, latest)
            .then(() => Bus.publish(Installation.Event.Updated, { version: latest }))
            .catch(() => {})
        })()
        ;(async () => {
          if (Ide.alreadyInstalled()) return
          const ide = Ide.ide()
          if (ide === "unknown") return
          await Ide.install(ide)
            .then(() => Bus.publish(Ide.Event.Installed, { ide }))
            .catch(() => {})
        })()

        await proc.exited
        server.stop()

        return "done"
      })
      if (result === "done") break
      if (result === "needs_provider") {
        UI.empty()
        UI.println(UI.logo("   "))
        const result = await Bun.spawn({
          cmd: [...getSnowcodeCommand(), "auth", "login"],
          cwd: process.cwd(),
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
        }).exited
        if (result !== 0) return
        UI.empty()
      }
    }
  },
})

/**
 * Get the correct command to run snow-code CLI
 * In development: ["bun", "run", "packages/snowcode/src/index.ts"]
 * In production: ["/path/to/snow-code"]
 */
function getSnowcodeCommand(): string[] {
  // Check if SNOWCODE_BIN_PATH is set (used by shell wrapper scripts)
  if (process.env["SNOWCODE_BIN_PATH"] || process.env["OPENCODE_BIN_PATH"]) {
    return [process.env["SNOWCODE_BIN_PATH"] || process.env["OPENCODE_BIN_PATH"]!]
  }

  const execPath = process.execPath.toLowerCase()

  if (Installation.isLocal()) {
    // In development, use bun to run the TypeScript entry point
    return [execPath, "run", process.argv[1]]
  }

  // In production, use the current executable path
  return [process.execPath]
}
