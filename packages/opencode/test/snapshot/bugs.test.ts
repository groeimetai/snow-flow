import { test, expect } from "bun:test"
import { $ } from "bun"
import { Snapshot } from "../../src/snapshot"
import { Instance } from "../../src/project/instance"
import path from "path"

async function bootstrap() {
  const dir = await $`mktemp -d`.text().then((t) => t.trim())
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

test("BUG: revert fails with absolute paths outside worktree", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    await Bun.write(`${tmp.dir}/new.txt`, "NEW")

    const patch = await Snapshot.patch(before!)

    // Bug: The revert function tries to checkout files using absolute paths
    // but git checkout expects relative paths from the worktree
    // This will fail when the file path contains the full absolute path
    await expect(Snapshot.revert([patch])).resolves.toBeUndefined()

    // The file should be deleted but won't be due to git checkout failure
    expect(await Bun.file(`${tmp.dir}/new.txt`).exists()).toBe(false)
  })
})

test("BUG: filenames with special git characters break operations", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    // Create files with characters that need escaping in git
    const problematicFiles = [
      `${tmp.dir}/"quotes".txt`,
      `${tmp.dir}/'apostrophe'.txt`,
      `${tmp.dir}/file\nwith\nnewline.txt`,
      `${tmp.dir}/file\twith\ttab.txt`,
      `${tmp.dir}/file with $ dollar.txt`,
      `${tmp.dir}/file with \` backtick.txt`,
    ]

    for (const file of problematicFiles) {
      try {
        await Bun.write(file, "content")
      } catch (e) {
        // Some filenames might not be valid on the filesystem
      }
    }

    const patch = await Snapshot.patch(before!)

    // The patch should handle these special characters correctly
    // but git commands may fail or produce unexpected results
    for (const file of patch.files) {
      if (problematicFiles.some((pf) => file.includes(path.basename(pf)))) {
        // These files with special characters may not be handled correctly
        console.log("Found problematic file in patch:", file)
      }
    }

    // Reverting these files will likely fail
    await Snapshot.revert([patch])

    // Check if files were actually removed (they likely won't be)
    for (const file of problematicFiles) {
      try {
        const exists = await Bun.file(file).exists()
        if (exists) {
          console.log("File with special chars still exists after revert:", file)
        }
      } catch {}
    }
  })
})

test("BUG: race condition in concurrent track calls", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    // Create initial state
    await Bun.write(`${tmp.dir}/file1.txt`, "initial1")
    const hash1 = await Snapshot.track()

    // Start multiple concurrent modifications and tracks
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        (async () => {
          await Bun.write(`${tmp.dir}/file${i}.txt`, `content${i}`)
          const hash = await Snapshot.track()
          return hash
        })(),
      )
    }

    const hashes = await Promise.all(promises)

    // Bug: Multiple concurrent track() calls may interfere with each other
    // because they all run `git add .` and `git write-tree` without locking
    // This can lead to inconsistent state

    // All hashes should be different (since files are different)
    // but due to race conditions, some might be the same
    const uniqueHashes = new Set(hashes)
    console.log(`Got ${uniqueHashes.size} unique hashes out of ${hashes.length} operations`)

    // This assertion might fail due to race conditions
    expect(uniqueHashes.size).toBe(hashes.length)
  })
})

test("BUG: restore doesn't handle modified files correctly", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    // Modify existing file
    await Bun.write(`${tmp.dir}/a.txt`, "MODIFIED")

    // Add new file
    await Bun.write(`${tmp.dir}/new.txt`, "NEW")

    // Delete existing file
    await $`rm ${tmp.dir}/b.txt`.quiet()

    // Restore to original state
    await Snapshot.restore(before!)

    // Check restoration
    expect(await Bun.file(`${tmp.dir}/a.txt`).text()).toBe(tmp.aContent)
    expect(await Bun.file(`${tmp.dir}/b.txt`).text()).toBe(tmp.bContent)

    // Bug: restore uses checkout-index -a which only restores tracked files
    // It doesn't remove untracked files that were added after the snapshot
    expect(await Bun.file(`${tmp.dir}/new.txt`).exists()).toBe(false) // This will fail
  })
})

