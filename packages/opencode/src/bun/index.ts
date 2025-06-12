import { Log } from "../util/log"
export namespace BunProc {
  const log = Log.create({ service: "bun" })

  export async function run(
    cmd: string[],
    options?: Bun.SpawnOptions.OptionsObject<any, any, any>,
  ) {
    log.info("running", {
      cmd: [which(), ...cmd],
      options,
    })
    const result = Bun.spawn([which(), ...cmd], {
      ...options,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ...options?.env,
        BUN_BE_BUN: "1",
      },
    })
    const code = await result.exited
    if (code !== 0) {
      throw new Error(`Command failed with exit code ${result.exitCode}`)
    }
    return result
  }

  export function which() {
    return process.execPath
  }
}
