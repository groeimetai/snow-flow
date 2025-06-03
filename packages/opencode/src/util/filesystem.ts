import { exists } from "fs/promises"
import { dirname, join } from "path"

export namespace Filesystem {
  export async function findUp(target: string, start: string, stop?: string) {
    let currentDir = start
    while (true) {
      const targetPath = join(currentDir, target)
      if (await exists(targetPath)) return targetPath
      if (stop === currentDir) return
      const parentDir = dirname(currentDir)
      if (parentDir === currentDir) {
        return
      }
      currentDir = parentDir
    }
  }
}
