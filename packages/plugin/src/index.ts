import type {
  Event,
  createOpencodeClient,
  Project,
  Model,
  Provider,
  Permission,
  UserMessage,
  Part,
  Auth,
  Config,
} from "@groeimetai/snow-flow-sdk"

import type { BunShell } from "./shell"
import { type ToolDefinition } from "./tool"

export * from "./tool"

export type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>
  project: Project
  directory: string
  worktree: string
  $: BunShell
}

export type Plugin = (input: PluginInput) => Promise<Hooks>

export interface Hooks {
  event?: (input: { event: Event }) => Promise<void>
  config?: (input: Config) => Promise<void>
  tool?: {
    [key: string]: ToolDefinition
  }
  auth?: {
    provider: string
    loader?: (auth: () => Promise<Auth>, provider: Provider) => Promise<Record<string, any>>
    methods: (
      | {
          type: "oauth"
          label: string
          authorize(): Promise<
            { url: string; instructions: string } & (
              | {
                  method: "auto"
                  callback(): Promise<
                    | ({
                        type: "success"
                      } & (
                        | {
                            refresh: string
                            access: string
                            expires: number
                          }
                        | { key: string }
                      ))
                    | {
                        type: "failed"
                      }
                  >
                }
              | {
                  method: "code"
                  callback(code: string): Promise<
                    | ({
                        type: "success"
                      } & (
                        | {
                            refresh: string
                            access: string
                            expires: number
                          }
                        | { key: string }
                      ))
                    | {
                        type: "failed"
                      }
                  >
                }
            )
          >
        }
      | { type: "api"; label: string }
    )[]
  }
  /**
   * Called when a new message is received
   */
  "chat.message"?: (input: {}, output: { message: UserMessage; parts: Part[] }) => Promise<void>
  /**
   * Modify parameters sent to LLM
   */
  "chat.params"?: (
    input: { model: Model; provider: Provider; message: UserMessage },
    output: { temperature: number; topP: number; options: Record<string, any> },
  ) => Promise<void>
  "permission.ask"?: (input: Permission, output: { status: "ask" | "deny" | "allow" }) => Promise<void>
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: {
      title: string
      output: string
      metadata: any
    },
  ) => Promise<void>

  // ============================================
  // Lifecycle Hooks
  // ============================================

  /**
   * Called when a session starts or resumes
   */
  "session.start"?: (input: { sessionID: string; isResume: boolean }) => Promise<void>

  /**
   * Called when a session ends
   */
  "session.end"?: (input: { sessionID: string; reason: "user" | "timeout" | "error" }) => Promise<void>

  /**
   * Called before user prompt is processed - can modify the prompt
   */
  "prompt.submit"?: (
    input: { prompt: string; sessionID: string },
    output: { prompt: string; inject?: string },
  ) => Promise<void>

  /**
   * Called when LLM response is complete
   */
  "response.complete"?: (
    input: { sessionID: string; messageID: string },
    output: { response: string },
  ) => Promise<void>

  /**
   * Called before context compaction
   */
  "context.compact.before"?: (
    input: { sessionID: string; messageCount: number },
    output: { allow: boolean },
  ) => Promise<void>

  // ============================================
  // ServiceNow-Specific Hooks
  // ============================================

  /**
   * Called before deploying a ServiceNow artifact (widget, script include, etc.)
   */
  "servicenow.deploy.before"?: (
    input: { type: string; identifier: string; config: Record<string, any> },
    output: { allow: boolean; reason?: string },
  ) => Promise<void>

  /**
   * Called after deploying a ServiceNow artifact
   */
  "servicenow.deploy.after"?: (
    input: { type: string; identifier: string; result: Record<string, any>; success: boolean },
  ) => Promise<void>

  /**
   * Called before executing a background script - can modify or block
   */
  "servicenow.script.before"?: (
    input: { script: string; description?: string },
    output: { script: string; allow: boolean; reason?: string },
  ) => Promise<void>

  /**
   * Called after executing a background script
   */
  "servicenow.script.after"?: (
    input: { script: string; result: any; success: boolean; executionTime: number },
  ) => Promise<void>

  /**
   * Called when update set changes occur
   */
  "servicenow.updateset.change"?: (
    input: { updateSetID: string; updateSetName: string; action: "create" | "switch" | "complete" | "modify" },
  ) => Promise<void>

  /**
   * Called when connecting to a ServiceNow instance
   */
  "servicenow.instance.connect"?: (
    input: { instanceURL: string; user?: string },
    output: { allow: boolean; reason?: string },
  ) => Promise<void>

  /**
   * Called when ServiceNow instance connection is established
   */
  "servicenow.instance.connected"?: (
    input: { instanceURL: string; version?: string },
  ) => Promise<void>

  // ============================================
  // Audit & Compliance Hooks (Core - Open Source)
  // ============================================

  /**
   * Called for audit logging - all significant actions
   */
  "audit.log"?: (
    input: {
      action: string
      category: "tool" | "session" | "servicenow" | "auth" | "config"
      metadata: Record<string, any>
      timestamp: number
    },
  ) => Promise<void>
}
