/**
 * DAG (Directed Acyclic Graph) Executor
 *
 * Executes tasks with dependencies in optimal order, maximizing parallel execution.
 *
 * Key features:
 * - Topological sort for dependency resolution
 * - Level-based parallel execution
 * - Cycle detection
 * - Progress tracking
 * - Error handling with partial completion
 */

// DAG Executor - moved from packages/snowcode to packages/core
import { SessionPrompt } from "../session/prompt.js"
import type { MessageV2 } from "../session/message-v2.js"

export namespace DAG {
  /**
   * Task definition with dependencies
   */
  export interface Task {
    id: string
    agentName: string
    prompt: string
    description?: string
    dependencies: string[] // IDs of tasks that must complete first
  }

  /**
   * Execution plan with tasks organized by dependency level
   */
  export interface Plan {
    tasks: Record<string, Task>
    levels: string[][] // [[level0_tasks], [level1_tasks], ...]
    rootTaskIds: string[]
  }

  /**
   * Result of task execution
   */
  export interface TaskResult {
    taskId: string
    success: boolean
    output: string
    artifacts: string[] // sys_ids or file paths created
    parts: MessageV2.Part[]
    duration: number
    error?: Error
  }

  /**
   * Result of plan execution
   */
  export interface PlanResult {
    planId: string
    success: boolean
    tasksCompleted: number
    tasksFailed: number
    tasksSkipped: number
    results: Record<string, TaskResult>
    totalDuration: number
    parallelizationGain: number // % time saved vs sequential
  }

  /**
   * Progress callback for monitoring
   */
  export type ProgressCallback = (event: {
    type: "level_start" | "level_complete" | "task_start" | "task_complete" | "task_failed"
    level?: number
    taskId?: string
    progress: {
      completed: number
      total: number
      percentage: number
    }
  }) => void

