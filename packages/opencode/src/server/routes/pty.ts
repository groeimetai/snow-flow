import { Hono } from "hono"
import { validator, resolver } from "hono-openapi"
import { describe } from "../describe"
import { upgradeWebSocket } from "hono/bun"
import z from "zod"
import { Pty } from "@/pty"
import { Storage } from "../../storage/storage"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

export const PtyRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describe({
        summary: "List PTY sessions",
        description: "Get a list of all active pseudo-terminal (PTY) sessions managed by OpenCode.",
        operationId: "pty.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Pty.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(Pty.list())
      },
    )
    .post(
      "/",
      describe({
        summary: "Create PTY session",
        description: "Create a new pseudo-terminal (PTY) session for running shell commands and processes.",
        operationId: "pty.create",
        responses: {
          200: {
            description: "Created session",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Pty.CreateInput),
      async (c) => {
        const info = await Pty.create(c.req.valid("json"))
        return c.json(info)
      },
    )
    .get(
      "/:ptyID",
      describe({
        summary: "Get PTY session",
        description: "Retrieve detailed information about a specific pseudo-terminal (PTY) session.",
        operationId: "pty.get",
        responses: {
          200: {
            description: "Session info",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      async (c) => {
        const info = Pty.get(c.req.valid("param").ptyID)
        if (!info) {
          throw new Storage.NotFoundError({ message: "Session not found" })
        }
        return c.json(info)
      },
    )
    .put(
      "/:ptyID",
      describe({
        summary: "Update PTY session",
        description: "Update properties of an existing pseudo-terminal (PTY) session.",
        operationId: "pty.update",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      validator("json", Pty.UpdateInput),
      async (c) => {
        const info = await Pty.update(c.req.valid("param").ptyID, c.req.valid("json"))
        return c.json(info)
      },
    )
    .delete(
      "/:ptyID",
      describe({
        summary: "Remove PTY session",
        description: "Remove and terminate a specific pseudo-terminal (PTY) session.",
        operationId: "pty.remove",
        responses: {
          200: {
            description: "Session removed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      async (c) => {
        await Pty.remove(c.req.valid("param").ptyID)
        return c.json(true)
      },
    )
    .get(
      "/:ptyID/connect",
      describe({
        summary: "Connect to PTY session",
        description: "Establish a WebSocket connection to interact with a pseudo-terminal (PTY) session in real-time.",
        operationId: "pty.connect",
        responses: {
          200: {
            description: "Connected session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      upgradeWebSocket((c) => {
        // The `validator("param", ...)` middleware above guarantees ptyID is a string at runtime,
        // but hono >= 4.12.12 narrowed c.req.param() to string | undefined regardless of validators.
        const id = c.req.param("ptyID")!
        let handler: ReturnType<typeof Pty.connect>
        if (!Pty.get(id)) throw new Error("Session not found")
        return {
          onOpen(_event, ws) {
            handler = Pty.connect(id, ws)
          },
          onMessage(event) {
            handler?.onMessage(String(event.data))
          },
          onClose() {
            handler?.onClose()
          },
        }
      }),
    ),
)
