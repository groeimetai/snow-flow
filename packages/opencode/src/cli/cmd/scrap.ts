import { App } from "../../app/app"
import { LSP } from "../../lsp"
import { VERSION } from "../version"
import { cmd } from "./cmd"

export const ScrapCommand = cmd({
  command: "scrap <file>",
  builder: (yargs) =>
    yargs.positional("file", { type: "string", demandOption: true }),
  async handler(args) {
    await App.provide({ cwd: process.cwd(), version: VERSION }, async (app) => {
      await LSP.touchFile(args.file, true)
      console.log(await LSP.diagnostics())
    })
  },
})
