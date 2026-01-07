import { Flag } from "../../../flag/flag"
import { Global } from "../../../global"
import { Installation } from "../../../installation"
import { Log } from "../../../util/log"
import { Config } from "../../../config/config"
import { Provider } from "../../../provider/provider"
import { UI } from "../../ui"
import { cmd } from "../cmd"
import { bootstrap } from "../../bootstrap"
import fs from "fs/promises"
import path from "path"

export const StatusCommand = cmd({
  command: "status",
  describe: "show debug status and environment info",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      UI.empty()
      UI.println(UI.Style.TEXT_CYAN + "=== Snow-Flow Debug Status ===" + UI.Style.RESET)
      UI.empty()

      // Version info
      UI.println(UI.Style.TEXT_YELLOW + "Version:" + UI.Style.RESET)
      UI.println(`  Snow-Code: ${Installation.VERSION}`)
      UI.println(`  Node: ${process.version}`)
      UI.println(`  Bun: ${Bun.version}`)
      UI.println(`  Platform: ${process.platform} ${process.arch}`)
      UI.empty()

      // Paths
      UI.println(UI.Style.TEXT_YELLOW + "Paths:" + UI.Style.RESET)
      for (const [key, value] of Object.entries(Global.Path)) {
        const exists = await fs.stat(value).then(() => true).catch(() => false)
        const status = exists ? UI.Style.TEXT_GREEN + "✓" : UI.Style.TEXT_RED + "✗"
        UI.println(`  ${key.padEnd(12)} ${status}${UI.Style.RESET} ${value}`)
      }
      UI.empty()

      // Debug flags
      UI.println(UI.Style.TEXT_YELLOW + "Debug Flags:" + UI.Style.RESET)
      const debugFlags = [
        ["SNOWCODE_DEBUG", Flag.SNOWCODE_DEBUG],
        ["SNOWCODE_DEBUG_TOKENS", Flag.SNOWCODE_DEBUG_TOKENS],
        ["SNOWCODE_DEBUG_TOOLS", Flag.SNOWCODE_DEBUG_TOOLS],
        ["SNOWCODE_DEBUG_MCP", Flag.SNOWCODE_DEBUG_MCP],
        ["SNOWCODE_DEBUG_PROVIDERS", Flag.SNOWCODE_DEBUG_PROVIDERS],
        ["SNOWCODE_DEBUG_SESSIONS", Flag.SNOWCODE_DEBUG_SESSIONS],
        ["SNOWCODE_DEBUG_COST", Flag.SNOWCODE_DEBUG_COST],
      ] as const
      for (const [name, value] of debugFlags) {
        const status = value ? UI.Style.TEXT_GREEN + "ON " : UI.Style.TEXT_DIM + "OFF"
        UI.println(`  ${name.padEnd(28)} ${status}${UI.Style.RESET}`)
      }
      UI.empty()

      // Feature flags
      UI.println(UI.Style.TEXT_YELLOW + "Feature Flags:" + UI.Style.RESET)
      const featureFlags = [
        ["SNOWCODE_DISABLE_AUTOUPDATE", Flag.SNOWCODE_DISABLE_AUTOUPDATE],
        ["SNOWCODE_DISABLE_PRUNE", Flag.SNOWCODE_DISABLE_PRUNE],
        ["SNOWCODE_DISABLE_LSP_DOWNLOAD", Flag.SNOWCODE_DISABLE_LSP_DOWNLOAD],
        ["SNOWCODE_DISABLE_AUTOCOMPACT", Flag.SNOWCODE_DISABLE_AUTOCOMPACT],
        ["SNOWCODE_EXPERIMENTAL_WATCHER", Flag.SNOWCODE_EXPERIMENTAL_WATCHER],
        ["SNOWCODE_EXPERIMENTAL_TURN_SUMMARY", Flag.SNOWCODE_EXPERIMENTAL_TURN_SUMMARY],
      ] as const
      for (const [name, value] of featureFlags) {
        const status = value ? UI.Style.TEXT_GREEN + "ON " : UI.Style.TEXT_DIM + "OFF"
        UI.println(`  ${name.padEnd(36)} ${status}${UI.Style.RESET}`)
      }
      UI.empty()

      // Config
      try {
        const config = await Config.get()
        UI.println(UI.Style.TEXT_YELLOW + "Configuration:" + UI.Style.RESET)
        UI.println(`  Model: ${config.model?.model || "not set"}`)
        UI.println(`  Provider: ${config.model?.provider || "not set"}`)
        UI.println(`  Share: ${config.share || "disabled"}`)
        UI.println(`  Auto-update: ${config.autoupdate !== false ? "enabled" : "disabled"}`)
        UI.empty()
      } catch (e) {
        UI.println(UI.Style.TEXT_RED + "Config: Failed to load" + UI.Style.RESET)
      }

      // Providers
      UI.println(UI.Style.TEXT_YELLOW + "Providers:" + UI.Style.RESET)
      try {
        const providers = await Provider.list()
        const providerNames = Object.keys(providers)
        if (providerNames.length === 0) {
          UI.println(UI.Style.TEXT_DIM + "  No providers configured" + UI.Style.RESET)
        } else {
          for (const name of providerNames.slice(0, 10)) {
            const modelCount = Object.keys(providers[name].models || {}).length
            UI.println(`  ${name}: ${modelCount} models`)
          }
          if (providerNames.length > 10) {
            UI.println(UI.Style.TEXT_DIM + `  ... and ${providerNames.length - 10} more` + UI.Style.RESET)
          }
        }
      } catch (e) {
        UI.println(UI.Style.TEXT_RED + "  Failed to load providers" + UI.Style.RESET)
      }
      UI.empty()

      // Log file
      const logFile = Log.file()
      if (logFile) {
        UI.println(UI.Style.TEXT_YELLOW + "Log File:" + UI.Style.RESET)
        UI.println(`  ${logFile}`)
        try {
          const stats = await fs.stat(logFile)
          UI.println(`  Size: ${(stats.size / 1024).toFixed(2)} KB`)
        } catch {
          UI.println(UI.Style.TEXT_DIM + "  (not created yet)" + UI.Style.RESET)
        }
      }
      UI.empty()
    })
  },
})
