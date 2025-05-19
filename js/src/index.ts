import { App } from "./app";
import { Server } from "./server/server";
import { Cli, Command, runExit } from "clipanion";

const cli = new Cli({
  binaryLabel: `opencode`,
  binaryName: `opencode`,
  binaryVersion: `1.0.0`,
});

cli.register(
  class Run extends Command {
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
  class OpenApi extends Command {
    static paths = [["openapi"]];
    async execute() {
      const specs = await Server.openapi();
      this.context.stdout.write(JSON.stringify(specs, null, 2));
    }
  },
);
const [_bun, _app, ...args] = process.argv;
cli.runExit(args);
