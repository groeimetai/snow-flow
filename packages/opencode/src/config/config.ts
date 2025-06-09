import { Log } from "../util/log"
import { z } from "zod"
import { App } from "../app/app"
import { Filesystem } from "../util/filesystem"

export namespace Config {
  const log = Log.create({ service: "config" })

  export const state = App.state("config", async (app) => {
    let result: Info = {}
    for (const file of ["opencode.jsonc", "opencode.json"]) {
      const [resolved] = await Filesystem.findUp(
        file,
        app.path.cwd,
        app.path.root,
      )
      if (!resolved) continue
      try {
        result = await import(resolved).then((mod) => Info.parse(mod.default))
        log.info("found", { path: resolved })
        break
      } catch (e) {
        if (e instanceof z.ZodError) {
          for (const issue of e.issues) {
            log.info(issue.message)
          }
          throw e
        }
        continue
      }
    }
    log.info("loaded", result)
    return result
  })

  export const McpLocal = z.object({
    type: z.literal("local"),
    command: z.string().array(),
    environment: z.record(z.string(), z.string()).optional(),
  })

  export const McpRemote = z.object({
    type: z.literal("remote"),
    url: z.string(),
  })

  export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote])
  export type Mcp = z.infer<typeof Mcp>

  export const Info = z
    .object({
      provider: z.record(z.string(), z.record(z.string(), z.any())).optional(),
      tool: z
        .object({
          provider: z.record(z.string(), z.string().array()).optional(),
        })
        .optional(),
      mcp: z.record(z.string(), Mcp).optional(),
    })
    .strict()

  export type Info = z.output<typeof Info>

  export function get() {
    return state()
  }
}
