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
  // 1. Standard DO_NOT_TRACK convention (consoledonottrack.com)
  const dnt = process.env.DO_NOT_TRACK?.toLowerCase()
  if (dnt === "1" || dnt === "true") return true

  // 2. Snow-Flow specific env vars
  if (Flag.OPENCODE_TELEMETRY_DISABLED) return true

  // 3. CI environments
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

export namespace AnonymousTelemetry {
  const state = Instance.state(
    () => {
      // Check env-based opt-out first (sync, before any subscriptions)
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
      const startTime = Date.now()

      const unsubs = [
        Bus.subscribe(MessageV2.Event.Updated, (event) => {
          if (event.properties.info.role === "user") {
            messageCount++
          }
        }),
      ]

      // Check config-based opt-out, then send session-start ping
      Config.get().then(async (config) => {
        if (config.telemetry === false) {
          log.info("anonymous telemetry disabled (config)")
          for (const unsub of unsubs) unsub()
          unsubs.length = 0
          return
        }
        log.info("anonymous telemetry active")

        // Send a session-start ping immediately so we have instant visibility
        try {
          await fetch(`${PORTAL_URL}/api/telemetry/ping`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              machineId,
              version: Installation.VERSION,
              channel: Installation.CHANNEL,
              os: process.platform,
              arch: process.arch,
              sessionDurationSec: 0,
              messageCount: 0,
              timestamp: Date.now(),
            }),
            signal: AbortSignal.timeout(5_000),
          })
        } catch {
          // Fire-and-forget
        }
      }).catch(() => {
        log.info("anonymous telemetry active (config unavailable)")
      })

      return { disabled: false as const, unsubs, startTime, machineId, get messageCount() { return messageCount } }
    },
    async (current) => {
      for (const unsub of current.unsubs) unsub()

      if (current.disabled) return

      const sessionDurationSec = Math.round((Date.now() - current.startTime) / 1000)

      // Check config opt-out before sending
      const config = await Config.get().catch(() => undefined)
      if (config?.telemetry === false) return

      const payload = {
        machineId: current.machineId,
        version: Installation.VERSION,
        channel: Installation.CHANNEL,
        os: process.platform,
        arch: process.arch,
        sessionDurationSec,
        messageCount: current.messageCount,
        timestamp: Date.now(),
      }

      try {
        await fetch(`${PORTAL_URL}/api/telemetry/ping`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5_000),
        })
      } catch {
        // Fire-and-forget: network errors expected when offline
      }
    },
  )

  /** Initialize the anonymous telemetry reporter. Call once per Instance lifecycle. */
  export function init() {
    state()
  }
}
