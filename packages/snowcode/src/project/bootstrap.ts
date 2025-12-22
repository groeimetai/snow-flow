import { Plugin } from "../plugin"
import { Share } from "../share/share"
import { Format } from "../format"
import { LSP } from "../lsp"
import { FileWatcher } from "../file/watcher"
import { File } from "../file"
import { Flag } from "../flag/flag"
import { ToolRegistry } from "../tool/registry"
import { MemorySync } from "../memory"
import { BackgroundAgent } from "../agent/background"
import { initializeBaseDocumentation } from "../init"

export async function InstanceBootstrap() {
  if (Flag.SNOWCODE_EXPERIMENTAL_NO_BOOTSTRAP) return

  // Initialize base documentation (CLAUDE.md, AGENTS.md) if not present
  // This ensures the AI agent has ServiceNow context from the first interaction
  // Enterprise auth will later append additional instructions via updateDocumentationWithEnterprise()
  await initializeBaseDocumentation()

  await Plugin.init()
  Share.init()
  Format.init()
  LSP.init()
  FileWatcher.init()
  File.init()
  MemorySync.initialize()
  BackgroundAgent.initialize()
  // Build tool search index for deferred tool loading pattern
  // This enables the tool_search meta-tool to discover all available tools
  // See: https://www.anthropic.com/engineering/advanced-tool-use
  await ToolRegistry.buildSearchIndex()
}
