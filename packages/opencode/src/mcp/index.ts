import { experimental_createMCPClient, type Tool } from "ai"
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio"
import { App } from "../app/app"
import { Config } from "../config/config"

export namespace MCP {
  const state = App.state(
    "mcp",
    async () => {
      const cfg = await Config.get()
      const clients: {
        [name: string]: Awaited<ReturnType<typeof experimental_createMCPClient>>
      } = {}
      for (const [key, mcp] of Object.entries(cfg.mcp ?? {})) {
        if (mcp.type === "remote") {
          clients[key] = await experimental_createMCPClient({
            name: key,
            transport: {
              type: "sse",
              url: mcp.url,
            },
          })
        }

        if (mcp.type === "local") {
          const [cmd, ...args] = mcp.command
          clients[key] = await experimental_createMCPClient({
            name: key,
            transport: new Experimental_StdioMCPTransport({
              stderr: "ignore",
              command: cmd,
              args,
              env: mcp.environment,
            }),
          })
        }
      }

      return {
        clients,
      }
    },
    async (state) => {
      for (const client of Object.values(state.clients)) {
        client.close()
      }
    },
  )

  export async function clients() {
    return state().then((state) => state.clients)
  }

  export async function tools() {
    const result: Record<string, Tool> = {}
    for (const [clientName, client] of Object.entries(await clients())) {
      for (const [toolName, tool] of Object.entries(await client.tools())) {
        result[clientName + "_" + toolName] = tool
      }
    }
    return result
  }
}