test("BUG: patch with spaces in filenames not properly escaped", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    // Create file with spaces
    const fileWithSpaces = `${tmp.dir}/file with many spaces.txt`
    await Bun.write(fileWithSpaces, "content")

    const patch = await Snapshot.patch(before!)
    expect(patch.files).toContain(fileWithSpaces)

    // Try to revert - this might fail due to improper escaping
    await Snapshot.revert([patch])

    // File should be removed but might not be due to escaping issues
    expect(await Bun.file(fileWithSpaces).exists()).toBe(false)
  })
})

test("BUG: init() recursive directory removal uses wrong method", async () => {
  // The init() function uses fs.rmdir() which is deprecated
  // and might not work correctly on all systems
  // It should use fs.rm() with recursive: true instead
  // This is more of a code quality issue than a functional bug
  // but could fail on certain node versions or systems
})

test("BUG: diff and patch don't handle binary files correctly", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    // Create a binary file
    const binaryData = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG header
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52,
    ])
    await Bun.write(`${tmp.dir}/image.png`, binaryData)

    // diff() returns text which won't handle binary files correctly
    const diff = await Snapshot.diff(before!)

    // Binary files should be indicated differently in diff
    // but the current implementation just returns text()
    console.log("Diff output for binary file:", diff)

    // The diff might contain binary data as text, which could cause issues
    expect(diff).toContain("image.png")
  })
})

test("BUG: revert with relative path from different cwd fails", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    await $`mkdir -p ${tmp.dir}/subdir`.quiet()
    await Bun.write(`${tmp.dir}/subdir/file.txt`, "content")

    const patch = await Snapshot.patch(before!)

    // Change cwd to a different directory
    const originalCwd = process.cwd()
    process.chdir(tmp.dir)

    try {
      // The revert function uses Instance.worktree as cwd for git checkout
      // but the file paths in the patch are absolute
      // This mismatch can cause issues
      await Snapshot.revert([patch])

      expect(await Bun.file(`${tmp.dir}/subdir/file.txt`).exists()).toBe(false)
    } finally {
      process.chdir(originalCwd)
    }
  })
})

test("BUG: track without git init in Instance.worktree creates orphaned git dir", async () => {
  // Create a directory without git initialization
  const dir = await $`mktemp -d`.text().then((t) => t.trim())

  try {
    await Instance.provide(dir, async () => {
      // Track will create a git directory in Global.Path.data
      // but if the worktree doesn't have git, operations might fail
      const hash = await Snapshot.track()

      // This might return a hash even though the worktree isn't properly tracked
      console.log("Hash from non-git directory:", hash)

      if (hash) {
        // Try to use the hash - this might fail or produce unexpected results
        const patch = await Snapshot.patch(hash)
        console.log("Patch from non-git directory:", patch)
      }
    })
  } finally {
    await $`rm -rf ${dir}`.quiet()
  }
})

test("BUG: patch doesn't handle deleted files in snapshot correctly", async () => {
  await using tmp = await bootstrap()
  await Instance.provide(tmp.dir, async () => {
    // Track initial state
    const before = await Snapshot.track()
    expect(before).toBeTruthy()

    // Delete a file
    await $`rm ${tmp.dir}/a.txt`.quiet()

    // Track after deletion
    const after = await Snapshot.track()
    expect(after).toBeTruthy()

    // Now create a new file
    await Bun.write(`${tmp.dir}/new.txt`, "NEW")

    // Get patch from the state where a.txt was deleted
    // This should show that new.txt was added and a.txt is still missing
    const patch = await Snapshot.patch(after!)

    // But the patch might incorrectly include a.txt as a changed file
    // because git diff compares against the snapshot tree, not working directory
    console.log("Patch files:", patch.files)

    // The patch should only contain new.txt
    expect(patch.files).toContain(`${tmp.dir}/new.txt`)
    expect(patch.files).not.toContain(`${tmp.dir}/a.txt`)
  })
})
