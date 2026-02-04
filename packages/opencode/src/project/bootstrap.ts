import { Plugin } from "../plugin"
import { Share } from "../share/share"
import { Format } from "../format"
import { LSP } from "../lsp"
import { FileWatcher } from "../file/watcher"
import { File } from "../file"
import { Project } from "./project"
import { Bus } from "../bus"
import { Command } from "../command"
import { Instance } from "./instance"
import { Vcs } from "./vcs"
import { Log } from "@/util/log"
import { ShareNext } from "@/share/share-next"
import { Snapshot } from "../snapshot"
import { Truncate } from "../tool/truncation"
import path from "path"
import AGENTS_TEMPLATE from "./agents-template.txt"

/**
 * Ensures AGENTS.md exists in the project directory.
 * Creates it from template if it doesn't exist.
 */
async function ensureAgentsMd() {
  const agentsMdPath = path.join(Instance.directory, "AGENTS.md")

  try {
    const exists = await Bun.file(agentsMdPath).exists()
    if (!exists) {
      await Bun.write(agentsMdPath, AGENTS_TEMPLATE)
      Log.Default.info("created AGENTS.md", { path: agentsMdPath })
    }
  } catch (error) {
    Log.Default.warn("failed to create AGENTS.md", {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export async function InstanceBootstrap() {
  Log.Default.info("bootstrapping", { directory: Instance.directory })
  await Plugin.init()
  Share.init()
  ShareNext.init()
  Format.init()
  await LSP.init()
  FileWatcher.init()
  File.init()
  Vcs.init()
  Snapshot.init()
  Truncate.init()

  // Create AGENTS.md if it doesn't exist
  await ensureAgentsMd()

  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id)
    }
  })
}
