import { UI } from "../../ui"
import { cmd } from "../cmd"

export const EnvCommand = cmd({
  command: "env",
  describe: "show environment variables (SNOWCODE_* and OPENCODE_*)",
  builder: (yargs) =>
    yargs
      .option("all", {
        alias: ["a"],
        type: "boolean",
        describe: "show all environment variables",
        default: false,
      })
      .option("filter", {
        alias: ["f"],
        type: "string",
        describe: "filter variables by pattern",
      }),
  handler: async (args) => {
    UI.empty()
    UI.println(UI.Style.TEXT_CYAN + "=== Environment Variables ===" + UI.Style.RESET)
    UI.empty()

    const entries = Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b))

    let filtered = entries
    if (!args.all) {
      // Only show SNOWCODE_*, OPENCODE_*, and relevant vars
      const relevantPrefixes = [
        "SNOWCODE_",
        "OPENCODE_",
        "ANTHROPIC_",
        "OPENAI_",
        "AZURE_",
        "GOOGLE_",
        "GEMINI_",
        "AWS_",
        "NODE_",
        "BUN_",
        "PATH",
        "HOME",
        "USER",
        "SHELL",
      ]
      filtered = entries.filter(([key]) =>
        relevantPrefixes.some((prefix) => key.startsWith(prefix) || key === prefix)
      )
    }

    if (args.filter) {
      const pattern = new RegExp(args.filter, "i")
      filtered = filtered.filter(([key]) => pattern.test(key))
    }

    // Group by prefix
    const groups: Record<string, Array<[string, string]>> = {}
    for (const [key, value] of filtered) {
      const prefix = key.split("_")[0] || "OTHER"
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push([key, value || ""])
    }

    // Show SNOWCODE/OPENCODE first
    const orderedPrefixes = ["SNOWCODE", "OPENCODE", ...Object.keys(groups).filter((p) => !["SNOWCODE", "OPENCODE"].includes(p)).sort()]

    for (const prefix of orderedPrefixes) {
      const vars = groups[prefix]
      if (!vars || vars.length === 0) continue

      UI.println(UI.Style.TEXT_YELLOW + `${prefix}:` + UI.Style.RESET)
      for (const [key, value] of vars) {
        // Truncate long values
        const displayValue = value.length > 60 ? value.slice(0, 60) + "..." : value
        // Mask sensitive values
        const isSensitive = /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL/i.test(key)
        const maskedValue = isSensitive && value ? "***" + value.slice(-4) : displayValue
        UI.println(`  ${key}=${UI.Style.TEXT_DIM}${maskedValue}${UI.Style.RESET}`)
      }
      UI.empty()
    }

    if (filtered.length === 0) {
      UI.println(UI.Style.TEXT_DIM + "No matching environment variables found" + UI.Style.RESET)
    } else {
      UI.println(UI.Style.TEXT_DIM + `Total: ${filtered.length} variables` + UI.Style.RESET)
    }
  },
})
