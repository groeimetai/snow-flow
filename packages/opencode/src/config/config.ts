import { Log } from "../util/log"
import path from "path"
import { z } from "zod"
import { App } from "../app/app"
import { Filesystem } from "../util/filesystem"
import { ModelsDev } from "../provider/models"
import { mergeDeep } from "remeda"
import { Global } from "../global"

export namespace Config {
  const log = Log.create({ service: "config" })

  export const state = App.state("config", async (app) => {
    let result = await Bun.file(path.join(Global.Path.config, "config.json"))
      .json()
      .then((mod) => Info.parse(mod))
      .catch(() => ({}) as Info)
    for (const file of ["opencode.jsonc", "opencode.json"]) {
      const [resolved] = await Filesystem.findUp(
        file,
        app.path.cwd,
        app.path.root,
      )
      if (!resolved) continue
      try {
        result = mergeDeep(
          result,
          await import(resolved).then((mod) => Info.parse(mod.default)),
        )
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
      $schema: z.string().optional(),
      provider: z
        .record(
          ModelsDev.Provider.partial().extend({
            models: z.record(ModelsDev.Model.partial()),
            options: z.record(z.any()).optional(),
          }),
        )
        .optional(),
      mcp: z.record(z.string(), Mcp).optional(),
    })
    .strict()

  export type Info = z.output<typeof Info>

  export function get() {
    return state()
  }
}
