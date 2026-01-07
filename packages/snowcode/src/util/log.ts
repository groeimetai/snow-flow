import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import z from "zod/v4"
import { Flag } from "../flag/flag"

export namespace Log {
  export const Level = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).meta({ ref: "LogLevel", description: "Log level" })
  export type Level = z.infer<typeof Level>

  const levelPriority: Record<Level, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  }

  let level: Level = "INFO"

  export function setLevel(newLevel: Level) {
    level = newLevel
  }

  export function getLevel(): Level {
    return level
  }

  function shouldLog(input: Level): boolean {
    return levelPriority[input] >= levelPriority[level]
  }

  // JSON debug file for pretty-printed structured logs
  interface DebugLogEntry {
    timestamp: string
    level: Level
    service?: string
    message?: string
    extra?: Record<string, any>
    duration?: number
  }

  let debugFilePath: string | null = null
  let debugLogEntries: DebugLogEntry[] = []
  let debugFileWriter: ReturnType<typeof Bun.file>["writer"] | null = null

  export function debugFile() {
    return debugFilePath
  }

  export async function initDebugFile(cwd: string, forceEnable = false) {
    // Check environment variables at runtime (not at module load time)
    const debugPath = process.env["SNOWCODE_DEBUG_FILE"] || process.env["OPENCODE_DEBUG_FILE"]
    const debugEnabled = forceEnable ||
      process.env["SNOWCODE_DEBUG"]?.toLowerCase() === "true" ||
      process.env["OPENCODE_DEBUG"]?.toLowerCase() === "true"

    if (!debugPath && !debugEnabled) return

    // Use provided path or default to .snow-flow-debug.json in working directory
    debugFilePath = debugPath || path.join(cwd, ".snow-flow-debug.json")

    // Initialize with empty array
    debugLogEntries = []
    await writeDebugFile()

    // Log that debug file is initialized
    console.error(`[Debug] Writing debug logs to: ${debugFilePath}`)
  }

  async function writeDebugFile() {
    if (!debugFilePath) return
    try {
      await Bun.write(debugFilePath, JSON.stringify(debugLogEntries, null, 2))
    } catch {
      // Silently ignore write errors
    }
  }

  function addDebugEntry(entry: DebugLogEntry) {
    if (!debugFilePath) return
    debugLogEntries.push(entry)
    // Keep only last 1000 entries to prevent file from growing too large
    if (debugLogEntries.length > 1000) {
      debugLogEntries = debugLogEntries.slice(-1000)
    }
    // Write async, don't await
    writeDebugFile()
  }

  export type Logger = {
    debug(message?: any, extra?: Record<string, any>): void
    info(message?: any, extra?: Record<string, any>): void
    error(message?: any, extra?: Record<string, any>): void
    warn(message?: any, extra?: Record<string, any>): void
    tag(key: string, value: string): Logger
    clone(): Logger
    time(
      message: string,
      extra?: Record<string, any>,
    ): {
      stop(): void
      [Symbol.dispose](): void
    }
  }

  const loggers = new Map<string, Logger>()

  export const Default = create({ service: "default" })

  export interface Options {
    print: boolean
    dev?: boolean
    level?: Level
  }

  let logpath = ""
  export function file() {
    return logpath
  }

  export async function init(options: Options) {
    // Priority: explicit option > env var > default
    if (options.level) {
      level = options.level
    } else {
      const envLevel = process.env["SNOWCODE_LOG_LEVEL"] || process.env["OPENCODE_LOG_LEVEL"]
      if (envLevel && Level.safeParse(envLevel).success) {
        level = envLevel as Level
      }
    }
    cleanup(Global.Path.log)
    if (options.print) return
    logpath = path.join(
      Global.Path.log,
      options.dev ? "dev.log" : new Date().toISOString().split(".")[0].replace(/:/g, "") + ".log",
    )
    const logfile = Bun.file(logpath)
    await fs.truncate(logpath).catch(() => {})
    const writer = logfile.writer()
    process.stderr.write = (msg) => {
      writer.write(msg)
      writer.flush()
      return true
    }
  }

  async function cleanup(dir: string) {
    const glob = new Bun.Glob("????-??-??T??????.log")
    const files = await Array.fromAsync(
      glob.scan({
        cwd: dir,
        absolute: true,
      }),
    )
    if (files.length <= 5) return

    const filesToDelete = files.slice(0, -10)
    await Promise.all(filesToDelete.map((file) => fs.unlink(file).catch(() => {})))
  }

  function formatError(error: Error, depth = 0): string {
    const result = error.message
    return error.cause instanceof Error && depth < 10
      ? result + " Caused by: " + formatError(error.cause, depth + 1)
      : result
  }

  let last = Date.now()
  export function create(tags?: Record<string, any>) {
    tags = tags || {}

    const service = tags["service"]
    if (service && typeof service === "string") {
      const cached = loggers.get(service)
      if (cached) {
        return cached
      }
    }

    function build(message: any, extra?: Record<string, any>) {
      const prefix = Object.entries({
        ...tags,
        ...extra,
      })
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          const prefix = `${key}=`
          if (value instanceof Error) return prefix + formatError(value)
          if (typeof value === "object") return prefix + JSON.stringify(value)
          return prefix + value
        })
        .join(" ")
      const next = new Date()
      const diff = next.getTime() - last
      last = next.getTime()
      return [next.toISOString().split(".")[0], "+" + diff + "ms", prefix, message].filter(Boolean).join(" ") + "\n"
    }
    // Helper to write to debug JSON file
    function logToDebugFile(level: Level, message?: any, extra?: Record<string, any>) {
      if (!debugFilePath) return
      addDebugEntry({
        timestamp: new Date().toISOString(),
        level,
        service: tags?.["service"],
        message: message instanceof Error ? formatError(message) : String(message ?? ""),
        extra: extra ? { ...tags, ...extra } : tags,
      })
    }

    const result: Logger = {
      debug(message?: any, extra?: Record<string, any>) {
        logToDebugFile("DEBUG", message, extra)
        if (shouldLog("DEBUG")) {
          process.stderr.write("DEBUG " + build(message, extra))
        }
      },
      info(message?: any, extra?: Record<string, any>) {
        logToDebugFile("INFO", message, extra)
        if (shouldLog("INFO")) {
          process.stderr.write("INFO  " + build(message, extra))
        }
      },
      error(message?: any, extra?: Record<string, any>) {
        logToDebugFile("ERROR", message, extra)
        if (shouldLog("ERROR")) {
          process.stderr.write("ERROR " + build(message, extra))
        }
      },
      warn(message?: any, extra?: Record<string, any>) {
        logToDebugFile("WARN", message, extra)
        if (shouldLog("WARN")) {
          process.stderr.write("WARN  " + build(message, extra))
        }
      },
      tag(key: string, value: string) {
        if (tags) tags[key] = value
        return result
      },
      clone() {
        return Log.create({ ...tags })
      },
      time(message: string, extra?: Record<string, any>) {
        const now = Date.now()
        result.info(message, { status: "started", ...extra })
        function stop() {
          result.info(message, {
            status: "completed",
            duration: Date.now() - now,
            ...extra,
          })
        }
        return {
          stop,
          [Symbol.dispose]() {
            stop()
          },
        }
      },
    }

    if (service && typeof service === "string") {
      loggers.set(service, result)
    }

    return result
  }
}
