import { App } from "./app";
import { Server } from "./server/server";
import { Cli, Command, runExit } from "clipanion";
import fs from "fs/promises";
import path from "path";
import { Bus } from "./bus";

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
  class Generate extends Command {
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
const [_bun, _app, ...args] = process.argv;
cli.runExit(args);
