import path from "path"
import { execSync } from "child_process"
import z from "zod/v4"
import { NamedError } from "../util/error"
import { Bus } from "../bus"
import { Log } from "../util/log"

// Helper to execute shell commands (Node.js compatible replacement for Bun's $)
function shell(command: string, env?: Record<string, string>) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, ...env }
    })
    return { output: result, exitCode: 0, stdout: result, stderr: '' }
  } catch (error: any) {
    return { output: error.stdout || '', exitCode: error.status || 1, stdout: error.stdout || '', stderr: error.stderr || '' }
  }
}

declare global {
  const SNOWCODE_VERSION: string
  const SNOWCODE_CHANNEL: string
}

export namespace Installation {
  const log = Log.create({ service: "installation" })

  export type Method = Awaited<ReturnType<typeof method>>

  export const Event = {
    Updated: Bus.event(
      "installation.updated",
      z.object({
        version: z.string(),
      }),
    ),
  }

  export const Info = z
    .object({
      version: z.string(),
      latest: z.string(),
    })
    .meta({
      ref: "InstallationInfo",
    })
  export type Info = z.infer<typeof Info>

  export async function info() {
    return {
      version: VERSION,
      latest: await latest(),
    }
  }

  export function isPreview() {
    return CHANNEL !== "latest"
  }

  export function isLocal() {
    return CHANNEL === "local"
  }

  export async function method() {
    if (process.execPath.includes(path.join(".snowcode", "bin"))) return "curl"
    if (process.execPath.includes(path.join(".local", "bin"))) return "curl"
    const exec = process.execPath.toLowerCase()

    const checks = [
      {
        name: "npm" as const,
        command: () => shell('npm list -g --depth=0').output,
      },
      {
        name: "yarn" as const,
        command: () => shell('yarn global list').output,
      },
      {
        name: "pnpm" as const,
        command: () => shell('pnpm list -g --depth=0').output,
      },
      {
        name: "bun" as const,
        command: () => shell('bun pm ls -g').output,
      },
      {
        name: "brew" as const,
        command: () => shell('brew list --formula @groeimetai/snow-flow-snowcode').output,
      },
    ]

    checks.sort((a, b) => {
      const aMatches = exec.includes(a.name)
      const bMatches = exec.includes(b.name)
      if (aMatches && !bMatches) return -1
      if (!aMatches && bMatches) return 1
      return 0
    })

    for (const check of checks) {
      const output = await check.command()
      if (output.includes("@groeimetai/snow-flow-snowcode") || output.includes("snow-code") || output.includes("snowcode")) {
        return check.name
      }
    }

    return "unknown"
  }

  export const UpgradeFailedError = NamedError.create(
    "UpgradeFailedError",
    z.object({
      stderr: z.string(),
    }),
  )

  export async function upgrade(method: Method, target: string) {
    const result = (() => {
      switch (method) {
        case "curl":
          return shell('curl -fsSL https://snow-flow.dev/install | bash', {
            VERSION: target,
          })
        case "npm":
          return shell(`npm install -g @groeimetai/snow-flow-snowcode@${target}`)
        case "pnpm":
          return shell(`pnpm install -g @groeimetai/snow-flow-snowcode@${target}`)
        case "bun":
          return shell(`bun install -g @groeimetai/snow-flow-snowcode@${target}`)
        case "brew":
          return shell('brew install groeimetai/tap/snowcode', {
            HOMEBREW_NO_AUTO_UPDATE: "1",
          })
        default:
          throw new Error(`Unknown method: ${method}`)
      }
    })()

    log.info("upgraded", {
      method,
      target,
      stdout: result.stdout,
      stderr: result.stderr,
    })
    if (result.exitCode !== 0)
      throw new UpgradeFailedError({
        stderr: result.stderr,
      })
  }

  export const VERSION = typeof SNOWCODE_VERSION === "string" ? SNOWCODE_VERSION : "local"
  export const CHANNEL = typeof SNOWCODE_CHANNEL === "string" ? SNOWCODE_CHANNEL : "local"
  export const USER_AGENT = `snowcode/${CHANNEL}/${VERSION}`

  export async function latest() {
    return fetch(`https://registry.npmjs.org/@groeimetai/snow-flow-snowcode/${CHANNEL}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data: any) => data.version)
  }
}
