import { Log } from "../util/log";
import { Bus } from "../bus";
import { describeRoute, generateSpecs, openAPISpecs } from "hono-openapi";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Session } from "../session/session";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";

const SessionInfo = Session.Info.openapi({
  ref: "Session.Info",
});

export namespace Server {
  const log = Log.create({ service: "server" });
  const PORT = 16713;

  export type App = ReturnType<typeof app>;

  function app() {
    const app = new Hono();

    const result = app
      .get(
        "/openapi",
        openAPISpecs(app, {
          documentation: {
            info: {
              title: "opencode",
              version: "1.0.0",
              description: "opencode api",
            },
          },
        }),
      )
      .get("/event", async (c) => {
        log.info("event connected");
        return streamSSE(c, async (stream) => {
          stream.writeSSE({
            data: JSON.stringify({}),
          });
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
      .post(
        "/session_create",
        describeRoute({
          description: "Create a new session",
          responses: {
            200: {
              description: "Successfully created session",
              content: {
                "application/json": {
                  schema: resolver(SessionInfo),
                },
              },
            },
          },
        }),
        async (c) => {
          const session = await Session.create();
          return c.json(session);
        },
      )
      .post(
        "/session_share",
        describeRoute({
          description: "Share the session",
          responses: {
            200: {
              description: "Successfully shared session",
              content: {
                "application/json": {
                  schema: resolver(SessionInfo),
                },
              },
            },
          },
        }),
        zValidator(
          "json",
          z.object({
            sessionID: z.string(),
          }),
        ),
        async (c) => {
          const body = c.req.valid("json");
          await Session.share(body.sessionID);
          const session = await Session.get(body.sessionID);
          return c.json(session);
        },
      )
      .post(
        "/session_messages",
        describeRoute({
          description: "Get messages for a session",
          responses: {
            200: {
              description: "Successfully created session",
              content: {
                "application/json": {
                  schema: resolver(z.custom<Session.Message[]>()),
                },
              },
            },
          },
        }),
        zValidator(
          "json",
          z.object({
            sessionID: z.string(),
          }),
        ),
        async (c) => {
          const messages = await Session.messages(
            c.req.valid("json").sessionID,
          );
          return c.json(messages);
        },
      )
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

    return result;
  }

  export async function openapi() {
    const a = app();
    const result = await generateSpecs(a, {
      documentation: {
        info: {
          title: "opencode",
          version: "1.0.0",
          description: "opencode api",
        },
      },
    });
    return result;
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
