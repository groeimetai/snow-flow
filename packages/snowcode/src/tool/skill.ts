import z from "zod/v4"
import { Tool } from "./tool"
import { Config } from "../config/config"
import { Skill } from "../skill"
import { Bus } from "../bus"
import { ToolSearch } from "./tool-search"

const DESCRIPTION = `Execute a skill to get specialized domain knowledge for the current task.

## When to Use This Tool

Use this tool when the user's request matches a skill's domain. Skills provide specialized knowledge and guidance for specific development contexts.

## How to Invoke

- Use the skill name from the available skills list
- The skill content will be returned with specialized guidance
- Associated tools will be highlighted for the task

## Examples

1. User asks about update sets or change tracking:
   \`skill: "update-set-workflow"\`

2. User asks about server-side JavaScript in ServiceNow:
   \`skill: "es5-compliance"\`

3. User asks about Performance Analytics or KPIs:
   \`skill: "performance-analytics"\`

## Important

- Only use skills listed in the Available skills section of the system prompt
- Choose the skill based on semantic relevance to the user's intent
- Multiple skills can be invoked if the task spans multiple domains
`

export const SkillTool = Tool.define("Skill", {
  description: DESCRIPTION,
  parameters: z.object({
    skill: z
      .string()
      .describe('The skill name to activate. E.g., "update-set-workflow", "es5-compliance"'),
  }),
  async execute(params, ctx) {
    const config = await Config.get()
    const skills = config.skill ?? {}

    const skill = skills[params.skill]
    if (!skill) {
      const available = Object.keys(skills)
      return {
        title: `Skill not found: ${params.skill}`,
        output: `Skill "${params.skill}" not found.\n\nAvailable skills:\n${available.map((s) => `- ${s}`).join("\n")}`,
        metadata: {
          error: true,
          available,
        },
      }
    }

    // Emit skill matched event for TUI feedback
    await Bus.publish(
      Skill.Event.Matched,
      {
        sessionID: ctx.sessionID,
        skills: [
          {
            name: skill.name,
            tools: skill.tools,
          },
        ],
        toolsEnabled: skill.tools ?? [],
      },
      { broadcast: true },
    )

    // Enable skill tools for this session so they become available
    if (skill.tools && skill.tools.length > 0) {
      await ToolSearch.enableTools(ctx.sessionID, skill.tools)
    }

    // Build the skill content for the model
    const content = Skill.inject(skill)
    const toolsInfo =
      skill.tools && skill.tools.length > 0
        ? `\n\n**Recommended tools for this skill:**\n${skill.tools.map((t) => `- ${t}`).join("\n")}`
        : ""

    // Create a clean summary for TUI display
    const toolsList = skill.tools && skill.tools.length > 0
      ? skill.tools.slice(0, 4).join(", ") + (skill.tools.length > 4 ? ` (+${skill.tools.length - 4} more)` : "")
      : "none"

    const displaySummary = [
      `✨ Skill loaded: ${skill.name}`,
      `   Tools: ${toolsList}`,
      `   Content: ${skill.content.split("\n").length} lines of specialized guidance`,
    ].join("\n")

    // Use special marker that TUI can detect for truncation
    // The full content goes after the marker for model context
    const fullOutput = [
      displaySummary,
      ``,
      `<skill-content hidden-from-display="true">`,
      content + toolsInfo,
      `</skill-content>`,
    ].join("\n")

    return {
      title: `✨ ${skill.name}`,
      output: fullOutput,
      metadata: {
        skill: skill.name,
        tools: skill.tools ?? [],
        contentLines: skill.content.split("\n").length,
      },
    }
  },
})
