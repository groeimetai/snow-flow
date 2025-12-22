/**
 * DAG Executor Tests
 */

import { describe, it, expect } from "bun:test"
import { DAG } from "./executor"

describe("DAG Executor", () => {
  describe("buildPlan", () => {
    it("should build plan for simple linear dependencies", () => {
      const tasks: DAG.Task[] = [
        { id: "task1", agentName: "general", prompt: "Do task 1", dependencies: [] },
        { id: "task2", agentName: "general", prompt: "Do task 2", dependencies: ["task1"] },
        { id: "task3", agentName: "general", prompt: "Do task 3", dependencies: ["task2"] },
      ]

      const plan = DAG.buildPlan(tasks)

      expect(plan.levels).toEqual([["task1"], ["task2"], ["task3"]])
      expect(plan.rootTaskIds).toEqual(["task1"])
    })

    it("should build plan for parallel tasks", () => {
      const tasks: DAG.Task[] = [
        { id: "research", agentName: "general", prompt: "Research", dependencies: [] },
        { id: "analyze", agentName: "general", prompt: "Analyze", dependencies: [] },
        { id: "design", agentName: "build", prompt: "Design", dependencies: ["research", "analyze"] },
      ]

      const plan = DAG.buildPlan(tasks)

      expect(plan.levels[0].sort()).toEqual(["analyze", "research"])
      expect(plan.levels[1]).toEqual(["design"])
      expect(plan.rootTaskIds.sort()).toEqual(["analyze", "research"])
    })

    it("should build plan for complex DAG", () => {
      const tasks: DAG.Task[] = [
        { id: "A", agentName: "general", prompt: "A", dependencies: [] },
        { id: "B", agentName: "general", prompt: "B", dependencies: [] },
        { id: "C", agentName: "general", prompt: "C", dependencies: ["A"] },
        { id: "D", agentName: "general", prompt: "D", dependencies: ["A", "B"] },
        { id: "E", agentName: "general", prompt: "E", dependencies: ["C", "D"] },
      ]

      const plan = DAG.buildPlan(tasks)

      // Level 0: A, B (parallel)
      expect(plan.levels[0].sort()).toEqual(["A", "B"])
      // Level 1: C, D (parallel, depend on A and/or B)
      expect(plan.levels[1].sort()).toEqual(["C", "D"])
      // Level 2: E (depends on C and D)
      expect(plan.levels[2]).toEqual(["E"])
    })

    it("should detect cyclic dependencies", () => {
      const tasks: DAG.Task[] = [
        { id: "task1", agentName: "general", prompt: "Do task 1", dependencies: ["task2"] },
        { id: "task2", agentName: "general", prompt: "Do task 2", dependencies: ["task1"] },
      ]

      expect(() => DAG.buildPlan(tasks)).toThrow(/Cyclic dependency detected/)
    })

    it("should detect missing dependencies", () => {
      const tasks: DAG.Task[] = [
        { id: "task1", agentName: "general", prompt: "Do task 1", dependencies: ["nonexistent"] },
      ]

      expect(() => DAG.buildPlan(tasks)).toThrow(/depends on non-existent task/)
    })

    it("should handle self-dependency as cycle", () => {
      const tasks: DAG.Task[] = [
        { id: "task1", agentName: "general", prompt: "Do task 1", dependencies: ["task1"] },
      ]

      expect(() => DAG.buildPlan(tasks)).toThrow(/Cyclic dependency detected/)
    })

    it("should handle diamond dependency pattern", () => {
      const tasks: DAG.Task[] = [
        { id: "A", agentName: "general", prompt: "A", dependencies: [] },
        { id: "B", agentName: "general", prompt: "B", dependencies: ["A"] },
        { id: "C", agentName: "general", prompt: "C", dependencies: ["A"] },
        { id: "D", agentName: "general", prompt: "D", dependencies: ["B", "C"] },
      ]

      const plan = DAG.buildPlan(tasks)

      expect(plan.levels[0]).toEqual(["A"])
      expect(plan.levels[1].sort()).toEqual(["B", "C"])
      expect(plan.levels[2]).toEqual(["D"])
    })
  })

  describe("validatePlan", () => {
    it("should validate correct plan", () => {
      const tasks: DAG.Task[] = [
        { id: "task1", agentName: "general", prompt: "Do task 1", dependencies: [] },
        { id: "task2", agentName: "general", prompt: "Do task 2", dependencies: ["task1"] },
      ]

      const plan = DAG.buildPlan(tasks)
      const validation = DAG.validatePlan(plan)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toEqual([])
    })

    it("should detect invalid dependency ordering", () => {
      // Manually create invalid plan (bypassing buildPlan validation)
      const plan: DAG.Plan = {
        tasks: {
          task1: { id: "task1", agentName: "general", prompt: "Do task 1", dependencies: ["task2"] },
          task2: { id: "task2", agentName: "general", prompt: "Do task 2", dependencies: [] },
        },
        levels: [
          ["task1"], // task1 at level 0
          ["task2"], // task2 at level 1 - but task1 depends on it!
        ],
        rootTaskIds: ["task1"],
      }

      const validation = DAG.validatePlan(plan)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe("visualizePlan", () => {
    it("should generate readable plan visualization", () => {
      const tasks: DAG.Task[] = [
        { id: "research", agentName: "general", prompt: "Research", description: "Research best practices", dependencies: [] },
        { id: "implement", agentName: "build", prompt: "Implement", description: "Implement feature", dependencies: ["research"] },
      ]

      const plan = DAG.buildPlan(tasks)
      const visualization = DAG.visualizePlan(plan)

      expect(visualization).toContain("# DAG Execution Plan")
      expect(visualization).toContain("**Total Tasks:** 2")
      expect(visualization).toContain("**Execution Levels:** 2")
      expect(visualization).toContain("Level 0")
      expect(visualization).toContain("Level 1")
      expect(visualization).toContain("research")
      expect(visualization).toContain("implement")
    })
  })

  describe("Complex scenarios", () => {
    it("should handle multi-level parallel execution", () => {
      const tasks: DAG.Task[] = [
        // Level 0: 3 parallel research tasks
        { id: "research_docs", agentName: "general", prompt: "Research docs", dependencies: [] },
        { id: "research_code", agentName: "general", prompt: "Research code", dependencies: [] },
        { id: "research_issues", agentName: "general", prompt: "Research issues", dependencies: [] },

        // Level 1: 2 parallel synthesis tasks
        { id: "synthesize_tech", agentName: "build", prompt: "Synthesize technical", dependencies: ["research_docs", "research_code"] },
        { id: "synthesize_user", agentName: "build", prompt: "Synthesize user needs", dependencies: ["research_issues"] },

        // Level 2: Implementation
        { id: "implement", agentName: "build", prompt: "Implement", dependencies: ["synthesize_tech", "synthesize_user"] },

        // Level 3: Testing
        { id: "test", agentName: "plan", prompt: "Test", dependencies: ["implement"] },
      ]

      const plan = DAG.buildPlan(tasks)

      expect(plan.levels.length).toBe(4)
      expect(plan.levels[0].length).toBe(3) // 3 parallel research
      expect(plan.levels[1].length).toBe(2) // 2 parallel synthesis
      expect(plan.levels[2].length).toBe(1) // 1 implementation
      expect(plan.levels[3].length).toBe(1) // 1 test
    })

    it("should calculate correct parallelization for widget creation pattern", () => {
      const tasks: DAG.Task[] = [
        // Level 0: 3 parallel research
        { id: "research_widgets", agentName: "general", prompt: "Research widgets", dependencies: [] },
        { id: "research_metrics", agentName: "general", prompt: "Research metrics", dependencies: [] },
        { id: "analyze_requirements", agentName: "plan", prompt: "Analyze requirements", dependencies: [] },

        // Level 1: 2 parallel design
        { id: "design_architecture", agentName: "build", prompt: "Design arch", dependencies: ["research_widgets", "research_metrics", "analyze_requirements"] },
        { id: "design_ui", agentName: "build", prompt: "Design UI", dependencies: ["analyze_requirements"] },

        // Level 2: Implementation
        { id: "implement_widget", agentName: "build", prompt: "Implement", dependencies: ["design_architecture", "design_ui"] },

        // Level 3: Testing
        { id: "test_widget", agentName: "plan", prompt: "Test", dependencies: ["implement_widget"] },

        // Level 4: Documentation
        { id: "document_widget", agentName: "general", prompt: "Document", dependencies: ["test_widget"] },
      ]

      const plan = DAG.buildPlan(tasks)

      // Total: 8 tasks
      expect(Object.keys(plan.tasks).length).toBe(8)

      // Execution levels: 5 (0-4)
      expect(plan.levels.length).toBe(5)

      // Parallelization opportunities
      expect(plan.levels[0].length).toBe(3) // Level 0: 3 parallel
      expect(plan.levels[1].length).toBe(2) // Level 1: 2 parallel
      expect(plan.levels[2].length).toBe(1) // Level 2: 1 task
      expect(plan.levels[3].length).toBe(1) // Level 3: 1 task
      expect(plan.levels[4].length).toBe(1) // Level 4: 1 task

      // Sequential execution: 8 tasks
      // Parallel execution: 5 levels
      // Theoretical speedup: 8/5 = 1.6x (60% faster)
    })
  })
})