  /**
   * Build execution plan from tasks
   *
   * Performs topological sort to determine execution order and detects cycles.
   */
  export function buildPlan(tasks: Task[]): Plan {
    const taskMap: Record<string, Task> = {}
    for (const task of tasks) {
      taskMap[task.id] = task
    }

    // Validate all dependencies exist
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!taskMap[depId]) {
          throw new Error(`Task '${task.id}' depends on non-existent task '${depId}'`)
        }
      }
    }

    // Detect cycles using DFS
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    function hasCycle(taskId: string): boolean {
      visited.add(taskId)
      recursionStack.add(taskId)

      const task = taskMap[taskId]
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) return true
        } else if (recursionStack.has(depId)) {
          return true // Cycle detected!
        }
      }

      recursionStack.delete(taskId)
      return false
    }

    for (const taskId of Object.keys(taskMap)) {
      if (!visited.has(taskId)) {
        if (hasCycle(taskId)) {
          throw new Error(`Cyclic dependency detected involving task '${taskId}'`)
        }
      }
    }

    // Topological sort using Kahn's algorithm
    const levels: string[][] = []
    const inDegree: Record<string, number> = {}
    const completed = new Set<string>()

    // Calculate in-degrees
    for (const task of tasks) {
      inDegree[task.id] = task.dependencies.length
    }

    // Build levels
    while (completed.size < tasks.length) {
      // Find all tasks with in-degree 0 (no unmet dependencies)
      const currentLevel: string[] = []
      for (const task of tasks) {
        if (!completed.has(task.id) && inDegree[task.id] === 0) {
          currentLevel.push(task.id)
        }
      }

      if (currentLevel.length === 0) {
        // Shouldn't happen if cycle detection worked, but safety check
        throw new Error("Unable to resolve dependencies - possible cycle")
      }

      levels.push(currentLevel)

      // Mark current level as completed and decrement in-degrees
      for (const taskId of currentLevel) {
        completed.add(taskId)
        const task = taskMap[taskId]

        // For each task that depends on this one, decrement in-degree
        for (const otherTask of tasks) {
          if (otherTask.dependencies.includes(taskId)) {
            inDegree[otherTask.id]--
          }
        }
      }
    }

    // Identify root tasks (tasks with no dependencies)
    const rootTaskIds = tasks.filter((t) => t.dependencies.length === 0).map((t) => t.id)

    return {
      tasks: taskMap,
      levels,
      rootTaskIds,
    }
  }

  /**
   * Execute plan with dependency-aware parallel execution
   *
   * @param sessionID - Session to execute tasks in
   * @param plan - Execution plan with tasks and levels
   * @param context - Execution context (model, agent defaults)
   * @param onProgress - Optional progress callback
   */
  export async function execute(
    sessionID: string,
    plan: Plan,
    context: {
      baseModel?: { providerID: string; modelID: string }
      baseAgent?: string
      skipOnError?: boolean // If true, skip dependent tasks when a task fails
    },
    onProgress?: ProgressCallback
  ): Promise<PlanResult> {
    const startTime = Date.now()
    const results: Record<string, TaskResult> = {}
    const failed = new Set<string>()
    const skipped = new Set<string>()

    const totalTasks = Object.keys(plan.tasks).length

    // Execute level by level
    for (let levelIndex = 0; levelIndex < plan.levels.length; levelIndex++) {
      const levelTasks = plan.levels[levelIndex]

      onProgress?.({
        type: "level_start",
        level: levelIndex,
        progress: {
          completed: Object.keys(results).length,
          total: totalTasks,
          percentage: (Object.keys(results).length / totalTasks) * 100,
        },
      })

      // Check if any tasks in this level should be skipped due to failed dependencies
      const tasksToExecute: string[] = []
      for (const taskId of levelTasks) {
        const task = plan.tasks[taskId]
        const hasFailedDependency = task.dependencies.some((depId) => failed.has(depId))

        if (hasFailedDependency && context.skipOnError) {
          skipped.add(taskId)
          results[taskId] = {
            taskId,
            success: false,
            output: `Skipped due to failed dependency`,
            artifacts: [],
            parts: [],
            duration: 0,
            error: new Error("Dependency failed"),
          }
          continue
        }

        tasksToExecute.push(taskId)
      }

      // Execute all tasks in this level in parallel
      const levelPromises = tasksToExecute.map(async (taskId) => {
        const task = plan.tasks[taskId]
        const taskStartTime = Date.now()

        onProgress?.({
          type: "task_start",
          taskId,
          level: levelIndex,
          progress: {
            completed: Object.keys(results).length,
            total: totalTasks,
            percentage: (Object.keys(results).length / totalTasks) * 100,
          },
        })

        try {
          // Execute task via SessionPrompt.prompt()
          const result = await SessionPrompt.prompt({
            sessionID,
            agent: task.agentName || context.baseAgent,
            model: context.baseModel,
            parts: [
              {
                type: "text",
                text: task.prompt,
              },
            ],
          })

          // Extract output and artifacts
          const textParts = result.parts.filter((p): p is MessageV2.TextPart => p.type === "text")
          const toolParts = result.parts.filter((p): p is MessageV2.ToolPart => p.type === "tool")

          const output = textParts.map((p) => p.text).join("\n")
          const artifacts: string[] = []

          // Extract sys_ids from tool outputs (heuristic)
          for (const toolPart of toolParts) {
            if (toolPart.state?.status === "completed" && toolPart.state.output) {
              const sysIdMatches = toolPart.state.output.match(/[a-f0-9]{32}/g)
              if (sysIdMatches) {
                artifacts.push(...sysIdMatches)
              }
            }
          }

          const taskResult: TaskResult = {
            taskId,
            success: true,
            output,
            artifacts: [...new Set(artifacts)], // Dedupe
            parts: result.parts,
            duration: Date.now() - taskStartTime,
          }

          results[taskId] = taskResult

          onProgress?.({
            type: "task_complete",
            taskId,
            level: levelIndex,
            progress: {
              completed: Object.keys(results).length,
              total: totalTasks,
              percentage: (Object.keys(results).length / totalTasks) * 100,
            },
          })

          return taskResult
        } catch (error) {
          failed.add(taskId)

          const taskResult: TaskResult = {
            taskId,
            success: false,
            output: "",
            artifacts: [],
            parts: [],
            duration: Date.now() - taskStartTime,
            error: error as Error,
          }

          results[taskId] = taskResult

          onProgress?.({
            type: "task_failed",
            taskId,
            level: levelIndex,
            progress: {
              completed: Object.keys(results).length,
              total: totalTasks,
              percentage: (Object.keys(results).length / totalTasks) * 100,
            },
          })

          return taskResult
        }
      })

      // Wait for all tasks in this level to complete
      await Promise.all(levelPromises)

      onProgress?.({
        type: "level_complete",
        level: levelIndex,
        progress: {
          completed: Object.keys(results).length,
          total: totalTasks,
          percentage: (Object.keys(results).length / totalTasks) * 100,
        },
      })
    }

    const totalDuration = Date.now() - startTime

    // Calculate parallelization gain (rough estimate)
    const sequentialDuration = Object.values(results).reduce((sum, r) => sum + r.duration, 0)
    const parallelizationGain = sequentialDuration > 0 ? ((sequentialDuration - totalDuration) / sequentialDuration) * 100 : 0

    const tasksCompleted = Object.values(results).filter((r) => r.success).length
    const tasksFailed = failed.size
    const tasksSkipped = skipped.size

    return {
      planId: sessionID,
      success: tasksFailed === 0,
      tasksCompleted,
      tasksFailed,
      tasksSkipped,
      results,
      totalDuration,
      parallelizationGain,
    }
  }

  /**
   * Visualize execution plan as text
   */
  export function visualizePlan(plan: Plan): string {
    let output = "# DAG Execution Plan\n\n"
    output += `**Total Tasks:** ${Object.keys(plan.tasks).length}\n`
    output += `**Execution Levels:** ${plan.levels.length}\n\n`

    for (let i = 0; i < plan.levels.length; i++) {
      const level = plan.levels[i]
      output += `## Level ${i} (${level.length} tasks in parallel)\n\n`

      for (const taskId of level) {
        const task = plan.tasks[taskId]
        output += `- **${taskId}** (agent: ${task.agentName})\n`
        output += `  - Description: ${task.description || "N/A"}\n`
        output += `  - Dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(", ") : "none"}\n`
        output += `\n`
      }
    }

    return output
  }

  /**
   * Validate plan without executing
   */
  export function validatePlan(plan: Plan): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check all dependencies exist
    for (const task of Object.values(plan.tasks)) {
      for (const depId of task.dependencies) {
        if (!plan.tasks[depId]) {
          errors.push(`Task '${task.id}' depends on non-existent task '${depId}'`)
        }
      }
    }

    // Check levels are correctly ordered
    const levelMap = new Map<string, number>()
    plan.levels.forEach((level, index) => {
      level.forEach((taskId) => levelMap.set(taskId, index))
    })

    for (const task of Object.values(plan.tasks)) {
      const taskLevel = levelMap.get(task.id)!
      for (const depId of task.dependencies) {
        const depLevel = levelMap.get(depId)!
        if (depLevel >= taskLevel) {
          errors.push(`Task '${task.id}' at level ${taskLevel} depends on '${depId}' at level ${depLevel} (must be earlier level)`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

// Export type aliases for external use
export type Task = DAG.Task
export type Plan = DAG.Plan
export type TaskResult = DAG.TaskResult
export type PlanResult = DAG.PlanResult
export type ProgressCallback = DAG.ProgressCallback
