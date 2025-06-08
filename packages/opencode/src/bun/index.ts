import path from "path"
import { Log } from "../util/log"
export namespace BunProc {
  const log = Log.create({ service: "bun" })

  export async function run(
    cmd: string[],
    options?: Bun.SpawnOptions.OptionsObject<any, any, any>,
  ) {
    const root =
      process.argv0 !== "bun"
        ? path.resolve(process.cwd(), process.argv0)
        : process.argv0
    log.info("running", {
      cmd: [root, ...cmd],
      options,
    })
    const result = Bun.spawn([root, ...cmd], {
      ...options,
      argv0: "bun",
      env: {
        ...process.env,
        ...options?.env,
        BUN_BE_BUN: "1",
      },
    })
    const code = await result.exited
    if (code !== 0) {
      console.error(result.stderr?.toString("utf8") ?? "")
      throw new Error(`Command failed with exit code ${result.exitCode}`)
    }
    return result
  }
}
