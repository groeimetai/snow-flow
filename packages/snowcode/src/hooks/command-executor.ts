import { Log } from "../util/log"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import type { HookEntry, HookResult, HookContext, HookType, HooksConfig } from "./types"

const log = Log.create({ service: "hooks" })

/**
 * Shell Command Hook Executor
 *
 * Executes shell command hooks in the style of Claude Code.
 * Hooks are configured in .snow-flow/settings.json or opencode.jsonc
 *
 * Exit codes:
 * - 0: Success, action proceeds
 * - 2: Block action, stderr is sent as reason
 * - Other: Non-blocking error, logged but action proceeds
 *
 * Environment variables available to hooks:
 * - SNOW_FLOW_PROJECT_DIR: Project root directory
 * - SNOW_FLOW_INSTANCE_URL: ServiceNow instance URL
 * - SNOW_FLOW_SESSION_ID: Current session ID
 * - SNOW_FLOW_TOOL_NAME: Tool/action that triggered the hook
 * - SNOW_FLOW_TOOL_INPUT: JSON stringified input (piped to stdin)
 * - SNOW_FLOW_TOOL_OUTPUT: JSON stringified output (PostToolUse only)
 * - SNOW_FLOW_HOOK_TYPE: Type of hook being executed
 */
export namespace CommandHook {
  /**
   * Check if a tool/action matches a matcher pattern
   */
  function matchesPattern(toolName: string, matcher: string): boolean {
    // Wildcard matches everything
    if (matcher === "*") return true

    // Split by pipe for multiple matchers
    const patterns = matcher.split("|").map((p) => p.trim())

    for (const pattern of patterns) {
      // Check for argument pattern matching: "Bash(npm test*)"
      const argMatch = pattern.match(/^(\w+)\((.+)\)$/)
      if (argMatch) {
        const [, baseTool, argPattern] = argMatch
        if (toolName.startsWith(baseTool)) {
          // Simple glob matching for argument patterns
          const regex = new RegExp("^" + argPattern.replace(/\*/g, ".*") + "$")
          // This would need the actual arguments to fully match
          // For now, just match the base tool name
          if (toolName === baseTool) return true
        }
        continue
      }

      // Check for MCP tool pattern: "mcp__memory__.*"
      if (pattern.includes("*")) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$")
        if (regex.test(toolName)) return true
        continue
      }

      // Exact match
      if (pattern === toolName) return true
    }

