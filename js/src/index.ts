import { App } from "./app";
import { Server } from "./server/server";
import { Cli, Command, Option } from "clipanion";
import fs from "fs/promises";
import path from "path";
import { Bus } from "./bus";
import { Session } from "./session/session";
import { LSP } from "./lsp";

const cli = new Cli({
  binaryLabel: `opencode`,
  binaryName: `opencode`,
  binaryVersion: `1.0.0`,
});

cli.register(
  class extends Command {
    async execute() {
      const app = await App.create({
        directory: process.cwd(),
      });

      await App.provide(app, async () => {
        const server = Server.listen();
      });
    }
  },
);

cli.register(
  class extends Command {
    static paths = [["generate"]];
    async execute() {
      const specs = await Server.openapi();
      const dir = "gen";
      await fs.rmdir(dir, { recursive: true }).catch(() => {});
      await fs.mkdir(dir, { recursive: true });
      await Bun.write(
        path.join(dir, "openapi.json"),
        JSON.stringify(specs, null, 2),
      );
      await Bun.write(
        path.join(dir, "event.json"),
        JSON.stringify(Bus.specs(), null, 2),
      );
    }
  },
);

cli.register(
  class extends Command {
    static paths = [["run"]];
    message = Option.Rest();

    async execute() {
      const app = await App.create({
        directory: process.cwd(),
      });

      await App.provide(app, async () => {
        console.log("Thinking...");
        const session = await Session.create();
        const result = await Session.chat(session.id, {
          type: "text",
          text: this.message.join(" "),
        });
        for (const part of result.parts) {
          if (part.type === "text") {
            console.log("opencode:", part.text);
          }
          if (part.type === "tool-invocation") {
            console.log(
              "tool:",
              part.toolInvocation.toolName,
              part.toolInvocation.args,
              part.toolInvocation.state === "result"
                ? part.toolInvocation.result
                : "",
            );
          }
        }
      });

      process.exit(0);
    }
  },
);
const [_bun, _app, ...args] = process.argv;
cli.runExit(args);
