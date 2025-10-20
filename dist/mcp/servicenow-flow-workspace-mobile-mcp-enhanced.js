#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Flow Designer, Agent Workspace & Mobile MCP Server - ENHANCED VERSION
 * With logging, token tracking, and progress indicators
 */
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const enhanced_base_mcp_server_js_1 = require("./shared/enhanced-base-mcp-server.js");
const mcp_config_manager_js_1 = require("../utils/mcp-config-manager.js");
class ServiceNowFlowWorkspaceMobileMCPEnhanced extends enhanced_base_mcp_server_js_1.EnhancedBaseMCPServer {
    constructor() {
        super('servicenow-flow-workspace-mobile-enhanced', '2.0.0');
        this.config = mcp_config_manager_js_1.mcpConfig.getConfig();
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                // Flow Designer Tools
                {
                    name: 'snow_create_flow',
                    description: 'Creates flow in Flow Designer using sys_hub_flow table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Flow name' },
                            description: { type: 'string', description: 'Flow description' },
                            application: { type: 'string', description: 'Application scope' },
                            active: { type: 'boolean', default: false },
                            run_as: { type: 'string', description: 'Run as user: user_who_initiates, system' }
                        },
                        required: ['name']
                    }
                },
                {
                    name: 'snow_create_flow_action',
                    description: 'Creates flow action using sys_hub_action_instance table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            flow: { type: 'string', description: 'Flow sys_id' },
                            action_type: { type: 'string', description: 'Action type' },
                            action_name: { type: 'string', description: 'Action name' },
                            inputs: { type: 'object', description: 'Action inputs' },
                            order: { type: 'number', description: 'Execution order' }
                        },
                        required: ['flow', 'action_type']
                    }
                },
                {
                    name: 'snow_create_subflow',
                    description: 'Creates reusable subflow using sys_hub_sub_flow table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Subflow name' },
                            description: { type: 'string', description: 'Subflow description' },
                            inputs: { type: 'array', items: { type: 'object' }, description: 'Input variables' },
                            outputs: { type: 'array', items: { type: 'object' }, description: 'Output variables' }
                        },
                        required: ['name']
                    }
                },
                {
                    name: 'snow_add_flow_trigger',
                    description: 'Adds trigger to flow using sys_hub_trigger_instance table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            flow: { type: 'string', description: 'Flow sys_id' },
                            trigger_type: { type: 'string', description: 'record, schedule, inbound_email' },
                            table: { type: 'string', description: 'Table name for record trigger' },
                            condition: { type: 'string', description: 'Trigger condition' },
                            schedule: { type: 'string', description: 'Schedule for time-based trigger' }
                        },
                        required: ['flow', 'trigger_type']
                    }
                },
                {
                    name: 'snow_publish_flow',
                    description: 'Publishes and activates flow in sys_hub_flow table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            flow_id: { type: 'string', description: 'Flow sys_id' },
                            version: { type: 'string', description: 'Version number' },
                            activate: { type: 'boolean', default: true }
                        },
                        required: ['flow_id']
                    }
                },
                {
                    name: 'snow_test_flow',
                    description: 'Tests flow execution using sys_flow_context table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            flow_id: { type: 'string', description: 'Flow sys_id' },
                            test_data: { type: 'object', description: 'Test input data' },
                            debug: { type: 'boolean', default: true }
                        },
                        required: ['flow_id']
                    }
                },
                {
                    name: 'snow_get_flow_execution_details',
                    description: 'Gets flow execution history from sys_flow_context table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            flow_id: { type: 'string', description: 'Flow sys_id' },
                            execution_id: { type: 'string', description: 'Specific execution ID' },
                            status: { type: 'string', description: 'Filter by status' },
                            limit: { type: 'number', default: 10 }
                        }
                    }
                },
                // Agent Workspace Tools
                {
                    name: 'snow_create_workspace',
                    description: 'Creates agent workspace using sys_aw_workspace table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Workspace name' },
                            description: { type: 'string', description: 'Workspace description' },
                            roles: { type: 'array', items: { type: 'string' }, description: 'Required roles' },
                            default_landing_page: { type: 'string', description: 'Landing page' },
                            branding: { type: 'object', description: 'Branding configuration' }
                        },
                        required: ['name']
                    }
                },
                {
                    name: 'snow_configure_workspace_tab',
                    description: 'Configures workspace tabs using sys_aw_tab table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            workspace: { type: 'string', description: 'Workspace sys_id' },
                            label: { type: 'string', description: 'Tab label' },
                            url: { type: 'string', description: 'Tab URL or page' },
                            order: { type: 'number', description: 'Tab order' },
                            icon: { type: 'string', description: 'Tab icon' }
                        },
                        required: ['workspace', 'label']
                    }
                },
                {
                    name: 'snow_add_workspace_list',
                    description: 'Adds lists to workspace using sys_aw_list table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            workspace: { type: 'string', description: 'Workspace sys_id' },
                            table: { type: 'string', description: 'Table name' },
                            filter: { type: 'string', description: 'List filter' },
                            columns: { type: 'array', items: { type: 'string' }, description: 'Display columns' },
                            order_by: { type: 'string', description: 'Sort order' }
                        },
                        required: ['workspace', 'table']
                    }
                },
                {
                    name: 'snow_create_workspace_form',
                    description: '⚠️ DEPRECATED: sys_aw_form table does not exist in modern ServiceNow. Use UI Builder form components instead.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            workspace: { type: 'string', description: 'Workspace sys_id' },
                            table: { type: 'string', description: 'Table name' },
                            sections: { type: 'array', items: { type: 'object' }, description: 'Form sections' },
                            fields: { type: 'array', items: { type: 'string' }, description: 'Form fields' }
                        },
                        required: ['workspace', 'table']
                    }
                },
                {
                    name: 'snow_configure_workspace_ui_action',
                    description: 'Adds UI actions to workspace using sys_aw_ui_action table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            workspace: { type: 'string', description: 'Workspace sys_id' },
                            name: { type: 'string', description: 'Action name' },
                            label: { type: 'string', description: 'Action label' },
                            script: { type: 'string', description: 'Action script' },
                            condition: { type: 'string', description: 'Display condition' }
                        },
                        required: ['workspace', 'name', 'label']
                    }
                },
                {
                    name: 'snow_deploy_workspace',
                    description: '⚠️ DEPRECATED: sys_aw_workspace table incorrect. Use sys_aw_master_config for workspace deployment.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            workspace_id: { type: 'string', description: 'Workspace sys_id' },
                            activate: { type: 'boolean', default: true },
                            roles: { type: 'array', items: { type: 'string' }, description: 'Target roles' }
                        },
                        required: ['workspace_id']
                    }
                },
                // Mobile Platform Tools
                {
                    name: 'snow_create_mobile_app_config',
                    description: 'Creates mobile app configuration using sys_mobile_config table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'App name' },
                            description: { type: 'string', description: 'App description' },
                            app_id: { type: 'string', description: 'Application ID' },
                            version: { type: 'string', description: 'App version' },
                            platforms: { type: 'array', items: { type: 'string' }, description: 'ios, android' }
                        },
                        required: ['name', 'app_id']
                    }
                },
                {
                    name: 'snow_configure_mobile_layout',
                    description: 'Configures mobile layouts using sys_mobile_layout table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            app_config: { type: 'string', description: 'App config sys_id' },
                            name: { type: 'string', description: 'Layout name' },
                            type: { type: 'string', description: 'list, form, dashboard' },
                            components: { type: 'array', items: { type: 'object' }, description: 'Layout components' }
                        },
                        required: ['app_config', 'name', 'type']
                    }
                },
                {
                    name: 'snow_create_mobile_applet',
                    description: 'Creates mobile applet using sys_mobile_applet table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Applet name' },
                            table: { type: 'string', description: 'Data table' },
                            layout: { type: 'string', description: 'Layout sys_id' },
                            icon: { type: 'string', description: 'Applet icon' },
                            order: { type: 'number', description: 'Display order' }
                        },
                        required: ['name', 'table']
                    }
                },
                {
                    name: 'snow_configure_offline_tables',
                    description: 'Configures offline data sync using sys_mobile_offline table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            app_config: { type: 'string', description: 'App config sys_id' },
                            tables: { type: 'array', items: { type: 'string' }, description: 'Tables to sync' },
                            sync_rules: { type: 'object', description: 'Sync conditions' },
                            frequency: { type: 'string', description: 'Sync frequency' }
                        },
                        required: ['app_config', 'tables']
                    }
                },
                {
                    name: 'snow_set_mobile_security',
                    description: 'Sets mobile security policies using sys_mobile_security table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            app_config: { type: 'string', description: 'App config sys_id' },
                            require_pin: { type: 'boolean', default: true },
                            biometric_auth: { type: 'boolean', default: false },
                            session_timeout: { type: 'number', description: 'Timeout in minutes' },
                            data_encryption: { type: 'boolean', default: true }
                        },
                        required: ['app_config']
                    }
                },
                {
                    name: 'snow_push_notification_config',
                    description: 'Configures push notifications using sys_push_notification table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            app_config: { type: 'string', description: 'App config sys_id' },
                            event_types: { type: 'array', items: { type: 'string' }, description: 'Event types' },
                            templates: { type: 'object', description: 'Message templates' },
                            enabled: { type: 'boolean', default: true }
                        },
                        required: ['app_config', 'event_types']
                    }
                },
                {
                    name: 'snow_deploy_mobile_app',
                    description: 'Deploys mobile app using sys_mobile_deployment table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            app_config_id: { type: 'string', description: 'App config sys_id' },
                            environment: { type: 'string', description: 'dev, test, prod' },
                            deploy_to_stores: { type: 'boolean', default: false },
                            release_notes: { type: 'string', description: 'Release notes' }
                        },
                        required: ['app_config_id', 'environment']
                    }
                }
            ]
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                // Execute with enhanced tracking
                return await this.executeTool(name, async () => {
                    switch (name) {
                        // Flow Designer
                        case 'snow_create_flow':
                            return await this.createFlow(args);
                        case 'snow_create_flow_action':
                            return await this.createFlowAction(args);
                        case 'snow_create_subflow':
                            return await this.createSubflow(args);
                        case 'snow_add_flow_trigger':
                            return await this.addFlowTrigger(args);
                        case 'snow_publish_flow':
                            return await this.publishFlow(args);
                        case 'snow_test_flow':
                            return await this.testFlow(args);
                        case 'snow_get_flow_execution_details':
                            return await this.getFlowExecutionDetails(args);
                        // Agent Workspace
                        case 'snow_create_workspace':
                            return await this.createWorkspace(args);
                        case 'snow_configure_workspace_tab':
                            return await this.configureWorkspaceTab(args);
                        case 'snow_add_workspace_list':
                            return await this.addWorkspaceList(args);
                        case 'snow_create_workspace_form':
                            return await this.createWorkspaceForm(args);
                        case 'snow_configure_workspace_ui_action':
                            return await this.configureWorkspaceUIAction(args);
                        case 'snow_deploy_workspace':
                            return await this.deployWorkspace(args);
                        // Mobile Platform
                        case 'snow_create_mobile_app_config':
                            return await this.createMobileAppConfig(args);
                        case 'snow_configure_mobile_layout':
                            return await this.configureMobileLayout(args);
                        case 'snow_create_mobile_applet':
                            return await this.createMobileApplet(args);
                        case 'snow_configure_offline_tables':
                            return await this.configureOfflineTables(args);
                        case 'snow_set_mobile_security':
                            return await this.setMobileSecurity(args);
                        case 'snow_push_notification_config':
                            return await this.pushNotificationConfig(args);
                        case 'snow_deploy_mobile_app':
                            return await this.deployMobileApp(args);
                        default:
                            throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                    }
                });
            }
            catch (error) {
                if (error instanceof types_js_1.McpError)
                    throw error;
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Tool execution failed: ${error}`);
            }
        });
    }
    // Flow Designer Methods
    async createFlow(args) {
        this.logger.info('Creating flow...', { name: args.name });
        const flowData = {
            name: args.name,
            description: args.description || '',
            application: args.application || 'global',
            active: args.active || false,
            run_as: args.run_as || 'user_who_initiates',
            state: 'draft'
        };
        this.logger.progress('Creating flow in ServiceNow...');
        const response = await this.createRecord('sys_hub_flow', flowData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create flow: ${response.error}`);
        }
        const result = response.data;
        this.logger.info('✅ Flow created', { sys_id: result.sys_id });
        return this.createResponse(`✅ Flow created successfully!
🔄 **${args.name}**
📝 ${args.description || 'No description'}
🔧 State: Draft
🏃 Run as: ${args.run_as || 'User who initiates'}
🆔 sys_id: ${result.sys_id}

✨ Flow ready for configuration!`);
    }
    async createFlowAction(args) {
        this.logger.info('Creating flow action...', {
            flow: args.flow,
            action_type: args.action_type
        });
        const actionData = {
            flow: args.flow,
            action_type: args.action_type,
            action_name: args.action_name || args.action_type,
            inputs: JSON.stringify(args.inputs || {}),
            order: args.order || 100
        };
        this.logger.progress('Adding action to flow...');
        const response = await this.createRecord('sys_hub_action_instance', actionData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create action: ${response.error}`);
        }
        this.logger.info('✅ Flow action created');
        return this.createResponse(`✅ Flow action added!
⚡ Type: ${args.action_type}
📝 Name: ${args.action_name || args.action_type}
📊 Order: ${args.order || 100}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async createSubflow(args) {
        this.logger.info('Creating subflow...', { name: args.name });
        const subflowData = {
            name: args.name,
            description: args.description || '',
            inputs: JSON.stringify(args.inputs || []),
            outputs: JSON.stringify(args.outputs || []),
            active: false
        };
        this.logger.progress('Creating subflow...');
        const response = await this.createRecord('sys_hub_sub_flow', subflowData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create subflow: ${response.error}`);
        }
        this.logger.info('✅ Subflow created');
        return this.createResponse(`✅ Subflow created!
🔄 **${args.name}**
📥 Inputs: ${args.inputs?.length || 0}
📤 Outputs: ${args.outputs?.length || 0}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async addFlowTrigger(args) {
        this.logger.info('Adding flow trigger...', {
            flow: args.flow,
            trigger_type: args.trigger_type
        });
        const triggerData = {
            flow: args.flow,
            trigger_type: args.trigger_type,
            active: true
        };
        if (args.trigger_type === 'record') {
            triggerData.table = args.table;
            triggerData.condition = args.condition || '';
        }
        else if (args.trigger_type === 'schedule') {
            triggerData.schedule = args.schedule;
        }
        this.logger.progress('Adding trigger...');
        const response = await this.createRecord('sys_hub_trigger_instance', triggerData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to add trigger: ${response.error}`);
        }
        this.logger.info('✅ Trigger added');
        return this.createResponse(`✅ Flow trigger added!
⚡ Type: ${args.trigger_type}
${args.table ? `📋 Table: ${args.table}` : ''}
${args.schedule ? `⏰ Schedule: ${args.schedule}` : ''}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async publishFlow(args) {
        this.logger.info('Publishing flow...', { flow_id: args.flow_id });
        const updateData = {
            active: args.activate !== false,
            state: 'published',
            version: args.version || '1.0'
        };
        this.logger.progress('Publishing flow...');
        const response = await this.updateRecord('sys_hub_flow', args.flow_id, updateData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to publish flow: ${response.error}`);
        }
        this.logger.info('✅ Flow published');
        return this.createResponse(`✅ Flow published!
📢 State: Published
✅ Active: ${args.activate !== false}
🔢 Version: ${args.version || '1.0'}
🆔 sys_id: ${args.flow_id}`);
    }
    async testFlow(args) {
        this.logger.info('Testing flow...', { flow_id: args.flow_id });
        const testData = {
            flow: args.flow_id,
            test_data: JSON.stringify(args.test_data || {}),
            debug: args.debug !== false,
            state: 'running'
        };
        this.logger.progress('Executing flow test...');
        const response = await this.createRecord('sys_flow_context', testData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to test flow: ${response.error}`);
        }
        this.logger.info('✅ Flow test initiated');
        return this.createResponse(`✅ Flow test started!
🧪 Execution ID: ${response.data.sys_id}
🐛 Debug: ${args.debug !== false ? 'Enabled' : 'Disabled'}
⏳ Status: Running

Check execution details for results.`);
    }
    async getFlowExecutionDetails(args) {
        this.logger.info('Getting flow execution details...');
        let query = '';
        if (args.flow_id)
            query = `flow=${args.flow_id}`;
        if (args.execution_id)
            query = `sys_id=${args.execution_id}`;
        if (args.status)
            query += `^state=${args.status}`;
        this.logger.progress('Retrieving execution history...');
        const response = await this.queryTable('sys_flow_context', query, args.limit || 10);
        if (!response.success) {
            return this.createResponse(`❌ Failed to get executions: ${response.error}`);
        }
        const executions = response.data.result;
        if (!executions.length) {
            return this.createResponse(`❌ No execution history found`);
        }
        this.logger.info(`Found ${executions.length} executions`);
        const executionList = executions.map((exec) => `🔄 **${exec.sys_id}**
  📊 State: ${exec.state}
  ⏰ Started: ${exec.sys_created_on}
  ⏱️ Duration: ${exec.duration || 'N/A'}`).join('\n\n');
        return this.createResponse(`📊 Flow Execution History:\n\n${executionList}\n\n✨ Total: ${executions.length} execution(s)`);
    }
    // Agent Workspace Methods
    async createWorkspace(args) {
        this.logger.info('Creating agent workspace...', { name: args.name });
        const workspaceData = {
            name: args.name,
            description: args.description || '',
            roles: args.roles?.join(',') || '',
            default_landing_page: args.default_landing_page || '',
            branding: JSON.stringify(args.branding || {}),
            active: false
        };
        this.logger.progress('Creating workspace...');
        const response = await this.createRecord('sys_aw_master_config', workspaceData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create workspace: ${response.error}`);
        }
        const result = response.data;
        this.logger.info('✅ Workspace created', { sys_id: result.sys_id });
        return this.createResponse(`✅ Agent Workspace created!
💼 **${args.name}**
📝 ${args.description || 'No description'}
👥 Roles: ${args.roles?.join(', ') || 'All'}
🆔 sys_id: ${result.sys_id}

✨ Workspace ready for configuration!`);
    }
    async configureWorkspaceTab(args) {
        this.logger.info('Configuring workspace tab...', {
            workspace: args.workspace,
            label: args.label
        });
        const tabData = {
            workspace: args.workspace,
            label: args.label,
            url: args.url || '',
            order: args.order || 100,
            icon: args.icon || ''
        };
        this.logger.progress('Adding tab...');
        // DEPRECATED: Return proper MCP response for non-existent table
        return {
            content: [{
                    type: 'text',
                    text: `⚠️ DEPRECATED: sys_aw_tab table does not exist in modern ServiceNow

🚨 **Modern Approach Required:**
Modern Agent Workspaces use UX Pages (sys_ux_*) for tab configuration.

💡 **Use Instead:**
- snow_add_uib_page_element: Add components to UX pages
- snow_create_uib_page: Create custom workspace pages
- snow_create_uib_data_broker: Connect data sources

📋 **Migration Path:**
1. Use snow_create_uib_page for workspace layout
2. Use snow_add_uib_page_element to add table components
3. Configure through UI Builder instead of legacy tables`
                }]
        };
    }
    async addWorkspaceList(args) {
        this.logger.info('Adding workspace list...', {
            workspace: args.workspace,
            table: args.table
        });
        const listData = {
            workspace: args.workspace,
            table: args.table,
            filter: args.filter || '',
            columns: args.columns?.join(',') || '',
            order_by: args.order_by || ''
        };
        this.logger.progress('Adding list...');
        // DEPRECATED: Return proper MCP response for non-existent table
        return {
            content: [{
                    type: 'text',
                    text: `⚠️ DEPRECATED: sys_aw_list table does not exist in modern ServiceNow

💡 **Modern Alternative:**
Use UI Builder list components for workspace lists.

🛠️ **Recommended Tools:**
- snow_create_uib_component: Create custom list component
- snow_create_uib_data_broker: Connect list to data source
- snow_add_uib_page_element: Add list to workspace page`
                }]
        };
    }
    async createWorkspaceForm(args) {
        this.logger.info('Creating workspace form...', {
            workspace: args.workspace,
            table: args.table
        });
        const formData = {
            workspace: args.workspace,
            table: args.table,
            sections: JSON.stringify(args.sections || []),
            fields: args.fields?.join(',') || ''
        };
        this.logger.progress('Creating form...');
        // DEPRECATED: Return proper MCP response for non-existent table
        return {
            content: [{
                    type: 'text',
                    text: `⚠️ DEPRECATED: sys_aw_form table does not exist in modern ServiceNow

💡 **Modern Alternative:**
Use UI Builder form components for workspace forms.

🛠️ **Recommended Tools:**
- snow_create_uib_component: Create custom form component  
- snow_create_uib_page: Create form pages
- Standard ServiceNow form designer for record forms`
                }]
        };
    }
    async configureWorkspaceUIAction(args) {
        this.logger.info('Configuring UI action...', {
            workspace: args.workspace,
            name: args.name
        });
        const actionData = {
            workspace: args.workspace,
            name: args.name,
            label: args.label,
            script: args.script || '',
            condition: args.condition || ''
        };
        this.logger.progress('Adding UI action...');
        // DEPRECATED: Return proper MCP response for non-existent table
        return {
            content: [{
                    type: 'text',
                    text: `⚠️ DEPRECATED: sys_aw_ui_action table does not exist in modern ServiceNow

💡 **Modern Alternative:**
Use UI Builder action components for workspace actions.

🛠️ **Recommended Tools:**
- snow_create_uib_component: Create custom action components
- Standard ServiceNow UI Actions for record actions
- UI Builder event system for custom interactions`
                }]
        };
    }
    async deployWorkspace(args) {
        this.logger.info('Deploying workspace...', { workspace_id: args.workspace_id });
        const updateData = {
            active: args.activate !== false,
            roles: args.roles?.join(',') || ''
        };
        this.logger.progress('Deploying workspace...');
        const response = await this.updateRecord('sys_aw_master_config', args.workspace_id, updateData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to deploy workspace: ${response.error}`);
        }
        this.logger.info('✅ Workspace deployed');
        return this.createResponse(`✅ Workspace deployed!
✅ Active: ${args.activate !== false}
👥 Available to: ${args.roles?.join(', ') || 'All roles'}
🆔 sys_id: ${args.workspace_id}

✨ Agents can now access this workspace!`);
    }
    // Mobile Platform Methods
    async createMobileAppConfig(args) {
        this.logger.info('Creating mobile app config...', {
            name: args.name,
            app_id: args.app_id
        });
        const configData = {
            name: args.name,
            description: args.description || '',
            app_id: args.app_id,
            version: args.version || '1.0.0',
            platforms: args.platforms?.join(',') || 'ios,android',
            active: false
        };
        this.logger.progress('Creating app configuration...');
        const response = await this.createRecord('sys_mobile_config', configData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create app config: ${response.error}`);
        }
        const result = response.data;
        this.logger.info('✅ Mobile app config created', { sys_id: result.sys_id });
        return this.createResponse(`✅ Mobile App configured!
📱 **${args.name}**
🔖 App ID: ${args.app_id}
📦 Version: ${args.version || '1.0.0'}
🖥️ Platforms: ${args.platforms?.join(', ') || 'iOS, Android'}
🆔 sys_id: ${result.sys_id}

✨ App ready for configuration!`);
    }
    async configureMobileLayout(args) {
        this.logger.info('Configuring mobile layout...', {
            app_config: args.app_config,
            type: args.type
        });
        const layoutData = {
            app_config: args.app_config,
            name: args.name,
            type: args.type,
            components: JSON.stringify(args.components || [])
        };
        this.logger.progress('Creating layout...');
        const response = await this.createRecord('sys_mobile_layout', layoutData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create layout: ${response.error}`);
        }
        this.logger.info('✅ Layout configured');
        return this.createResponse(`✅ Mobile layout created!
📐 Name: ${args.name}
🎨 Type: ${args.type}
🧩 Components: ${args.components?.length || 0}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async createMobileApplet(args) {
        this.logger.info('Creating mobile applet...', { name: args.name });
        const appletData = {
            name: args.name,
            table: args.table,
            layout: args.layout || '',
            icon: args.icon || '',
            order: args.order || 100
        };
        this.logger.progress('Creating applet...');
        const response = await this.createRecord('sys_mobile_applet', appletData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create applet: ${response.error}`);
        }
        this.logger.info('✅ Applet created');
        return this.createResponse(`✅ Mobile applet created!
📲 Name: ${args.name}
📋 Table: ${args.table}
🎨 Icon: ${args.icon || 'Default'}
📊 Order: ${args.order || 100}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async configureOfflineTables(args) {
        this.logger.info('Configuring offline tables...', {
            app_config: args.app_config,
            tables: args.tables
        });
        const offlineData = {
            app_config: args.app_config,
            tables: args.tables.join(','),
            sync_rules: JSON.stringify(args.sync_rules || {}),
            frequency: args.frequency || 'on_demand'
        };
        this.logger.progress('Configuring offline sync...');
        const response = await this.createRecord('sys_mobile_offline', offlineData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to configure offline: ${response.error}`);
        }
        this.logger.info('✅ Offline sync configured');
        return this.createResponse(`✅ Offline sync configured!
📋 Tables: ${args.tables.join(', ')}
🔄 Frequency: ${args.frequency || 'On demand'}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async setMobileSecurity(args) {
        this.logger.info('Setting mobile security...', { app_config: args.app_config });
        const securityData = {
            app_config: args.app_config,
            require_pin: args.require_pin !== false,
            biometric_auth: args.biometric_auth || false,
            session_timeout: args.session_timeout || 30,
            data_encryption: args.data_encryption !== false
        };
        this.logger.progress('Applying security settings...');
        const response = await this.createRecord('sys_mobile_security', securityData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to set security: ${response.error}`);
        }
        this.logger.info('✅ Security configured');
        return this.createResponse(`✅ Mobile security configured!
🔐 PIN Required: ${args.require_pin !== false}
👆 Biometric: ${args.biometric_auth || false}
⏱️ Timeout: ${args.session_timeout || 30} minutes
🔒 Encryption: ${args.data_encryption !== false}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async pushNotificationConfig(args) {
        this.logger.info('Configuring push notifications...', { app_config: args.app_config });
        const notifData = {
            app_config: args.app_config,
            event_types: args.event_types.join(','),
            templates: JSON.stringify(args.templates || {}),
            enabled: args.enabled !== false
        };
        this.logger.progress('Setting up notifications...');
        const response = await this.createRecord('sys_push_notification', notifData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to configure notifications: ${response.error}`);
        }
        this.logger.info('✅ Push notifications configured');
        return this.createResponse(`✅ Push notifications configured!
🔔 Events: ${args.event_types.join(', ')}
✅ Enabled: ${args.enabled !== false}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async deployMobileApp(args) {
        this.logger.info('Deploying mobile app...', {
            app_config_id: args.app_config_id,
            environment: args.environment
        });
        const deployData = {
            app_config: args.app_config_id,
            environment: args.environment,
            deploy_to_stores: args.deploy_to_stores || false,
            release_notes: args.release_notes || '',
            deployment_date: new Date().toISOString()
        };
        this.logger.progress('Deploying app...');
        const response = await this.createRecord('sys_mobile_deployment', deployData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to deploy app: ${response.error}`);
        }
        // Update app config to active
        await this.updateRecord('sys_mobile_config', args.app_config_id, { active: true });
        this.logger.info('✅ Mobile app deployed');
        return this.createResponse(`✅ Mobile app deployed!
🚀 Environment: ${args.environment}
📱 Store Deployment: ${args.deploy_to_stores ? 'Yes' : 'No'}
📝 Release Notes: ${args.release_notes || 'None'}
🆔 Deployment ID: ${response.data.sys_id}

✨ App is now live in ${args.environment}!`);
    }
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        // Log ready state
        this.logger.info('🚀 ServiceNow Flow, Workspace & Mobile MCP Server (Enhanced) running');
        this.logger.info('📊 Token tracking enabled');
        this.logger.info('⏳ Progress indicators active');
    }
}
// Start the enhanced server
const server = new ServiceNowFlowWorkspaceMobileMCPEnhanced();
server.start().catch((error) => {
    console.error('Failed to start enhanced server:', error);
    process.exit(1);
});
//# sourceMappingURL=servicenow-flow-workspace-mobile-mcp-enhanced.js.map