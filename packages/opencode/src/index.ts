import "zod-openapi/extend"
import { App } from "./app/app"
import { Server } from "./server/server"
import fs from "fs/promises"
import path from "path"
import { Bus } from "./bus"
import { Session } from "./session"
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
    let cwd = new URL("../../tui/cmd/opencode", import.meta.url).pathname
    if (Bun.embeddedFiles.length > 0) {
      const blob = Bun.embeddedFiles[0] as File
      const binary = path.join(Global.Path.cache, "tui", blob.name)
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
      env: {
        ...process.env,
        OPENCODE_SERVER: server.url.toString(),
      },
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

      const styles = {
        TEXT_HIGHLIGHT: "\x1b[96m",
        TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
        TEXT_DIM: "\x1b[90m",
        TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
        TEXT_NORMAL: "\x1b[0m",
        TEXT_NORMAL_BOLD: "\x1b[1m",
        TEXT_WARNING: "\x1b[93m",
        TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
        TEXT_DANGER: "\x1b[91m",
        TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
        TEXT_SUCCESS: "\x1b[92m",
        TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
        TEXT_INFO: "\x1b[94m",
        TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
      }

      let isEmpty = false
      function stderr(...message: string[]) {
        isEmpty = true
        Bun.stderr.write(message.join(" "))
        Bun.stderr.write("\n")
      }

      function empty() {
        stderr("" + styles.TEXT_NORMAL)
        isEmpty = true
      }

      stderr(styles.TEXT_HIGHLIGHT_BOLD + "◍  OpenCode", version)
      empty()
      stderr(styles.TEXT_NORMAL_BOLD + "> ", message.join(" "))
      empty()

      function printEvent(color: string, type: string, title: string) {
        stderr(
          color + `|`,
          styles.TEXT_NORMAL + styles.TEXT_DIM + ` ${type.padEnd(7, " ")}`,
          "",
          styles.TEXT_NORMAL + title,
        )
      }

      Bus.subscribe(Message.Event.PartUpdated, async (message) => {
        const part = message.properties.part
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state === "result"
        ) {
          if (part.toolInvocation.toolName === "opencode_todowrite") return
          const messages = await Session.messages(session.id)
          const metadata =
            messages[messages.length - 1].metadata.tool[
              part.toolInvocation.toolCallId
            ]
          const args = part.toolInvocation.args as any
          const tool = part.toolInvocation.toolName

          if (tool === "opencode_edit")
            printEvent(styles.TEXT_SUCCESS_BOLD, "Edit", args.filePath)
          if (tool === "opencode_bash")
            printEvent(styles.TEXT_WARNING_BOLD, "Execute", args.command)
          if (tool === "opencode_read")
            printEvent(styles.TEXT_INFO_BOLD, "Read", args.filePath)
          if (tool === "opencode_write")
            printEvent(styles.TEXT_SUCCESS_BOLD, "Create", args.filePath)
          if (tool === "opencode_glob")
            printEvent(
              styles.TEXT_INFO_BOLD,
              "Glob",
              args.pattern + (args.path ? " in " + args.path : ""),
            )
        }

        if (part.type === "text") {
          if (part.text.includes("\n")) {
            empty()
            stderr(part.text)
            empty()
            return
          }
          printEvent(styles.TEXT_NORMAL_BOLD, "Text", part.text)
        }
      })

      const { providerID, modelID } = await Provider.defaultModel()
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
      empty()
    })
  })

cli.command("init", "Run a chat message").action(async () => {
  await App.provide({ cwd: process.cwd(), version }, async () => {
    const { modelID, providerID } = await Provider.defaultModel()
    console.log("Initializing...")

    const session = await Session.create()

    const unsub = Bus.subscribe(Session.Event.Updated, async (message) => {
      if (message.properties.info.share?.url)
        console.log("Share:", message.properties.info.share.url)
      unsub()
    })

    await Session.initialize({
      sessionID: session.id,
      modelID,
      providerID,
    })
  })
})

cli.version(typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "dev")
cli.help()
cli.parse()
