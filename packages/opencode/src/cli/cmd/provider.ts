import { App } from "../../app/app"
import { AuthAnthropic } from "../../auth/anthropic"
import { AuthKeys } from "../../auth/keys"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import open from "open"
import { VERSION } from "../version"
import { Provider } from "../../provider/provider"

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
    await App.provide({ cwd: process.cwd(), version: VERSION }, async () => {
      prompts.intro("Providers")
      const providers = await Provider.list().then((x) => Object.values(x))
      for (const value of providers) {
        prompts.log.success(value.info.name + " (" + value.source + ")")
      }
      prompts.outro(`${providers.length} configured`)
    })
  },
})

export const ProviderAddCommand = cmd({
  command: "add",
  describe: "add credentials for various providers",
  async handler() {
    await App.provide({ cwd: process.cwd(), version: VERSION }, async () => {
      const providers = await Provider.list()
      prompts.intro("Add provider")
      const provider = await prompts.select({
        message: "Select",
        maxItems: 2,
        options: [
          {
            label: "Anthropic",
            value: "anthropic",
            hint: providers["anthropic"] ? "configured" : "",
          },
          {
            label: "OpenAI",
            value: "openai",
            hint: providers["openai"] ? "configured" : "",
          },
          {
            label: "Google",
            value: "google",
            hint: providers["google"] ? "configured" : "",
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
        validate: (x) => (x.length > 0 ? undefined : "Required"),
      })
      if (prompts.isCancel(key)) return
      await AuthKeys.set(provider, key)

      prompts.outro("Done")
    })
  },
})
