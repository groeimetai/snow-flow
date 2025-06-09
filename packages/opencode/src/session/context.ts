import { App } from "../app/app"
import { Filesystem } from "../util/filesystem"

export namespace SessionContext {
  const FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    "CONTEXT.md", // deprecated
  ]
  export async function find() {
    const { cwd, root } = App.info().path
    const found = []
    for (const item of FILES) {
      const matches = await Filesystem.findUp(item, cwd, root)
      found.push(...matches.map((x) => Bun.file(x).text()))
    }
    return Promise.all(found).then((parts) => parts.join("\n\n"))
  }
}
