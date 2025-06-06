import { App } from "../../app/app"
import { VERSION } from "../version"
import { LSP } from "../../lsp"
import { cmd } from "./cmd"

export const ScrapCommand = cmd({
  command: "scrap <file>",
  builder: (yargs) =>
    yargs.positional("file", { type: "string", demandOption: true }),
  describe: "test command",
  async handler(args) {
    await App.provide(
      { cwd: process.cwd(), version: VERSION, printLogs: true },
      async () => {
        await LSP.file(args.file)
        const diagnostics = await LSP.diagnostics()
        console.log(diagnostics)
      },
    )
  },
})
