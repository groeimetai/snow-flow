import "zod-openapi/extend"
import { App } from "./app/app"
import { Server } from "./server/server"
import fs from "fs/promises"
import path from "path"
import { Bus } from "./bus"
import { Session } from "./session/session"
import cac from "cac"
import { Share } from "./share/share"
import { Storage } from "./storage/storage"
import { LLM } from "./llm/llm"
import { Message } from "./session/message"

const cli = cac("opencode")

cli.command("", "Start the opencode in interactive mode").action(async () => {
  await App.provide({ directory: process.cwd() }, async () => {
    await Share.init()
    Server.listen()
  })
})

cli.command("generate", "Generate OpenAPI and event specs").action(async () => {
  const specs = await Server.openapi()
  const dir = "gen"
  await fs.rmdir(dir, { recursive: true }).catch(() => {})
  await fs.mkdir(dir, { recursive: true })
  await Bun.write(
    path.join(dir, "openapi.json"),
    JSON.stringify(specs, null, 2),
  )
})

cli
  .command("run [...message]", "Run a chat message")
  .option("--session <id>", "Session ID")
  .action(async (message: string[], options) => {
    await App.provide({ directory: process.cwd() }, async () => {
      await Share.init()
      const session = options.session
        ? await Session.get(options.session)
        : await Session.create()
      console.log("Session:", session.id)

      Bus.subscribe(Message.Event.Updated, async (message) => {
        console.log("Thinking...")
      })

      const unsub = Bus.subscribe(Session.Event.Updated, async (message) => {
        if (message.properties.info.share?.url)
          console.log("Share:", message.properties.info.share.url)
        unsub()
      })

      const providers = await LLM.providers()
      const providerID = Object.keys(providers)[0]
      const modelID = providers[providerID].info.models[0].id
      console.log("using", providerID, modelID)
      const result = await Session.chat({
        sessionID: session.id,
        providerID,
        modelID,
        parts: [
          {
            type: "text",
            text: message.join(" "),
          },
        ],
      })

      for (const part of result.parts) {
        if (part.type === "text") {
          console.log("opencode:", part.text)
        }
      }
      console.log({
        cost: result.metadata.assistant?.cost,
        tokens: result.metadata.assistant?.tokens,
      })
    })
  })

cli.help()
cli.version("1.0.0")
cli.parse()
