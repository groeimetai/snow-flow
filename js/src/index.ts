import { App } from "./app";
import process from "node:process";
import { RPC } from "./server/server";
import { Session } from "./session/session";
import { Identifier } from "./id/id";

const app = await App.create({
  directory: process.cwd(),
});

App.provide(app, async () => {
  const sessionID = await Session.list()
    [Symbol.asyncIterator]()
    .next()
    .then((v) => v.value ?? Session.create().then((s) => s.id));

  await Session.chat(sessionID, {
    role: "user",
    id: Identifier.ascending("message"),
    parts: [
      {
        type: "text",
        text: "Hey how are you? try to use tools",
      },
    ],
  });

  const rpc = RPC.listen();
});
