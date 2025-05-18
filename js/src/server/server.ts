import { Log } from "../util/log";
import { Bus } from "../bus";

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Session } from "../session/session";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export namespace Server {
  const log = Log.create({ service: "server" });
  const PORT = 16713;

  export type App = ReturnType<typeof app>;

  function app() {
    return new Hono()
      .get("/event", async (c) => {
        log.info("event connected");
        return streamSSE(c, async (stream) => {
          const unsub = Bus.subscribeAll(async (event) => {
            await stream.writeSSE({
              data: JSON.stringify(event),
            });
          });
          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              unsub();
              resolve();
              log.info("event disconnected");
            });
          });
        });
      })
      .post("/session_create", async (c) => {
        const session = await Session.create();
        return c.json(session);
      })
      .post(
        "/session_chat",
        zValidator(
          "json",
          z.object({
            sessionID: z.string(),
            parts: z.custom<Session.Message["parts"]>(),
          }),
        ),
        async (c) => {
          const body = c.req.valid("json");
          const msg = await Session.chat(body.sessionID, ...body.parts);
          return c.json(msg);
        },
      );
  }

  export function listen() {
    const server = Bun.serve({
      port: PORT,
      hostname: "0.0.0.0",
      idleTimeout: 0,
      fetch: app().fetch,
    });
    return server;
  }
}