    return false
  }

  /**
   * Execute a single hook command
   */
  async function executeCommand(
    command: string,
    context: HookContext,
    hookType: HookType,
    timeout: number = 30000
  ): Promise<HookResult> {
    const startTime = Date.now()

    try {
      // Build environment variables
      const env: Record<string, string> = {
        ...process.env,
        SNOW_FLOW_PROJECT_DIR: context.projectDir,
        SNOW_FLOW_HOOK_TYPE: hookType,
      }

      if (context.instanceURL) {
        env.SNOW_FLOW_INSTANCE_URL = context.instanceURL
      }
      if (context.sessionID) {
        env.SNOW_FLOW_SESSION_ID = context.sessionID
      }
      if (context.toolName) {
        env.SNOW_FLOW_TOOL_NAME = context.toolName
      }
      if (context.toolInput) {
        env.SNOW_FLOW_TOOL_INPUT = context.toolInput
      }
      if (context.toolOutput) {
        env.SNOW_FLOW_TOOL_OUTPUT = context.toolOutput
      }

      log.debug("executing hook command", {
        command,
        hookType,
        toolName: context.toolName,
      })

      // Execute command with Bun shell
      const proc = Bun.spawn(["sh", "-c", command], {
        env,
        stdin: context.toolInput ? new Blob([context.toolInput]) : undefined,
        stdout: "pipe",
        stderr: "pipe",
        cwd: context.projectDir,
      })

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          proc.kill()
          reject(new Error(`Hook command timed out after ${timeout}ms`))
        }, timeout)
      })

      // Wait for completion or timeout
      const exitCode = await Promise.race([proc.exited, timeoutPromise])

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      const executionTime = Date.now() - startTime

      log.debug("hook command completed", {
        command,
        exitCode,
        executionTime,
        stdout: stdout.substring(0, 200),
        stderr: stderr.substring(0, 200),
      })

      // Exit code 2 = block action
      if (exitCode === 2) {
        return {
          allow: false,
          output: stderr || stdout || "Blocked by hook",
          exitCode,
          executionTime,
        }
      }

      // Exit code 0 = success
      if (exitCode === 0) {
        return {
          allow: true,
          output: stdout,
          exitCode,
          executionTime,
        }
      }

      // Other exit codes = non-blocking error
      log.warn("hook command returned non-zero exit code", {
        command,
        exitCode,
        stderr,
      })

      return {
        allow: true,
        output: stdout,
        error: stderr || `Exit code: ${exitCode}`,
        exitCode,
        executionTime,
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      const message = error instanceof Error ? error.message : String(error)

      log.error("hook command failed", {
        command,
        error: message,
      })

      return {
        allow: true, // Don't block on errors by default
        error: message,
        exitCode: -1,
        executionTime,
      }
    }
  }

  /**
   * Get hooks configuration from config
   */
  async function getHooksConfig(): Promise<HooksConfig | undefined> {
    try {
      const config = await Config.get()
      // Check both new hooks field and experimental.hook
      return (config as any).hooks as HooksConfig | undefined
    } catch {
      return undefined
    }
  }

  /**
   * Execute all matching hooks for a given hook type
   *
   * @param hookType - Type of hook to execute
   * @param toolName - Name of tool/action that triggered the hook
   * @param context - Hook execution context
   * @returns Combined result from all hooks
   */
  export async function execute(
    hookType: HookType,
    toolName: string,
    context: Partial<HookContext>
  ): Promise<HookResult> {
    const startTime = Date.now()
    const hooksConfig = await getHooksConfig()

    if (!hooksConfig) {
      return {
        allow: true,
        exitCode: 0,
        executionTime: 0,
      }
    }

    const entries = hooksConfig[hookType] as HookEntry[] | undefined

    if (!entries || entries.length === 0) {
      return {
        allow: true,
        exitCode: 0,
        executionTime: 0,
      }
    }

    // Build full context
    const fullContext: HookContext = {
      projectDir: context.projectDir || Instance.directory,
      instanceURL: context.instanceURL,
      sessionID: context.sessionID,
      toolName: context.toolName || toolName,
      toolInput: context.toolInput,
      toolOutput: context.toolOutput,
    }

    const outputs: string[] = []
    let blocked = false
    let blockReason: string | undefined

    // Execute matching hooks
    for (const entry of entries) {
      if (!matchesPattern(toolName, entry.matcher)) {
        continue
      }

      log.info("executing hooks for", {
        hookType,
        toolName,
        matcher: entry.matcher,
        hookCount: entry.hooks.length,
      })

      for (const hook of entry.hooks) {
        const result = await executeCommand(
          hook.command,
          fullContext,
          hookType,
          hook.timeout
        )

        if (result.output) {
          outputs.push(result.output)
        }

        // If any Pre* hook blocks, stop execution
        if (!result.allow && hookType.startsWith("Pre")) {
          blocked = true
          blockReason = result.output || result.error
          break
        }
      }

      if (blocked) break
    }

    return {
      allow: !blocked,
      output: outputs.join("\n").trim() || undefined,
      error: blockReason,
      exitCode: blocked ? 2 : 0,
      executionTime: Date.now() - startTime,
    }
  }

  /**
   * Execute PreToolUse hooks
   */
  export async function preToolUse(
    toolName: string,
    toolInput: any,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("PreToolUse", toolName, {
      ...context,
      toolName,
      toolInput: JSON.stringify(toolInput),
    })
  }

  /**
   * Execute PostToolUse hooks
   */
  export async function postToolUse(
    toolName: string,
    toolInput: any,
    toolOutput: any,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("PostToolUse", toolName, {
      ...context,
      toolName,
      toolInput: JSON.stringify(toolInput),
      toolOutput: JSON.stringify(toolOutput),
    })
  }

  /**
   * Execute SessionStart hooks
   */
  export async function sessionStart(
    sessionID: string,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("SessionStart", "session", {
      ...context,
      sessionID,
    })
  }

  /**
   * Execute SessionEnd hooks
   */
  export async function sessionEnd(
    sessionID: string,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("SessionEnd", "session", {
      ...context,
      sessionID,
    })
  }

  /**
   * Execute PreDeploy hooks (ServiceNow specific)
   */
  export async function preDeploy(
    deployType: string,
    config: any,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("PreDeploy", deployType, {
      ...context,
      toolName: deployType,
      toolInput: JSON.stringify(config),
    })
  }

  /**
   * Execute PostDeploy hooks (ServiceNow specific)
   */
  export async function postDeploy(
    deployType: string,
    config: any,
    result: any,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("PostDeploy", deployType, {
      ...context,
      toolName: deployType,
      toolInput: JSON.stringify(config),
      toolOutput: JSON.stringify(result),
    })
  }

  /**
   * Execute PreScript hooks (ServiceNow specific)
   */
  export async function preScript(
    script: string,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("PreScript", "snow_execute_background_script", {
      ...context,
      toolInput: JSON.stringify({ script }),
    })
  }

  /**
   * Execute PostScript hooks (ServiceNow specific)
   */
  export async function postScript(
    script: string,
    result: any,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("PostScript", "snow_execute_background_script", {
      ...context,
      toolInput: JSON.stringify({ script }),
      toolOutput: JSON.stringify(result),
    })
  }

  /**
   * Execute InstanceConnect hooks (ServiceNow specific)
   */
  export async function instanceConnect(
    instanceURL: string,
    user?: string,
    context: Partial<HookContext> = {}
  ): Promise<HookResult> {
    return execute("InstanceConnect", "instance_connect", {
      ...context,
      instanceURL,
      toolInput: JSON.stringify({ instanceURL, user }),
    })
  }
}
