import { realpathSync } from "fs"
import { realpath } from "fs/promises"
import { dirname, join, relative, resolve } from "path"

export namespace Filesystem {
  export const exists = (p: string) =>
    Bun.file(p)
      .stat()
      .then(() => true)
      .catch(() => false)

  export const isDir = (p: string) =>
    Bun.file(p)
      .stat()
      .then((s) => s.isDirectory())
      .catch(() => false)
  /**
   * On Windows, normalize a path to its canonical casing using the filesystem.
   * This is needed because Windows paths are case-insensitive but LSP servers
   * may return paths with different casing than what we send them.
   */
  export function normalizePath(p: string): string {
    if (process.platform !== "win32") return p
    try {
      return realpathSync.native(p)
    } catch {
      return p
    }
  }
  export function overlaps(a: string, b: string) {
    const relA = relative(a, b)
    const relB = relative(b, a)
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..")
  }

  /**
   * Lexical containment check: returns true if `child` is inside `parent`
   * based on path string comparison only. Does NOT resolve symlinks.
   * Use `containsReal` for symlink-safe checks.
   */
  export function contains(parent: string, child: string) {
    return !relative(parent, child).startsWith("..")
  }

  /**
   * Symlink-safe containment check: resolves both paths to their real
   * filesystem locations before comparing. This prevents symlink-based
   * directory traversal attacks where a symlink inside the project
   * points to a location outside the allowed boundary.
   *
   * Falls back to lexical `contains()` if realpath resolution fails
   * (e.g., path does not exist yet for new file creation).
   */
  export async function containsReal(parent: string, child: string): Promise<boolean> {
    const resolvedParent = await realpath(resolve(parent)).catch(() => resolve(parent))
    const resolvedChild = await realpath(resolve(child)).catch(() => resolve(child))
    const rel = relative(resolvedParent, resolvedChild)
    return !rel.startsWith("..")
  }

  export async function findUp(target: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      const search = join(current, target)
      if (await exists(search)) result.push(search)
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  export async function* up(options: { targets: string[]; start: string; stop?: string }) {
    const { targets, start, stop } = options
    let current = start
    while (true) {
      for (const target of targets) {
        const search = join(current, target)
        if (await exists(search)) yield search
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      try {
        const glob = new Bun.Glob(pattern)
        for await (const match of glob.scan({
          cwd: current,
          absolute: true,
          onlyFiles: true,
          followSymlinks: false,
          dot: true,
        })) {
          result.push(match)
        }
      } catch {
        // Skip invalid glob patterns
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }
}
