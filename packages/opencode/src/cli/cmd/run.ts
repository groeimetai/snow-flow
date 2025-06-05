import type { Argv } from "yargs"
import { App } from "../../app/app"
import { version } from "bun"
import { Bus } from "../../bus"
import { Provider } from "../../provider/provider"
import { Session } from "../../session"
import { Share } from "../../share/share"
import { Message } from "../../session/message"

export const RunCommand = {
  command: "run [message..]",
  describe: "Run OpenCode with a message",
  builder: (yargs: Argv) => {
    return yargs
      .positional("message", {
        describe: "Message to send",
        type: "string",
        array: true,
        default: [],
      })
      .option("session", {
        describe: "Session ID to continue",
        type: "string",
      })
  },
  handler: async (args: { message: string[]; session?: string }) => {
    const message = args.message.join(" ")
    await App.provide({ cwd: process.cwd(), version }, async () => {
      await Share.init()
      const session = args.session
        ? await Session.get(args.session)
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
      stderr(styles.TEXT_NORMAL_BOLD + "> ", message)
      empty()
      stderr(
        styles.TEXT_INFO_BOLD +
          "~  https://dev.opencode.ai/s?id=" +
          session.id.slice(-8),
      )
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
            text: message,
          },
        ],
      })
      empty()
    })
  },
}
