import type { Argv } from "yargs"
import path from "path"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { Config } from "../../config/config"
import { Global } from "../../global"
import { Instance } from "../../project/instance"
import { bootstrap } from "../bootstrap"
import { UXHelpers } from "../ux-helpers"
import * as prompts from "@clack/prompts"

/**
 * Config Command - Manage Snow-Code configuration
 *
 * Provides:
 * - View current configuration
 * - Set individual config values
 * - Show config file locations
 * - Open config in editor
 * - Reset to defaults
 */

export const ConfigCommand = cmd({
  command: "config [action]",
  describe: "Manage Snow-Code configuration",
  builder: (yargs: Argv) => {
    return yargs
      .positional("action", {
        describe: "Action to perform",
        type: "string",
        choices: ["show", "get", "set", "edit", "paths", "reset"],
        default: "show",
      })
      .option("key", {
        alias: "k",
        describe: "Configuration key (for get/set)",
        type: "string",
      })
      .option("value", {
        alias: "v",
        describe: "Configuration value (for set)",
        type: "string",
      })
      .option("format", {
        alias: "f",
        describe: "Output format",
        type: "string",
        choices: ["json", "yaml", "table"],
        default: "table",
      })
      .option("global", {
        alias: "g",
        describe: "Use global config",
        type: "boolean",
        default: false,
      })
      .example("$0 config show", "Show current configuration")
      .example("$0 config get --key model", "Get specific config value")
      .example("$0 config set --key model --value anthropic/claude-sonnet-4", "Set config value")
      .example("$0 config paths", "Show config file locations")
      .example("$0 config edit", "Open config in editor")
  },
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const action = args.action as string

      switch (action) {
        case "show":
          await showConfig(args.format as string)
          break

        case "get":
          if (!args.key) {
            UI.error("Please specify a key with --key")
            process.exit(1)
          }
          await getConfigValue(args.key)
          break

        case "set":
          if (!args.key) {
            UI.error("Please specify a key with --key")
            process.exit(1)
          }
          if (args.value === undefined) {
            UI.error("Please specify a value with --value")
            process.exit(1)
          }
          await setConfigValue(args.key, args.value, args.global as boolean)
          break

        case "edit":
          await editConfig(args.global as boolean)
          break

        case "paths":
          await showPaths()
          break

        case "reset":
          await resetConfig(args.global as boolean)
          break

        default:
          await showConfig(args.format as string)
      }
    })
  },
})

async function showConfig(format: string) {
  const config = await Config.get()

  if (format === "json") {
    console.log(JSON.stringify(config, null, 2))
    return
  }

  UI.empty()
  prompts.intro("Snow-Code Configuration")

  // Core settings
  const coreSettings = [
    { key: "Model", value: config.model ?? "default" },
    { key: "Small Model", value: config.small_model ?? "default" },
    { key: "Theme", value: config.theme ?? "default" },
    { key: "Username", value: config.username ?? "system" },
    { key: "Share", value: config.share ?? "manual" },
    { key: "Auto Update", value: String(config.autoupdate ?? true) },
  ]

  prompts.log.info("Core Settings")
  for (const { key, value } of coreSettings) {
    console.log(UXHelpers.formatKeyValue(key, value, 14))
  }

  // TUI settings
  if (config.tui) {
    UI.empty()
    prompts.log.info("TUI Settings")
    if (config.tui.scroll_speed) console.log(UXHelpers.formatKeyValue("Scroll Speed", String(config.tui.scroll_speed), 14))
  }

  // Agents
  if (config.agent && Object.keys(config.agent).length > 0) {
    UI.empty()
    prompts.log.info("Configured Agents")
    for (const [name, agent] of Object.entries(config.agent)) {
      const modelInfo = agent.model ? ` (${agent.model})` : ""
      console.log(`  • ${name}${modelInfo}`)
    }
  }

  // MCP Servers
  if (config.mcp && Object.keys(config.mcp).length > 0) {
    UI.empty()
    prompts.log.info("MCP Servers")
    for (const [name, server] of Object.entries(config.mcp)) {
      const status = server.enabled === false ? " (disabled)" : ""
      console.log(`  • ${name}${status}`)
    }
  }

  // Commands
  if (config.command && Object.keys(config.command).length > 0) {
    UI.empty()
    prompts.log.info("Custom Commands")
    for (const [name, command] of Object.entries(config.command)) {
      const desc = command.description ? ` - ${command.description}` : ""
      console.log(`  /${name}${desc}`)
    }
  }

  // Disabled providers
  if (config.disabled_providers && config.disabled_providers.length > 0) {
    UI.empty()
    prompts.log.info("Disabled Providers")
    for (const provider of config.disabled_providers) {
      console.log(`  • ${provider}`)
    }
  }

  prompts.outro("Use 'snowcode config paths' to see config file locations")
}

