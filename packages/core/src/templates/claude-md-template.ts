/**
 * CLAUDE.md / AGENTS.md Template
 *
 * This file re-exports the shared base-agents.txt template from the root templates folder.
 * This ensures a single source of truth for all agent instructions across packages.
 */

// Import the shared template from root templates folder
import TEMPLATE_CONTENT from "../../../../templates/base-agents.txt";

export const CLAUDE_MD_TEMPLATE = TEMPLATE_CONTENT;

export const CLAUDE_MD_TEMPLATE_VERSION = '10.0.0-SHARED-TEMPLATE';
