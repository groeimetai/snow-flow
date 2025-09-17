import { test, expect } from "bun:test"
import { $ } from "bun"
import path from "path"
import { Snapshot } from "../../src/snapshot"
import { Instance } from "../../src/project/instance"

async function bootstrap() {
  const dir = await $`mktemp -d`.text().then((t) => t.trim())
  // Randomize file contents to ensure unique git repos
  const unique = Math.random().toString(36).slice(2)
  const aContent = `A${unique}`
  const bContent = `B${unique}`
  await Bun.write(`${dir}/a.txt`, aContent)
  await Bun.write(`${dir}/b.txt`, bContent)
  await $`git init`.cwd(dir).quiet()
  await $`git add .`.cwd(dir).quiet()
  await $`git commit -m init`.cwd(dir).quiet()

  return {
    [Symbol.asyncDispose]: async () => {
      await $`rm -rf ${dir}`.quiet()
    },
    dir,
    aContent,
    bContent,
  }
}

test("file path bug - git returns paths with worktree prefix", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    // Create a file in subdirectory
    await $`mkdir -p ${tmp.dir}/sub`.quiet()
    await Bun.write(`${tmp.dir}/sub/file.txt`, "SUB")

    // Get the patch - this will demonstrate the path bug
    const patch = await Snapshot.patch(before!)

    // Log what we get to see the actual paths
    console.log("Worktree path:", Instance.worktree)
    console.log("Patch files:", patch.files)

    // The bug: if git returns paths that already include the worktree directory,
    // path.join(Instance.worktree, x) will create double paths
    // For example: if git returns "tmpDir/sub/file.txt" and worktree is "tmpDir",
    // we get "tmpDir/tmpDir/sub/file.txt" which is wrong

    // Check if any paths are duplicated
    const hasDoublePaths = patch.files.some((filePath) => {
      const worktreeParts = Instance.worktree.split("/").filter(Boolean)
      const fileParts = filePath.split("/").filter(Boolean)

      // Check if worktree appears twice at the start
      if (worktreeParts.length > 0 && fileParts.length >= worktreeParts.length * 2) {
        const firstWorktree = fileParts.slice(0, worktreeParts.length).join("/")
        const secondWorktree = fileParts.slice(worktreeParts.length, worktreeParts.length * 2).join("/")
        return firstWorktree === secondWorktree
      }
      return false
    })

    expect(hasDoublePaths).toBe(false) // This test will fail if the bug exists
  })
})

test("file path bug - manual demonstration", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    // Create a file
    await Bun.write(`${tmp.dir}/test.txt`, "TEST")

    // Simulate what happens in the patch function
    // Mock git diff returning a path that already includes worktree
    const mockGitOutput = `${Instance.worktree}/test.txt\n`

    // This is what the current code does:
    const files = mockGitOutput
      .trim()
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => path.join(Instance.worktree, x)) // This is the bug!

    console.log("Mock git output:", mockGitOutput)
    console.log("Result after path.join:", files)

    // This will show the double path: /tmp/dir/tmp/dir/test.txt
    expect(files[0]).toBe(`${Instance.worktree}/test.txt`) // This should pass but won't due to the bug
  })
})
