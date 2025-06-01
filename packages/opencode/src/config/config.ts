import path from "path"
import { Log } from "../util/log"
import { z } from "zod"
import { App } from "../app/app"
import { Provider } from "../provider/provider"

export namespace Config {
  const log = Log.create({ service: "config" })

  export const state = App.state("config", async (app) => {
    const result = await load(app.path.root)
    return result
  })

  export const Info = z
    .object({
      provider: z.lazy(() => Provider.Info.array().optional()),
      tool: z
        .object({
          provider: z.record(z.string(), z.string().array()).optional(),
        })
        .optional(),
    })
    .strict()

  export type Info = z.output<typeof Info>

  export function get() {
    return state()
  }

  async function load(directory: string) {
    let result: Info = {}
    for (const file of ["opencode.jsonc", "opencode.json"]) {
      const resolved = path.join(directory, file)
      log.info("searching", { path: resolved })
      try {
        result = await import(path.join(directory, file)).then((mod) =>
          Info.parse(mod.default),
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
  }
}
