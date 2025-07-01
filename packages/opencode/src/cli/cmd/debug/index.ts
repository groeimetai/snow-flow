import { cmd } from "../cmd"
import { FileCommand } from "./file"
import { LSPCommand } from "./lsp"
import { RipgrepCommand } from "./ripgrep"
import { SnapshotCommand } from "./snapshot"

export const DebugCommand = cmd({
  command: "debug",
  builder: (yargs) =>
    yargs
      .command(LSPCommand)
      .command(RipgrepCommand)
      .command(FileCommand)
      .command(SnapshotCommand)
      .demandCommand(),
  async handler() {},
})
