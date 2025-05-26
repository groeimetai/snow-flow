import { App } from "../app";
import { Log } from "../util/log";
import { LSPClient } from "./client";

export namespace LSP {
  const log = Log.create({ service: "lsp" });

  const state = App.state(
    "lsp",
    async () => {
      const clients = new Map<string, LSPClient.Info>();

      // QUESTION: how lazy should lsp auto discovery be? should it not initialize until a file is opened?
      clients.set(
        "typescript",
        await LSPClient.create({
          cmd: ["bun", "x", "typescript-language-server", "--stdio"],
        }),
      );

      return {
        clients,
        diagnostics: new Map<string, any>(),
      };
    },
    async (state) => {
      for (const client of state.clients.values()) {
        await client.shutdown();
      }
    },
  );

  export async function run<T>(
    input: (client: LSPClient.Info) => Promise<T>,
  ): Promise<T[]> {
    const clients = await state().then((x) => [...x.clients.values()]);
    const tasks = clients.map((x) => input(x));
    return Promise.all(tasks);
  }

  const AUTO: {
    command: string[];
    extensions: string[];
    install?: () => Promise<void>;
  }[] = [
    {
      command: ["bun", "x", "typescript-language-server", "--stdio"],
      extensions: [
        "ts",
        "tsx",
        "js",
        "jsx",
        "mjs",
        "cjs",
        "mts",
        "cts",
        "mtsx",
        "ctsx",
      ],
    },
    {
      command: ["gopls"],
      extensions: ["go"],
    },
  ];
}
