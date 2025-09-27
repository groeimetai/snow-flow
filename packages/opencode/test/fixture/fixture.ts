import { $ } from "bun"
import os from "os"
import path from "path"

type TmpDirOptions<Init extends Record<string, any>> = {
  git?: boolean
  init?: (dir: string) => Promise<Init>
  dispose?: (dir: string) => Promise<void>
}
export async function tmpdir<Init extends Record<string, any>>(options?: TmpDirOptions<Init>) {
  const dirpath = path.join(os.tmpdir(), "opencode-test-" + Math.random().toString(36).slice(2))
  await $`mkdir -p ${dirpath}`.quiet()
  if (options?.git) await $`git init`.cwd(dirpath).quiet()
  const extra = await options?.init?.(dirpath)
  const result = {
    [Symbol.asyncDispose]: async () => {
      await options?.dispose?.(dirpath)
      await $`rm -rf ${dirpath}`.quiet()
    },
    path: dirpath,
    extra: extra as Init,
  }
  return result
}
