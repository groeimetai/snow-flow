import { App } from "../app";
import { Log } from "../util/log";
import { LSPClient } from "./client";

export namespace LSP {
  const log = Log.create({ service: "lsp" });

  const state = App.state("lsp", async () => {
    const clients = new Map<string, LSPClient.Info>();

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
  });

  export async function run<T>(
    input: (client: LSPClient.Info) => Promise<T>,
  ): Promise<T[]> {
    const clients = await state().then((x) => [...x.clients.values()]);
    const tasks = clients.map((x) => input(x));
    return Promise.all(tasks);
  }
}
