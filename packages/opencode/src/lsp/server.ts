import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import type { App } from "../app/app"
import path from "path"
import { Global } from "../global"
import { Log } from "../util/log"

export namespace LSPServer {
  const log = Log.create({ service: "lsp.server" })

  export interface Handle {
    process: ChildProcessWithoutNullStreams
    initialization?: Record<string, any>
  }

  export interface Info {
    id: string
    extensions: string[]
    spawn(app: App.Info): Promise<Handle | undefined>
  }

  export const All: Info[] = [
    {
      id: "typescript",
      extensions: [
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
        ".mts",
        ".cts",
      ],
      async spawn(app) {
        const tsserver = Bun.resolve(
          "typescript/lib/tsserver.js",
          app.path.cwd,
        ).catch(() => {})
        if (!tsserver) return
        const root =
          process.argv0 !== "bun" && false
            ? path.resolve(process.cwd(), process.argv0)
            : "bun"
        const proc = spawn(
          root,
          ["x", "typescript-language-server", "--stdio"],
          {
            argv0: "bun",
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
          },
        )
        return {
          process: proc,
          initialization: {
            tsserver: {
              path: tsserver,
            },
          },
        }
      },
    },
    {
      id: "golang",
      extensions: [".go"],
      async spawn() {
        let bin = Bun.which("gopls", {
          PATH: process.env["PATH"] + ":" + Global.Path.bin,
        })
        if (!bin) {
          log.info("installing gopls")
          const proc = Bun.spawn({
            cmd: ["go", "install", "golang.org/x/tools/gopls@latest"],
            env: { ...process.env, GOBIN: Global.Path.bin },
          })
          const exit = await proc.exited
          if (exit !== 0) {
            log.error("Failed to install gopls")
            return
          }
          bin = path.join(
            Global.Path.bin,
            "gopls" + (process.platform === "win32" ? ".exe" : ""),
          )
          log.info(`installed gopls`, {
            bin,
          })
        }
        return {
          process: spawn(bin!),
        }
      },
    },
  ]
}
