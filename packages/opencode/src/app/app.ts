import { Log } from "../util/log"
import { Context } from "../util/context"
import { Filesystem } from "../util/filesystem"
import { Global } from "../global"
import path from "path"
import { z } from "zod"

export namespace App {
  const log = Log.create({ service: "app" })

  export const Info = z
    .object({
      time: z.object({
        initialized: z.number().optional(),
      }),
      git: z.boolean(),
      path: z.object({
        data: z.string(),
        root: z.string(),
        cwd: z.string(),
      }),
    })
    .openapi({
      ref: "App.Info",
    })
  export type Info = z.infer<typeof Info>

  const ctx = Context.create<Awaited<ReturnType<typeof create>>>("app")

  async function create(input: { cwd: string; version: string }) {
    const git = await Filesystem.findUp(".git", input.cwd).then((x) =>
      x ? path.dirname(x) : undefined,
    )

    const data = path.join(Global.data(), git ?? "global")
    await Bun.write(path.join(data, "version"), input.version)
    const stateFile = Bun.file(path.join(data, "state"))
    const state = (
      (await stateFile.exists()) ? await stateFile.json() : {}
    ) as {
      initialized: number
      version: string
    }
    state.version = input.version
    if (!git) state.initialized = Date.now()
    await stateFile.write(JSON.stringify(state))

    const services = new Map<
      any,
      {
        state: any
        shutdown?: (input: any) => Promise<void>
      }
    >()

    await Log.file(path.join(data, "log"))

    const info: Info = {
      time: {
        initialized: state.initialized,
      },
      git: git !== undefined,
      path: {
        data,
        root: git ?? input.cwd,
        cwd: input.cwd,
      },
    }
    const result = {
      services,
      info,
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
          state: init(app.info),
          shutdown: shutdown,
        })
      }
      return services.get(key)?.state as State
    }
  }

  export function info() {
    return ctx.use().info
  }

  export async function provide<T extends (app: Info) => any>(
    input: { cwd: string; version: string },
    cb: T,
  ) {
    const app = await create(input)

    return ctx.provide(app, async () => {
      const result = await cb(app.info)
      for (const [key, entry] of app.services.entries()) {
        log.info("shutdown", { name: key })
        await entry.shutdown?.(await entry.state)
      }
      return result
    })
  }
}
