import { Log } from "../util/log"
import { Context } from "../util/context"
import { Filesystem } from "../util/filesystem"
import { Global } from "../global"
import path from "path"

export namespace App {
  const log = Log.create({ service: "app" })

  export type Info = Awaited<ReturnType<typeof create>>

  const ctx = Context.create<Info>("app")

  async function create(input: { cwd: string; version: string }) {
    let root = await Filesystem.findUp(".git", input.cwd).then((x) =>
      x ? path.dirname(x) : input.cwd,
    )

    const data = path.join(Global.data(), root)
    await Bun.write(path.join(data, "version"), input.version)

    const services = new Map<
      any,
      {
        state: any
        shutdown?: (input: any) => Promise<void>
      }
    >()

    await Log.file(path.join(data, "log"))

    const result = Object.freeze({
      services,
      path: {
        data,
        root,
        cwd: input.cwd,
      },
    })

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
    input: { cwd: string; version: string },
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
