#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Local Development MCP Server
 *
 * Bridges ServiceNow artifacts with Claude Code's native file tools
 * by creating temporary local files that can be edited with full
 * Claude Code capabilities, then synced back to ServiceNow.
 *
 * THIS IS THE KEY TO POWERFUL SERVICENOW DEVELOPMENT!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowLocalDevelopmentMCP = void 0;
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const enhanced_base_mcp_server_js_1 = require("./shared/enhanced-base-mcp-server.js");
const artifact_local_sync_js_1 = require("../utils/artifact-local-sync.js");
const artifact_registry_js_1 = require("../utils/artifact-sync/artifact-registry.js");
class ServiceNowLocalDevelopmentMCP extends enhanced_base_mcp_server_js_1.EnhancedBaseMCPServer {
    constructor() {
        super('servicenow-local-development', '1.0.0');
        // Initialize after client is available
        this.setupSyncManager();
        this.setupHandlers();
    }
    setupSyncManager() {
        // Initialize sync manager with the client from enhanced base server
        this.syncManager = new artifact_local_sync_js_1.ArtifactLocalSync(this.client);
        this.logger.info('🔧 Local sync manager initialized');
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'snow_pull_artifact',
                    description: `Pull ANY ServiceNow artifact to local files for editing with Claude Code's native tools. Automatically detects the artifact type and creates appropriate files based on the artifact registry. Supports: ${(0, artifact_registry_js_1.getSupportedTables)().map(t => (0, artifact_registry_js_1.getTableDisplayName)(t)).join(', ')}`,
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: {
                                type: 'string',
                                description: 'Artifact sys_id to pull'
                            },
                            table: {
                                type: 'string',
                                description: 'Optional: Specify table name if known for faster processing',
                                enum: (0, artifact_registry_js_1.getSupportedTables)()
                            }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_push_artifact',
                    description: 'Push local artifact changes back to ServiceNow with validation and coherence checking',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: {
                                type: 'string',
                                description: 'Artifact sys_id to push back'
                            },
                            force: {
                                type: 'boolean',
                                description: 'Force push despite validation warnings',
                                default: false
                            }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_validate_artifact_coherence',
                    description: 'Validate coherence and relationships between artifact components (e.g., widget HTML-client-server relationships)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: {
                                type: 'string',
                                description: 'Artifact sys_id to validate'
                            }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_list_supported_artifacts',
                    description: 'List all supported artifact types for local synchronization',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        additionalProperties: false
                    }
                },
                {
                    name: 'snow_sync_status',
                    description: 'Check sync status of local artifacts',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: {
                                type: 'string',
                                description: 'Optional: Check specific artifact, or all if omitted'
                            }
                        }
                    }
                },
                {
                    name: 'snow_sync_cleanup',
                    description: 'Clean up local artifact files after successful sync',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: {
                                type: 'string',
                                description: 'Artifact sys_id to clean up'
                            },
                            force: {
                                type: 'boolean',
                                description: 'Force cleanup even with unsaved changes',
                                default: false
                            }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_convert_to_es5',
                    description: 'Convert modern JavaScript code to ES5 for ServiceNow compatibility',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            code: {
                                type: 'string',
                                description: 'JavaScript code to convert to ES5'
                            },
                            context: {
                                type: 'string',
                                description: 'Context: server_script, client_script, business_rule, etc.',
                                enum: ['server_script', 'client_script', 'business_rule', 'script_include', 'ui_script']
                            }
                        },
                        required: ['code']
                    }
                },
                {
                    name: 'snow_debug_widget_fetch',
                    description: 'Debug widget fetching to diagnose API issues',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: {
                                type: 'string',
                                description: 'Widget sys_id to debug'
                            }
                        },
                        required: ['sys_id']
                    }
                },
            ]
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            // Add timeout protection for MCP tool execution
            const TOOL_TIMEOUT = 10000; // 10 seconds max per tool call
            try {
                this.logger.info(`🔧 Executing tool: ${name}`, args);
                // Create timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Tool ${name} timed out after ${TOOL_TIMEOUT / 1000}s`)), TOOL_TIMEOUT);
                });
                // Execute tool with timeout protection
                const toolPromise = (async () => {
                    let result;
                    switch (name) {
                        case 'snow_pull_artifact':
                            result = await this.pullArtifact(args);
                            break;
                        case 'snow_push_artifact':
                            result = await this.pushArtifact(args);
                            break;
                        case 'snow_validate_artifact_coherence':
                            result = await this.validateArtifactCoherence(args);
                            break;
                        case 'snow_sync_status':
                            result = await this.getSyncStatus(args);
                            break;
                        case 'snow_list_supported_artifacts':
                            result = await this.listSupportedArtifacts(args);
                            break;
                        case 'snow_sync_cleanup':
                            result = await this.syncCleanup(args);
                            break;
                        case 'snow_convert_to_es5':
                            result = await this.convertToES5(args);
                            break;
                        case 'snow_debug_widget_fetch':
                            result = await this.debugWidgetFetch(args);
                            break;
                        default:
                            throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                    }
                    return result;
                })();
                // Race between tool execution and timeout
                const result = await Promise.race([toolPromise, timeoutPromise]);
                this.logger.info(`✅ Tool ${name} completed successfully`);
                return {
                    content: result.content
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`❌ Tool ${name} failed: ${errorMessage}`);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error executing ${name}: ${errorMessage}`
                        }
                    ]
                };
            }
        });
    }
    async pullArtifact(args) {
        const { sys_id, table } = args;
        const startTime = Date.now();
        // Add timeout for pull operations (must be longer than pullArtifactBySysId's 30s timeout)
        const PULL_TIMEOUT = 35000; // 35 seconds for pull operations (allows 30s for detection + 5s buffer)
        try {
            const pullPromise = (async () => {
                let artifact;
                if (table) {
                    // Use specified table
                    artifact = await this.syncManager.pullArtifact(table, sys_id);
                }
                else {
                    // Auto-detect table
                    artifact = await this.syncManager.pullArtifactBySysId(sys_id);
                }
                return artifact;
            })();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Pull operation timed out after ${PULL_TIMEOUT / 1000}s`)), PULL_TIMEOUT);
            });
            const artifact = await Promise.race([pullPromise, timeoutPromise]);
            const duration = Date.now() - startTime;
            // Log artifact sync operation
            await this.getAuditLogger().logArtifactSync('pull', artifact.tableName, sys_id, artifact.name, artifact.files.length, duration, true);
            // Special logging for widgets
            if (artifact.tableName === 'sp_widget') {
                await this.getAuditLogger().logWidgetOperation('pull', sys_id, artifact.name, duration, true);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `✅ Successfully pulled ${artifact.type} to local files at: ${artifact.localPath}\n\n📁 Files created:\n${artifact.files.map(f => `  - ${f.filename} (${f.type})`).join('\n')}\n\n💡 You can now use Claude Code's native tools to edit these files!`
                    }
                ]
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Log failed operation
            await this.getAuditLogger().logArtifactSync('pull', table || 'unknown', sys_id, undefined, 0, duration, false);
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Failed to pull artifact: ${errorMessage}`
                    }
                ]
            };
        }
    }
    async pushArtifact(args) {
        const { sys_id, force = false } = args;
        const startTime = Date.now();
        try {
            const success = await this.syncManager.pushArtifact(sys_id);
            const duration = Date.now() - startTime;
            // Get artifact info for logging
            const localArtifacts = this.syncManager.listLocalArtifacts();
            const artifact = localArtifacts.find(a => a.sys_id === sys_id);
            if (success) {
                // Log successful push
                await this.getAuditLogger().logArtifactSync('push', artifact?.tableName || 'unknown', sys_id, artifact?.name, artifact?.files.length, duration, true);
                // Special logging for widgets
                if (artifact?.tableName === 'sp_widget') {
                    await this.getAuditLogger().logWidgetOperation('push', sys_id, artifact.name, duration, true);
                }
            }
            else {
                // Log failed push
                await this.getAuditLogger().logArtifactSync('push', artifact?.tableName || 'unknown', sys_id, artifact?.name, artifact?.files.length, duration, false);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: success
                            ? `✅ Successfully pushed changes back to ServiceNow!`
                            : `❌ Failed to push changes. Check logs for details.`
                    }
                ]
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Log failed operation
            await this.getAuditLogger().logArtifactSync('push', 'unknown', sys_id, undefined, 0, duration, false);
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Failed to push artifact: ${errorMessage}`
                    }
                ]
            };
        }
    }
    async getSyncStatus(args) {
        const { sys_id } = args;
        if (sys_id) {
            const status = this.syncManager.getSyncStatus(sys_id);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Sync status for ${sys_id}: ${status}`
                    }
                ]
            };
        }
        else {
            const artifacts = this.syncManager.listLocalArtifacts();
            const statusText = artifacts.length > 0
                ? artifacts.map(a => `${a.name} (${a.sys_id}): ${a.syncStatus}`).join('\n')
                : 'No local artifacts found';
            return {
                content: [
                    {
                        type: 'text',
                        text: `Local artifacts status:\n${statusText}`
                    }
                ]
            };
        }
    }
    async listSupportedArtifacts(args) {
        const supportedTypes = (0, artifact_registry_js_1.getSupportedTables)().map(table => {
            const config = artifact_registry_js_1.ARTIFACT_REGISTRY[table];
            return {
                table,
                displayName: config?.displayName || table,
                folderName: config?.folderName || table,
                fields: config?.fieldMappings.length || 0,
                hasCoherence: (config?.coherenceRules?.length || 0) > 0,
                requiresES5: config?.fieldMappings.some(fm => fm.validateES5) || false
            };
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `Supported ServiceNow artifact types for local sync:\n\n${supportedTypes.map(t => `📦 ${t.displayName} (${t.table})\n   └── ${t.fields} fields, ES5: ${t.requiresES5 ? '✅' : '❌'}, Coherence: ${t.hasCoherence ? '✅' : '❌'}`).join('\n\n')}\n\nTotal: ${supportedTypes.length} artifact types supported`
                }
            ]
        };
    }
    async validateArtifactCoherence(args) {
        const { sys_id } = args;
        try {
            const results = await this.syncManager.validateArtifactCoherence(sys_id);
            const hasErrors = results.some(r => !r.valid);
            return {
                content: [
                    {
                        type: 'text',
                        text: hasErrors
                            ? `⚠️ Coherence validation found issues:\n${results.filter(r => !r.valid).map(r => r.errors.join(', ')).join('\n')}`
                            : `✅ Artifact coherence validation passed!`
                    }
                ]
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Failed to validate coherence: ${errorMessage}`
                    }
                ]
            };
        }
    }
    async syncCleanup(args) {
        const { sys_id, force = false } = args;
        try {
            await this.syncManager.cleanup(sys_id, force);
            return {
                content: [
                    {
                        type: 'text',
                        text: `✅ Successfully cleaned up local files for ${sys_id}`
                    }
                ]
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Failed to cleanup: ${errorMessage}`
                    }
                ]
            };
        }
    }
    async convertToES5(args) {
        const { code, context = 'server_script' } = args;
        // Basic ES5 conversion - in a real implementation this would be more sophisticated
        let es5Code = code
            .replace(/\bconst\s+/g, 'var ')
            .replace(/\blet\s+/g, 'var ')
            .replace(/(\w+)\s*=>\s*{/g, 'function($1) {')
            .replace(/(\w+)\s*=>\s*([^{])/g, 'function($1) { return $2; }')
            .replace(/`([^`]*)`/g, (match, content) => {
            return '"' + content.replace(/\$\{([^}]+)\}/g, '" + $1 + "') + '"';
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Converted to ES5 (basic conversion):\n\n\`\`\`javascript\n${es5Code}\n\`\`\`\n\n⚠️ Note: This is a basic conversion. Please review and test the code.`
                }
            ]
        };
    }
    async debugWidgetFetch(args) {
        const { sys_id } = args;
        // Debug operations get extra time
        const DEBUG_TIMEOUT = 20000; // 20 seconds for debug operations
        try {
            const debugPromise = this.syncManager['smartFetcher'].debugFetchWidget(sys_id);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Debug operation timed out after ${DEBUG_TIMEOUT / 1000}s`)), DEBUG_TIMEOUT);
            });
            const debugResults = await Promise.race([debugPromise, timeoutPromise]);
            let summaryText = `🔍 Debug Results for Widget ${sys_id}\n\n`;
            // Check which methods worked
            const methods = ['searchRecords', 'getRecord', 'searchRecordsWithFields'];
            for (const method of methods) {
                if (debugResults[method]) {
                    const widget = debugResults[method];
                    summaryText += `✅ ${method}:\n`;
                    summaryText += `  - Fields: ${Object.keys(widget).length}\n`;
                    summaryText += `  - Has script: ${!!widget.script}\n`;
                    summaryText += `  - Has client_script: ${!!widget.client_script}\n`;
                    summaryText += `  - Has template: ${!!widget.template}\n`;
                    summaryText += `  - Script size: ${widget.script?.length || 0} chars\n`;
                    summaryText += `  - Client script size: ${widget.client_script?.length || 0} chars\n`;
                    summaryText += `  - Template size: ${widget.template?.length || 0} chars\n\n`;
                }
                else {
                    summaryText += `❌ ${method}: Failed\n\n`;
                }
            }
            // Recommend best approach
            const workingMethods = methods.filter(m => debugResults[m]);
            if (workingMethods.length > 0) {
                summaryText += `\n📊 Recommendation: Use ${workingMethods[0]} for fetching this widget.`;
            }
            else {
                summaryText += `\n⚠️ All fetch methods failed. There may be an authentication or permission issue.`;
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: summaryText
                    }
                ]
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Debug failed: ${errorMessage}`
                    }
                ]
            };
        }
    }
}
exports.ServiceNowLocalDevelopmentMCP = ServiceNowLocalDevelopmentMCP;
// Start the server with timeout protection
async function main() {
    try {
        const mcpServer = new ServiceNowLocalDevelopmentMCP();
        const transport = new stdio_js_1.StdioServerTransport();
        // Add timeout for server initialization
        const INIT_TIMEOUT = 5000; // 5 seconds to start
        const connectPromise = mcpServer.server.connect(transport);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Server initialization timeout')), INIT_TIMEOUT);
        });
        await Promise.race([connectPromise, timeoutPromise]);
        console.error('🚀 ServiceNow Local Development MCP Server started');
    }
    catch (error) {
        console.error('❌ Server failed to start within timeout:', error);
        // Still allow server to run even if initial connection takes time
        console.error('⏳ Server may still be initializing...');
    }
}
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Server failed to start:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=servicenow-local-development-mcp.js.map