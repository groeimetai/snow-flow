import { createCli, type TrpcCliMeta } from "trpc-cli"
import { initTRPC } from "@trpc/server"
import { z } from "zod"
import { Server } from "../server/server"
import { AuthAnthropic } from "../auth/anthropic"
import { UI } from "./ui"
import { App } from "../app/app"
import { Bus } from "../bus"
import { Provider } from "../provider/provider"
import { Session } from "../session"
import { Share } from "../share/share"
import { Message } from "../session/message"
import { VERSION } from "./version"
import { LSP } from "../lsp"
import fs from "fs/promises"
import path from "path"

const t = initTRPC.meta<TrpcCliMeta>().create()

export const router = t.router({
  generate: t.procedure
    .meta({
      description: "Generate OpenAPI and event specs",
    })
    .input(z.object({}))
    .mutation(async () => {
      const specs = await Server.openapi()
      const dir = "gen"
      await fs.rmdir(dir, { recursive: true }).catch(() => {})
      await fs.mkdir(dir, { recursive: true })
      await Bun.write(
        path.join(dir, "openapi.json"),
        JSON.stringify(specs, null, 2),
      )
      return "Generated OpenAPI specs in gen/ directory"
    }),

  run: t.procedure
    .meta({
      description: "Run OpenCode with a message",
    })
    .input(
      z.object({
        message: z.array(z.string()).default([]).describe("Message to send"),
        session: z.string().optional().describe("Session ID to continue"),
      }),
    )
    .mutation(
      async ({ input }: { input: { message: string[]; session?: string } }) => {
        const message = input.message.join(" ")
        await App.provide(
          {
            cwd: process.cwd(),
            version: "0.0.0",
          },
          async () => {
            await Share.init()
            const session = input.session
              ? await Session.get(input.session)
              : await Session.create()

            UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + "◍  OpenCode", VERSION)
            UI.empty()
            UI.println(UI.Style.TEXT_NORMAL_BOLD + "> ", message)
            UI.empty()
            UI.println(
              UI.Style.TEXT_INFO_BOLD +
                "~  https://dev.opencode.ai/s?id=" +
                session.id.slice(-8),
            )
            UI.empty()

            function printEvent(color: string, type: string, title: string) {
              UI.println(
                color + `|`,
                UI.Style.TEXT_NORMAL +
                  UI.Style.TEXT_DIM +
                  ` ${type.padEnd(7, " ")}`,
                "",
                UI.Style.TEXT_NORMAL + title,
              )
            }

            Bus.subscribe(Message.Event.PartUpdated, async (message) => {
              const part = message.properties.part
              if (
                part.type === "tool-invocation" &&
                part.toolInvocation.state === "result"
              ) {
                if (part.toolInvocation.toolName === "opencode_todowrite")
                  return

                const args = part.toolInvocation.args as any
                const tool = part.toolInvocation.toolName

                if (tool === "opencode_edit")
                  printEvent(UI.Style.TEXT_SUCCESS_BOLD, "Edit", args.filePath)
                if (tool === "opencode_bash")
                  printEvent(
                    UI.Style.TEXT_WARNING_BOLD,
                    "Execute",
                    args.command,
                  )
                if (tool === "opencode_read")
                  printEvent(UI.Style.TEXT_INFO_BOLD, "Read", args.filePath)
                if (tool === "opencode_write")
                  printEvent(
                    UI.Style.TEXT_SUCCESS_BOLD,
                    "Create",
                    args.filePath,
                  )
                if (tool === "opencode_list")
                  printEvent(UI.Style.TEXT_INFO_BOLD, "List", args.path)
                if (tool === "opencode_glob")
                  printEvent(
                    UI.Style.TEXT_INFO_BOLD,
                    "Glob",
                    args.pattern + (args.path ? " in " + args.path : ""),
                  )
              }

              if (part.type === "text") {
                if (part.text.includes("\n")) {
                  UI.empty()
                  UI.println(part.text)
                  UI.empty()
                  return
                }
                printEvent(UI.Style.TEXT_NORMAL_BOLD, "Text", part.text)
              }
            })

            const { providerID, modelID } = await Provider.defaultModel()
            await Session.chat({
              sessionID: session.id,
              providerID,
              modelID,
              parts: [
                {
                  type: "text",
                  text: message,
                },
              ],
            })
            UI.empty()
          },
        )
        return "Session completed"
      },
    ),

  scrap: t.procedure
    .meta({
      description: "Test command for scraping files",
    })
    .input(
      z.object({
        file: z.string().describe("File to process"),
      }),
    )
    .mutation(async ({ input }: { input: { file: string } }) => {
      await App.provide({ cwd: process.cwd(), version: VERSION }, async () => {
        await LSP.touchFile(input.file, true)
        await LSP.diagnostics()
      })
      return `Processed file: ${input.file}`
    }),

  login: t.router({
    anthropic: t.procedure
      .meta({
        description: "Login to Anthropic",
      })
      .input(z.object({}))
      .mutation(async () => {
        const { url, verifier } = await AuthAnthropic.authorize()

        UI.println("Login to Anthropic")
        UI.println("Open the following URL in your browser:")
        UI.println(url)
        UI.println("")

        const code = await UI.input("Paste the authorization code here: ")
        await AuthAnthropic.exchange(code, verifier)
        return "Successfully logged in to Anthropic"
      }),
  }),
})

export function createOpenCodeCli() {
  return createCli({ router })
}

