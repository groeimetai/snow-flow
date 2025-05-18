import { App } from "./app";
import process from "node:process";
import { RPC } from "./server/server";
import { Session } from "./session/session";

const app = await App.create({
  directory: process.cwd(),
});

App.provide(app, async () => {
  const session = await Session.create();
  const rpc = RPC.listen();
});
