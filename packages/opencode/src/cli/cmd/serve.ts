import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "../../flag/flag"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencode server",
  handler: async (args) => {
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }
    const opts = await resolveNetworkOptions(args)
    const server = Server.listen(opts)
    console.log(`opencode server listening on http://${server.hostname}:${server.port}`)

    // Pre-warm Instance bootstrap so it's cached before TUI connects
    fetch(`http://127.0.0.1:${server.port}/config`)
      .then(() => console.log("server bootstrap warmup complete"))
      .catch((e) => console.log(`server bootstrap warmup failed: ${e instanceof Error ? e.message : e}`))

    await new Promise(() => {})
    await server.stop()
  },
})
