import { spawn } from "child_process";
import path from "path";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";
import { App } from "../app";
import { Log } from "../util/log";
import { LANGUAGE_EXTENSIONS } from "./language";
import { Bus } from "../bus";
import z from "zod/v4";

export namespace LSPClient {
  const log = Log.create({ service: "lsp.client" });

  export type Info = Awaited<ReturnType<typeof create>>;

  export const Event = {
    Diagnostics: Bus.event(
      "lsp.client.diagnostics",
      z.object({
        path: z.string(),
      }),
    ),
  };

  export async function create(input: { cmd: string[] }) {
    log.info("starting client", input);
    let version = 0;

    const app = await App.use();
    const [command, ...args] = input.cmd;
    const server = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: app.root,
    });

    const connection = createMessageConnection(
      new StreamMessageReader(server.stdout),
      new StreamMessageWriter(server.stdin),
    );

    const diagnostics = new Map<string, any>();
    connection.onNotification("textDocument/publishDiagnostics", (params) => {
      const path = new URL(params.uri).pathname;
      log.info("textDocument/publishDiagnostics", {
        path,
      });
      diagnostics.set(path, params.diagnostics);
      Bus.publish(Event.Diagnostics, { path });
    });
    connection.listen();

    await connection.sendRequest("initialize", {
      processId: server.pid,
      initializationOptions: {
        workspaceFolders: [
          {
            name: "workspace",
            uri: "file://" + app.root,
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
    });
    await connection.sendNotification("initialized", {});
    log.info("initialized");

    const result = {
      get connection() {
        return connection;
      },
      notify: {
        async open(input: { path: string }) {
          log.info("textDocument/didOpen", input);
          diagnostics.delete(input.path);
          const text = await Bun.file(input.path).text();
          const languageId = LANGUAGE_EXTENSIONS[path.extname(input.path)];
          await connection.sendNotification("textDocument/didOpen", {
            textDocument: {
              uri: `file://` + input.path,
              languageId,
              version: 1,
              text: text,
            },
          });
        },
        async change(input: { path: string }) {
          log.info("textDocument/didChange", input);
          diagnostics.delete(input.path);
          const text = await Bun.file(input.path).text();
          version++;
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
          });
        },
      },
      get diagnostics() {
        return diagnostics;
      },
      async refreshDiagnostics(input: { path: string }) {
        log.info("refreshing diagnostics", input);
        let unsub: () => void;
        let timeout: NodeJS.Timeout;
        return await Promise.race([
          new Promise<void>(async (resolve) => {
            unsub = Bus.subscribe(Event.Diagnostics, (event) => {
              if (event.properties.path === input.path) {
                log.info("refreshed diagnostics", input);
                clearTimeout(timeout);
                unsub?.();
                resolve();
              }
            });
            await result.notify.change(input);
          }),
          new Promise<void>((resolve) => {
            timeout = setTimeout(() => {
              unsub?.();
              resolve();
            }, 5000);
          }),
        ]);
      },
    };

    return result;
  }
}
