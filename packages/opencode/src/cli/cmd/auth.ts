import { AuthAnthropic } from "../../auth/anthropic"
import { Auth } from "../../auth"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import open from "open"
import { UI } from "../ui"
import { ModelsDev } from "../../provider/models"

export const AuthCommand = cmd({
  command: "auth",
  builder: (yargs) =>
    yargs
      .command(AuthLoginCommand)
      .command(AuthLogoutCommand)
      .command(AuthListCommand)
      .demandCommand(),
  async handler(args) {},
})

export const AuthListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list providers",
  async handler() {
    UI.empty()
    prompts.intro("Credentials")
    const results = await Auth.all().then((x) => Object.entries(x))
    const database = await ModelsDev.get()

    for (const [providerID, result] of results) {
      const name = database[providerID]?.name || providerID
      prompts.log.info(`${name} ${Bun.color("gray", "ansi")}(${result.type})`)
    }

    prompts.outro(`${results.length} credentials`)
  },
})

export const AuthLoginCommand = cmd({
  command: "login",
  describe: "login to a provider",
  async handler() {
    UI.empty()
    prompts.intro("Add credential")
    const provider = await prompts.select({
      message: "Select provider",
      maxItems: 2,
      options: [
        {
          label: "Anthropic",
          value: "anthropic",
        },
        {
          label: "OpenAI",
          value: "openai",
        },
        {
          label: "Google",
          value: "google",
        },
      ],
    })
    if (prompts.isCancel(provider)) throw new UI.CancelledError()

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
      if (prompts.isCancel(method)) throw new UI.CancelledError()

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
        if (prompts.isCancel(code)) throw new UI.CancelledError()

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
    if (prompts.isCancel(key)) throw new UI.CancelledError()
    await Auth.set(provider, {
      type: "api",
      key,
    })

    prompts.outro("Done")
  },
})

export const AuthLogoutCommand = cmd({
  command: "logout",
  describe: "logout from a configured provider",
  async handler() {
    UI.empty()
    const credentials = await Auth.all().then((x) => Object.entries(x))
    prompts.intro("Remove credential")
    if (credentials.length === 0) {
      prompts.log.error("No credentials found")
      return
    }
    const database = await ModelsDev.get()
    const providerID = await prompts.select({
      message: "Select credential",
      options: credentials.map(([key, value]) => ({
        label: database[key]?.name || key,
        value: key,
      })),
    })
    if (prompts.isCancel(providerID)) throw new UI.CancelledError()
    await Auth.remove(providerID)
    prompts.outro("Logout successful")
  },
})
