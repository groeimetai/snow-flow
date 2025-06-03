import { App } from "../app/app"
import path from "path"

export namespace SessionContext {
  const FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    "CONTEXT.md", // deprecated
  ]
  export async function find() {
    const { cwd, root } = App.info().path
    let current = cwd
    const found = []
    while (true) {
      for (const item of FILES) {
        const file = Bun.file(path.join(current, item))
        if (await file.exists()) {
          found.push(file.text())
        }
      }

      if (current === root) break
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
    return Promise.all(found).then((parts) => parts.join("\n\n"))
  }
}
