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
 * Hook configuration for approval requests
 * This triggers the TUI permission dialog for user confirmation
 */
export const HookApproval = z.object({
  type: z.literal("approval"),
  title: z.string().describe("Title shown in approval dialog"),
  message: z.string().optional().describe("Optional message explaining why approval is needed"),
})
export type HookApproval = z.infer<typeof HookApproval>

/**
 * Union of all hook action types
 */
export const HookAction = z.discriminatedUnion("type", [HookCommand, HookApproval])
export type HookAction = z.infer<typeof HookAction>

/**
 * Single hook entry with matcher and actions
 */
export const HookEntry = z.object({
  matcher: z
    .string()
    .describe("Tool/action matcher pattern. Use '|' for multiple, '*' for all. E.g., 'Bash|Write' or 'snow_deploy'"),
  hooks: z.array(HookAction).describe("Actions to execute when matcher matches"),
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
  /** Message ID for permission requests */
  messageID?: string
  /** Tool call ID for permission requests */
  callID?: string
  /** Tool/action name that triggered the hook */
  toolName?: string
  /** JSON stringified input to the tool */
  toolInput?: string
  /** JSON stringified output from the tool (PostToolUse only) */
  toolOutput?: string
}

/**
 * Default hooks that are always active for quality and safety
 * These are merged with user-configured hooks
 */
export const DEFAULT_HOOKS: HooksConfig = {
  PreToolUse: [
    // Approval required for table creation
    {
      matcher: "snow_create_table",
      hooks: [
        {
          type: "approval",
          title: "Table Creation Approval",
          message: "Creating a new table requires approval. This will add a new table to the ServiceNow instance.",
        },
      ],
    },
    // Approval required for destructive operations
    {
      matcher: "snow_delete_record|snow_delete_table",
      hooks: [
        {
          type: "approval",
          title: "Destructive Operation",
          message: "This operation will permanently delete data. Please confirm.",
        },
      ],
    },
  ],
  PostToolUse: [
    // Log all deployments
    {
      matcher: "snow_push_artifact",
      hooks: [
        {
          type: "command",
          command: "mkdir -p ~/.snow-flow && echo \"[$(date '+%Y-%m-%d %H:%M:%S')] Deployed: $SNOW_FLOW_TOOL_NAME - $(echo $SNOW_FLOW_TOOL_INPUT | jq -r '.type // \"artifact\"')\" >> ~/.snow-flow/deploy.log",
          timeout: 5000,
        },
      ],
    },
  ],
}
