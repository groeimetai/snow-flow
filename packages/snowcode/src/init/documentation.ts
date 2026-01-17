/**
 * Documentation Initialization Module
 *
 * Automatically generates AGENTS.md in the user's working directory
 * with base ServiceNow instructions when snow-flow starts.
 *
 * This ensures the AI agent has proper context about ServiceNow development
 * guidelines and available MCP tools from the very first interaction.
 *
 * MODULAR DESIGN:
 * - AGENTS.md is the generic file that works for ALL LLMs (Claude, GPT, Gemini, etc.)
 * - The system checks for files in order: AGENTS.md → CLAUDE.md → CONTEXT.md
 * - Users can optionally create CLAUDE.md for Claude-specific instructions
 *
 * After enterprise authentication, additional enterprise-specific instructions
 * are appended by updateDocumentationWithEnterprise() in auth.ts/auth-routes.ts.
 */

import path from "path"
import { Log } from "../util/log"

// Import the base documentation template (as .txt for TypeScript/Bun compatibility)
import BASE_DOCUMENTATION from "../../../../templates/base-agents.txt"

/**
 * Version marker for base documentation
 * Used to detect if documentation needs updating
 */
const DOCUMENTATION_VERSION_MARKER = "<!-- Snow-Flow Base Documentation v1.0 -->"

/**
 * Initialize base documentation file in the user's working directory.
 *
 * Creates AGENTS.md with ServiceNow development guidelines if it doesn't exist.
 * AGENTS.md is the generic file that works for all LLMs.
 *
 * This is called automatically during snow-flow startup via InstanceBootstrap.
 *
 * @param projectRoot - The working directory (defaults to process.cwd())
 */
export async function initializeBaseDocumentation(projectRoot?: string): Promise<void> {
  const cwd = projectRoot || process.cwd()
  const agentsMdPath = path.join(cwd, "AGENTS.md")

  try {
    // Only create AGENTS.md - the generic file that works for all LLMs
    // Users can optionally create CLAUDE.md for Claude-specific instructions
    await ensureDocumentationFile(agentsMdPath, "AGENTS.md")

    Log.Default.info("documentation", { message: "Base documentation initialized" })
  } catch (error: any) {
    // Don't fail startup if documentation init fails - just log it
    Log.Default.warn("documentation", {
      message: "Failed to initialize documentation",
      error: error.message,
    })
  }
}

/**
 * Ensure a documentation file exists with the base content.
 * Only creates the file if it doesn't exist.
 * Does NOT overwrite existing files to preserve enterprise additions.
 */
async function ensureDocumentationFile(filePath: string, fileName: string): Promise<void> {
  const file = Bun.file(filePath)

  if (await file.exists()) {
    // File exists - don't overwrite to preserve enterprise additions
    Log.Default.debug("documentation", {
      file: fileName,
      action: "exists",
      message: "Keeping existing documentation",
    })
    return
  }

  // File doesn't exist - create it with base content
  const content = addVersionMarker(BASE_DOCUMENTATION)
  await Bun.write(filePath, content)

  Log.Default.info("documentation", {
    file: fileName,
    action: "created",
    message: "Created base documentation file",
  })
}

/**
 * Add version marker to documentation content for future version tracking.
 */
function addVersionMarker(content: string): string {
  // Add version marker at the end (hidden in rendered markdown)
  return `${content.trim()}\n\n${DOCUMENTATION_VERSION_MARKER}\n`
}

/**
 * Check if a documentation file has the current base version.
 * This can be used in the future to offer updates to users.
 */
export async function hasCurrentBaseVersion(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath)
    if (!(await file.exists())) return false

    const content = await file.text()
    return content.includes(DOCUMENTATION_VERSION_MARKER)
  } catch {
    return false
  }
}

/**
 * Force regenerate documentation (for manual init command).
 * This will overwrite the existing AGENTS.md file.
 */
export async function forceRegenerateDocumentation(projectRoot?: string): Promise<void> {
  const cwd = projectRoot || process.cwd()
  const agentsMdPath = path.join(cwd, "AGENTS.md")

  const content = addVersionMarker(BASE_DOCUMENTATION)

  await Bun.write(agentsMdPath, content)

  Log.Default.info("documentation", {
    action: "regenerated",
    message: "AGENTS.md regenerated",
  })
}

/**
 * Get the base documentation content for programmatic use.
 */
export function getBaseDocumentationContent(): string {
  return BASE_DOCUMENTATION
}

/**
 * Restore enterprise documentation if enterprise auth is active.
 *
 * This is called during bootstrap to ensure enterprise documentation
 * persists across restarts. It checks if enterprise config exists with
 * enabledServices and applies enterprise docs to AGENTS.md if needed.
 *
 * @param projectRoot - The working directory (defaults to process.cwd())
 */
export async function restoreEnterpriseDocumentation(projectRoot?: string): Promise<void> {
  const cwd = projectRoot || process.cwd()
  const agentsMdPath = path.join(cwd, "AGENTS.md")
  const os = await import("os")

  try {
    // Check enterprise config
    const enterpriseConfigPath = path.join(os.homedir(), ".snow-code", "enterprise.json")
    const configFile = Bun.file(enterpriseConfigPath)

    if (!(await configFile.exists())) {
      // No enterprise config - nothing to restore
      return
    }

    const config = await configFile.json()

    // Need token to restore docs (enabledServices can be empty for base enterprise features)
    if (!config.token) {
      return
    }

    // Get enabledServices or default to empty array
    const enabledServices = config.enabledServices || []

    // Check if AGENTS.md exists
    const agentsFile = Bun.file(agentsMdPath)
    if (!(await agentsFile.exists())) {
      // No AGENTS.md - will be created by initializeBaseDocumentation
      // Enterprise docs will need to be added on next auth/sync
      return
    }

    const content = await agentsFile.text()

    // Check if enterprise docs already present
    if (content.includes("ENTERPRISE INTEGRATIONS - AUTONOMOUS DEVELOPMENT WORKFLOW")) {
      // Already has enterprise docs - no restore needed
      return
    }

    // Generate and apply enterprise docs
    const { generateEnterpriseInstructions, generateStakeholderDocumentation } =
      await import("../cli/cmd/enterprise-docs-generator.js")

    // For stakeholders, replace with read-only documentation
    if (config.role === 'stakeholder') {
      await Bun.write(agentsMdPath, generateStakeholderDocumentation())
      Log.Default.info("documentation", { message: "Restored stakeholder documentation" })
      return
    }

    // Generate comprehensive enterprise documentation
    const enterpriseDocSection = generateEnterpriseInstructions(enabledServices)

    // Find insertion point (before "## Conclusion" or at end)
    let insertionPoint = content.lastIndexOf("## Conclusion")
    if (insertionPoint === -1) {
      insertionPoint = content.lastIndexOf("---")
    }
    if (insertionPoint === -1) {
      insertionPoint = content.length
    }

    const updatedContent =
      content.slice(0, insertionPoint) + enterpriseDocSection + "\n\n" + content.slice(insertionPoint)

    await Bun.write(agentsMdPath, updatedContent)
    Log.Default.info("documentation", { message: "Restored enterprise documentation" })

  } catch (error: any) {
    // Don't fail startup if enterprise docs restore fails - just log it
    Log.Default.warn("documentation", {
      message: "Failed to restore enterprise documentation",
      error: error.message,
    })
  }
}
