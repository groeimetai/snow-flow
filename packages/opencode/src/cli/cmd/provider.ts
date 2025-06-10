import { AuthAnthropic } from "../../auth/anthropic"
import { AuthKeys } from "../../auth/keys"
import { UI } from "../ui"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import open from "open"

const OPENCODE = [
  `█▀▀█ █▀▀█ █▀▀ █▀▀▄ █▀▀ █▀▀█ █▀▀▄ █▀▀`,
  `█░░█ █░░█ █▀▀ █░░█ █░░ █░░█ █░░█ █▀▀`,
  `▀▀▀▀ █▀▀▀ ▀▀▀ ▀  ▀ ▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀`,
]

export const ProviderCommand = cmd({
  command: "provider",
  builder: (yargs) =>
    yargs
      .command(ProviderAddCommand)
      .command(ProviderListCommand)
      .demandCommand(),
  describe: "initialize opencode",
  async handler() {},
})

export const ProviderListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list providers",
  async handler() {
    prompts.intro("Configured Providers")
    const keys = await AuthKeys.get()
    for (const key of Object.keys(keys)) {
      prompts.log.success(key)
    }
    prompts.outro("3 providers configured")
  },
})

const ProviderAddCommand = cmd({
  command: "add",
  describe: "add credentials for various providers",
  async handler() {
    UI.empty()
    for (const row of OPENCODE) {
      UI.print("   ")
      for (let i = 0; i < row.length; i++) {
        const color =
          i < 18 ? Bun.color("white", "ansi") : Bun.color("gray", "ansi")
        const char = row[i]
        UI.print(color + char)
      }
      UI.println()
    }
    UI.empty()

    prompts.intro("Setup")
    const keys = await AuthKeys.get()
    const provider = await prompts.select({
      message: "Configure a provider",
      options: [
        {
          label: "Anthropic",
          value: "anthropic",
          hint: keys["anthropic"] ? "configured" : "",
        },
        {
          label: "OpenAI",
          value: "openai",
          hint: keys["openai"] ? "configured" : "",
        },
        {
          label: "Google",
          value: "google",
          hint: keys["google"] ? "configured" : "",
        },
      ],
    })
    if (prompts.isCancel(provider)) return

    if (provider === "anthropic") {
      const method = await prompts.select({
        message: "Login method",
        options: [
          {
            label: "Claude Pro/Max",
            value: "oauth",
          },
          {
            label: "API Key",
            value: "api",
          },
        ],
      })
      if (prompts.isCancel(method)) return

      if (method === "oauth") {
        // some weird bug where program exits without this
        await new Promise((resolve) => setTimeout(resolve, 10))
        const { url, verifier } = await AuthAnthropic.authorize()
        prompts.note("Opening browser...")
        await open(url)
        prompts.log.info(url)

        const code = await prompts.text({
          message: "Paste the authorization code here: ",
          validate: (x) => (x.length > 0 ? undefined : "Required"),
        })
        if (prompts.isCancel(code)) return
        await AuthAnthropic.exchange(code, verifier)
          .then(() => {
            prompts.log.success("Login successful")
          })
          .catch(() => {
            prompts.log.error("Invalid code")
          })
        prompts.outro("Done")
        return
      }
    }

    const key = await prompts.password({
      message: "Enter your API key",
    })
    if (prompts.isCancel(key)) return
    await AuthKeys.set(provider, key)

    prompts.outro("Done")
  },
})
