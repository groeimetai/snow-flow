import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const filepath = path.join(Global.Path.cache, "models.json")

  export async function get() {
    const file = Bun.file(filepath)
    const result = await file.json().catch(() => {})
    if (result) {
      refresh()
      return result
    }
    await refresh()
    return get()
  }

  async function refresh() {
    const file = Bun.file(filepath)
    log.info("refreshing")
    const result = await fetch("https://models.dev/api.json")
    if (!result.ok)
      throw new Error(`Failed to fetch models.dev: ${result.statusText}`)
    await Bun.write(file, result)
  }
}
