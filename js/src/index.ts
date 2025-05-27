import { App } from "./app";
import { Server } from "./server/server";
import fs from "node:fs/promises";
import path from "node:path";
import { Bus } from "./bus";
import { Session } from "./session/session";
import cac from "cac";
import { Share } from "./share/share";
import { Storage } from "./storage/storage";

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
        console.log(
          `Share ID: ${Share.URL.replace("api.", "")}/share?id=${session.id}`,
        );

      let index = 0;
      Bus.subscribe(Storage.Event.Write, async (payload) => {
        const [root, , type, messageID] = payload.properties.key.split("/");
        if (root !== "session" && type !== "message") return;
        const message = await Session.messages(session.id).then((x) =>
          x.find((x) => x.id === messageID),
        );
        if (!message) return;

        for (; index < message.parts.length; index++) {
          const part = message.parts[index];
          if (part.type === "text") continue;
          if (part.type === "step-start") continue;
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation.state !== "result"
          )
            break;

          if (part.type === "tool-invocation") {
            console.log(`🔧 ${part.toolInvocation.toolName}`);
            if (
              part.toolInvocation.state === "result" &&
              "result" in part.toolInvocation
            ) {
              const result = part.toolInvocation.result;
              if (typeof result === "string") {
                const lines = result.split("\n");
                const truncated = lines.slice(0, 4);
                if (lines.length > 4) truncated.push("...");
                console.log(truncated.join("\n"));
              } else if (result && typeof result === "object") {
                const jsonStr = JSON.stringify(result, null, 2);
                const lines = jsonStr.split("\n");
                const truncated = lines.slice(0, 4);
                if (lines.length > 4) truncated.push("...");
                console.log(truncated.join("\n"));
              }
            }
            continue;
          }
          console.log(part);
        }
      });

      const result = await Session.chat(session.id, {
        type: "text",
        text: message.join(" "),
      });

      for (const part of result.parts) {
        if (part.type === "text") {
          console.log("opencode:", part.text);
        }
      }
    });
  });

cli.help();
cli.version("1.0.0");
cli.parse();
