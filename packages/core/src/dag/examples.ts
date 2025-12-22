/**
 * DAG Executor Examples
 *
 * Practical examples demonstrating how to use the DAG executor for common scenarios.
 */

import { DAG } from "./executor"

/**
 * Example 1: Simple Linear Workflow
 *
 * Research → Implement → Test
 */
export function example1_LinearWorkflow(): DAG.Plan {
  const tasks: DAG.Task[] = [
    {
      id: "research",
      agentName: "general",
      prompt: "Research ServiceNow widget best practices and common patterns",
      description: "Research phase",
      dependencies: [],
    },
    {
      id: "implement",
      agentName: "build",
      prompt: "Implement a ServiceNow dashboard widget based on the research findings",
      description: "Implementation phase",
      dependencies: ["research"],
    },
    {
      id: "test",
      agentName: "plan",
      prompt: "Test the implemented widget for functionality and performance",
      description: "Testing phase",
      dependencies: ["implement"],
    },
  ]

  return DAG.buildPlan(tasks)
}

/**
 * Example 2: Parallel Research + Sequential Implementation
 *
 * Level 0: research_docs, research_code (parallel)
 * Level 1: synthesize
 * Level 2: implement
 * Level 3: test
 */
export function example2_ParallelResearch(): DAG.Plan {
  const tasks: DAG.Task[] = [
    // Level 0: Parallel research
    {
      id: "research_docs",
      agentName: "general",
      prompt: "Research ServiceNow official documentation for REST API integration",
      description: "Documentation research",
      dependencies: [],
    },
    {
      id: "research_code",
      agentName: "general",
      prompt: "Search existing codebase for similar REST API integration patterns",
      description: "Code analysis",
      dependencies: [],
    },

    // Level 1: Synthesize findings
    {
      id: "synthesize",
      agentName: "build",
      prompt: "Synthesize research findings from documentation and codebase into a coherent integration approach",
      description: "Synthesis phase",
      dependencies: ["research_docs", "research_code"],
    },

    // Level 2: Implementation
    {
      id: "implement",
      agentName: "build",
      prompt: "Implement REST API integration based on synthesized approach",
      description: "Implementation",
      dependencies: ["synthesize"],
    },

    // Level 3: Testing
    {
      id: "test",
      agentName: "plan",
      prompt: "Test REST API integration with various scenarios",
      description: "Testing",
      dependencies: ["implement"],
    },
  ]

  return DAG.buildPlan(tasks)
}

/**
 * Example 3: Full-Stack Feature Development
 *
 * Level 0: research_requirements, analyze_architecture (parallel)
 * Level 1: design_backend, design_frontend, design_database (parallel)
 * Level 2: implement_backend, implement_frontend, implement_database (parallel)
 * Level 3: integrate
 * Level 4: test_unit, test_integration (parallel)
 * Level 5: deploy
 */
export function example3_FullStackFeature(): DAG.Plan {
  const tasks: DAG.Task[] = [
    // Level 0: Initial analysis (parallel)
    {
      id: "research_requirements",
      agentName: "general",
      prompt: "Research and document functional requirements for incident management dashboard",
      description: "Requirements research",
      dependencies: [],
    },
    {
      id: "analyze_architecture",
      agentName: "plan",
      prompt: "Analyze existing ServiceNow architecture and identify integration points",
      description: "Architecture analysis",
      dependencies: [],
    },

    // Level 1: Design phase (parallel)
    {
      id: "design_backend",
      agentName: "build",
      prompt: "Design backend API endpoints and business logic for incident dashboard",
      description: "Backend design",
      dependencies: ["research_requirements", "analyze_architecture"],
    },
    {
      id: "design_frontend",
      agentName: "build",
      prompt: "Design frontend UI/UX components for incident dashboard",
      description: "Frontend design",
      dependencies: ["research_requirements"],
    },
    {
      id: "design_database",
      agentName: "build",
      prompt: "Design database schema for incident metrics storage",
      description: "Database design",
      dependencies: ["analyze_architecture"],
    },

    // Level 2: Implementation phase (parallel)
    {
      id: "implement_backend",
      agentName: "build",
      prompt: "Implement backend API endpoints according to design specifications",
      description: "Backend implementation",
      dependencies: ["design_backend"],
    },
    {
      id: "implement_frontend",
      agentName: "build",
      prompt: "Implement frontend components according to design specifications",
      description: "Frontend implementation",
      dependencies: ["design_frontend"],
    },
    {
      id: "implement_database",
      agentName: "build",
      prompt: "Create database tables and relationships according to schema design",
      description: "Database setup",
      dependencies: ["design_database"],
    },

    // Level 3: Integration
    {
      id: "integrate",
      agentName: "build",
      prompt: "Integrate backend, frontend, and database components into cohesive system",
      description: "System integration",
      dependencies: ["implement_backend", "implement_frontend", "implement_database"],
    },

    // Level 4: Testing (parallel)
    {
      id: "test_unit",
      agentName: "plan",
      prompt: "Execute unit tests for all components",
      description: "Unit testing",
      dependencies: ["integrate"],
    },
    {
      id: "test_integration",
      agentName: "plan",
      prompt: "Execute end-to-end integration tests",
      description: "Integration testing",
      dependencies: ["integrate"],
    },

    // Level 5: Deployment
    {
      id: "deploy",
      agentName: "build",
      prompt: "Deploy incident dashboard to ServiceNow instance",
      description: "Deployment",
      dependencies: ["test_unit", "test_integration"],
    },
  ]

  return DAG.buildPlan(tasks)
}

