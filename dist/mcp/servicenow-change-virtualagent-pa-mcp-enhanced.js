#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Change Management, Virtual Agent & Performance Analytics MCP Server - ENHANCED VERSION
 * With logging, token tracking, and progress indicators
 */
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const enhanced_base_mcp_server_js_1 = require("./shared/enhanced-base-mcp-server.js");
const mcp_config_manager_js_1 = require("../utils/mcp-config-manager.js");
class ServiceNowChangeVirtualAgentPAMCPEnhanced extends enhanced_base_mcp_server_js_1.EnhancedBaseMCPServer {
    constructor() {
        super('servicenow-change-virtualagent-pa-enhanced', '2.0.0');
        this.config = mcp_config_manager_js_1.mcpConfig.getConfig();
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                // Change Management Tools
                {
                    name: 'snow_create_change_request',
                    description: 'Creates change request in ServiceNow using change_request table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            short_description: { type: 'string', description: 'Change summary' },
                            description: { type: 'string', description: 'Detailed description' },
                            type: { type: 'string', description: 'normal, standard, emergency' },
                            risk: { type: 'string', description: 'high, moderate, low' },
                            impact: { type: 'string', description: '1-critical, 2-high, 3-moderate, 4-low' },
                            implementation_plan: { type: 'string', description: 'Implementation steps' },
                            backout_plan: { type: 'string', description: 'Rollback steps' },
                            test_plan: { type: 'string', description: 'Testing steps' },
                            justification: { type: 'string', description: 'Business justification' },
                            start_date: { type: 'string', description: 'Planned start (YYYY-MM-DD HH:MM:SS)' },
                            end_date: { type: 'string', description: 'Planned end (YYYY-MM-DD HH:MM:SS)' }
                        },
                        required: ['short_description', 'type']
                    }
                },
                {
                    name: 'snow_create_change_task',
                    description: 'Creates change task using change_task table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            change_request: { type: 'string', description: 'Parent change sys_id' },
                            short_description: { type: 'string', description: 'Task description' },
                            assignment_group: { type: 'string', description: 'Group sys_id' },
                            assigned_to: { type: 'string', description: 'User sys_id' },
                            order: { type: 'number', description: 'Task order' }
                        },
                        required: ['change_request', 'short_description']
                    }
                },
                {
                    name: 'snow_get_change_request',
                    description: 'Gets change request details from change_request table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: { type: 'string', description: 'Change request sys_id' },
                            include_tasks: { type: 'boolean', default: false }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_update_change_state',
                    description: 'Updates change request state in change_request table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: { type: 'string', description: 'Change request sys_id' },
                            state: { type: 'string', description: 'new, assess, authorize, scheduled, implement, review, closed' },
                            close_notes: { type: 'string', description: 'Closure notes' }
                        },
                        required: ['sys_id', 'state']
                    }
                },
                {
                    name: 'snow_schedule_cab_meeting',
                    description: 'Schedules CAB meeting using cab_meeting and cab_agenda_item tables.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            meeting_date: { type: 'string', description: 'Meeting date/time' },
                            location: { type: 'string', description: 'Meeting location' },
                            change_requests: { type: 'array', items: { type: 'string' }, description: 'Change sys_ids' }
                        },
                        required: ['meeting_date']
                    }
                },
                {
                    name: 'snow_search_change_requests',
                    description: 'Searches change requests in change_request table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' },
                            state: { type: 'string', description: 'Filter by state' },
                            type: { type: 'string', description: 'Filter by type' },
                            risk: { type: 'string', description: 'Filter by risk' },
                            limit: { type: 'number', default: 10 }
                        }
                    }
                },
                // Virtual Agent Tools
                {
                    name: 'snow_create_va_topic',
                    description: 'Creates virtual agent topic using sys_cs_topic table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Topic name' },
                            description: { type: 'string', description: 'Topic description' },
                            trigger_phrases: { type: 'array', items: { type: 'string' } },
                            category: { type: 'string', description: 'Topic category' },
                            active: { type: 'boolean', default: true }
                        },
                        required: ['name', 'trigger_phrases']
                    }
                },
                {
                    name: 'snow_create_va_topic_block',
                    description: 'Creates conversation blocks using sys_cs_topic_block table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string', description: 'Topic sys_id' },
                            type: { type: 'string', description: 'Block type: text, question, action' },
                            message: { type: 'string', description: 'Block message' },
                            order: { type: 'number', description: 'Block order' },
                            options: { type: 'array', items: { type: 'object' } }
                        },
                        required: ['topic', 'type', 'message']
                    }
                },
                {
                    name: 'snow_get_va_conversation',
                    description: 'Gets conversation history from sys_cs_conversation table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            conversation_id: { type: 'string', description: 'Conversation sys_id' },
                            user: { type: 'string', description: 'Filter by user' },
                            limit: { type: 'number', default: 50 }
                        }
                    }
                },
                {
                    name: 'snow_send_va_message',
                    description: 'Sends message to virtual agent using sys_cs_conversation table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            conversation_id: { type: 'string', description: 'Conversation ID' },
                            message: { type: 'string', description: 'User message' },
                            user: { type: 'string', description: 'User sys_id' }
                        },
                        required: ['message']
                    }
                },
                {
                    name: 'snow_handoff_to_agent',
                    description: 'Escalates conversation to live agent using sys_cs_conversation table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            conversation_id: { type: 'string', description: 'Conversation to escalate' },
                            reason: { type: 'string', description: 'Escalation reason' },
                            priority: { type: 'string', description: 'Priority level' }
                        },
                        required: ['conversation_id']
                    }
                },
                {
                    name: 'snow_discover_va_topics',
                    description: 'Lists all virtual agent topics from sys_cs_topic table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            active_only: { type: 'boolean', default: true },
                            category: { type: 'string', description: 'Filter by category' }
                        }
                    }
                },
                // Performance Analytics Tools
                {
                    name: 'snow_create_pa_indicator',
                    description: 'Creates PA indicator using pa_indicators table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Indicator name' },
                            table: { type: 'string', description: 'Source table' },
                            aggregate: { type: 'string', description: 'Aggregation: COUNT, SUM, AVG' },
                            field: { type: 'string', description: 'Field to aggregate' },
                            conditions: { type: 'string', description: 'Filter conditions' },
                            frequency: { type: 'string', description: 'daily, weekly, monthly' }
                        },
                        required: ['name', 'table', 'aggregate']
                    }
                },
                {
                    name: 'snow_create_pa_widget',
                    description: 'Creates PA dashboard widget using pa_widgets table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Widget name' },
                            indicator: { type: 'string', description: 'Indicator sys_id' },
                            type: { type: 'string', description: 'line, bar, pie, single_score' },
                            size: { type: 'string', description: 'small, medium, large' },
                            time_range: { type: 'string', description: 'Time range' }
                        },
                        required: ['name', 'indicator', 'type']
                    }
                },
                {
                    name: 'snow_create_pa_breakdown',
                    description: 'Creates PA breakdown using pa_breakdowns table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Breakdown name' },
                            source_table: { type: 'string', description: 'Source table' },
                            field: { type: 'string', description: 'Field to break down by' },
                            related_indicator: { type: 'string', description: 'Related indicator sys_id' }
                        },
                        required: ['name', 'source_table', 'field']
                    }
                },
                {
                    name: 'snow_create_pa_threshold',
                    description: 'Creates PA threshold using pa_thresholds table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            indicator: { type: 'string', description: 'Indicator sys_id' },
                            value: { type: 'number', description: 'Threshold value' },
                            direction: { type: 'string', description: 'above, below' },
                            color: { type: 'string', description: 'red, yellow, green' },
                            send_alert: { type: 'boolean', default: false }
                        },
                        required: ['indicator', 'value', 'direction']
                    }
                },
                {
                    name: 'snow_get_pa_scores',
                    description: 'Gets PA scores from pa_scores table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            indicator: { type: 'string', description: 'Indicator sys_id' },
                            start_date: { type: 'string', description: 'Start date' },
                            end_date: { type: 'string', description: 'End date' },
                            breakdown: { type: 'string', description: 'Breakdown sys_id' }
                        },
                        required: ['indicator']
                    }
                },
                {
                    name: 'snow_create_pa_target',
                    description: 'Creates PA target using pa_targets table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            indicator: { type: 'string', description: 'Indicator sys_id' },
                            target_value: { type: 'number', description: 'Target value' },
                            period: { type: 'string', description: 'monthly, quarterly, yearly' },
                            start_date: { type: 'string', description: 'Target start date' }
                        },
                        required: ['indicator', 'target_value']
                    }
                },
                {
                    name: 'snow_analyze_pa_trends',
                    description: 'Analyzes PA trends from pa_scores table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            indicator: { type: 'string', description: 'Indicator sys_id' },
                            period: { type: 'string', description: 'Analysis period' },
                            include_forecast: { type: 'boolean', default: false }
                        },
                        required: ['indicator']
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
                        // Change Management
                        case 'snow_create_change_request':
                            return await this.createChangeRequest(args);
                        case 'snow_create_change_task':
                            return await this.createChangeTask(args);
                        case 'snow_get_change_request':
                            return await this.getChangeRequest(args);
                        case 'snow_update_change_state':
                            return await this.updateChangeState(args);
                        case 'snow_schedule_cab_meeting':
                            return await this.scheduleCabMeeting(args);
                        case 'snow_search_change_requests':
                            return await this.searchChangeRequests(args);
                        // Virtual Agent
                        case 'snow_create_va_topic':
                            return await this.createVATopic(args);
                        case 'snow_create_va_topic_block':
                            return await this.createVATopicBlock(args);
                        case 'snow_get_va_conversation':
                            return await this.getVAConversation(args);
                        case 'snow_send_va_message':
                            return await this.sendVAMessage(args);
                        case 'snow_handoff_to_agent':
                            return await this.handoffToAgent(args);
                        case 'snow_discover_va_topics':
                            return await this.discoverVATopics(args);
                        // Performance Analytics
                        case 'snow_create_pa_indicator':
                            return await this.createPAIndicator(args);
                        case 'snow_create_pa_widget':
                            return await this.createPAWidget(args);
                        case 'snow_create_pa_breakdown':
                            return await this.createPABreakdown(args);
                        case 'snow_create_pa_threshold':
                            return await this.createPAThreshold(args);
                        case 'snow_get_pa_scores':
                            return await this.getPAScores(args);
                        case 'snow_create_pa_target':
                            return await this.createPATarget(args);
                        case 'snow_analyze_pa_trends':
                            return await this.analyzePATrends(args);
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
    // Change Management Methods
    async createChangeRequest(args) {
        this.logger.info('Creating change request...', {
            short_description: args.short_description,
            type: args.type,
            risk: args.risk
        });
        const changeData = {
            short_description: args.short_description,
            description: args.description || '',
            type: args.type,
            risk: args.risk || 'moderate',
            impact: args.impact || '3',
            implementation_plan: args.implementation_plan || '',
            backout_plan: args.backout_plan || '',
            test_plan: args.test_plan || '',
            justification: args.justification || '',
            start_date: args.start_date || '',
            end_date: args.end_date || '',
            state: 'new'
        };
        this.logger.progress('Creating change request in ServiceNow...');
        const response = await this.createRecord('change_request', changeData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create change: ${response.error}`);
        }
        const result = response.data;
        this.logger.info('✅ Change request created', {
            number: result.number,
            sys_id: result.sys_id
        });
        return this.createResponse(`✅ Change Request created!
📋 **${result.number}**
🔧 Type: ${args.type}
⚠️ Risk: ${args.risk || 'moderate'}
📊 Impact: ${args.impact || '3-moderate'}
🆔 sys_id: ${result.sys_id}
📅 Schedule: ${args.start_date || 'TBD'} - ${args.end_date || 'TBD'}

✨ Change request ready for assessment!`);
    }
    async createChangeTask(args) {
        this.logger.info('Creating change task...', { change_request: args.change_request });
        const taskData = {
            change_request: args.change_request,
            short_description: args.short_description,
            assignment_group: args.assignment_group || '',
            assigned_to: args.assigned_to || '',
            order: args.order || 100,
            state: 'pending'
        };
        this.logger.progress('Creating task...');
        const response = await this.createRecord('change_task', taskData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create task: ${response.error}`);
        }
        this.logger.info('✅ Change task created');
        return this.createResponse(`✅ Change task created!
📋 ${args.short_description}
🆔 sys_id: ${response.data.sys_id}
📊 Order: ${args.order || 100}`);
    }
    async getChangeRequest(args) {
        this.logger.info('Getting change request...', { sys_id: args.sys_id });
        const response = await this.getRecord('change_request', args.sys_id);
        if (!response.success) {
            return this.createResponse(`❌ Failed to get change: ${response.error}`);
        }
        const change = response.data;
        let details = `📋 **${change.number}**
🔧 Type: ${change.type}
⚠️ Risk: ${change.risk}
📊 State: ${change.state}
📅 Schedule: ${change.start_date} - ${change.end_date}
🆔 sys_id: ${change.sys_id}`;
        if (args.include_tasks) {
            const taskQuery = `change_request=${args.sys_id}`;
            const taskResponse = await this.queryTable('change_task', taskQuery, 20);
            if (taskResponse.success && taskResponse.data.result.length > 0) {
                details += `\n\n📌 Tasks (${taskResponse.data.result.length}):`;
                taskResponse.data.result.forEach((task) => {
                    details += `\n  • ${task.short_description} (${task.state})`;
                });
            }
        }
        this.logger.info('✅ Retrieved change details');
        return this.createResponse(details);
    }
    async updateChangeState(args) {
        this.logger.info('Updating change state...', {
            sys_id: args.sys_id,
            state: args.state
        });
        const updateData = { state: args.state };
        if (args.close_notes)
            updateData.close_notes = args.close_notes;
        const response = await this.updateRecord('change_request', args.sys_id, updateData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to update state: ${response.error}`);
        }
        this.logger.info('✅ Change state updated');
        return this.createResponse(`✅ Change state updated to: ${args.state}
🆔 sys_id: ${args.sys_id}`);
    }
    async scheduleCabMeeting(args) {
        this.logger.info('Scheduling CAB meeting...', { date: args.meeting_date });
        const meetingData = {
            meeting_date: args.meeting_date,
            location: args.location || 'Virtual',
            state: 'scheduled'
        };
        this.logger.progress('Creating CAB meeting...');
        const response = await this.createRecord('cab_meeting', meetingData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to schedule CAB: ${response.error}`);
        }
        const meeting = response.data;
        // Add change requests to agenda
        if (args.change_requests && args.change_requests.length > 0) {
            for (const changeId of args.change_requests) {
                await this.createRecord('cab_agenda_item', {
                    cab_meeting: meeting.sys_id,
                    change_request: changeId
                });
            }
        }
        this.logger.info('✅ CAB meeting scheduled');
        return this.createResponse(`✅ CAB Meeting scheduled!
📅 Date: ${args.meeting_date}
📍 Location: ${args.location || 'Virtual'}
📋 Changes: ${args.change_requests?.length || 0} items
🆔 sys_id: ${meeting.sys_id}`);
    }
    async searchChangeRequests(args) {
        this.logger.info('Searching change requests...', { query: args.query });
        let query = args.query ? `short_descriptionLIKE${args.query}` : '';
        if (args.state)
            query += `^state=${args.state}`;
        if (args.type)
            query += `^type=${args.type}`;
        if (args.risk)
            query += `^risk=${args.risk}`;
        this.logger.progress('Searching changes...');
        const response = await this.queryTable('change_request', query, args.limit || 10);
        if (!response.success) {
            return this.createResponse(`❌ Search failed: ${response.error}`);
        }
        const changes = response.data.result;
        if (!changes.length) {
            return this.createResponse(`❌ No changes found`);
        }
        this.logger.info(`Found ${changes.length} changes`);
        const changeList = changes.map((c) => `📋 **${c.number}** - ${c.short_description}
  🔧 ${c.type} | ⚠️ ${c.risk} | 📊 ${c.state}`).join('\n\n');
        return this.createResponse(`🔍 Change Requests:\n\n${changeList}\n\n✨ Found ${changes.length} change(s)`);
    }
    // Virtual Agent Methods
    async createVATopic(args) {
        this.logger.info('Creating VA topic...', { name: args.name });
        const topicData = {
            name: args.name,
            description: args.description || '',
            trigger_phrases: args.trigger_phrases.join(','),
            category: args.category || '',
            active: args.active !== false
        };
        this.logger.progress('Creating topic...');
        const response = await this.createRecord('sys_cs_topic', topicData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create topic: ${response.error}`);
        }
        this.logger.info('✅ VA topic created');
        return this.createResponse(`✅ Virtual Agent topic created!
🤖 **${args.name}**
💬 Triggers: ${args.trigger_phrases.join(', ')}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async createVATopicBlock(args) {
        this.logger.info('Creating topic block...', { topic: args.topic, type: args.type });
        const blockData = {
            topic: args.topic,
            type: args.type,
            message: args.message,
            order: args.order || 100,
            options: JSON.stringify(args.options || [])
        };
        this.logger.progress('Creating block...');
        const response = await this.createRecord('sys_cs_topic_block', blockData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create block: ${response.error}`);
        }
        this.logger.info('✅ Topic block created');
        return this.createResponse(`✅ Topic block created!
📝 Type: ${args.type}
💬 Message: ${args.message}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async getVAConversation(args) {
        this.logger.info('Getting VA conversation...');
        let query = '';
        if (args.conversation_id)
            query = `sys_id=${args.conversation_id}`;
        else if (args.user)
            query = `user=${args.user}`;
        const response = await this.queryTable('sys_cs_conversation', query, args.limit || 50);
        if (!response.success) {
            return this.createResponse(`❌ Failed to get conversation: ${response.error}`);
        }
        const messages = response.data.result;
        this.logger.info(`Retrieved ${messages.length} messages`);
        const conversation = messages.map((msg) => `[${msg.sys_created_on}] ${msg.from_user ? '👤' : '🤖'} ${msg.message}`).join('\n');
        return this.createResponse(`💬 Conversation History:\n\n${conversation}\n\n✨ ${messages.length} messages`);
    }
    async sendVAMessage(args) {
        this.logger.info('Sending VA message...', { message: args.message });
        const messageData = {
            conversation: args.conversation_id || '',
            message: args.message,
            user: args.user || 'api_user',
            from_user: true
        };
        this.logger.progress('Sending message...');
        const response = await this.createRecord('sys_cs_conversation', messageData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to send message: ${response.error}`);
        }
        this.logger.info('✅ Message sent');
        return this.createResponse(`✅ Message sent to Virtual Agent!
💬 "${args.message}"
🆔 Conversation: ${response.data.conversation || response.data.sys_id}`);
    }
    async handoffToAgent(args) {
        this.logger.info('Escalating to live agent...', { conversation_id: args.conversation_id });
        const updateData = {
            state: 'escalated',
            escalation_reason: args.reason || 'User requested agent',
            priority: args.priority || '3'
        };
        const response = await this.updateRecord('sys_cs_conversation', args.conversation_id, updateData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to escalate: ${response.error}`);
        }
        this.logger.info('✅ Escalated to agent');
        return this.createResponse(`✅ Conversation escalated to live agent!
📞 Reason: ${args.reason || 'User requested'}
⚡ Priority: ${args.priority || '3-moderate'}`);
    }
    async discoverVATopics(args) {
        this.logger.info('Discovering VA topics...');
        let query = args.active_only ? 'active=true' : '';
        if (args.category)
            query += `^category=${args.category}`;
        const response = await this.queryTable('sys_cs_topic', query, 50);
        if (!response.success) {
            return this.createResponse(`❌ Failed to discover topics: ${response.error}`);
        }
        const topics = response.data.result;
        this.logger.info(`Found ${topics.length} topics`);
        const topicList = topics.map((topic) => `🤖 **${topic.name}**
  📝 ${topic.description || 'No description'}
  🏷️ ${topic.category || 'Uncategorized'}`).join('\n\n');
        return this.createResponse(`🤖 Virtual Agent Topics:\n\n${topicList}\n\n✨ Total: ${topics.length} topics`);
    }
    // Performance Analytics Methods
    async createPAIndicator(args) {
        this.logger.info('Creating PA indicator...', {
            name: args.name,
            table: args.table,
            aggregate: args.aggregate
        });
        const indicatorData = {
            name: args.name,
            table: args.table,
            aggregate: args.aggregate,
            field: args.field || '',
            conditions: args.conditions || '',
            frequency: args.frequency || 'daily',
            active: true
        };
        this.logger.progress('Creating indicator...');
        const response = await this.createRecord('pa_indicators', indicatorData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create indicator: ${response.error}`);
        }
        this.logger.info('✅ PA indicator created');
        return this.createResponse(`✅ PA Indicator created!
📊 **${args.name}**
📋 Table: ${args.table}
📈 Aggregate: ${args.aggregate}${args.field ? ` on ${args.field}` : ''}
⏰ Frequency: ${args.frequency || 'daily'}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async createPAWidget(args) {
        this.logger.info('Creating PA widget...', {
            name: args.name,
            type: args.type
        });
        const widgetData = {
            name: args.name,
            indicator: args.indicator,
            type: args.type,
            size: args.size || 'medium',
            time_range: args.time_range || '30 days'
        };
        this.logger.progress('Creating widget...');
        const response = await this.createRecord('pa_widgets', widgetData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create widget: ${response.error}`);
        }
        this.logger.info('✅ PA widget created');
        return this.createResponse(`✅ PA Widget created!
📊 **${args.name}**
📈 Type: ${args.type}
📐 Size: ${args.size || 'medium'}
⏰ Range: ${args.time_range || '30 days'}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async createPABreakdown(args) {
        this.logger.info('Creating PA breakdown...', { name: args.name });
        const breakdownData = {
            name: args.name,
            source_table: args.source_table,
            field: args.field,
            related_indicator: args.related_indicator || ''
        };
        this.logger.progress('Creating breakdown...');
        const response = await this.createRecord('pa_breakdowns', breakdownData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create breakdown: ${response.error}`);
        }
        this.logger.info('✅ PA breakdown created');
        return this.createResponse(`✅ PA Breakdown created!
📊 **${args.name}**
📋 Table: ${args.source_table}
🔍 Field: ${args.field}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async createPAThreshold(args) {
        this.logger.info('Creating PA threshold...', {
            indicator: args.indicator,
            value: args.value
        });
        const thresholdData = {
            indicator: args.indicator,
            value: args.value,
            direction: args.direction,
            color: args.color || 'yellow',
            send_alert: args.send_alert || false
        };
        this.logger.progress('Creating threshold...');
        const response = await this.createRecord('pa_thresholds', thresholdData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create threshold: ${response.error}`);
        }
        this.logger.info('✅ PA threshold created');
        return this.createResponse(`✅ PA Threshold created!
⚠️ Value: ${args.value} (${args.direction})
🎨 Color: ${args.color || 'yellow'}
🔔 Alert: ${args.send_alert ? 'Yes' : 'No'}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async getPAScores(args) {
        this.logger.info('Getting PA scores...', { indicator: args.indicator });
        let query = `indicator=${args.indicator}`;
        if (args.start_date)
            query += `^sys_created_on>=${args.start_date}`;
        if (args.end_date)
            query += `^sys_created_on<=${args.end_date}`;
        if (args.breakdown)
            query += `^breakdown=${args.breakdown}`;
        this.logger.progress('Retrieving scores...');
        const response = await this.queryTable('pa_scores', query, 100);
        if (!response.success) {
            return this.createResponse(`❌ Failed to get scores: ${response.error}`);
        }
        const scores = response.data.result;
        if (!scores.length) {
            return this.createResponse(`❌ No scores found for indicator`);
        }
        this.logger.info(`Retrieved ${scores.length} scores`);
        // Calculate statistics
        const values = scores.map((s) => parseFloat(s.value));
        const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
        const min = Math.min(...values);
        const max = Math.max(...values);
        return this.createResponse(`📊 PA Scores:
📈 Average: ${avg}
⬇️ Min: ${min}
⬆️ Max: ${max}
📅 Period: ${scores.length} data points
✨ Latest: ${values[values.length - 1]}`);
    }
    async createPATarget(args) {
        this.logger.info('Creating PA target...', {
            indicator: args.indicator,
            target_value: args.target_value
        });
        const targetData = {
            indicator: args.indicator,
            target_value: args.target_value,
            period: args.period || 'monthly',
            start_date: args.start_date || new Date().toISOString()
        };
        this.logger.progress('Creating target...');
        const response = await this.createRecord('pa_targets', targetData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create target: ${response.error}`);
        }
        this.logger.info('✅ PA target created');
        return this.createResponse(`✅ PA Target created!
🎯 Target: ${args.target_value}
📅 Period: ${args.period || 'monthly'}
📆 Start: ${args.start_date || 'Today'}
🆔 sys_id: ${response.data.sys_id}`);
    }
    async analyzePATrends(args) {
        this.logger.info('Analyzing PA trends...', { indicator: args.indicator });
        const query = `indicator=${args.indicator}^ORDERBYsys_created_on`;
        const response = await this.queryTable('pa_scores', query, 100);
        if (!response.success) {
            return this.createResponse(`❌ Failed to analyze trends: ${response.error}`);
        }
        const scores = response.data.result;
        if (scores.length < 2) {
            return this.createResponse(`❌ Insufficient data for trend analysis`);
        }
        this.logger.info(`Analyzing ${scores.length} data points`);
        // Calculate trend
        const values = scores.map((s) => parseFloat(s.value));
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const trend = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1);
        const direction = parseFloat(trend) > 0 ? '📈 Upward' : parseFloat(trend) < 0 ? '📉 Downward' : '➡️ Stable';
        let analysis = `📊 Trend Analysis:
${direction} trend: ${Math.abs(parseFloat(trend))}%
📅 Period: ${scores.length} data points
📈 Current: ${values[values.length - 1]}
📉 Previous: ${values[values.length - 2]}`;
        if (args.include_forecast) {
            // Simple linear forecast
            const growthRate = parseFloat(trend) / 100;
            const forecast = (values[values.length - 1] * (1 + growthRate)).toFixed(2);
            analysis += `\n🔮 Next Period Forecast: ${forecast}`;
        }
        return this.createResponse(analysis);
    }
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        // Log ready state
        this.logger.info('🚀 ServiceNow Change, VA & PA MCP Server (Enhanced) running');
        this.logger.info('📊 Token tracking enabled');
        this.logger.info('⏳ Progress indicators active');
    }
}
// Start the enhanced server
const server = new ServiceNowChangeVirtualAgentPAMCPEnhanced();
server.start().catch((error) => {
    console.error('Failed to start enhanced server:', error);
    process.exit(1);
});
//# sourceMappingURL=servicenow-change-virtualagent-pa-mcp-enhanced.js.map