async function getConfigValue(key: string) {
  const config = await Config.get()

  // Navigate nested keys with dot notation
  const keys = key.split(".")
  let value: unknown = config

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      UI.error(`Key "${key}" not found in configuration`)
      process.exit(1)
    }
  }

  if (typeof value === "object") {
    console.log(JSON.stringify(value, null, 2))
  } else {
    console.log(String(value))
  }
}

async function setConfigValue(key: string, value: string, useGlobal: boolean) {
  const configPath = useGlobal
    ? path.join(Global.Path.config, "config.json")
    : path.join(Instance.directory, "snowcode.json")

  // Read existing config or create empty
  let existingConfig: Record<string, unknown> = {}
  try {
    const file = Bun.file(configPath)
    if (await file.exists()) {
      existingConfig = await file.json()
    }
  } catch {
    // Ignore errors, start fresh
  }

  // Parse value (try JSON first, then string)
  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(value)
  } catch {
    parsedValue = value
  }

  // Navigate and set nested key
  const keys = key.split(".")
  let target: Record<string, unknown> = existingConfig

  // SECURITY: Prevent prototype pollution by blocking dangerous keys
  const BLOCKED_KEYS = ["__proto__", "constructor", "prototype"]
  if (keys.some(k => BLOCKED_KEYS.includes(k))) {
    UXHelpers.error("Invalid key: prototype pollution attempt blocked")
    return
  }

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (!(k in target) || typeof target[k] !== "object") {
      target[k] = {}
    }
    target = target[k] as Record<string, unknown>
  }

  target[keys[keys.length - 1]] = parsedValue

  // Write config
  await Bun.write(configPath, JSON.stringify(existingConfig, null, 2))

  UXHelpers.success(`Set ${key} = ${JSON.stringify(parsedValue)}`)
  prompts.log.info(`Config saved to: ${configPath}`)
}

async function editConfig(useGlobal: boolean) {
  const configPath = useGlobal
    ? path.join(Global.Path.config, "config.json")
    : path.join(Instance.directory, "snowcode.json")

  // Create default config if it doesn't exist
  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    const defaultConfig = {
      $schema: "https://snow-flow.dev/schema/config.json",
      model: "anthropic/claude-sonnet-4",
      theme: "default",
    }
    await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2))
  }

  const editor = process.env.EDITOR || process.env.VISUAL || "nano"

  prompts.log.info(`Opening ${configPath} with ${editor}`)

  const proc = Bun.spawn([editor, configPath], {
    stdio: ["inherit", "inherit", "inherit"],
  })

  await proc.exited

  UXHelpers.success("Config file saved")
}

async function showPaths() {
  const directories = await Config.directories()

  UI.empty()
  prompts.intro("Configuration Paths")

  prompts.log.info("Global Config Directory")
  console.log(`  ${Global.Path.config}`)

  prompts.log.info("Project Config Directories")
  for (const dir of directories) {
    const isGlobal = dir === Global.Path.config
    const label = isGlobal ? " (global)" : ""
    console.log(`  ${dir}${label}`)
  }

  UI.empty()
  prompts.log.info("Config Files (in order of precedence)")
  console.log("  1. SNOWCODE_CONFIG env variable")
  console.log("  2. .snow-code/config.json (project)")
  console.log("  3. snowcode.json (project)")
  console.log("  4. opencode.json (project)")
  console.log("  5. ~/.config/snow-code/config.json (global)")

  UI.empty()
  prompts.log.info("Agent Definitions")
  console.log("  .snow-code/agent/*.md")

  prompts.log.info("Custom Commands")
  console.log("  .snow-code/command/*.md")

  prompts.log.info("Plugins")
  console.log("  .snow-code/plugin/*.ts")

  prompts.outro("Files in later directories override earlier ones")
}

async function resetConfig(useGlobal: boolean) {
  const configPath = useGlobal
    ? path.join(Global.Path.config, "config.json")
    : path.join(Instance.directory, "snowcode.json")

  const confirmed = await UXHelpers.confirm({
    message: `Reset configuration at ${configPath}?`,
    destructive: true,
  })

  if (!confirmed) {
    prompts.log.warn("Cancelled")
    return
  }

  const defaultConfig = {
    $schema: "https://snow-flow.dev/schema/config.json",
    model: "anthropic/claude-sonnet-4",
    theme: "default",
    share: "manual",
    autoupdate: true,
  }

  await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2))

  UXHelpers.success(`Reset configuration to defaults at ${configPath}`)
}
