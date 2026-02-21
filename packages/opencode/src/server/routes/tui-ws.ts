import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { upgradeWebSocket } from "hono/bun"
import z from "zod"
import { lazy } from "../../util/lazy"
import { Log } from "../../util/log"
import type { IPty } from "bun-pty"

const log = Log.create({ service: "tui-ws" })

const HEARTBEAT_INTERVAL = 30_000

interface TuiSession {
  pty: IPty
  lastActivity: number
}

const sessions = new Map<string, TuiSession>()

const IDLE_TIMEOUT = 30 * 60 * 1000

const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > IDLE_TIMEOUT) {
      log.info("cleaning up idle tui session", { id })
      try {
        session.pty.kill()
      } catch {}
      sessions.delete(id)
    }
  }
}, 60_000)

if (typeof cleanup === "object" && "unref" in cleanup) {
  cleanup.unref()
}

async function spawnTui(cols: number, rows: number, env?: Record<string, string>): Promise<{ id: string; pty: IPty }> {
  const { spawn } = await import("bun-pty")
  const id = crypto.randomUUID()

  const ptyProcess = spawn("bun", ["run", "--conditions=browser", "src/index.ts", "--connect", "http://localhost:4096"], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: new URL("../../../", import.meta.url).pathname.replace(/\/$/, ""),
    env: {
      ...process.env,
      ...env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      FORCE_COLOR: "3",
    },
  })

  const session: TuiSession = { pty: ptyProcess, lastActivity: Date.now() }
  sessions.set(id, session)

  ptyProcess.onExit((exitCode) => {
    log.info("tui session exited", { id, exitCode })
    sessions.delete(id)
  })

  log.info("tui session spawned", { id, pid: ptyProcess.pid })
  return { id, pty: ptyProcess }
}

export const TuiWsRoutes = lazy(() =>
  new Hono().get(
    "/ws",
    describeRoute({
      summary: "Connect to TUI via WebSocket",
      description:
        "Establish a WebSocket connection that spawns a TUI instance as a PTY and streams terminal I/O. Send JSON messages with type 'resize' to change terminal dimensions. All other messages are forwarded as terminal input.",
      operationId: "tui.ws.connect",
      responses: {
        101: {
          description: "WebSocket upgrade successful",
        },
      },
    }),
    upgradeWebSocket((c) => {
      const cols = parseInt(c.req.query("cols") ?? "80")
      const rows = parseInt(c.req.query("rows") ?? "24")
      let session: TuiSession | undefined
      let sessionId: string | undefined
      let heartbeat: ReturnType<typeof setInterval> | undefined

      return {
        async onOpen(_event, ws) {
          try {
            const result = await spawnTui(cols, rows)
            session = sessions.get(result.id)
            sessionId = result.id

            result.pty.onData((data) => {
              if (session) session.lastActivity = Date.now()
              try {
                ws.send(data)
              } catch {
                // client disconnected
              }
            })

            heartbeat = setInterval(() => {
              try {
                ws.send("")
              } catch {}
            }, HEARTBEAT_INTERVAL)

            log.info("client connected to tui session", { id: sessionId })
          } catch (e) {
            log.error("failed to spawn tui", { error: e })
            ws.close(1011, "Failed to spawn TUI")
          }
        },
        onMessage(event) {
          if (!session) return
          session.lastActivity = Date.now()
          const data = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer)

          // Check for JSON control messages
          if (data.startsWith("{")) {
            try {
              const msg = JSON.parse(data)
              if (msg.type === "resize" && typeof msg.cols === "number" && typeof msg.rows === "number") {
                session.pty.resize(msg.cols, msg.rows)
                return
              }
            } catch {
              // not JSON, treat as terminal input
            }
          }

          session.pty.write(data)
        },
        onClose() {
          log.info("client disconnected from tui session", { id: sessionId })
          if (heartbeat) clearInterval(heartbeat)
          if (session && sessionId) {
            try {
              session.pty.kill()
            } catch {}
            sessions.delete(sessionId)
          }
        },
      }
    }),
  ),
)
