import { spawn } from "child_process"
import path from "path"
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node"
import type { Diagnostic as VSCodeDiagnostic } from "vscode-languageserver-types"
import { App } from "../app/app"
import { Log } from "../util/log"
import { LANGUAGE_EXTENSIONS } from "./language"
import { Bus } from "../bus"
import z from "zod"

export namespace LSPClient {
  const log = Log.create({ service: "lsp.client" })

  export type Info = Awaited<ReturnType<typeof create>>

  export type Diagnostic = VSCodeDiagnostic

  export const Event = {
    Diagnostics: Bus.event(
      "lsp.client.diagnostics",
      z.object({
        serverID: z.string(),
        path: z.string(),
      }),
    ),
  }

  export async function create(input: { cmd: string[]; serverID: string }) {
    log.info("starting client", input)

    const app = App.info()
    const [command, ...args] = input.cmd
    const server = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: app.path.cwd,
    })

    const connection = createMessageConnection(
      new StreamMessageReader(server.stdout),
      new StreamMessageWriter(server.stdin),
    )

    const diagnostics = new Map<string, Diagnostic[]>()
    connection.onNotification("textDocument/publishDiagnostics", (params) => {
      const path = new URL(params.uri).pathname
      log.info("textDocument/publishDiagnostics", {
        path,
      })
      const exists = diagnostics.has(path)
      diagnostics.set(path, params.diagnostics)
      // servers seem to send one blank publishDiagnostics event before the first real one
      if (!exists && !params.diagnostics.length) return
      Bus.publish(Event.Diagnostics, { path, serverID: input.serverID })
    })
    connection.listen()

    await connection.sendRequest("initialize", {
      processId: server.pid,
      initializationOptions: {
        workspaceFolders: [
          {
            name: "workspace",
            uri: "file://" + app.path.cwd,
          },
        ],
        tsserver: {
          path: require.resolve("typescript/lib/tsserver.js"),
        },
      },
      capabilities: {
        workspace: {
          configuration: true,
          didChangeConfiguration: {
            dynamicRegistration: true,
          },
          didChangeWatchedFiles: {
            dynamicRegistration: true,
            relativePatternSupport: true,
          },
        },
        textDocument: {
          synchronization: {
            dynamicRegistration: true,
            didSave: true,
          },
          completion: {
            completionItem: {},
          },
          codeLens: {
            dynamicRegistration: true,
          },
          documentSymbol: {},
          codeAction: {
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: [],
              },
            },
          },
          publishDiagnostics: {
            versionSupport: true,
          },
          semanticTokens: {
            requests: {
              range: {},
              full: {},
            },
            tokenTypes: [],
            tokenModifiers: [],
            formats: [],
          },
        },
        window: {},
      },
    })
    await connection.sendNotification("initialized", {})
    log.info("initialized")

    const files = new Set<string>()

    const result = {
      get clientID() {
        return input.serverID
      },
      get connection() {
        return connection
      },
      notify: {
        async open(input: { path: string }) {
          const file = Bun.file(input.path)
          const text = await file.text()
          const opened = files.has(input.path)
          if (!opened) {
            log.info("textDocument/didOpen", input)
            diagnostics.delete(input.path)
            const extension = path.extname(input.path)
            const languageId = LANGUAGE_EXTENSIONS[extension] ?? "plaintext"
            await connection.sendNotification("textDocument/didOpen", {
              textDocument: {
                uri: `file://` + input.path,
                languageId,
                version: Date.now(),
                text,
              },
            })
            files.add(input.path)
            return
          }

          log.info("textDocument/didChange", input)
          diagnostics.delete(input.path)
          await connection.sendNotification("textDocument/didChange", {
            textDocument: {
              uri: `file://` + input.path,
              version: Date.now(),
            },
            contentChanges: [
              {
                text,
              },
            ],
          })
        },
      },
      get diagnostics() {
        return diagnostics
      },
      async waitForDiagnostics(input: { path: string }) {
        log.info("waiting for diagnostics", input)
        let unsub: () => void
        let timeout: NodeJS.Timeout
        return await Promise.race([
          new Promise<void>(async (resolve) => {
            unsub = Bus.subscribe(Event.Diagnostics, (event) => {
              if (
                event.properties.path === input.path &&
                event.properties.serverID === result.clientID
              ) {
                log.info("got diagnostics", input)
                clearTimeout(timeout)
                unsub?.()
                resolve()
              }
            })
          }),
          new Promise<void>((resolve) => {
            timeout = setTimeout(() => {
              log.info("timed out refreshing diagnostics", input)
              unsub?.()
              resolve()
            }, 5000)
          }),
        ])
      },
      async shutdown() {
        log.info("shutting down")
        connection.end()
        connection.dispose()
      },
    }

    return result
  }
}
