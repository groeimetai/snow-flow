import z from "zod/v4"

/**
 * Hook configuration for shell command hooks (Claude Code style)
 */
export const HookCommand = z.object({
  type: z.literal("command"),
  command: z.string().describe("Shell command to execute"),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .default(30000)
    .describe("Timeout in milliseconds. Default: 30000"),
})
export type HookCommand = z.infer<typeof HookCommand>

/**
 * Single hook entry with matcher and commands
 */
export const HookEntry = z.object({
  matcher: z
    .string()
    .describe("Tool/action matcher pattern. Use '|' for multiple, '*' for all. E.g., 'Bash|Write' or 'snow_deploy'"),
  hooks: z.array(HookCommand).describe("Commands to execute when matcher matches"),
})
export type HookEntry = z.infer<typeof HookEntry>

/**
 * All available hook types
 */
export const HookType = z.enum([
  // Lifecycle hooks
  "PreToolUse",
  "PostToolUse",
  "SessionStart",
  "SessionEnd",
  "PromptSubmit",
  "ResponseComplete",
  "PreCompact",
  // ServiceNow-specific hooks
  "PreDeploy",
  "PostDeploy",
  "PreScript",
  "PostScript",
  "UpdateSetChange",
  "InstanceConnect",
])
export type HookType = z.infer<typeof HookType>

/**
 * Full hooks configuration schema
 */
export const HooksConfig = z.object({
  // Lifecycle hooks
  PreToolUse: z.array(HookEntry).optional(),
  PostToolUse: z.array(HookEntry).optional(),
  SessionStart: z.array(HookEntry).optional(),
  SessionEnd: z.array(HookEntry).optional(),
  PromptSubmit: z.array(HookEntry).optional(),
  ResponseComplete: z.array(HookEntry).optional(),
  PreCompact: z.array(HookEntry).optional(),
  // ServiceNow-specific hooks
  PreDeploy: z.array(HookEntry).optional(),
  PostDeploy: z.array(HookEntry).optional(),
  PreScript: z.array(HookEntry).optional(),
  PostScript: z.array(HookEntry).optional(),
  UpdateSetChange: z.array(HookEntry).optional(),
  InstanceConnect: z.array(HookEntry).optional(),
})
export type HooksConfig = z.infer<typeof HooksConfig>

/**
 * Hook execution result
 */
export interface HookResult {
  /** Whether the action should proceed (only relevant for Pre* hooks) */
  allow: boolean
  /** Output from the hook command */
  output?: string
  /** Error message if hook failed */
  error?: string
  /** Exit code from command */
  exitCode: number
  /** Execution time in milliseconds */
  executionTime: number
}

/**
 * Hook context passed to commands via environment variables
 */
export interface HookContext {
  /** Project directory */
  projectDir: string
  /** ServiceNow instance URL (if connected) */
  instanceURL?: string
  /** Current session ID */
  sessionID?: string
  /** Tool/action name that triggered the hook */
  toolName?: string
  /** JSON stringified input to the tool */
  toolInput?: string
  /** JSON stringified output from the tool (PostToolUse only) */
  toolOutput?: string
}
