import { Config } from "../config/config"
import path from "path"
import z from "zod/v4"
import { Bus } from "../bus"

export namespace Skill {
  /**
   * Skill events for UI feedback
   */
  export const Event = {
    Matched: Bus.event(
      "skill.matched",
      z.object({
        sessionID: z.string(),
        skills: z.array(
          z.object({
            name: z.string(),
            tools: z.array(z.string()).optional(),
          })
        ),
        toolsEnabled: z.array(z.string()),
      })
    ),
  }
  /**
   * Match a user message against available skills based on trigger phrases in descriptions.
   * Returns the first matching skill or null if no match found.
   */
  export async function match(userMessage: string): Promise<Config.Skill | null> {
    const config = await Config.get()
    const skills = config.skill ?? {}

    const msgLower = userMessage.toLowerCase()

    for (const [_name, skill] of Object.entries(skills)) {
      const triggers = extractTriggers(skill.description)

      if (triggers.some((t) => matchTrigger(msgLower, t.toLowerCase()))) {
        return skill
      }
    }
    return null
  }

  /**
   * Match all skills that apply to a user message.
   * Returns an array of matching skills.
   */
  export async function matchAll(userMessage: string): Promise<Config.Skill[]> {
    const config = await Config.get()
    const skills = config.skill ?? {}

    const msgLower = userMessage.toLowerCase()
    const matched: Config.Skill[] = []

    for (const [_name, skill] of Object.entries(skills)) {
      const triggers = extractTriggers(skill.description)

      if (triggers.some((t) => matchTrigger(msgLower, t.toLowerCase()))) {
        matched.push(skill)
      }
    }
    return matched
  }

  /**
   * Inject a skill's content into the context as a tagged block.
   */
  export function inject(skill: Config.Skill): string {
    return [`<skill name="${skill.name}">`, skill.content, `</skill>`].join("\n")
  }

  /**
   * Inject multiple skills into the context.
   */
  export function injectAll(skills: Config.Skill[]): string {
    return skills.map(inject).join("\n\n")
  }

  /**
   * Extract trigger phrases from a skill description.
   * Trigger phrases are quoted strings in the description, e.g., "create a widget".
   */
  function extractTriggers(description: string): string[] {
    const matches = description.match(/"([^"]+)"/g) || []
    return matches.map((m) => m.replace(/"/g, ""))
  }

  /**
   * Match a trigger against a message with word boundary support.
   * Short triggers (<=3 chars) require word boundaries to prevent false positives
   * like "PA" matching in "oppakken".
   */
  function matchTrigger(message: string, trigger: string): boolean {
    // For short triggers, use word boundary regex to avoid false positives
    if (trigger.length <= 3) {
      // Escape special regex characters in trigger
      const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(`\\b${escaped}\\b`, "i")
      return regex.test(message)
    }
    // For longer triggers, simple includes is fine
    return message.includes(trigger)
  }

  /**
   * Load additional resources from a skill's subdirectories (references, examples, scripts).
   */
  export async function loadResources(
    skill: Config.Skill,
    resourceType: "references" | "examples" | "scripts",
  ): Promise<string[]> {
    const resourceDir = path.join(skill.path, resourceType)
    const files: string[] = []

    try {
      for await (const item of new Bun.Glob("**/*.md").scan({
        cwd: resourceDir,
        absolute: true,
      })) {
        files.push(await Bun.file(item).text())
      }
    } catch {
      // Directory doesn't exist or isn't readable
    }

    return files
  }

  /**
   * Get a skill by name.
   */
  export async function get(name: string): Promise<Config.Skill | undefined> {
    const config = await Config.get()
    return config.skill?.[name]
  }

  /**
   * List all available skills.
   */
  export async function list(): Promise<Record<string, Config.Skill>> {
    const config = await Config.get()
    return config.skill ?? {}
  }
}
