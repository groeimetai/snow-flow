import path from "path";
import { Log } from "../util/log";
export namespace BunProc {
  const log = Log.create({ service: "bun" });

  export function run(
    cmd: string[],
    options?: Bun.SpawnOptions.OptionsObject<any, any, any>,
  ) {
    const root =
      process.argv0 !== "bun"
        ? path.resolve(process.cwd(), process.argv0)
        : process.argv0;
    log.info("running", {
      cmd: [root, ...cmd],
      options,
    });
    const result = Bun.spawnSync([root, ...cmd], {
      ...options,
      argv0: "bun",
      env: {
        ...process.env,
        ...options?.env,
      },
    });
    return result;
  }
}
