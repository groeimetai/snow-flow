import { Global } from "../../../global"
import { bootstrap } from "../../bootstrap"
import { UI } from "../../ui"
import { cmd } from "../cmd"
import { ConfigCommand } from "./config"
import { FileCommand } from "./file"
import { LSPCommand } from "./lsp"
import { RipgrepCommand } from "./ripgrep"
import { ScrapCommand } from "./scrap"
import { SnapshotCommand } from "./snapshot"
import { StatusCommand } from "./status"
import { LogsCommand } from "./logs"
import { EnvCommand } from "./env"

export const DebugCommand = cmd({
  command: "debug",
  describe: "debugging tools and diagnostics",
  builder: (yargs) =>
    yargs
      // Main debug commands
      .command(StatusCommand)
      .command(LogsCommand)
      .command(EnvCommand)
      .command(PathsCommand)
      // Development debug commands
      .command(ConfigCommand)
      .command(LSPCommand)
      .command(RipgrepCommand)
      .command(FileCommand)
      .command(ScrapCommand)
      .command(SnapshotCommand)
      .command({
        command: "wait",
        describe: "wait indefinitely (for debugging)",
        async handler() {
          await bootstrap(process.cwd(), async () => {
            await new Promise((resolve) => setTimeout(resolve, 1_000 * 60 * 60 * 24))
          })
        },
      })
      .demandCommand(),
  async handler() {
    // Show help when no subcommand provided
    UI.println(UI.Style.TEXT_CYAN + "Snow-Flow Debug Commands" + UI.Style.RESET)
    UI.empty()
    UI.println("Usage: snow-flow debug <command>")
    UI.empty()
    UI.println(UI.Style.TEXT_YELLOW + "Main Commands:" + UI.Style.RESET)
    UI.println("  status    Show debug status and environment info")
    UI.println("  logs      View or tail log files")
    UI.println("  env       Show environment variables")
    UI.println("  paths     Show Snow-Flow paths")
    UI.empty()
    UI.println(UI.Style.TEXT_YELLOW + "Development Commands:" + UI.Style.RESET)
    UI.println("  config    Debug configuration")
    UI.println("  lsp       Debug LSP servers")
    UI.println("  ripgrep   Debug ripgrep")
    UI.println("  file      Debug file operations")
    UI.println("  snapshot  Debug snapshots")
    UI.empty()
    UI.println(UI.Style.TEXT_DIM + "Run 'snow-flow debug <command> --help' for more info" + UI.Style.RESET)
  },
})

const PathsCommand = cmd({
  command: "paths",
  describe: "show Snow-Flow paths",
  handler() {
    UI.println(UI.Style.TEXT_CYAN + "Snow-Flow Paths:" + UI.Style.RESET)
    UI.empty()
    for (const [key, value] of Object.entries(Global.Path)) {
      UI.println(`  ${UI.Style.TEXT_YELLOW}${key.padEnd(12)}${UI.Style.RESET} ${value}`)
    }
  },
})
