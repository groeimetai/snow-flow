import "zod-openapi/extend"
import { App } from "./app/app"
import { Server } from "./server/server"
import fs from "fs/promises"
import path from "path"

import { Share } from "./share/share"

import { Global } from "./global"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
import { VERSION } from "./cli/version"
import { ScrapCommand } from "./cli/cmd/scrap"
import { Log } from "./util/log"
import { ProviderCommand } from "./cli/cmd/provider"

await Log.init({ print: process.argv.includes("--print-logs") })

yargs(hideBin(process.argv))
  .scriptName("opencode")
  .version(VERSION)
  .command({
    command: "$0",
    describe: "Start OpenCode TUI",
    builder: (yargs) =>
      yargs.option("print-logs", {
        type: "boolean",
      }),
    handler: async (args) => {
      await App.provide({ cwd: process.cwd(), version: VERSION }, async () => {
        await Share.init()
        const server = Server.listen()

        let cmd = ["go", "run", "./main.go"]
        let cwd = new URL("../../tui/cmd/opencode", import.meta.url).pathname
        if (Bun.embeddedFiles.length > 0) {
          const blob = Bun.embeddedFiles[0] as File
          const binary = path.join(Global.Path.cache, "tui", blob.name)
          const file = Bun.file(binary)
          if (!(await file.exists())) {
            console.log("installing tui binary...")
            await Bun.write(file, blob, { mode: 0o755 })
            await fs.chmod(binary, 0o755)
          }
          cwd = process.cwd()
          cmd = [binary]
        }
        const proc = Bun.spawn({
          cmd,
          cwd,
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
          env: {
            ...process.env,
            OPENCODE_SERVER: server.url.toString(),
          },
          onExit: () => {
            server.stop()
          },
        })
        await proc.exited
        await server.stop()
      })
    },
  })
  .command(RunCommand)
  .command(GenerateCommand)
  .command(ScrapCommand)
  .command(ProviderCommand)
  .help()
  .parse()
