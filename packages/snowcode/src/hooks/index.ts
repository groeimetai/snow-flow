/**
 * Snow-Flow Hooks System
 *
 * A hybrid hook system supporting both:
 * 1. TypeScript plugin hooks (complex logic)
 * 2. Shell command hooks (simple automations, Claude Code style)
 *
 * Hook Types:
 * - PreToolUse: Before tool execution (can block)
 * - PostToolUse: After tool execution
 * - SessionStart: When session starts/resumes
 * - SessionEnd: When session ends
 * - PromptSubmit: Before prompt is processed
 * - ResponseComplete: When LLM response is complete
 * - PreDeploy/PostDeploy: ServiceNow deployment hooks
 * - PreScript/PostScript: Background script hooks
 * - UpdateSetChange: Update set modification hooks
 * - InstanceConnect: ServiceNow instance connection hooks
 */

export * from "./command-executor"
export * from "./types"
