import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { UI } from "../ui"

/**
 * `snow-flow upgrade-scan --instance N --target vancouver`
 *
 * Triggers a server-side Upgrade Readiness scan via the Snow-Flow
 * Enterprise portal. The portal fetches every script/ACL from the
 * registered ServiceNow instance (OAuth), evaluates them against the
 * curated rule set for the target release, and returns a risk score
 * + blockers + findings count.
 *
 * Requires these env vars:
 *   SNOW_FLOW_ENTERPRISE_URL   default: https://portal.snow-flow.dev
 *   SNOW_FLOW_ENTERPRISE_TOKEN portal JWT (obtain via portal login)
 *
 * The instance ID comes from the portal — visit /portal/servicenow to
 * find it, or inspect the URL when you click an instance in the portal.
 */
export const UpgradeScanCommand = cmd({
  command: "upgrade-scan",
  describe: "run an Upgrade Readiness scan on a registered ServiceNow instance",
  builder: (yargs: Argv) => {
    return yargs
      .option("instance", {
        describe: "ServiceNow instance id (as registered in the portal)",
        type: "number",
        demandOption: true,
      })
      .option("target", {
        describe: "target release (vancouver|washington|xanadu|yokohama)",
        type: "string",
        demandOption: true,
      })
      .option("base-url", {
        describe: "Snow-Flow Enterprise portal URL (overrides env)",
        type: "string",
      })
  },
  handler: async (argv) => {
    const baseUrl = (argv["base-url"] as string | undefined) || process.env.SNOW_FLOW_ENTERPRISE_URL || "https://portal.snow-flow.dev"
    const token = process.env.SNOW_FLOW_ENTERPRISE_TOKEN
    if (!token) {
      process.stderr.write("error: SNOW_FLOW_ENTERPRISE_TOKEN is not set.\n")
      process.stderr.write("Log in via the portal (portal.snow-flow.dev) and copy your session JWT into that env var.\n")
      process.exit(1)
      return
    }

    const instance = argv.instance as number
    const target = (argv.target as string).toLowerCase().trim()
    const validTargets = ["vancouver", "washington", "xanadu", "yokohama"]
    if (!validTargets.includes(target)) {
      process.stderr.write(`error: target must be one of ${validTargets.join(", ")}\n`)
      process.exit(1)
      return
    }

    UI.logo()
    process.stdout.write(`Starting Upgrade Readiness scan…\n`)
    process.stdout.write(`  instance:    ${instance}\n`)
    process.stdout.write(`  target:      ${target}\n`)
    process.stdout.write(`  portal:      ${baseUrl}\n\n`)

    const url = `${baseUrl.replace(/\/$/, "")}/api/governance/sn-code-intelligence/scan-instance`
    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instanceId: instance, targetRelease: target }),
      })
    } catch (err: any) {
      process.stderr.write(`error: failed to reach portal: ${err?.message ?? err}\n`)
      process.exit(2)
      return
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const anyData = data as { error?: string; details?: unknown }
      process.stderr.write(`error ${response.status}: ${anyData.error ?? "unknown"}\n`)
      if (anyData.details) {
        process.stderr.write(`details: ${JSON.stringify(anyData.details, null, 2)}\n`)
      }
      process.exit(3)
      return
    }

    const result = data as { scanId: number; artifactCount: number; findings: number; fetchErrors: string[] }
    process.stdout.write(`✅ Scan complete\n`)
    process.stdout.write(`  scan id:         ${result.scanId}\n`)
    process.stdout.write(`  artifacts:       ${result.artifactCount}\n`)
    process.stdout.write(`  findings:        ${result.findings}\n`)
    if (result.fetchErrors && result.fetchErrors.length > 0) {
      process.stdout.write(`  fetch warnings:\n`)
      for (const e of result.fetchErrors) process.stdout.write(`    - ${e}\n`)
    }
    process.stdout.write(`\n  Details: ${baseUrl}/governance/code-intelligence\n`)
  },
})
