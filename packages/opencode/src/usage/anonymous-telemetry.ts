import { Instance } from "@/project/instance"
import { Bus } from "@/bus"
import { MessageV2 } from "@/session/message-v2"
import { Log } from "@/util/log"
import { Installation } from "@/installation"
import { Flag } from "@/flag/flag"
import { Config } from "@/config/config"
import { machineIdSync } from "node-machine-id"

const log = Log.create({ service: "usage.anonymous-telemetry" })

const PORTAL_URL = process.env.SNOW_FLOW_PORTAL_URL || "https://portal.snow-flow.dev"

function isDisabled(): boolean {
  const dnt = process.env.DO_NOT_TRACK?.toLowerCase()
  if (dnt === "1" || dnt === "true") return true
  if (Flag.OPENCODE_TELEMETRY_DISABLED) return true
  const ci = process.env.CI?.toLowerCase()
  if (ci === "true" || ci === "1") return true
  return false
}

function getMachineId(): string | undefined {
  try {
    return machineIdSync()
  } catch {
    return undefined
  }
}

function detectInstallMethod(): string {
  // Check npm
  if (process.env.npm_config_user_agent) return "npm"
  // Check bun
  if (typeof globalThis.Bun !== "undefined") return "bun"
  // Check homebrew
  const execPath = process.execPath || ""
  if (execPath.includes("Cellar") || execPath.includes("homebrew") || execPath.includes("linuxbrew")) return "brew"
  // Check standalone binary (no node_modules in path suggests binary distribution)
  if (!execPath.includes("node_modules") && !execPath.includes("node") && !execPath.includes("bun")) return "binary"
  return "other"
}

async function sendPing(payload: Record<string, unknown>): Promise<void> {
  try {
    const response = await fetch(`${PORTAL_URL}/api/telemetry/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000),
    })
    log.info("telemetry ping sent", { status: response.status, type: payload.type })
    if (process.env.SNOW_FLOW_DEBUG_TELEMETRY) {
      console.error(`[telemetry] ping OK (${payload.type}) → ${response.status}`)
    }
  } catch (error) {
    log.info("telemetry ping failed", { error: String(error), type: payload.type })
    if (process.env.SNOW_FLOW_DEBUG_TELEMETRY) {
      console.error(`[telemetry] ping failed (${payload.type}):`, String(error))
    }
  }
}

export namespace AnonymousTelemetry {
  const state = Instance.state(
    () => {
      if (isDisabled()) {
        log.info("anonymous telemetry disabled (env)")
        return { disabled: true as const, unsubs: [] as (() => void)[], startTime: 0, messageCount: 0 }
      }

      const machineId = getMachineId()
      if (!machineId) {
        log.info("anonymous telemetry disabled (no machine id)")
        return { disabled: true as const, unsubs: [] as (() => void)[], startTime: 0, messageCount: 0 }
      }

      let messageCount = 0
      let exitReason: "normal" | "error" | "interrupt" = "normal"
      let configDisabled = false
      const startTime = Date.now()
      const sessionId = crypto.randomUUID()
      const installMethod = detectInstallMethod()

      const unsubs = [
        Bus.subscribe(MessageV2.Event.Updated, (event) => {
          if (event.properties.info.role === "user") messageCount++
        }),
      ]

      // Track exit reason via process signals
      const onError = () => {
        exitReason = "error"
      }
      const onInterrupt = () => {
        exitReason = "interrupt"
      }
      process.on("uncaughtException", onError)
      process.on("unhandledRejection", onError)
      process.on("SIGINT", onInterrupt)
      process.on("SIGTERM", onInterrupt)

      const basePayload = {
        machineId,
        sessionId,
        version: Installation.VERSION,
        channel: Installation.CHANNEL,
        os: process.platform,
        arch: process.arch,
        installMethod,
      }

      log.info("anonymous telemetry initializing", { machineId: machineId.slice(0, 8) + "..." })

      Config.get()
        .then((config) => {
          if (config.telemetry === false) {
            configDisabled = true
            log.info("anonymous telemetry disabled (config)")
            for (const unsub of unsubs) unsub()
            unsubs.length = 0
            return
          }
          log.info("anonymous telemetry active, sending start ping")
          sendPing({ ...basePayload, type: "start", sessionDurationSec: 0, messageCount: 0, timestamp: Date.now() })
        })
        .catch(() => {
          log.info("anonymous telemetry active (config unavailable), sending start ping")
          sendPing({ ...basePayload, type: "start", sessionDurationSec: 0, messageCount: 0, timestamp: Date.now() })
        })

      return {
        disabled: false as const,
        unsubs,
        startTime,
        machineId,
        sessionId,
        basePayload,
        get messageCount() {
          return messageCount
        },
        get exitReason() {
          return exitReason
        },
        get configDisabled() {
          return configDisabled
        },
        cleanup() {
          process.removeListener("uncaughtException", onError)
          process.removeListener("unhandledRejection", onError)
          process.removeListener("SIGINT", onInterrupt)
          process.removeListener("SIGTERM", onInterrupt)
        },
      }
    },
    async (current) => {
      for (const unsub of current.unsubs) unsub()
      if (current.disabled || current.configDisabled) return

      if ("cleanup" in current) current.cleanup()

      const sessionDurationSec = Math.round((Date.now() - current.startTime) / 1000)

      await sendPing({
        ...current.basePayload,
        type: "end",
        exitReason: current.exitReason,
        sessionDurationSec,
        messageCount: current.messageCount,
        timestamp: Date.now(),
      })
    },
  )

  export function init() {
    state()
  }
}
