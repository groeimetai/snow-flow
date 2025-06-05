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
import { LoginAnthropicCommand } from "./cli/cmd/login-anthropic"
import { GenerateCommand } from "./cli/cmd/generate"

declare global {
  const OPENCODE_VERSION: string
}

const version = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "dev"

yargs(hideBin(process.argv))
  .scriptName("opencode")
  .version(version)
  .command({
    command: "$0",
    describe: "Start OpenCode TUI",
    handler: async () => {
      await App.provide({ cwd: process.cwd(), version }, async () => {
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
  .command({
    command: "login",
    describe: "generate credentials for various providers",
    builder: (yargs) => yargs.command(LoginAnthropicCommand).demandCommand(),
    handler: () => {},
  })
  .help()
  .parse()
