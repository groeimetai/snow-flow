import "zod-openapi/extend"
import { App } from "./app/app"
import { Server } from "./server/server"
import fs from "fs/promises"
import path from "path"
import { Bus } from "./bus"
import { Session } from "./session/session"
import cac from "cac"
import { Share } from "./share/share"
import { Message } from "./session/message"
import { Global } from "./global"
import { Provider } from "./provider/provider"

declare global {
  const OPENCODE_VERSION: string
}

const cli = cac("opencode")
const version = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "dev"

cli.command("", "Start the opencode in interactive mode").action(async () => {
  await App.provide({ cwd: process.cwd(), version }, async () => {
    await Share.init()
    const server = Server.listen()

    let cmd = ["go", "run", "./main.go"]
    let cwd = "../tui"
    if (Bun.embeddedFiles.length > 0) {
      const blob = Bun.embeddedFiles[0] as File
      const binary = path.join(Global.cache(), "tui", blob.name)
      const file = Bun.file(binary)
      if (!(await file.exists())) {
        console.log("installing tui binary...")
        await Bun.write(file, blob, { mode: 0o755 })
        await fs.chmod(binary, 0o755)
      }
      cwd = process.cwd()
      cmd = [binary]
    }
    const proc = Bun.spawn({
      cmd,
      cwd,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      onExit: () => {
        server.stop()
      },
    })
    await proc.exited
    await server.stop()
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
    await App.provide({ cwd: process.cwd(), version }, async () => {
      await Share.init()
      const session = options.session
        ? await Session.get(options.session)
        : await Session.create()
      console.log("Session:", session.id)

      Bus.subscribe(Message.Event.Updated, async () => {
        console.log("Thinking...")
      })

      const unsub = Bus.subscribe(Session.Event.Updated, async (message) => {
        if (message.properties.info.share?.url)
          console.log("Share:", message.properties.info.share.url)
        unsub()
      })

      const [provider] = await Provider.active().then((val) =>
        val.values().toArray(),
      )
      if (!provider) throw new Error("no providers found")
      const model = provider.models[0]
      if (!model) throw new Error("no models found")
      console.log("using", provider.id, model.id)
      const result = await Session.chat({
        sessionID: session.id,
        providerID: provider.id,
        modelID: model.id,
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

cli.version(typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "dev")
cli.help()
cli.parse()
