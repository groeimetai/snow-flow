import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"

export const UpgradeCommand = {
  command: "upgrade [target]",
  describe: "upgrade opencode to the latest version or a specific version",
  builder: (yargs: Argv) => {
    return yargs.positional("target", {
      describe: "specific version to upgrade to (e.g., '0.1.48' or 'v0.1.48')",
      type: "string",
    })
  },
  handler: async (args: { target?: string }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("Upgrade")
    const method = await Installation.method()
    if (method === "unknown") {
      prompts.log.error(
        `opencode is installed to ${process.execPath} and seems to be managed by a package manager`,
      )
      prompts.outro("Done")
      return
    }
    const target = args.target ?? (await Installation.latest())
    prompts.log.info(`From ${Installation.VERSION} → ${target}`)
    const spinner = prompts.spinner()
    spinner.start("Upgrading...")
    const err = await Installation.upgrade(method, target).catch((err) => err)
    if (err) {
      spinner.stop("Upgrade failed")
      if (err instanceof Installation.UpgradeFailedError)
        prompts.log.error(err.data.stderr)
      else if (err instanceof Error) prompts.log.error(err.message)
      prompts.outro("Done")
      return
    }
    spinner.stop("Upgrade complete")
    prompts.outro("Done")
  },
}
