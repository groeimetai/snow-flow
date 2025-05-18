import { App } from "./app";
import process from "node:process";
import { Server } from "./server/server";

const app = await App.create({
  directory: process.cwd(),
});

App.provide(app, async () => {
  const server = Server.listen();
});
