import { App } from "../../app/app"
import { Ripgrep } from "../../file/ripgrep"
import { LSP } from "../../lsp"
import { cmd } from "./cmd"

export const DebugCommand = cmd({
  command: "debug",
  builder: (yargs) =>
    yargs.command(DiagnosticsCommand).command(TreeCommand).demandCommand(),
  async handler() {},
})

const DiagnosticsCommand = cmd({
  command: "diagnostics <file>",
  builder: (yargs) =>
    yargs.positional("file", { type: "string", demandOption: true }),
  async handler(args) {
    await App.provide({ cwd: process.cwd() }, async () => {
      await LSP.touchFile(args.file, true)
      console.log(await LSP.diagnostics())
    })
  },
})

const TreeCommand = cmd({
  command: "tree",
  builder: (yargs) =>
    yargs.option("limit", {
      type: "number",
    }),
  async handler(args) {
    await App.provide({ cwd: process.cwd() }, async () => {
      const app = App.info()
      console.log(await Ripgrep.tree({ cwd: app.path.cwd, limit: args.limit }))
    })
  },
})
