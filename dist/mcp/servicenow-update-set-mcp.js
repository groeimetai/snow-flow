#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Update Set Management MCP Server
 * Ensures all changes are tracked in Update Sets for safe deployment
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
const mcp_logger_js_1 = require("./shared/mcp-logger.js");
const fs_1 = require("fs");
const path_1 = require("path");
class ServiceNowUpdateSetMCP {
    constructor() {
        this.currentSession = null;
        this.server = new index_js_1.Server({
            name: 'servicenow-update-set',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
        this.logger = new mcp_logger_js_1.MCPLogger('ServiceNowUpdateSetMCP');
        this.sessionsPath = (0, path_1.join)(process.cwd(), 'memory', 'update-set-sessions');
        // Debug: Test credentials on startup
        this.testCredentials();
        this.setupHandlers();
        this.ensureSessionsDirectory();
    }
    /**
     * Test credentials on startup
     */
    async testCredentials() {
        console.error('🔍 [UPDATE-SET MCP] Testing credentials...');
        try {
            const credentials = await this.oauth.loadCredentials();
            if (credentials) {
                console.error('✅ [UPDATE-SET MCP] Credentials loaded successfully');
                const isAuth = await this.oauth.isAuthenticated();
                console.error(`🔐 [UPDATE-SET MCP] Authentication status: ${isAuth ? '✅ Valid' : '❌ Expired'}`);
            }
            else {
                console.error('❌ [UPDATE-SET MCP] No credentials found');
            }
        }
        catch (error) {
            console.error('❌ [UPDATE-SET MCP] Credential test failed:', error);
        }
    }
    async ensureSessionsDirectory() {
        try {
            await fs_1.promises.mkdir(this.sessionsPath, { recursive: true });
        }
        catch (error) {
            this.logger.error('Failed to create sessions directory', error);
        }
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'snow_update_set_create',
                    description: 'Creates a new Update Set for tracking changes related to a user story or feature. Essential for ServiceNow change management and deployment tracking.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                description: 'Update Set name (e.g., "STORY-123: Add incident widget")'
                            },
                            description: {
                                type: 'string',
                                description: 'Detailed description of changes'
                            },
                            user_story: {
                                type: 'string',
                                description: 'User story or ticket number'
                            },
                            release_date: {
                                type: 'string',
                                description: 'Target release date (optional)'
                            },
                            auto_switch: {
                                type: 'boolean',
                                description: 'Automatically switch to the created Update Set (default: true)',
                                default: true
                            }
                        },
                        required: ['name', 'description']
                    }
                },
                {
                    name: 'snow_update_set_switch',
                    description: 'Switches the active Update Set context to an existing set. Ensures all subsequent changes are tracked in the specified Update Set.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            update_set_id: {
                                type: 'string',
                                description: 'Update Set sys_id to switch to'
                            }
                        },
                        required: ['update_set_id']
                    }
                },
                {
                    name: 'snow_update_set_current',
                    description: 'Retrieves information about the currently active Update Set including ID, name, state, and tracked artifacts.',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'snow_update_set_list',
                    description: 'Lists Update Sets filtered by state (in_progress, complete, released). Provides overview of recent changes and deployment readiness.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            state: {
                                type: 'string',
                                description: 'Filter by state: in_progress, complete, released',
                                enum: ['in_progress', 'complete', 'released']
                            },
                            limit: {
                                type: 'number',
                                description: 'Maximum number of results (default: 10)'
                            }
                        }
                    }
                },
                {
                    name: 'snow_update_set_complete',
                    description: 'Marks an Update Set as complete, preventing further changes. Prepares the set for testing, review, and migration to other instances.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            update_set_id: {
                                type: 'string',
                                description: 'Update Set sys_id to complete (uses current if not specified)'
                            },
                            notes: {
                                type: 'string',
                                description: 'Completion notes or testing instructions'
                            }
                        }
                    }
                },
                {
                    name: 'snow_update_set_add_artifact',
                    description: 'Registers an artifact (widget, flow, script) in the active Update Set for tracking. Maintains comprehensive change history for deployments.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            type: {
                                type: 'string',
                                description: 'Artifact type (widget, flow, script, etc.)'
                            },
                            sys_id: {
                                type: 'string',
                                description: 'ServiceNow sys_id of the artifact'
                            },
                            name: {
                                type: 'string',
                                description: 'Artifact name for tracking'
                            }
                        },
                        required: ['type', 'sys_id', 'name']
                    }
                },
                {
                    name: 'snow_update_set_preview',
                    description: 'Generates a detailed preview of all changes contained in an Update Set. Shows modified tables, fields, and potential deployment impacts.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            update_set_id: {
                                type: 'string',
                                description: 'Update Set sys_id (uses current if not specified)'
                            }
                        }
                    }
                },
                {
                    name: 'snow_update_set_export',
                    description: 'Exports Update Set to XML format for backup, version control, or manual migration between instances. Preserves all change records and metadata.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            update_set_id: {
                                type: 'string',
                                description: 'Update Set sys_id to export'
                            },
                            output_path: {
                                type: 'string',
                                description: 'Path to save the XML file'
                            }
                        }
                    }
                },
                {
                    name: 'snow_ensure_active_update_set',
                    description: 'Ensures an active Update Set is available for tracking changes. Automatically creates a contextual Update Set if none exists, preventing untracked modifications.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            context: {
                                type: 'string',
                                description: 'Context for auto-created Update Set (e.g., "widget development", "flow creation")'
                            },
                            auto_create: {
                                type: 'boolean',
                                description: 'Automatically create Update Set if none exists (default: true)',
                                default: true
                            }
                        }
                    }
                }
            ]
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                // Start operation with token tracking
                this.logger.operationStart(name, args);
                // Check authentication for all operations
                const isAuthenticated = await this.oauth.isAuthenticated();
                if (!isAuthenticated) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, 'Not authenticated. Run "snow-flow auth login" first.');
                }
                let result;
                switch (name) {
                    case 'snow_update_set_create':
                        result = await this.createUpdateSet(args);
                        break;
                    case 'snow_update_set_switch':
                        result = await this.switchUpdateSet(args);
                        break;
                    case 'snow_update_set_current':
                        result = await this.getCurrentUpdateSet();
                        break;
                    case 'snow_update_set_list':
                        result = await this.listUpdateSets(args);
                        break;
                    case 'snow_update_set_complete':
                        result = await this.completeUpdateSet(args);
                        break;
                    case 'snow_update_set_add_artifact':
                        result = await this.addArtifactToSession(args);
                        break;
                    case 'snow_update_set_preview':
                        result = await this.previewUpdateSet(args);
                        break;
                    case 'snow_update_set_export':
                        result = await this.exportUpdateSet(args);
                        break;
                    case 'snow_ensure_active_update_set':
                        result = await this.ensureActiveUpdateSet(args);
                        break;
                    case 'snow_sync_current_update_set':
                        result = await this.syncCurrentUpdateSet(args);
                        break;
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
                // Complete operation with token tracking
                result = this.logger.addTokenUsageToResponse(result);
                result = this.logger.addTokenUsageToResponse(result);
                this.logger.operationComplete(name, result);
                return result;
            }
            catch (error) {
                if (error instanceof types_js_1.McpError)
                    throw error;
                this.logger.error('Tool execution failed', { tool: name, error });
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    async createUpdateSet(args) {
        try {
            this.logger.info('Creating new Update Set', args);
            // Create Update Set in ServiceNow
            this.logger.trackAPICall('CREATE', 'sys_update_set', 1);
            const response = await this.client.createUpdateSet({
                name: args.name,
                description: args.description,
                release_date: args.release_date,
                state: 'in_progress'
            });
            if (!response.success) {
                throw new Error(response.error || 'Failed to create Update Set');
            }
            // Validate response structure
            if (!response.data || !response.data.sys_id) {
                throw new Error(`Invalid Update Set response: missing data or sys_id. Response: ${JSON.stringify(response)}`);
            }
            // Auto-switch to Update Set if requested (default: true)
            const autoSwitch = args.auto_switch !== false;
            let switchedToUpdateSet = false;
            if (autoSwitch) {
                this.logger.trackAPICall('UPDATE', 'sys_update_set', 1);
                await this.client.setCurrentUpdateSet(response.data.sys_id);
                switchedToUpdateSet = true;
                // Create local session
                this.currentSession = {
                    update_set_id: response.data.sys_id,
                    name: args.name,
                    description: args.description,
                    user_story: args.user_story,
                    created_at: new Date().toISOString(),
                    state: 'in_progress',
                    artifacts: [],
                    auto_switched: true,
                    active_session: true
                };
                // Save session
                await this.saveSession();
            }
            const credentials = await this.oauth.loadCredentials();
            const updateSetUrl = `https://${credentials?.instance}/sys_update_set.do?sys_id=${response.data.sys_id}`;
            return {
                content: [{
                        type: 'text',
                        text: `✅ **Update Set Created Successfully!**

📋 **Details:**
- **Name**: ${args.name}
- **ID**: ${response.data.sys_id}
- **Description**: ${args.description}
${args.user_story ? `- **User Story**: ${args.user_story}` : ''}
- **State**: In Progress
${switchedToUpdateSet ? '- **Auto-Switched**: ✅ Active session ready' : '- **Auto-Switch**: ❌ Manual switch required'}

🔗 **View in ServiceNow**: ${updateSetUrl}

${switchedToUpdateSet ? `⚡ **Current Session Active**
All subsequent changes will be automatically tracked in this Update Set.` : `⚠️ **Manual Switch Required**
Use \`snow_update_set_switch\` to activate this Update Set before making changes.`}

💡 **Best Practices:**
1. Keep Update Sets focused on a single story/feature
2. Test thoroughly before marking complete
3. Document all changes in the description
4. Use meaningful names that include story numbers`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create Update Set', error);
            throw error;
        }
    }
    async switchUpdateSet(args) {
        try {
            this.logger.info('Switching to Update Set', { update_set_id: args.update_set_id });
            // Set as current in ServiceNow
            this.logger.trackAPICall('UPDATE', 'sys_update_set', 1);
            await this.client.setCurrentUpdateSet(args.update_set_id);
            // Load or create session
            const sessionFile = (0, path_1.join)(this.sessionsPath, `${args.update_set_id}.json`);
            try {
                const sessionData = await fs_1.promises.readFile(sessionFile, 'utf-8');
                this.currentSession = JSON.parse(sessionData);
            }
            catch {
                // Create new session for existing Update Set
                this.logger.trackAPICall('GET', 'sys_update_set', 1);
                const updateSet = await this.client.getUpdateSet(args.update_set_id);
                this.currentSession = {
                    update_set_id: args.update_set_id,
                    name: updateSet.data.name,
                    description: updateSet.data.description,
                    created_at: updateSet.data.sys_created_on,
                    state: updateSet.data.state,
                    artifacts: []
                };
                await this.saveSession();
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ **Switched to Update Set**

📋 **Current Update Set:**
- **Name**: ${this.currentSession?.name || 'Unknown'}
- **ID**: ${this.currentSession?.update_set_id || 'Unknown'}
- **State**: ${this.currentSession?.state || 'Unknown'}
- **Artifacts Tracked**: ${this.currentSession?.artifacts.length || 0}

All subsequent changes will be tracked in this Update Set.`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to switch Update Set', error);
            throw error;
        }
    }
    async getCurrentUpdateSet() {
        if (!this.currentSession) {
            // Try to get from ServiceNow
            this.logger.trackAPICall('GET', 'sys_update_set', 1);
            const current = await this.client.getCurrentUpdateSet();
            if (current.success && current.data) {
                return {
                    content: [{
                            type: 'text',
                            text: `📋 **Current Update Set (from ServiceNow):**
- **Name**: ${current.data.name}
- **ID**: ${current.data.sys_id}
- **State**: ${current.data.state}

⚠️ **Note**: No local session active. Use \`snow_update_set_switch\` to activate session tracking.`
                        }]
                };
            }
            return {
                content: [{
                        type: 'text',
                        text: '❌ **No Update Set Active**\n\nUse `snow_update_set_create` to create a new Update Set for your changes.'
                    }]
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `📋 **Current Update Set Session:**
- **Name**: ${this.currentSession.name}
- **ID**: ${this.currentSession.update_set_id}
- **User Story**: ${this.currentSession.user_story || 'Not specified'}
- **State**: ${this.currentSession.state}
- **Created**: ${new Date(this.currentSession.created_at).toLocaleString()}
- **Artifacts**: ${this.currentSession.artifacts.length}

📦 **Tracked Artifacts:**
${this.currentSession.artifacts.length > 0
                        ? this.currentSession.artifacts.map(a => `- ${a.type}: ${a.name}`).join('\n')
                        : '- No artifacts tracked yet'}`
                }]
        };
    }
    async listUpdateSets(args) {
        try {
            this.logger.trackAPICall('SEARCH', 'sys_update_set', args.limit || 10);
            const response = await this.client.listUpdateSets({
                state: args.state,
                limit: args.limit || 10
            });
            if (!response.success) {
                throw new Error(response.error || 'Failed to list Update Sets');
            }
            const updateSets = response.data || [];
            const credentials = await this.oauth.loadCredentials();
            return {
                content: [{
                        type: 'text',
                        text: `📋 **Update Sets** (${updateSets.length} found)

${updateSets.map((us) => `
**${us.name}**
- ID: ${us.sys_id}
- State: ${us.state}
- Created: ${new Date(us.sys_created_on).toLocaleDateString()}
- Created By: ${us.sys_created_by}
- 🔗 [View](https://${credentials?.instance}/sys_update_set.do?sys_id=${us.sys_id})
`).join('\n---\n')}

💡 Use \`snow_update_set_switch\` to activate any Update Set.`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to list Update Sets', error);
            throw error;
        }
    }
    async completeUpdateSet(args) {
        try {
            const updateSetId = args.update_set_id || this.currentSession?.update_set_id;
            if (!updateSetId) {
                throw new Error('No Update Set specified and no active session');
            }
            // Mark as complete in ServiceNow
            this.logger.trackAPICall('UPDATE', 'sys_update_set', 1);
            const response = await this.client.completeUpdateSet(updateSetId, args.notes);
            if (!response.success) {
                throw new Error(response.error || 'Failed to complete Update Set');
            }
            // Update session
            if (this.currentSession && this.currentSession.update_set_id === updateSetId) {
                this.currentSession.state = 'complete';
                await this.saveSession();
            }
            const credentials = await this.oauth.loadCredentials();
            const updateSetUrl = `https://${credentials?.instance}/sys_update_set.do?sys_id=${updateSetId}`;
            return {
                content: [{
                        type: 'text',
                        text: `✅ **Update Set Completed!**

📋 **Summary:**
- **Name**: ${response.data.name}
- **ID**: ${updateSetId}
- **State**: Complete
${args.notes ? `- **Notes**: ${args.notes}` : ''}

🔗 **View in ServiceNow**: ${updateSetUrl}

📝 **Next Steps:**
1. Test all changes thoroughly
2. Get peer review if required
3. Move to target instance when ready
4. Create new Update Set for next feature

⚠️ **Important**: This Update Set is now locked. Create a new one for additional changes.`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to complete Update Set', error);
            throw error;
        }
    }
    async addArtifactToSession(args) {
        // Intelligent session management - auto-create session if none exists
        if (!this.currentSession) {
            this.logger.info('No active session found, auto-creating Update Set session');
            try {
                // Create a default update set with smart naming
                const defaultName = `AUTO-${new Date().toISOString().split('T')[0]}-${Date.now().toString().slice(-6)}`;
                const defaultDescription = `Auto-created Update Set for ${args.type} deployment: ${args.name}`;
                await this.createUpdateSet({
                    name: defaultName,
                    description: defaultDescription,
                    user_story: 'Automated artifact deployment'
                });
                this.logger.info('Auto-created Update Set session', {
                    name: defaultName,
                    updateSetId: this.currentSession?.update_set_id
                });
            }
            catch (error) {
                this.logger.error('Failed to auto-create Update Set session', { error });
                throw new Error(`No active Update Set session and auto-creation failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        // Add artifact to session
        this.currentSession.artifacts.push({
            type: args.type,
            sys_id: args.sys_id,
            name: args.name,
            created_at: new Date().toISOString()
        });
        await this.saveSession();
        const autoCreatedNotice = this.currentSession.name.startsWith('AUTO-')
            ? `\n🔄 **Smart Session Management:**\n- ✅ Update Set session auto-created (no manual setup required)\n- 📝 Naming: ${this.currentSession.name}\n- 🎯 Intelligent deployment tracking enabled\n`
            : '';
        return {
            content: [{
                    type: 'text',
                    text: `✅ **Artifact Added to Update Set Session**

📦 **Artifact Details:**
- **Type**: ${args.type}
- **Name**: ${args.name}
- **Sys ID**: ${args.sys_id}
${autoCreatedNotice}
📋 **Current Session:**
- **Update Set**: ${this.currentSession.name}
- **Total Artifacts**: ${this.currentSession.artifacts.length}
- **Session ID**: ${this.currentSession.update_set_id}`
                }]
        };
    }
    async previewUpdateSet(args) {
        try {
            const updateSetId = args.update_set_id || this.currentSession?.update_set_id;
            if (!updateSetId) {
                throw new Error('No Update Set specified and no active session');
            }
            // Get Update Set details and changes
            this.logger.trackAPICall('GET', 'sys_update_set_preview', 1);
            const response = await this.client.previewUpdateSet(updateSetId);
            if (!response.success) {
                throw new Error(response.error || 'Failed to preview Update Set');
            }
            const changes = response.data.changes || [];
            const credentials = await this.oauth.loadCredentials();
            return {
                content: [{
                        type: 'text',
                        text: `📋 **Update Set Preview**

**Update Set**: ${response.data.name}
**Total Changes**: ${changes.length}

📦 **Changes by Type:**
${this.groupChangesByType(changes)}

📝 **Change Details:**
${changes.slice(0, 20).map((change) => `
- **${change.type}**: ${change.target_name}
  - Action: ${change.action}
  - Table: ${change.target_table}
  - Updated: ${new Date(change.sys_updated_on).toLocaleString()}
`).join('\n')}
${changes.length > 20 ? `\n... and ${changes.length - 20} more changes` : ''}

🔗 **Full Preview**: https://${credentials?.instance}/sys_update_set_preview.do?sysparm_set=${updateSetId}`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to preview Update Set', error);
            throw error;
        }
    }
    async exportUpdateSet(args) {
        try {
            const updateSetId = args.update_set_id;
            if (!updateSetId) {
                throw new Error('Update Set ID is required for export');
            }
            // Export Update Set as XML
            this.logger.trackAPICall('GET', 'sys_update_set_export', 1);
            const response = await this.client.exportUpdateSet(updateSetId);
            if (!response.success) {
                throw new Error(response.error || 'Failed to export Update Set');
            }
            // Save to file
            const outputPath = args.output_path || (0, path_1.join)(process.cwd(), 'exports', `update_set_${updateSetId}_${Date.now()}.xml`);
            await fs_1.promises.mkdir((0, path_1.join)(process.cwd(), 'exports'), { recursive: true });
            await fs_1.promises.writeFile(outputPath, response.data.xml);
            return {
                content: [{
                        type: 'text',
                        text: `✅ **Update Set Exported Successfully!**

📦 **Export Details:**
- **Update Set**: ${response.data.name}
- **File Size**: ${(response.data.xml.length / 1024).toFixed(2)} KB
- **Changes**: ${response.data.change_count}
- **Saved to**: ${outputPath}

💡 **Usage:**
- Import this XML file to another ServiceNow instance
- Keep as backup before major changes
- Share with team members for review`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to export Update Set', error);
            throw error;
        }
    }
    async ensureActiveUpdateSet(args) {
        try {
            this.logger.info('Ensuring active Update Set session', args);
            // Check if we already have an active session
            if (this.currentSession?.state === 'in_progress') {
                // Also sync current Update Set if requested
                if (args.set_as_current !== false) {
                    await this.syncCurrentUpdateSet({ force_switch: true });
                }
                return {
                    success: true,
                    message: 'Active Update Set session found and synchronized',
                    update_set: {
                        name: this.currentSession.name,
                        sys_id: this.currentSession.update_set_id,
                        artifacts_count: this.currentSession.artifacts?.length || 0
                    },
                    synchronized: args.set_as_current !== false
                };
            }
            // Auto-create if requested (default: true)
            const autoCreate = args.auto_create !== false;
            if (autoCreate) {
                const context = args.context || 'automated deployment';
                const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
                return await this.createUpdateSet({
                    name: `Auto-${context} (${timestamp})`,
                    description: `Automatically created Update Set for ${context}`,
                    user_story: 'Automated deployment workflow',
                    auto_switch: true
                });
            }
            else {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ **No Active Update Set Session**

⚠️ **Manual Creation Required**
Create an Update Set before making changes:

\`\`\`
snow_update_set_create({
  name: "Your feature name",
  description: "Description of changes"
})
\`\`\`

💡 **Why Update Sets Matter:**
- Track all changes for rollback capability
- Organize related changes together  
- Required for deployment to other environments`
                        }]
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to ensure active Update Set', error);
            throw error;
        }
    }
    async saveSession() {
        if (!this.currentSession)
            return;
        const sessionFile = (0, path_1.join)(this.sessionsPath, `${this.currentSession.update_set_id}.json`);
        await fs_1.promises.writeFile(sessionFile, JSON.stringify(this.currentSession, null, 2));
    }
    groupChangesByType(changes) {
        const grouped = changes.reduce((acc, change) => {
            const type = change.type || 'Other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => `- ${type}: ${count}`)
            .join('\n');
    }
    /**
     * NEW: Synchronize user's current Update Set with Snow-Flow's active Update Set
     */
    async syncCurrentUpdateSet(args) {
        try {
            this.logger.info('Synchronizing user current Update Set with Snow-Flow session...');
            if (!this.currentSession) {
                return {
                    success: false,
                    error: 'No active Snow-Flow Update Set session found.',
                    suggestion: 'Run snow_ensure_active_update_set first to create or activate an Update Set.'
                };
            }
            // Set Snow-Flow Update Set as current for user via script
            const syncScript = `
        // Synchronize user's current Update Set with Snow-Flow session
        var updateSetId = '${this.currentSession.update_set_id}';
        var currentUser = gs.getUserID();
        
        // Get current Update Set info
        var updateSet = new GlideRecord('sys_update_set');
        if (updateSet.get(updateSetId)) {
          gs.info('Snow-Flow Update Set found: ' + updateSet.name);
          
          // Set as current for user via session variable
          gs.getSession().putProperty('update_set', updateSetId);
          gs.info('Set as current Update Set for user: ' + updateSet.name);
          
          // Also try to set via user preference
          var pref = new GlideRecord('sys_user_preference');
          pref.addQuery('user', currentUser);
          pref.addQuery('name', 'update_set.current');
          pref.query();
          
          if (pref.next()) {
            pref.value = updateSetId;
            pref.update();
            gs.info('Updated user preference for current Update Set');
          } else {
            var newPref = new GlideRecord('sys_user_preference');
            newPref.initialize();
            newPref.user = currentUser;
            newPref.name = 'update_set.current';
            newPref.value = updateSetId;
            newPref.insert();
            gs.info('Created user preference for current Update Set');
          }
          
          gs.info('SYNC COMPLETE: User current Update Set = Snow-Flow session Update Set');
        } else {
          gs.error('Snow-Flow Update Set not found: ' + updateSetId);
        }
      `;
            const scriptResponse = await this.client.executeScript(syncScript);
            if (!scriptResponse.success) {
                return {
                    success: false,
                    error: 'Failed to synchronize current Update Set',
                    suggestion: 'Check ServiceNow connection and Update Set permissions',
                    update_set_id: this.currentSession.update_set_id
                };
            }
            return {
                success: true,
                message: `Current Update Set synchronized with Snow-Flow session`,
                update_set_name: this.currentSession.name,
                update_set_id: this.currentSession.update_set_id,
                sync_method: 'session_variable_and_user_preference',
                sync_status: 'completed'
            };
        }
        catch (error) {
            this.logger.error('Failed to sync current Update Set:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                suggestion: 'Check ServiceNow connection and permissions'
            };
        }
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('ServiceNow Update Set MCP Server running on stdio');
    }
}
const server = new ServiceNowUpdateSetMCP();
server.run().catch(console.error);
//# sourceMappingURL=servicenow-update-set-mcp.js.map