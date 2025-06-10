import type { Argv } from "yargs"
import { App } from "../../app/app"
import { Bus } from "../../bus"
import { Provider } from "../../provider/provider"
import { Session } from "../../session"
import { Share } from "../../share/share"
import { Message } from "../../session/message"
import { UI } from "../ui"
import { VERSION } from "../version"

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
  handler: async (args: {
    message: string[]
    session?: string
    printLogs?: boolean
  }) => {
    const message = args.message.join(" ")
    await App.provide(
      {
        cwd: process.cwd(),
        version: "0.0.0",
      },
      async () => {
        await Share.init()
        const session = args.session
          ? await Session.get(args.session)
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
            if (part.toolInvocation.toolName === "opencode_todowrite") return

            const args = part.toolInvocation.args as any
            const tool = part.toolInvocation.toolName

            if (tool === "opencode_edit")
              printEvent(UI.Style.TEXT_SUCCESS_BOLD, "Edit", args.filePath)
            if (tool === "opencode_bash")
              printEvent(UI.Style.TEXT_WARNING_BOLD, "Execute", args.command)
            if (tool === "opencode_read")
              printEvent(UI.Style.TEXT_INFO_BOLD, "Read", args.filePath)
            if (tool === "opencode_write")
              printEvent(UI.Style.TEXT_SUCCESS_BOLD, "Create", args.filePath)
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
  },
}
