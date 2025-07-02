import { z } from "zod"
import { Bus } from "../bus"
import { $ } from "bun"
import { createPatch } from "diff"
import path from "path"
import { status } from "isomorphic-git"
import { App } from "../app/app"
import fs from "fs"
import { Log } from "../util/log"

export namespace File {
  const log = Log.create({ service: "files" })

  export const Event = {
    Edited: Bus.event(
      "file.edited",
      z.object({
        file: z.string(),
      }),
    ),
  }

  export async function read(file: string) {
    using _ = log.time("read", { file })
    const app = App.info()
    const full = path.join(app.path.cwd, file)
    const content = await Bun.file(full).text()
    if (app.git) {
      const rel = path.relative(app.path.root, full)
      const diff = await status({
        fs,
        dir: app.path.root,
        filepath: rel,
      })
      if (diff !== "unmodified") {
        const original = await $`git show HEAD:${rel}`
          .cwd(app.path.root)
          .quiet()
          .nothrow()
          .text()
        const patch = createPatch(file, original, content)
        return patch
      }
    }
    return content.trim()
  }
}
