/**
 * Initialization Module
 *
 * Handles automatic initialization of snow-flow project files
 * including documentation (CLAUDE.md, AGENTS.md) and configuration.
 */

export {
  initializeBaseDocumentation,
  forceRegenerateDocumentation,
  hasCurrentBaseVersion,
  getBaseDocumentationContent,
} from "./documentation"
