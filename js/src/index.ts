import { App } from "./app";
import { Server } from "./server/server";
import fs from "node:fs/promises";
import path from "node:path";
import { Bus } from "./bus";
import { Session } from "./session/session";
import cac from "cac";
import { Share } from "./share/share";

const cli = cac("opencode");

cli.command("", "Start the opencode in interactive mode").action(async () => {
  await App.provide({ directory: process.cwd() }, async () => {
    await Share.init();
    Server.listen();
  });
});

cli.command("generate", "Generate OpenAPI and event specs").action(async () => {
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
});

cli
  .command("run [...message]", "Run a chat message")
  .action(async (message: string[]) => {
    await App.provide({ directory: process.cwd() }, async () => {
      console.log("Thinking...");
      await Share.init();
      const session = await Session.create();
      const shareID = await Session.share(session.id);
      if (shareID)
        console.log("Share ID: https://dev.opencode.ai/share?id=" + session.id);
      const result = await Session.chat(session.id, {
        type: "text",
        text: message.join(" "),
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
  });

cli.help();
cli.version("1.0.0");
cli.parse();
