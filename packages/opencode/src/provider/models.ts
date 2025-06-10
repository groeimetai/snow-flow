import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const file = Bun.file(path.join(Global.Path.cache, "models.json"))

  export async function get() {
    if (await file.exists()) {
      refresh()
      return file.json()
    }
    await refresh()
    return get()
  }

  async function refresh() {
    log.info("refreshing")
    const result = await fetch("https://models.dev/api.json")
    if (!result.ok)
      throw new Error(`Failed to fetch models.dev: ${result.statusText}`)
    await Bun.write(file, result)
  }
}
