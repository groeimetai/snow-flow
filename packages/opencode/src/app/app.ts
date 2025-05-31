import fs from "fs/promises"
import { AppPath } from "./path"
import { Log } from "../util/log"
import { Context } from "../util/context"

export namespace App {
  const log = Log.create({ service: "app" })

  export type Info = Awaited<ReturnType<typeof create>>

  const ctx = Context.create<Info>("app")

  async function create(input: { directory: string }) {
    const dataDir = AppPath.data(input.directory)
    await fs.mkdir(dataDir, { recursive: true })
    await Log.file(input.directory)

    log.info("created", { path: dataDir })

    const services = new Map<
      any,
      {
        state: any
        shutdown?: (input: any) => Promise<void>
      }
    >()

    const result = {
      get services() {
        return services
      },
      get root() {
        return input.directory
      },
    }

    return result
  }

  export function state<State>(
    key: any,
    init: (app: Info) => State,
    shutdown?: (state: Awaited<State>) => Promise<void>,
  ) {
    return () => {
      const app = ctx.use()
      const services = app.services
      if (!services.has(key)) {
        log.info("registering service", { name: key })
        services.set(key, {
          state: init(app),
          shutdown: shutdown,
        })
      }
      return services.get(key)?.state as State
    }
  }

  export async function use() {
    return ctx.use()
  }

  export async function provide<T extends (app: Info) => any>(
    input: { directory: string },
    cb: T,
  ) {
    const app = await create(input)

    return ctx.provide(app, async () => {
      const result = await cb(app)
      for (const [key, entry] of app.services.entries()) {
        log.info("shutdown", { name: key })
        await entry.shutdown?.(await entry.state)
      }
      return result
    })
  }
}
