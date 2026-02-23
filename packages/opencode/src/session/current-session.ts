/**
 * Current Session ID Management
 *
 * Writes the current session ID to a file that the MCP server can read.
 * This allows session-based tool enabling to persist across conversation compaction.
 *
 * The MCP server reads this file via ToolSearch.getCurrentSession() to know
 * which session's enabled tools to use.
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { Log } from "../util/log"

const log = Log.create({ service: "current-session" })

/**
 * Get the current session file path
 * Uses the same data directory as snow-code/MCP server
 */
function getCurrentSessionFilePath(): string {
  let dataDir: string
  if (process.platform === "darwin") {
    dataDir = path.join(os.homedir(), "Library", "Application Support", "snow-code")
  } else if (process.platform === "win32" && process.env.APPDATA) {
    dataDir = path.join(process.env.APPDATA, "snow-code")
  } else {
    dataDir = path.join(os.homedir(), ".local", "share", "snow-code")
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  return path.join(dataDir, "current-session.json")
}

/**
 * Set the current session ID
 * Called when a session becomes active (created or selected)
 */
export function setCurrentSessionId(sessionId: string): void {
  try {
    const filePath = getCurrentSessionFilePath()
    const data = JSON.stringify(
      {
        sessionId,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )
    fs.writeFileSync(filePath, data, "utf-8")
    log.debug("set current session", { sessionId })
  } catch (e: any) {
    log.warn("failed to set current session", { error: e.message })
  }
}

/**
 * Get the current session ID
 */
export function getCurrentSessionId(): string | undefined {
  try {
    const filePath = getCurrentSessionFilePath()
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"))
      return data.sessionId
    }
  } catch (e: any) {
    log.debug("failed to read current session", { error: e.message })
  }
  return undefined
}

/**
 * Clear the current session ID
 */
export function clearCurrentSessionId(): void {
  try {
    const filePath = getCurrentSessionFilePath()
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      log.debug("cleared current session")
    }
  } catch (e: any) {
    log.warn("failed to clear current session", { error: e.message })
  }
}
