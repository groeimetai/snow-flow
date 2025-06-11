import { App } from "../../app/app"
import { VERSION } from "../version"
import { cmd } from "./cmd"

export const ScrapCommand = cmd({
  command: "scrap <file>",
  builder: (yargs) =>
    yargs.positional("file", { type: "string", demandOption: true }),
  async handler() {
    await App.provide({ cwd: process.cwd(), version: VERSION }, async (app) => {
      Bun.resolveSync("typescript/lib/tsserver.js", app.path.cwd)
    })
  },
})
