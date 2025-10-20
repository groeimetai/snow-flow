#!/usr/bin/env node
"use strict";
/**
 * MCP Tool Registry Mapper
 *
 * Solves Issue #2: Tool Registry Mapping Failures
 * Provides robust tool name resolution between different MCP providers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPToolRegistry = void 0;
exports.getToolRegistry = getToolRegistry;
exports.resolveToolName = resolveToolName;
exports.isValidTool = isValidTool;
exports.suggestTools = suggestTools;
const logger_js_1 = require("./logger.js");
class MCPToolRegistry {
    constructor() {
        this.toolMappings = new Map();
        this.logger = new logger_js_1.Logger('MCPToolRegistry');
        this.initializeDefaultMappings();
    }
    /**
     * Initialize default tool mappings
     */
    initializeDefaultMappings() {
        // ServiceNow table schema discovery - common confusion point
        this.registerTool({
            canonicalName: 'table_schema_discovery',
            aliases: [
                'mcp__servicenow-operations__snow_table_schema_discovery',
                'snow_table_schema_discovery',
                'table_schema',
                'schema_discovery'
            ],
            provider: 'servicenow-platform-development',
            actualTool: 'mcp__servicenow-platform-development__snow_table_schema_discovery',
            description: 'Comprehensive table schema discovery'
        });
        // Flow deployment tools
        this.registerTool({
            canonicalName: 'deploy_flow',
            aliases: [
                'mcp__servicenow-deployment__snow_deploy_flow',
                'snow_deploy_flow',
                'deploy_flow',
                'flow_deploy'
            ],
            provider: 'servicenow-deployment',
            actualTool: 'mcp__servicenow-deployment__snow_deploy',
            description: 'Deploy flows to ServiceNow'
        });
        // Update Set management
        this.registerTool({
            canonicalName: 'update_set_create',
            aliases: [
                'mcp__servicenow-update-set__snow_update_set_create',
                'snow_update_set_create',
                'create_update_set',
                'update_set_new'
            ],
            provider: 'servicenow-update-set',
            actualTool: 'mcp__servicenow-update-set__snow_update_set_create',
            description: 'Create Update Sets'
        });
        // Authentication diagnostics
        this.registerTool({
            canonicalName: 'auth_diagnostics',
            aliases: [
                'mcp__servicenow-deployment__snow_auth_diagnostics',
                'snow_auth_diagnostics',
                'auth_check',
                'permission_check'
            ],
            provider: 'servicenow-deployment',
            actualTool: 'mcp__servicenow-deployment__snow_auth_diagnostics',
            description: 'Authentication and permission diagnostics'
        });
        // Local Development Sync Tools
        this.registerTool({
            canonicalName: 'pull_artifact',
            aliases: [
                'mcp__servicenow-local-development__snow_pull_artifact',
                'snow_pull_artifact',
                'pull_artifact',
                'sync_artifact',
                'local_sync'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_pull_artifact',
            description: 'Pull any ServiceNow artifact to local files for editing'
        });
        this.registerTool({
            canonicalName: 'push_artifact',
            aliases: [
                'mcp__servicenow-local-development__snow_push_artifact',
                'snow_push_artifact',
                'push_artifact',
                'sync_back'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_push_artifact',
            description: 'Push local artifact changes back to ServiceNow'
        });
        this.registerTool({
            canonicalName: 'validate_artifact_coherence',
            aliases: [
                'mcp__servicenow-local-development__snow_validate_artifact_coherence',
                'snow_validate_artifact_coherence',
                'validate_coherence',
                'check_coherence'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_validate_artifact_coherence',
            description: 'Validate artifact coherence and relationships'
        });
        this.registerTool({
            canonicalName: 'list_supported_artifacts',
            aliases: [
                'mcp__servicenow-local-development__snow_list_supported_artifacts',
                'snow_list_supported_artifacts',
                'supported_artifacts',
                'artifact_types'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_list_supported_artifacts',
            description: 'List all supported artifact types for local sync'
        });
        this.registerTool({
            canonicalName: 'sync_status',
            aliases: [
                'mcp__servicenow-local-development__snow_sync_status',
                'snow_sync_status',
                'local_status',
                'sync_check'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_sync_status',
            description: 'Check sync status of local artifacts'
        });
        this.registerTool({
            canonicalName: 'sync_cleanup',
            aliases: [
                'mcp__servicenow-local-development__snow_sync_cleanup',
                'snow_sync_cleanup',
                'cleanup_local',
                'remove_local'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_sync_cleanup',
            description: 'Clean up local artifact files'
        });
        this.registerTool({
            canonicalName: 'convert_to_es5',
            aliases: [
                'mcp__servicenow-local-development__snow_convert_to_es5',
                'snow_convert_to_es5',
                'es5_convert',
                'transpile_es5'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_convert_to_es5',
            description: 'Convert modern JavaScript to ES5 for ServiceNow'
        });
        // Legacy widget/script tools (backward compatibility)
        this.registerTool({
            canonicalName: 'pull_widget',
            aliases: [
                'mcp__servicenow-local-development__snow_pull_widget',
                'snow_pull_widget',
                'pull_widget'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_pull_widget',
            description: 'Pull widget to local files (legacy - use pull_artifact)'
        });
        this.registerTool({
            canonicalName: 'push_widget',
            aliases: [
                'mcp__servicenow-local-development__snow_push_widget',
                'snow_push_widget',
                'push_widget'
            ],
            provider: 'servicenow-local-development',
            actualTool: 'mcp__servicenow-local-development__snow_push_widget',
            description: 'Push widget changes (legacy - use push_artifact)'
        });
        // Catalog item management
        this.registerTool({
            canonicalName: 'catalog_item_manager',
            aliases: [
                'mcp__servicenow-operations__snow_catalog_item_manager',
                'snow_catalog_item_manager',
                'catalog_manager',
                'manage_catalog'
            ],
            provider: 'servicenow-operations',
            actualTool: 'mcp__servicenow-operations__snow_catalog_item_manager',
            description: 'Manage service catalog items'
        });
        // Platform development tools
        this.registerTool({
            canonicalName: 'discover_table_fields',
            aliases: [
                'mcp__servicenow-platform-development__snow_discover_table_fields',
                'snow_discover_table_fields',
                'discover_fields',
                'table_fields'
            ],
            provider: 'servicenow-platform-development',
            actualTool: 'mcp__servicenow-platform-development__snow_discover_table_fields',
            description: 'Discover table fields'
        });
        // Add more mappings as needed...
    }
    /**
     * Register a tool mapping
     */
    registerTool(mapping) {
        // Register by canonical name
        this.toolMappings.set(mapping.canonicalName, mapping);
        // Register by actual tool name
        this.toolMappings.set(mapping.actualTool, mapping);
        // Register by all aliases
        mapping.aliases.forEach(alias => {
            this.toolMappings.set(alias.toLowerCase(), mapping);
        });
        this.logger.debug(`Registered tool: ${mapping.canonicalName} with ${mapping.aliases.length} aliases`);
    }
    /**
     * Resolve a tool name to its actual MCP tool
     */
    resolveTool(toolName) {
        // Try exact match first
        let mapping = this.toolMappings.get(toolName);
        // Try lowercase match
        if (!mapping) {
            mapping = this.toolMappings.get(toolName.toLowerCase());
        }
        // Try partial matches
        if (!mapping) {
            const searchKey = toolName.toLowerCase();
            for (const [key, value] of this.toolMappings.entries()) {
                if (key.includes(searchKey) || searchKey.includes(key)) {
                    mapping = value;
                    break;
                }
            }
        }
        if (mapping) {
            this.logger.debug(`Resolved '${toolName}' to '${mapping.actualTool}'`);
            return mapping.actualTool;
        }
        this.logger.warn(`Could not resolve tool: ${toolName}`);
        return null;
    }
    /**
     * Get all tools for a provider
     */
    getProviderTools(provider) {
        const tools = [];
        const seen = new Set();
        for (const mapping of this.toolMappings.values()) {
            if (mapping.provider === provider && !seen.has(mapping.canonicalName)) {
                tools.push(mapping);
                seen.add(mapping.canonicalName);
            }
        }
        return tools;
    }
    /**
     * Search tools by keyword
     */
    searchTools(keyword) {
        const results = [];
        const seen = new Set();
        const searchKey = keyword.toLowerCase();
        for (const mapping of this.toolMappings.values()) {
            if (seen.has(mapping.canonicalName))
                continue;
            if (mapping.canonicalName.includes(searchKey) ||
                mapping.description?.toLowerCase().includes(searchKey) ||
                mapping.aliases.some(alias => alias.toLowerCase().includes(searchKey))) {
                results.push(mapping);
                seen.add(mapping.canonicalName);
            }
        }
        return results;
    }
    /**
     * Check if a tool exists
     */
    toolExists(toolName) {
        return this.resolveTool(toolName) !== null;
    }
    /**
     * Get tool info
     */
    getToolInfo(toolName) {
        const resolved = this.resolveTool(toolName);
        if (!resolved)
            return null;
        return this.toolMappings.get(resolved) || null;
    }
    /**
     * Export all mappings for documentation
     */
    exportMappings() {
        const exports = {};
        const seen = new Set();
        for (const mapping of this.toolMappings.values()) {
            if (!seen.has(mapping.canonicalName)) {
                exports[mapping.canonicalName] = mapping;
                seen.add(mapping.canonicalName);
            }
        }
        return exports;
    }
}
exports.MCPToolRegistry = MCPToolRegistry;
// Singleton instance
let registryInstance = null;
/**
 * Get or create registry instance
 */
function getToolRegistry() {
    if (!registryInstance) {
        registryInstance = new MCPToolRegistry();
    }
    return registryInstance;
}
/**
 * Helper function to resolve tool names
 */
function resolveToolName(toolName) {
    const registry = getToolRegistry();
    return registry.resolveTool(toolName) || toolName;
}
/**
 * Helper to check if tool exists
 */
function isValidTool(toolName) {
    const registry = getToolRegistry();
    return registry.toolExists(toolName);
}
/**
 * Helper to get tool suggestions
 */
function suggestTools(partial) {
    const registry = getToolRegistry();
    return registry.searchTools(partial);
}
// Export types and default instance
exports.default = MCPToolRegistry;
//# sourceMappingURL=mcp-tool-registry.js.map