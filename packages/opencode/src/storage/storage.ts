import { FileStorage } from "@flystorage/file-storage"
import { LocalStorageAdapter } from "@flystorage/local-fs"
import fs from "fs/promises"
import { Log } from "../util/log"
import { App } from "../app/app"
import { Bus } from "../bus"
import path from "path"
import z from "zod"

export namespace Storage {
  const log = Log.create({ service: "storage" })

  export const Event = {
    Write: Bus.event(
      "storage.write",
      z.object({ key: z.string(), content: z.any() }),
    ),
  }

  const state = App.state("storage", async () => {
    const app = App.info()
    const storageDir = path.join(app.path.data, "storage")
    await fs.mkdir(storageDir, { recursive: true })
    const storage = new FileStorage(new LocalStorageAdapter(storageDir))
    log.info("created", { path: storageDir })
    return {
      storage,
    }
  })

  export async function readJSON<T>(key: string) {
    const storage = await state().then((x) => x.storage)
    const data = await storage.readToString(key + ".json")
    return JSON.parse(data) as T
  }

  export async function writeJSON<T>(key: string, content: T) {
    const storage = await state().then((x) => x.storage)
    const json = JSON.stringify(content)
    await storage.write(key + ".json", json)
    Bus.publish(Event.Write, { key, content })
  }

  export async function* list(prefix: string) {
    try {
      const storage = await state().then((x) => x.storage)
      const list = storage.list(prefix)
      for await (const item of list) {
        yield item.path.slice(0, -5)
      }
    } catch {
      return
    }
  }
}
