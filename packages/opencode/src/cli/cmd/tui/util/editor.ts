import { defer } from "@/util/defer"
import { chmod, mkdtemp, rm } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CliRenderer } from "@opentui/core"

export namespace Editor {
  export async function open(opts: { value: string; renderer: CliRenderer }): Promise<string | undefined> {
    const editor = process.env["VISUAL"] || process.env["EDITOR"]
    if (!editor) return

    // Use mkdtemp for unpredictable temp directory + randomBytes for filename
    // to prevent symlink attacks and temp file race conditions.
    const tempDir = await mkdtemp(join(tmpdir(), "opencode-editor-"))
    const filepath = join(tempDir, `${randomBytes(16).toString("hex")}.md`)
    await using _ = defer(async () => rm(tempDir, { recursive: true, force: true }))

    await Bun.write(filepath, opts.value)
    await chmod(filepath, 0o600)
    opts.renderer.suspend()
    opts.renderer.currentRenderBuffer.clear()
    const parts = editor.split(" ")
    const proc = Bun.spawn({
      cmd: [...parts, filepath],
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })
    await proc.exited
    const content = await Bun.file(filepath).text()
    opts.renderer.currentRenderBuffer.clear()
    opts.renderer.resume()
    opts.renderer.requestRender()
    return content || undefined
  }
}