/**
 * Example 4: ServiceNow Widget Creation (Realistic Scenario)
 *
 * This mirrors the pattern described in the DAG orchestrator agent prompt.
 */
export function example4_WidgetCreation(): DAG.Plan {
  const tasks: DAG.Task[] = [
    // Level 0: Parallel research (3 agents)
    {
      id: "research_widgets",
      agentName: "general",
      prompt:
        "Research ServiceNow Service Portal widget best practices, available widget types, and common patterns for dashboard widgets",
      description: "Widget research",
      dependencies: [],
    },
    {
      id: "research_metrics",
      agentName: "general",
      prompt: "Research available incident metrics and KPIs in ServiceNow. Identify most valuable metrics for dashboard display",
      description: "Metrics research",
      dependencies: [],
    },
    {
      id: "analyze_requirements",
      agentName: "plan",
      prompt: "Analyze user requirements for dashboard widget. What are the must-have features vs nice-to-have?",
      description: "Requirements analysis",
      dependencies: [],
    },

    // Level 1: Parallel design (2 agents)
    {
      id: "design_architecture",
      agentName: "build",
      prompt:
        "Design widget architecture: HTML structure, server script queries for metrics, client controller for chart rendering. Use findings from research tasks.",
      description: "Architecture design",
      dependencies: ["research_widgets", "research_metrics", "analyze_requirements"],
    },
    {
      id: "design_ui",
      agentName: "build",
      prompt: "Design UI/UX: layout, chart types, color scheme, responsive behavior. Base on requirements analysis.",
      description: "UI design",
      dependencies: ["analyze_requirements"],
    },

    // Level 2: Implementation (1 agent)
    {
      id: "implement_widget",
      agentName: "build",
      prompt:
        "Implement widget: create sp_widget record with HTML template, server script (query incident metrics using GlideRecord), client controller (initialize charts), CSS styling. Follow both design specifications.",
      description: "Widget implementation",
      dependencies: ["design_architecture", "design_ui"],
    },

    // Level 3: Testing (1 agent)
    {
      id: "test_widget",
      agentName: "plan",
      prompt:
        "Test widget: verify data loads correctly, charts render properly, responsive design works across devices, performance is acceptable. Check browser console and server logs for errors.",
      description: "Widget testing",
      dependencies: ["implement_widget"],
    },

    // Level 4: Documentation (1 agent)
    {
      id: "document_widget",
      agentName: "general",
      prompt:
        "Create comprehensive documentation: widget purpose, configuration options, data sources, metrics explanation, customization guide for future developers.",
      description: "Documentation",
      dependencies: ["test_widget"],
    },
  ]

  return DAG.buildPlan(tasks)
}

/**
 * Example 5: Complex Multi-Path DAG (Diamond Pattern)
 *
 *     A
 *    / \
 *   B   C
 *    \ /
 *     D
 */
export function example5_DiamondPattern(): DAG.Plan {
  const tasks: DAG.Task[] = [
    {
      id: "A",
      agentName: "general",
      prompt: "Initial research and requirements gathering",
      description: "Research",
      dependencies: [],
    },
    {
      id: "B",
      agentName: "build",
      prompt: "Design and implement backend components based on research A",
      description: "Backend work",
      dependencies: ["A"],
    },
    {
      id: "C",
      agentName: "build",
      prompt: "Design and implement frontend components based on research A",
      description: "Frontend work",
      dependencies: ["A"],
    },
    {
      id: "D",
      agentName: "plan",
      prompt: "Integrate backend B and frontend C, perform end-to-end testing",
      description: "Integration",
      dependencies: ["B", "C"],
    },
  ]

  return DAG.buildPlan(tasks)
}

/**
 * Example 6: Error Handling - Skip Dependent Tasks on Failure
 *
 * Demonstrates how to handle failures gracefully by skipping dependent tasks.
 */
export function example6_ErrorHandlingPlan(): DAG.Plan {
  const tasks: DAG.Task[] = [
    {
      id: "critical_setup",
      agentName: "build",
      prompt: "Set up critical infrastructure (this might fail)",
      description: "Critical setup",
      dependencies: [],
    },
    {
      id: "optional_optimization",
      agentName: "build",
      prompt: "Optimize infrastructure (optional enhancement)",
      description: "Optional optimization",
      dependencies: ["critical_setup"], // Will be skipped if critical_setup fails
    },
    {
      id: "deploy_application",
      agentName: "build",
      prompt: "Deploy application to infrastructure",
      description: "Deployment",
      dependencies: ["critical_setup"], // Will be skipped if critical_setup fails
    },
  ]

  return DAG.buildPlan(tasks)
}

/**
 * Helper: Print example plan visualization
 */
export function printExample(exampleName: string, plan: DAG.Plan): void {
  console.log(`\n${"=".repeat(80)}`)
  console.log(`  ${exampleName}`)
  console.log("=".repeat(80))
  console.log(DAG.visualizePlan(plan))
  console.log("=".repeat(80))
}

/**
 * Run all examples (for demonstration)
 */
export function runAllExamples(): void {
  printExample("Example 1: Linear Workflow", example1_LinearWorkflow())
  printExample("Example 2: Parallel Research", example2_ParallelResearch())
  printExample("Example 3: Full-Stack Feature", example3_FullStackFeature())
  printExample("Example 4: Widget Creation", example4_WidgetCreation())
  printExample("Example 5: Diamond Pattern", example5_DiamondPattern())
  printExample("Example 6: Error Handling", example6_ErrorHandlingPlan())
}

// Uncomment to run examples:
// runAllExamples()
