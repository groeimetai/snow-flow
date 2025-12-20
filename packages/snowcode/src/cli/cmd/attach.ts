import { Global } from "../../global"
import { cmd } from "./cmd"
import path from "path"
import fs from "fs/promises"
import { Log } from "../../util/log"

import { $ } from "bun"

export const AttachCommand = cmd({
  command: "attach <server>",
  describe: "attach to a running snow-code server",
  builder: (yargs) =>
    yargs
      .positional("server", {
        type: "string",
        describe: "http://localhost:4096",
      })
      .option("session", {
        alias: ["s"],
        describe: "session id to continue",
        type: "string",
      }),
  handler: async (args) => {
    let cmd = [] as string[]

    // Platform binaries: TUI is in node_modules/@groeimetai/snow-flow-{platform}-{arch}/bin/tui
    const platformMap: Record<string, string> = {
      darwin: "darwin",
      linux: "linux",
      win32: "win32"
    }
    const archMap: Record<string, string> = {
      x64: "x64",
      arm64: "arm64",
      arm: "arm"
    }
    const platform = platformMap[process.platform] || process.platform
    const arch = archMap[process.arch] || process.arch
    const tuiExt = process.platform === "win32" ? ".exe" : ""
    const platformPkgName = `@groeimetai/snow-flow-${platform}-${arch}`

    // Try multiple possible locations for the platform binary
    const possiblePaths = [
      // Try using Node's module resolution (most reliable)
      (() => {
        try {
          const pkgPath = require.resolve(`${platformPkgName}/package.json`)
          return path.join(path.dirname(pkgPath), "bin", `tui${tuiExt}`)
        } catch {
          return null
        }
      })(),
      // Relative to package root (calculated from import.meta.dir)
      path.join(path.dirname(path.dirname(path.dirname(import.meta.dir))), "node_modules", platformPkgName, "bin", `tui${tuiExt}`),
      // Relative to current executable
      path.join(path.dirname(process.argv[1]), "..", "node_modules", platformPkgName, "bin", `tui${tuiExt}`),
    ].filter(Boolean) as string[]

    let platformBinaryPath: string | undefined
    for (const tryPath of possiblePaths) {
      if (await Bun.file(tryPath).exists()) {
        platformBinaryPath = tryPath
        break
      }
    }

    if (platformBinaryPath) {
      cmd = [platformBinaryPath]
    } else {
      // Fallback: try embedded files (for development builds)
      const tui = Bun.embeddedFiles.find((item) => (item as File).name.includes("tui")) as File
      if (tui) {
        let binaryName = tui.name
        if (process.platform === "win32" && !binaryName.endsWith(".exe")) {
          binaryName += ".exe"
        }
        const binary = path.join(Global.Path.cache, "tui", binaryName)
        const file = Bun.file(binary)
        if (!(await file.exists())) {
          await Bun.write(file, tui, { mode: 0o755 })
          if (process.platform !== "win32") await fs.chmod(binary, 0o755)
        }
        cmd = [binary]
      } else {
        throw new Error(`TUI binary not found at ${platformBinaryPath} - try reinstalling: npm install -g @groeimetai/snow-flow-snowcode`)
      }
    }
    if (args.session) {
      cmd.push("--session", args.session)
    }
    Log.Default.info("tui", {
      cmd,
    })
    const proc = Bun.spawn({
      cmd,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      env: {
        ...process.env,
        CGO_ENABLED: "0",
        SNOWCODE_SERVER: args.server,
        OPENCODE_SERVER: args.server, // Fallback for compatibility
      },
    })

    await proc.exited
  },
})
