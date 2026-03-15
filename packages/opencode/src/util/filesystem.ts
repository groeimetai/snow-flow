import { realpathSync, statSync, mkdirSync } from "fs"
import { readFile, writeFile, stat as fsStat, realpath, mkdir } from "fs/promises"
import { dirname, join, relative, resolve as pathResolve } from "path"

export namespace Filesystem {
  export const exists = (p: string) =>
    fsStat(p)
      .then(() => true)
      .catch(() => false)

  export const isDir = (p: string) =>
    fsStat(p)
      .then((s) => s.isDirectory())
      .catch(() => false)

  export async function readText(p: string): Promise<string> {
    return readFile(p, "utf-8")
  }

  export async function readJson<T = unknown>(p: string): Promise<T> {
    const text = await readFile(p, "utf-8")
    return JSON.parse(text) as T
  }

  export async function write(p: string, content: string | Buffer | Uint8Array): Promise<void> {
    await mkdir(dirname(p), { recursive: true }).catch(() => {})
    await writeFile(p, content)
  }

  export async function writeJson(p: string, data: unknown): Promise<void> {
    await mkdir(dirname(p), { recursive: true }).catch(() => {})
    await writeFile(p, JSON.stringify(data, null, 2))
  }

  export async function readBytes(p: string): Promise<Buffer> {
    return readFile(p)
  }

  export function stat(p: string) {
    return fsStat(p)
  }

  export function resolve(...segments: string[]): string {
    return pathResolve(...segments)
  }
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
