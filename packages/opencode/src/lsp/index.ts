import { App } from "../app/app"
import { Log } from "../util/log"
import { LSPClient } from "./client"
import path from "path"

export namespace LSP {
  const log = Log.create({ service: "lsp" })

  const state = App.state(
    "lsp",
    async () => {
      log.info("initializing")
      const clients = new Map<string, LSPClient.Info>()

      return {
        clients,
      }
    },
    async (state) => {
      for (const client of state.clients.values()) {
        await client.shutdown()
      }
    },
  )

  export async function touchFile(input: string, waitForDiagnostics?: boolean) {
    const extension = path.parse(input).ext
    const s = await state()
    const matches = AUTO.filter((x) => x.extensions.includes(extension))
    for (const match of matches) {
      const existing = s.clients.get(match.id)
      if (existing) continue
      const [binary] = match.command
      const bin = Bun.which(binary)
      if (!bin) continue
      const client = await LSPClient.create({
        cmd: match.command,
        serverID: match.id,
        initialization: match.initialization,
      })
      s.clients.set(match.id, client)
    }
    if (waitForDiagnostics) {
      await run(async (client) => {
        const wait = client.waitForDiagnostics({ path: input })
        await client.notify.open({ path: input })
        return wait
      })
    }
  }

  export async function diagnostics() {
    const results: Record<string, LSPClient.Diagnostic[]> = {}
    for (const result of await run(async (client) => client.diagnostics)) {
      for (const [path, diagnostics] of result.entries()) {
        const arr = results[path] || []
        arr.push(...diagnostics)
        results[path] = arr
      }
    }
    return results
  }

  export async function hover(input: {
    file: string
    line: number
    character: number
  }) {
    return run((client) => {
      return client.connection.sendRequest("textDocument/hover", {
        textDocument: {
          uri: `file://${input.file}`,
        },
        position: {
          line: input.line,
          character: input.character,
        },
      })
    })
  }

  async function run<T>(
    input: (client: LSPClient.Info) => Promise<T>,
  ): Promise<T[]> {
    const clients = await state().then((x) => [...x.clients.values()])
    const tasks = clients.map((x) => input(x))
    return Promise.all(tasks)
  }

  const AUTO: {
    id: string
    command: string[]
    initialization?: any
    extensions: string[]
    install?: () => Promise<void>
  }[] = [
    {
      id: "typescript",
      command: ["bun", "x", "typescript-language-server", "--stdio"],
      extensions: [
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
        ".mts",
        ".cts",
        ".mtsx",
        ".ctsx",
      ],
      initialization: {
        tsserver: {
          path: require.resolve("typescript/lib/tsserver.js"),
        },
      },
    },
    {
      id: "golang",
      command: ["gopls" /*"-logfile", "gopls.log", "-rpc.trace", "-vv"*/],
      extensions: [".go"],
    },
  ]

  export namespace Diagnostic {
    export function pretty(diagnostic: LSPClient.Diagnostic) {
      const severityMap = {
        1: "ERROR",
        2: "WARN",
        3: "INFO",
        4: "HINT",
      }

      const severity = severityMap[diagnostic.severity || 1]
      const line = diagnostic.range.start.line + 1
      const col = diagnostic.range.start.character + 1

      return `${severity} [${line}:${col}] ${diagnostic.message}`
    }
  }
}
