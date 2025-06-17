import { z } from "zod"
import { Global } from "."
import { lazy } from "../util/lazy"
import path from "path"

export namespace GlobalConfig {
  export const Info = z.object({
    autoupdate: z.boolean().optional(),
    autoshare: z.boolean().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
  })
  export type Info = z.infer<typeof Info>

  export const get = lazy(async () => {
    const toml = await import(path.join(Global.Path.config, "config"), {
      with: {
        type: "toml",
      },
    })
      .then((mod) => mod.default)
      .catch(() => ({}))
    return Info.parse(toml)
  })
}
