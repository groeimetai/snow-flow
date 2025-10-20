#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Knowledge Management & Service Catalog MCP Server
 * Handles knowledge articles, service catalog items, and related operations
 * Uses official ServiceNow REST APIs for kb_knowledge and sc_cat_item tables
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const mcp_auth_middleware_js_1 = require("../utils/mcp-auth-middleware.js");
const mcp_config_manager_js_1 = require("../utils/mcp-config-manager.js");
const mcp_logger_js_1 = require("./shared/mcp-logger.js");
class ServiceNowKnowledgeCatalogMCP {
    constructor() {
        this.server = new index_js_1.Server({
            name: 'servicenow-knowledge-catalog',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.logger = new mcp_logger_js_1.MCPLogger('ServiceNowKnowledgeCatalogMCP');
        this.config = mcp_config_manager_js_1.mcpConfig.getConfig();
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                // Knowledge Management Tools
                {
                    name: 'snow_create_knowledge_article',
                    description: 'Creates a knowledge article in ServiceNow Knowledge Base. Articles can contain solutions, how-to guides, or reference information.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            short_description: { type: 'string', description: 'Article title' },
                            text: { type: 'string', description: 'Article content (HTML supported)' },
                            kb_knowledge_base: { type: 'string', description: 'Knowledge base sys_id or name' },
                            kb_category: { type: 'string', description: 'Category sys_id or name' },
                            article_type: { type: 'string', description: 'Type: text, html, wiki' },
                            workflow_state: { type: 'string', description: 'State: draft, review, published, retired' },
                            valid_to: { type: 'string', description: 'Expiration date (YYYY-MM-DD)' },
                            meta_description: { type: 'string', description: 'SEO meta description' },
                            keywords: { type: 'array', items: { type: 'string' }, description: 'Search keywords' },
                            author: { type: 'string', description: 'Author user sys_id or username' }
                        },
                        required: ['short_description', 'text']
                    }
                },
                {
                    name: 'snow_search_knowledge',
                    description: 'Searches knowledge articles using keywords, categories, or filters. Returns relevant articles with snippets.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query text' },
                            kb_knowledge_base: { type: 'string', description: 'Filter by knowledge base' },
                            kb_category: { type: 'string', description: 'Filter by category' },
                            workflow_state: { type: 'string', description: 'Filter by state (published, draft, etc.)' },
                            limit: { type: 'number', description: 'Maximum results to return', default: 10 },
                            include_content: { type: 'boolean', description: 'Include full article content', default: false }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'snow_update_knowledge_article',
                    description: 'Updates an existing knowledge article. Can modify content, metadata, or workflow state.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: { type: 'string', description: 'Article sys_id to update' },
                            short_description: { type: 'string', description: 'Updated title' },
                            text: { type: 'string', description: 'Updated content' },
                            workflow_state: { type: 'string', description: 'New state' },
                            valid_to: { type: 'string', description: 'New expiration date' },
                            meta_description: { type: 'string', description: 'Updated SEO description' },
                            keywords: { type: 'array', items: { type: 'string' }, description: 'Updated keywords' }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_retire_knowledge_article',
                    description: 'Retires a knowledge article, making it unavailable for general use while preserving history.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: { type: 'string', description: 'Article sys_id to retire' },
                            retirement_reason: { type: 'string', description: 'Reason for retirement' },
                            replacement_article: { type: 'string', description: 'Replacement article sys_id (optional)' }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_create_knowledge_base',
                    description: 'Creates a new knowledge base for organizing articles by topic, department, or audience.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Knowledge base title' },
                            description: { type: 'string', description: 'Knowledge base description' },
                            owner: { type: 'string', description: 'Owner user or group' },
                            managers: { type: 'array', items: { type: 'string' }, description: 'Manager users or groups' },
                            kb_version: { type: 'string', description: 'Version number' },
                            active: { type: 'boolean', description: 'Active status', default: true }
                        },
                        required: ['title']
                    }
                },
                {
                    name: 'snow_discover_knowledge_bases',
                    description: 'Discovers available knowledge bases and their categories in the ServiceNow instance.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            active_only: { type: 'boolean', description: 'Show only active knowledge bases', default: true }
                        }
                    }
                },
                // Service Catalog Tools
                {
                    name: 'snow_create_catalog_item',
                    description: 'Creates a service catalog item for user self-service requests. Includes forms, workflows, and fulfillment.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Catalog item name' },
                            short_description: { type: 'string', description: 'Brief description' },
                            description: { type: 'string', description: 'Full description (HTML)' },
                            category: { type: 'string', description: 'Category sys_id or name' },
                            sc_catalogs: { type: 'string', description: 'Catalog sys_id or name' },
                            price: { type: 'string', description: 'Item price' },
                            recurring_price: { type: 'string', description: 'Recurring price' },
                            recurring_frequency: { type: 'string', description: 'Frequency: monthly, yearly' },
                            workflow: { type: 'string', description: 'Fulfillment workflow name' },
                            delivery_time: { type: 'string', description: 'Expected delivery time' },
                            active: { type: 'boolean', description: 'Active status', default: true },
                            billable: { type: 'boolean', description: 'Is billable', default: false },
                            mobile_hide_price: { type: 'boolean', description: 'Hide price on mobile', default: false }
                        },
                        required: ['name', 'short_description']
                    }
                },
                {
                    name: 'snow_create_catalog_variable',
                    description: 'Adds a variable (form field) to a catalog item for collecting user input during ordering.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            cat_item: { type: 'string', description: 'Catalog item sys_id' },
                            name: { type: 'string', description: 'Variable name' },
                            question_text: { type: 'string', description: 'Question to display' },
                            type: { type: 'string', description: 'Type: single_line_text, multi_line_text, select_box, checkbox, reference, etc.' },
                            order: { type: 'number', description: 'Display order' },
                            mandatory: { type: 'boolean', description: 'Is required', default: false },
                            default_value: { type: 'string', description: 'Default value' },
                            help_text: { type: 'string', description: 'Help text for users' },
                            reference: { type: 'string', description: 'Reference table (for reference type)' },
                            choice_table: { type: 'string', description: 'Choice list name (for select_box)' }
                        },
                        required: ['cat_item', 'name', 'question_text', 'type']
                    }
                },
                {
                    name: 'snow_create_catalog_ui_policy',
                    description: 'Creates comprehensive UI policies for catalog items with conditions and actions to control form behavior dynamically.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            cat_item: { type: 'string', description: 'Catalog item sys_id' },
                            short_description: { type: 'string', description: 'Policy name' },
                            condition: { type: 'string', description: 'Legacy condition script (optional if conditions array provided)' },
                            applies_to: { type: 'string', description: 'Applies to: item, set, or variable' },
                            active: { type: 'boolean', description: 'Active status', default: true },
                            on_load: { type: 'boolean', description: 'Run on form load', default: true },
                            reverse_if_false: { type: 'boolean', description: 'Reverse actions if false', default: true },
                            conditions: {
                                type: 'array',
                                description: 'Array of condition objects for dynamic policy evaluation',
                                items: {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string', description: 'Condition type (catalog_variable, javascript)', default: 'catalog_variable' },
                                        catalog_variable: { type: 'string', description: 'Target catalog variable sys_id or name' },
                                        operation: { type: 'string', description: 'Comparison operation: is, is_not, is_empty, is_not_empty, contains, does_not_contain', default: 'is' },
                                        value: { type: 'string', description: 'Comparison value' },
                                        and_or: { type: 'string', description: 'Logical operator with next condition: AND, OR', default: 'AND' }
                                    },
                                    required: ['catalog_variable', 'operation']
                                }
                            },
                            actions: {
                                type: 'array',
                                description: 'Array of action objects to execute when conditions are met',
                                items: {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string', description: 'Action type: set_mandatory, set_visible, set_readonly, set_value', default: 'set_visible' },
                                        catalog_variable: { type: 'string', description: 'Target catalog variable sys_id or name' },
                                        mandatory: { type: 'boolean', description: 'Set field as mandatory (for set_mandatory type)' },
                                        visible: { type: 'boolean', description: 'Set field visibility (for set_visible type)' },
                                        readonly: { type: 'boolean', description: 'Set field as readonly (for set_readonly type)' },
                                        value: { type: 'string', description: 'Value to set (for set_value type)' }
                                    },
                                    required: ['type', 'catalog_variable']
                                }
                            }
                        },
                        required: ['cat_item', 'short_description']
                    }
                },
                {
                    name: 'snow_create_catalog_client_script',
                    description: 'Creates client scripts for catalog items to add custom JavaScript behavior to forms.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            cat_item: { type: 'string', description: 'Catalog item sys_id' },
                            name: { type: 'string', description: 'Script name' },
                            script: { type: 'string', description: 'JavaScript code' },
                            type: { type: 'string', description: 'Type: onLoad, onChange, onSubmit, onCellEdit' },
                            applies_to: { type: 'string', description: 'Applies to: item, set, variable' },
                            variable: { type: 'string', description: 'Variable name (for onChange)' },
                            active: { type: 'boolean', description: 'Active status', default: true }
                        },
                        required: ['cat_item', 'name', 'script', 'type']
                    }
                },
                {
                    name: 'snow_search_catalog',
                    description: 'Searches service catalog for items, categories, or catalogs. Returns available items for ordering.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' },
                            category: { type: 'string', description: 'Filter by category' },
                            catalog: { type: 'string', description: 'Filter by catalog' },
                            active_only: { type: 'boolean', description: 'Show only active items', default: true },
                            include_variables: { type: 'boolean', description: 'Include item variables', default: false },
                            limit: { type: 'number', description: 'Maximum results', default: 20 }
                        }
                    }
                },
                {
                    name: 'snow_order_catalog_item',
                    description: 'Orders a catalog item programmatically, creating a request (RITM) with specified variable values.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            cat_item: { type: 'string', description: 'Catalog item sys_id' },
                            requested_for: { type: 'string', description: 'User sys_id or username' },
                            variables: { type: 'object', description: 'Variable name-value pairs' },
                            quantity: { type: 'number', description: 'Quantity to order', default: 1 },
                            delivery_address: { type: 'string', description: 'Delivery address' },
                            special_instructions: { type: 'string', description: 'Special instructions' }
                        },
                        required: ['cat_item', 'requested_for']
                    }
                },
                {
                    name: 'snow_get_catalog_item_details',
                    description: 'Gets detailed information about a catalog item including variables, pricing, and availability.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: { type: 'string', description: 'Catalog item sys_id' },
                            include_variables: { type: 'boolean', description: 'Include all variables', default: true },
                            include_ui_policies: { type: 'boolean', description: 'Include UI policies', default: false },
                            include_client_scripts: { type: 'boolean', description: 'Include client scripts', default: false }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_discover_catalogs',
                    description: 'Discovers available service catalogs and their categories in the ServiceNow instance.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            include_categories: { type: 'boolean', description: 'Include category tree', default: true },
                            active_only: { type: 'boolean', description: 'Show only active catalogs', default: true }
                        }
                    }
                }
            ]
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                // Start operation with token tracking
                this.logger.operationStart(name, args);
                const authResult = await mcp_auth_middleware_js_1.mcpAuth.ensureAuthenticated();
                if (!authResult.success) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, authResult.error || 'Authentication required');
                }
                let result;
                switch (name) {
                    // Knowledge Management
                    case 'snow_create_knowledge_article':
                        result = await this.createKnowledgeArticle(args);
                        break;
                    case 'snow_search_knowledge':
                        result = await this.searchKnowledge(args);
                        break;
                    case 'snow_update_knowledge_article':
                        result = await this.updateKnowledgeArticle(args);
                        break;
                    case 'snow_retire_knowledge_article':
                        result = await this.retireKnowledgeArticle(args);
                        break;
                    case 'snow_create_knowledge_base':
                        result = await this.createKnowledgeBase(args);
                        break;
                    case 'snow_discover_knowledge_bases':
                        result = await this.discoverKnowledgeBases(args);
                        break;
                    // Service Catalog
                    case 'snow_create_catalog_item':
                        result = await this.createCatalogItem(args);
                        break;
                    case 'snow_create_catalog_variable':
                        result = await this.createCatalogVariable(args);
                        break;
                    case 'snow_create_catalog_ui_policy':
                        result = await this.createCatalogUIPolicy(args);
                        break;
                    case 'snow_create_catalog_client_script':
                        result = await this.createCatalogClientScript(args);
                        break;
                    case 'snow_search_catalog':
                        result = await this.searchCatalog(args);
                        break;
                    case 'snow_order_catalog_item':
                        result = await this.orderCatalogItem(args);
                        break;
                    case 'snow_get_catalog_item_details':
                        result = await this.getCatalogItemDetails(args);
                        break;
                    case 'snow_discover_catalogs':
                        result = await this.discoverCatalogs(args);
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
                this.logger.error(`Error in ${request.params.name}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create Knowledge Article
     * Uses kb_knowledge table
     */
    async createKnowledgeArticle(args) {
        try {
            this.logger.info('Creating knowledge article...');
            // Find knowledge base if name provided
            let kbId = args.kb_knowledge_base;
            let kbFound = false;
            if (kbId) {
                // If it's already a sys_id, verify it exists
                if (kbId.match(/^[a-f0-9]{32}$/)) {
                    const kbVerifyResponse = await this.client.searchRecords('kb_knowledge_base', `sys_id=${kbId}`, 1);
                    if (kbVerifyResponse.success && kbVerifyResponse.data.result.length > 0) {
                        kbFound = true;
                        this.logger.info(`✅ Knowledge base verified with sys_id: ${kbId}`);
                    }
                }
                else {
                    // It's a name/title, search for it
                    const kbResponse = await this.client.searchRecords('kb_knowledge_base', `title=${kbId}`, 1);
                    if (kbResponse.success && kbResponse.data.result.length > 0) {
                        kbId = kbResponse.data.result[0].sys_id;
                        kbFound = true;
                        this.logger.info(`✅ Found knowledge base '${args.kb_knowledge_base}' with sys_id: ${kbId}`);
                    }
                }
                // If knowledge base was specified but not found, this is an error
                if (!kbFound) {
                    this.logger.error(`❌ Knowledge base '${args.kb_knowledge_base}' not found!`);
                    // List available knowledge bases to help the user
                    const availableKBs = await this.client.searchRecords('kb_knowledge_base', 'active=true', 10);
                    let kbList = '';
                    if (availableKBs.success && availableKBs.data.result.length > 0) {
                        kbList = '\n\n📚 **Available Knowledge Bases:**\n' +
                            availableKBs.data.result.map((kb) => `  - ${kb.title} (${kb.sys_id})`).join('\n');
                    }
                    throw new Error(`Knowledge base '${args.kb_knowledge_base}' does not exist! ` +
                        `Article cannot be created without a valid knowledge base.\n\n` +
                        `🔧 **Solution Options:**\n` +
                        `1. Use snow_create_knowledge_base to create a new knowledge base first\n` +
                        `2. Use snow_discover_knowledge_bases to list existing knowledge bases\n` +
                        `3. Specify a valid knowledge base sys_id or title${kbList}`);
                }
            }
            else {
                // No knowledge base specified - this should also be an error for proper article management
                this.logger.warn('⚠️ No knowledge base specified for article creation');
                throw new Error('Knowledge base is required for article creation!\n\n' +
                    '🔧 **Solution:**\n' +
                    '1. Specify kb_knowledge_base with either a sys_id or title\n' +
                    '2. Use snow_discover_knowledge_bases to list available options\n' +
                    '3. Or create a new one with snow_create_knowledge_base');
            }
            // Find category if name provided
            let categoryId = args.kb_category;
            if (categoryId && !categoryId.match(/^[a-f0-9]{32}$/)) {
                const catResponse = await this.client.searchRecords('kb_category', `label=${categoryId}`, 1);
                if (catResponse.success && catResponse.data.result.length) {
                    categoryId = catResponse.data.result[0].sys_id;
                }
            }
            const articleData = {
                short_description: args.short_description,
                text: args.text,
                kb_knowledge_base: kbId, // Now guaranteed to be valid or error thrown
                kb_category: categoryId || '',
                article_type: args.article_type || 'text',
                workflow_state: args.workflow_state || 'draft',
                valid_to: args.valid_to || '',
                meta_description: args.meta_description || '',
                keywords: args.keywords ? args.keywords.join(',') : '',
                author: args.author || ''
            };
            const updateSetResult = await this.client.ensureUpdateSet();
            this.logger.trackAPICall('CREATE', 'kb_knowledge', 1);
            const response = await this.client.createRecord('kb_knowledge', articleData);
            if (!response.success) {
                throw new Error(`Failed to create knowledge article: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Knowledge Article created successfully!

📚 **${args.short_description}**
🆔 sys_id: ${response.data.sys_id}
📂 Knowledge Base: ${args.kb_knowledge_base} (${kbId})
🏷️ Category: ${args.kb_category || 'Uncategorized'}
📝 Type: ${args.article_type || 'text'}
📊 State: ${args.workflow_state || 'draft'}
${args.keywords ? `🔍 Keywords: ${args.keywords.join(', ')}` : ''}
${args.valid_to ? `📅 Valid Until: ${args.valid_to}` : ''}

✨ Article created and ready for review!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create knowledge article:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create knowledge article: ${error}`);
        }
    }
    /**
     * Search Knowledge Articles
     * Uses kb_knowledge table with text search
     */
    async searchKnowledge(args) {
        try {
            this.logger.info('Searching knowledge articles...');
            let query = `short_descriptionLIKE${args.query}^ORtextLIKE${args.query}`;
            if (args.kb_knowledge_base) {
                query += `^kb_knowledge_base=${args.kb_knowledge_base}`;
            }
            if (args.kb_category) {
                query += `^kb_category=${args.kb_category}`;
            }
            if (args.workflow_state) {
                query += `^workflow_state=${args.workflow_state}`;
            }
            else {
                query += '^workflow_state=published'; // Default to published only
            }
            const limit = args.limit || 10;
            this.logger.trackAPICall('SEARCH', 'kb_knowledge', limit);
            const response = await this.client.searchRecords('kb_knowledge', query, limit);
            if (!response.success) {
                throw new Error('Failed to search knowledge articles');
            }
            const articles = response.data.result;
            if (!articles.length) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ No knowledge articles found matching "${args.query}"`
                        }]
                };
            }
            const articleList = articles.map((article) => {
                const snippet = args.include_content ?
                    article.text?.substring(0, 200) + '...' :
                    article.short_description;
                return `📄 **${article.short_description}**
🆔 ${article.sys_id}
📊 State: ${article.workflow_state}
📅 Updated: ${article.sys_updated_on}
${args.include_content ? `📝 ${snippet}` : ''}`;
            }).join('\n\n');
            return {
                content: [{
                        type: 'text',
                        text: `🔍 Knowledge Search Results for "${args.query}":

${articleList}

✨ Found ${articles.length} article(s)`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to search knowledge:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to search knowledge: ${error}`);
        }
    }
    /**
     * Update Knowledge Article
     */
    async updateKnowledgeArticle(args) {
        try {
            this.logger.info('Updating knowledge article...');
            const updateData = {};
            if (args.short_description)
                updateData.short_description = args.short_description;
            if (args.text)
                updateData.text = args.text;
            if (args.workflow_state)
                updateData.workflow_state = args.workflow_state;
            if (args.valid_to)
                updateData.valid_to = args.valid_to;
            if (args.meta_description)
                updateData.meta_description = args.meta_description;
            if (args.keywords)
                updateData.keywords = args.keywords.join(',');
            this.logger.trackAPICall('UPDATE', 'kb_knowledge', 1);
            const response = await this.client.updateRecord('kb_knowledge', args.sys_id, updateData);
            if (!response.success) {
                throw new Error(`Failed to update knowledge article: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Knowledge Article updated successfully!

🆔 sys_id: ${args.sys_id}
${args.short_description ? `📚 New Title: ${args.short_description}` : ''}
${args.workflow_state ? `📊 New State: ${args.workflow_state}` : ''}
${args.valid_to ? `📅 Valid Until: ${args.valid_to}` : ''}

✨ Article updated!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to update knowledge article:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to update knowledge article: ${error}`);
        }
    }
    /**
     * Retire Knowledge Article
     */
    async retireKnowledgeArticle(args) {
        try {
            this.logger.info('Retiring knowledge article...');
            const updateData = {
                workflow_state: 'retired',
                retirement_date: new Date().toISOString(),
                retirement_reason: args.retirement_reason || 'Retired via API'
            };
            if (args.replacement_article) {
                updateData['replacement_article'] = args.replacement_article;
            }
            this.logger.trackAPICall('UPDATE', 'kb_knowledge', 1);
            const response = await this.client.updateRecord('kb_knowledge', args.sys_id, updateData);
            if (!response.success) {
                throw new Error(`Failed to retire knowledge article: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Knowledge Article retired successfully!

🆔 sys_id: ${args.sys_id}
📊 State: Retired
📝 Reason: ${args.retirement_reason || 'Retired via API'}
${args.replacement_article ? `🔄 Replacement: ${args.replacement_article}` : ''}

✨ Article retired and archived!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to retire knowledge article:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to retire knowledge article: ${error}`);
        }
    }
    /**
     * Create Knowledge Base
     */
    async createKnowledgeBase(args) {
        try {
            this.logger.info('Creating knowledge base...');
            const kbData = {
                title: args.title,
                description: args.description || '',
                owner: args.owner || '',
                kb_version: args.kb_version || '1.0',
                active: args.active !== false
            };
            const updateSetResult = await this.client.ensureUpdateSet();
            const response = await this.client.createRecord('kb_knowledge_base', kbData);
            if (!response.success) {
                throw new Error(`Failed to create knowledge base: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Knowledge Base created successfully!

📚 **${args.title}**
🆔 sys_id: ${response.data.sys_id}
📝 Description: ${args.description || 'No description'}
👤 Owner: ${args.owner || 'Not specified'}
🔢 Version: ${args.kb_version || '1.0'}
🔄 Active: ${args.active !== false ? 'Yes' : 'No'}

✨ Knowledge base ready for articles!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create knowledge base:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create knowledge base: ${error}`);
        }
    }
    /**
     * Discover Knowledge Bases
     */
    async discoverKnowledgeBases(args) {
        try {
            this.logger.info('Discovering knowledge bases...');
            let query = '';
            if (args.active_only) {
                query = 'active=true';
            }
            const kbResponse = await this.client.searchRecords('kb_knowledge_base', query, 50);
            if (!kbResponse.success) {
                throw new Error('Failed to discover knowledge bases');
            }
            const knowledgeBases = kbResponse.data.result;
            // Get categories for each knowledge base
            const kbWithCategories = await Promise.all(knowledgeBases.map(async (kb) => {
                const catResponse = await this.client.searchRecords('kb_category', `kb_knowledge_base=${kb.sys_id}`, 20);
                const categories = catResponse.success ? catResponse.data.result : [];
                return { ...kb, categories };
            }));
            const kbText = kbWithCategories.map((kb) => {
                const categoryList = kb.categories.map((cat) => `  - ${cat.label}`).join('\n');
                return `📚 **${kb.title}** ${kb.active ? '✅' : '❌'}
🆔 ${kb.sys_id}
📝 ${kb.description || 'No description'}
📂 Categories:
${categoryList || '  No categories'}`;
            }).join('\n\n');
            return {
                content: [{
                        type: 'text',
                        text: `🔍 Discovered Knowledge Bases:

${kbText}

✨ Found ${knowledgeBases.length} knowledge base(s)`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to discover knowledge bases:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to discover knowledge bases: ${error}`);
        }
    }
    /**
     * Create Catalog Item
     * Uses sc_cat_item table
     */
    async createCatalogItem(args) {
        try {
            this.logger.info('Creating catalog item...');
            // Find category if name provided
            let categoryId = args.category;
            if (categoryId && !categoryId.match(/^[a-f0-9]{32}$/)) {
                const catResponse = await this.client.searchRecords('sc_category', `title=${categoryId}`, 1);
                if (catResponse.success && catResponse.data.result.length) {
                    categoryId = catResponse.data.result[0].sys_id;
                }
            }
            // Find catalog if name provided
            let catalogId = args.sc_catalogs;
            if (catalogId && !catalogId.match(/^[a-f0-9]{32}$/)) {
                const catalogResponse = await this.client.searchRecords('sc_catalog', `title=${catalogId}`, 1);
                if (catalogResponse.success && catalogResponse.data.result.length) {
                    catalogId = catalogResponse.data.result[0].sys_id;
                }
            }
            const itemData = {
                name: args.name,
                short_description: args.short_description,
                description: args.description || '',
                category: categoryId || '',
                sc_catalogs: catalogId || '',
                price: args.price || '0',
                recurring_price: args.recurring_price || '0',
                recurring_frequency: args.recurring_frequency || '',
                workflow: args.workflow || '',
                delivery_time: args.delivery_time || '3 business days',
                active: args.active !== false,
                billable: args.billable || false,
                mobile_hide_price: args.mobile_hide_price || false
            };
            const updateSetResult = await this.client.ensureUpdateSet();
            this.logger.trackAPICall('CREATE', 'sc_cat_item', 1);
            const response = await this.client.createRecord('sc_cat_item', itemData);
            if (!response.success) {
                throw new Error(`Failed to create catalog item: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Catalog Item created successfully!

🛍️ **${args.name}**
🆔 sys_id: ${response.data.sys_id}
📝 ${args.short_description}
${args.category ? `📂 Category: ${args.category}` : ''}
${args.price && args.price !== '0' ? `💰 Price: $${args.price}` : ''}
${args.recurring_price && args.recurring_price !== '0' ? `🔄 Recurring: $${args.recurring_price} ${args.recurring_frequency || ''}` : ''}
📦 Delivery: ${args.delivery_time || '3 business days'}
🔄 Active: ${args.active !== false ? 'Yes' : 'No'}

✨ Catalog item ready for ordering!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create catalog item:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create catalog item: ${error}`);
        }
    }
    /**
     * Create Catalog Variable
     * Uses sc_cat_item_option table (CORRECTED TABLE NAME)
     */
    async createCatalogVariable(args) {
        try {
            this.logger.info('Creating catalog variable...', { name: args.name, cat_item: args.cat_item });
            // Add ESSENTIAL missing fields that might be required
            const variableData = {
                // Required fields
                cat_item: args.cat_item,
                name: args.name,
                question_text: args.question_text,
                type: args.type || '1', // Default to string type
                // Essential fields that were missing
                active: true, // ✅ CRITICAL: Must be active
                order: args.order || 100,
                mandatory: args.mandatory || false,
                // Display settings
                display_type: args.display_type || 'normal',
                // Values
                default_value: args.default_value || '',
                help_text: args.help_text || '',
                // References and choices  
                reference: args.reference || '',
                choice_table: args.choice_table || '',
                // Security fields (might be required)
                write_roles: args.write_roles || '',
                read_roles: args.read_roles || '',
                // Additional fields
                example_text: args.example_text || '',
                tooltip: args.tooltip || ''
            };
            this.logger.info('🎯 Creating variable with payload:', variableData);
            // ✅ FIXED TABLE NAME: Use item_option_new (the correct table for catalog variables)
            const response = await this.client.createRecord('item_option_new', variableData);
            if (!response.success) {
                this.logger.error('❌ Variable creation failed:', {
                    error: response.error,
                    payload: variableData,
                    success: response.success
                });
                throw new Error(`Failed to create catalog variable: ${response.error}`);
            }
            const createdSysId = response.data.sys_id;
            this.logger.info(`✅ Variable created with sys_id: ${createdSysId}`);
            // 🔍 VERIFICATION: Check if variable was actually created
            this.logger.info('🔍 Verifying variable creation...');
            const verification = await this.client.searchRecords('item_option_new', `sys_id=${createdSysId}`, 1);
            if (!verification.success || verification.data.result.length === 0) {
                this.logger.error('❌ VERIFICATION FAILED: Variable not found after creation!');
                throw new Error(`Variable creation verification failed - not found in database`);
            }
            this.logger.info('✅ Variable verified in database');
            return {
                content: [{
                        type: 'text',
                        text: `✅ Catalog Variable created successfully!

📝 **${args.question_text}**
🆔 sys_id: ${response.data.sys_id}
🏷️ Name: ${args.name}
📊 Type: ${args.type}
🔢 Order: ${args.order || 100}
${args.mandatory ? '⚠️ Required: Yes' : '✅ Required: No'}
${args.default_value ? `📋 Default: ${args.default_value}` : ''}
${args.help_text ? `❓ Help: ${args.help_text}` : ''}

✨ Variable added to catalog item!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create catalog variable:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create catalog variable: ${error}`);
        }
    }
    /**
     * SIMPLIFIED Create Catalog UI Policy with Actions
     * ServiceNow catalog UI policies work differently - simpler approach
     */
    async createCatalogUIPolicy(args) {
        this.logger.info('🎯 SIMPLIFIED: Creating catalog UI policy with working approach...');
        // Simplified approach - focus on what actually works in ServiceNow
        try {
            this.logger.info('Creating comprehensive catalog UI policy...');
            // First, let's fetch ALL variables for this catalog item for debugging
            this.logger.info(`📋 Fetching all variables for catalog item ${args.cat_item} for debugging...`);
            try {
                const allVarsResponse = await this.client.searchRecords('sc_cat_item_option', `cat_item=${args.cat_item}`, 100);
                if (allVarsResponse.success && allVarsResponse.data.result.length > 0) {
                    this.logger.info(`📊 Found ${allVarsResponse.data.result.length} variables for this catalog item:`);
                    allVarsResponse.data.result.forEach((v) => {
                        this.logger.info(`  - Variable: name='${v.name}', sys_id='${v.sys_id}', question='${v.question_text}'`);
                    });
                }
                else {
                    this.logger.warn(`⚠️ No variables found for catalog item ${args.cat_item} - this might be a problem!`);
                }
            }
            catch (error) {
                this.logger.error(`❌ Failed to fetch variables for debugging:`, error);
            }
            // Helper function to resolve variable names to sys_ids with MULTIPLE FALLBACKS
            const resolveVariableId = async (variableName, catalogItem) => {
                // If already a sys_id, return as-is
                if (variableName && variableName.match(/^[a-f0-9]{32}$/)) {
                    this.logger.info(`✅ Using sys_id directly: ${variableName}`);
                    return variableName;
                }
                this.logger.info(`🔍 Resolving variable name '${variableName}' to sys_id for catalog item ${catalogItem}...`);
                // Try multiple search strategies for maximum compatibility
                const searchStrategies = [
                    // Strategy 1: Search by name field
                    {
                        query: `cat_item=${catalogItem}^name=${variableName}`,
                        description: 'by name field'
                    },
                    // Strategy 2: Search by name with LIKE operator
                    {
                        query: `cat_item=${catalogItem}^nameLIKE${variableName}`,
                        description: 'by name with LIKE'
                    },
                    // Strategy 3: Search by question_text
                    {
                        query: `cat_item=${catalogItem}^question_text=${variableName}`,
                        description: 'by question_text field'
                    },
                    // Strategy 4: Search all variables for this item and match manually
                    {
                        query: `cat_item=${catalogItem}`,
                        description: 'all variables for manual matching'
                    }
                ];
                for (const strategy of searchStrategies) {
                    this.logger.info(`🔍 Trying strategy: ${strategy.description}`);
                    try {
                        const varResponse = await this.client.searchRecords('sc_cat_item_option', strategy.query, 50 // Get more results for manual matching
                        );
                        if (varResponse.success && varResponse.data.result.length > 0) {
                            // For the "all variables" strategy, try to match manually
                            if (strategy.description === 'all variables for manual matching') {
                                const match = varResponse.data.result.find((v) => v.name === variableName ||
                                    v.question_text === variableName ||
                                    v.name?.toLowerCase() === variableName.toLowerCase());
                                if (match) {
                                    this.logger.info(`✅ Found variable through manual matching: ${match.sys_id}`);
                                    return match.sys_id;
                                }
                            }
                            else {
                                // Direct match found
                                const sysId = varResponse.data.result[0].sys_id;
                                this.logger.info(`✅ Resolved '${variableName}' to sys_id: ${sysId} (${strategy.description})`);
                                return sysId;
                            }
                        }
                    }
                    catch (error) {
                        this.logger.warn(`⚠️ Strategy failed: ${strategy.description}`, error);
                    }
                }
                // If all strategies fail, try alternate table names (just in case)
                const alternateTables = ['item_option_new', 'io_set_item_option'];
                for (const table of alternateTables) {
                    this.logger.info(`🔍 Trying alternate table: ${table}`);
                    try {
                        const varResponse = await this.client.searchRecords(table, `cat_item=${catalogItem}^name=${variableName}`, 1);
                        if (varResponse.success && varResponse.data.result.length > 0) {
                            const sysId = varResponse.data.result[0].sys_id;
                            this.logger.info(`✅ Found in alternate table ${table}: ${sysId}`);
                            return sysId;
                        }
                    }
                    catch (error) {
                        this.logger.warn(`⚠️ Alternate table ${table} failed:`, error);
                    }
                }
                this.logger.error(`❌ CRITICAL: Variable '${variableName}' not found in any table for catalog item ${catalogItem}`);
                this.logger.error(`❌ This will cause the action to fail! Please use the sys_id directly instead of the name.`);
                // Return the name but log a warning that this will fail
                return variableName;
            };
            // Helper function to map operations to correct ServiceNow format
            const mapOperatorToServiceNow = (operator) => {
                const opMap = {
                    'is': '=',
                    'equals': '=',
                    'is_not': '!=',
                    'is not': '!=',
                    'not equals': '!=',
                    'contains': 'LIKE',
                    'does_not_contain': 'NOT LIKE',
                    'does not contain': 'NOT LIKE',
                    'greater_than': '>',
                    'greater than': '>',
                    'less_than': '<',
                    'less than': '<',
                    'is_empty': 'ISEMPTY',
                    'is empty': 'ISEMPTY',
                    'is_not_empty': 'ISNOTEMPTY', // ✅ CRITICAL FIX: was missing!
                    'is not empty': 'ISNOTEMPTY'
                };
                const normalizedOp = operator.toLowerCase().trim();
                const mapped = opMap[normalizedOp] || operator;
                this.logger.info(`🎯 Mapped operator '${operator}' -> '${mapped}'`);
                return mapped;
            };
            // Build condition string from conditions array
            let conditionString = '';
            this.logger.info('Checking conditions parameter:', {
                hasConditions: !!args.conditions,
                isArray: Array.isArray(args.conditions),
                length: args.conditions ? args.conditions.length : 0,
                conditionsData: args.conditions
            });
            if (args.conditions && Array.isArray(args.conditions)) {
                this.logger.info(`🎯 Building conditions string from ${args.conditions.length} conditions...`);
                const conditionParts = [];
                for (const condition of args.conditions) {
                    // Resolve variable name to sys_id
                    const variableId = await resolveVariableId(condition.catalog_variable, args.cat_item);
                    // Get the correct ServiceNow operator
                    const originalOperator = condition.operation || 'is';
                    const serviceNowOperator = mapOperatorToServiceNow(originalOperator);
                    // Safely get condition value (avoid undefined concatenation)
                    const conditionValue = condition.value || '';
                    // Build the condition part based on operator type
                    // ✅ CRITICAL: Conditions must use IO:sys_id format for catalog variables!
                    // BUT only if we successfully resolved the variable to a sys_id
                    const isValidSysId = variableId && variableId.match(/^[a-f0-9]{32}$/);
                    const variableWithIOPrefix = isValidSysId ? `IO:${variableId}` : variableId;
                    if (!isValidSysId) {
                        this.logger.warn(`⚠️ Variable '${condition.catalog_variable}' could not be resolved to sys_id - condition may fail!`);
                    }
                    let conditionPart = '';
                    if (serviceNowOperator === 'ISEMPTY' || serviceNowOperator === 'ISNOTEMPTY') {
                        // For empty/not empty checks, no value needed
                        conditionPart = `${variableWithIOPrefix}${serviceNowOperator}`;
                    }
                    else if (serviceNowOperator === 'LIKE' || serviceNowOperator === 'NOT LIKE') {
                        // For LIKE operations, ensure value is wrapped properly
                        conditionPart = `${variableWithIOPrefix}${serviceNowOperator}${conditionValue}`;
                    }
                    else {
                        // Standard operations (=, !=, >, <, etc.)
                        conditionPart = `${variableWithIOPrefix}${serviceNowOperator}${conditionValue}`;
                    }
                    this.logger.info(`🏗️ Built condition part: ${conditionPart} (from ${originalOperator}: '${conditionValue}')`);
                    conditionParts.push(conditionPart);
                }
                // Join all conditions with ^ separator (ServiceNow query format)
                conditionString = conditionParts.join('^');
                this.logger.info(`✅ Built conditions string: "${conditionString}"`);
            }
            // ✅ CRITICAL FIX: Create in catalog_ui_policy table!
            // The actions reference catalog_ui_policy, NOT sys_ui_policy!
            const policyData = {
                // catalog_ui_policy fields
                short_description: args.short_description,
                catalog_item: args.cat_item, // Reference to the catalog item
                catalog_conditions: conditionString || args.condition || '', // Conditions as string
                applies_catalog: true, // This is a catalog policy
                active: args.active !== false,
                applies_on: args.applies_on || 'true', // When to apply: 'true', 'false', or 'both'
                reverse_if_false: args.reverse_if_false !== false,
                // Optional script fields
                script_true: args.script_true || '',
                script_false: args.script_false || ''
            };
            this.logger.info('🎯 Creating main policy in catalog_ui_policy table with data:', policyData);
            const policyResponse = await this.client.createRecord('catalog_ui_policy', policyData);
            if (!policyResponse.success) {
                this.logger.error('❌ Policy creation failed:', policyResponse.error);
                throw new Error(`Failed to create catalog UI policy: ${policyResponse.error}`);
            }
            const policyId = policyResponse.data.sys_id;
            this.logger.info(`✅ Created main policy with sys_id: ${policyId}`);
            const createdActions = [];
            // Step 2: Create action records (dit werkt wel met aparte tabel)
            this.logger.info('Checking actions parameter:', {
                hasActions: !!args.actions,
                isArray: Array.isArray(args.actions),
                length: args.actions ? args.actions.length : 0,
                actionsData: args.actions
            });
            if (args.actions && Array.isArray(args.actions)) {
                this.logger.info(`🎯 Starting to create ${args.actions.length} action records...`);
                for (let i = 0; i < args.actions.length; i++) {
                    const action = args.actions[i];
                    // Resolve variable name to sys_id
                    this.logger.info(`🔍 Resolving variable: ${action.catalog_variable} for catalog item: ${args.cat_item}`);
                    const variableId = await resolveVariableId(action.catalog_variable, args.cat_item);
                    // Check if resolution actually worked (should be a sys_id now)
                    const isValidSysId = variableId && variableId.match(/^[a-f0-9]{32}$/);
                    if (!isValidSysId) {
                        this.logger.error(`❌ CRITICAL: Failed to resolve variable '${action.catalog_variable}' to sys_id!`);
                        this.logger.error(`❌ Got: ${variableId} (this is not a valid sys_id)`);
                        // Continue anyway but it will likely fail
                    }
                    else {
                        this.logger.info(`✅ Resolved to variable sys_id: ${variableId}`);
                    }
                    // ✅ CRITICAL FIX: Add "IO:" prefix as required by ServiceNow
                    // BUT ONLY if we have a valid sys_id!
                    const catalogVariableWithPrefix = isValidSysId ? `IO:${variableId}` : variableId;
                    this.logger.info(`🎯 Using catalog_variable value: ${catalogVariableWithPrefix}`);
                    // Actions structure in ServiceNow:
                    // - catalog_ui_policy_action.catalog_variable -> "IO:" + variable_sys_id (required format)
                    // - catalog_ui_policy_action.ui_policy -> catalog_ui_policy.sys_id
                    // ✅ CRITICAL: Build action data according to ServiceNow's exact structure
                    // catalog_ui_policy_action inherits from sys_ui_policy_action
                    // We must set fields in the correct way for ServiceNow to accept them
                    const actionData = {};
                    // STEP 1: ENHANCED VERIFICATION - Verify policy exists before creating actions
                    this.logger.info(`🔍 ENHANCED DEBUG: Verifying policy ${policyId} exists before creating action...`);
                    if (!policyId) {
                        this.logger.error(`❌ CRITICAL: No policyId available for action ${i + 1}!`);
                        throw new Error(`Cannot create action without valid policy ID`);
                    }
                    // ✅ NEW: Test policy existence before action creation
                    const policyExists = await this.client.searchRecords('catalog_ui_policy', `sys_id=${policyId}`, 1);
                    if (!policyExists.success || policyExists.data.result.length === 0) {
                        this.logger.error(`❌ CRITICAL: Policy ${policyId} does not exist in catalog_ui_policy table!`);
                        throw new Error(`Policy verification failed - cannot create action without valid policy`);
                    }
                    const existingPolicy = policyExists.data.result[0];
                    this.logger.info(`✅ Policy verification successful:`);
                    this.logger.info(`   - Policy sys_id: ${existingPolicy.sys_id}`);
                    this.logger.info(`   - Policy name: ${existingPolicy.short_description || 'N/A'}`);
                    this.logger.info(`   - Policy active: ${existingPolicy.active}`);
                    // STEP 2: Set reference fields with enhanced validation
                    // ✅ ui_policy is a reference to catalog_ui_policy - test multiple formats
                    this.logger.info(`📝 Setting ui_policy reference to: ${policyId}`);
                    // Try setting the reference in the most explicit way possible
                    actionData.ui_policy = policyId;
                    // ✅ catalog_item is a reference to sc_cat_item - use sys_id directly  
                    if (!args.cat_item) {
                        this.logger.error(`❌ CRITICAL: No catalog item ID provided!`);
                        throw new Error(`Cannot create action without catalog item ID`);
                    }
                    this.logger.info(`📝 Setting catalog_item reference to: ${args.cat_item}`);
                    actionData.catalog_item = args.cat_item;
                    // STEP 3: Set the catalog_variable with IO: prefix (STRING field, not reference)
                    this.logger.info(`📝 Setting catalog_variable to: ${catalogVariableWithPrefix}`);
                    actionData.catalog_variable = catalogVariableWithPrefix;
                    // STEP 4: Set action properties with correct values
                    // ✅ CRITICAL: Use "ignore" instead of not setting or using false
                    // This is how ServiceNow differentiates between "don't change" and "set to false"
                    if (action.visible !== undefined) {
                        actionData.visible = action.visible === true ? 'true' :
                            action.visible === false ? 'false' : 'ignore';
                    }
                    else {
                        actionData.visible = 'ignore'; // Default to ignore if not specified
                    }
                    if (action.mandatory !== undefined) {
                        actionData.mandatory = action.mandatory === true ? 'true' :
                            action.mandatory === false ? 'false' : 'ignore';
                    }
                    else {
                        actionData.mandatory = 'ignore'; // Default to ignore if not specified
                    }
                    if (action.readonly !== undefined) {
                        actionData.disabled = action.readonly === true ? 'true' :
                            action.readonly === false ? 'false' : 'ignore';
                    }
                    else {
                        actionData.disabled = 'ignore'; // Default to ignore if not specified
                    }
                    // STEP 5: Set optional value field
                    if (action.value !== undefined && action.value !== null && action.value !== '') {
                        actionData.value = String(action.value);
                    }
                    // STEP 6: Set other metadata
                    actionData.order = (i + 1) * 100;
                    actionData.active = true;
                    this.logger.info(`🔗 Creating action with VALIDATED structure:`);
                    this.logger.info(`  - ui_policy (ref): ${policyId} [VERIFIED EXISTS]`);
                    this.logger.info(`  - catalog_item (ref): ${args.cat_item}`);
                    this.logger.info(`  - catalog_variable: ${catalogVariableWithPrefix}`);
                    this.logger.info(`  - visible: ${actionData.visible}`);
                    this.logger.info(`  - mandatory: ${actionData.mandatory}`);
                    this.logger.info(`  - disabled: ${actionData.disabled}`);
                    // ✅ ENHANCED DEBUG: Log complete action data being sent
                    this.logger.info(`📋 Complete action data being sent to ServiceNow:`, JSON.stringify(actionData, null, 2));
                    this.logger.info(`🎯 Attempting to create action ${i + 1} in catalog_ui_policy_action table...`);
                    const actionResponse = await this.client.createRecord('catalog_ui_policy_action', actionData);
                    if (actionResponse.success) {
                        const createdActionId = actionResponse.data.sys_id;
                        this.logger.info(`✅ Created action with sys_id: ${createdActionId}`);
                        // 🔍 VERIFICATION: Check if action was actually created AND fields are populated
                        this.logger.info(`🔍 Verifying action ${i + 1} creation and field population...`);
                        const actionVerification = await this.client.searchRecords('catalog_ui_policy_action', `sys_id=${createdActionId}`, 1);
                        if (!actionVerification.success || actionVerification.data.result.length === 0) {
                            this.logger.error('❌ ACTION VERIFICATION FAILED: Action not found after creation!');
                            throw new Error(`Action creation verification failed - action ${i + 1} not found in database`);
                        }
                        // ✅ NEW: Verify that critical fields are actually populated
                        const createdAction = actionVerification.data.result[0];
                        this.logger.info(`📋 Created action data:`, {
                            sys_id: createdAction.sys_id,
                            ui_policy: createdAction.ui_policy || '❌ EMPTY',
                            catalog_variable: createdAction.catalog_variable || '❌ EMPTY',
                            catalog_item: createdAction.catalog_item || '❌ EMPTY',
                            visible: createdAction.visible,
                            mandatory: createdAction.mandatory,
                            disabled: createdAction.disabled
                        });
                        // ✅ ENHANCED VERIFICATION: Check if critical fields are populated correctly
                        const uiPolicyValue = createdAction.ui_policy;
                        const catalogVariableValue = createdAction.catalog_variable;
                        const catalogItemValue = createdAction.catalog_item;
                        // Log the raw response to understand what ServiceNow returns
                        this.logger.info(`📋 Raw action verification response:`, JSON.stringify(createdAction, null, 2));
                        // Check ui_policy reference - ServiceNow might return it as an object
                        let actualUiPolicyId = uiPolicyValue;
                        if (typeof uiPolicyValue === 'object' && uiPolicyValue !== null) {
                            actualUiPolicyId = uiPolicyValue.value || uiPolicyValue.sys_id || '';
                            this.logger.info(`📝 ui_policy returned as object: ${JSON.stringify(uiPolicyValue)}`);
                        }
                        if (!actualUiPolicyId || actualUiPolicyId === '' || actualUiPolicyId === '{}') {
                            this.logger.error(`❌ CRITICAL: ui_policy field is EMPTY for action ${i + 1}!`);
                            this.logger.error(`❌ Expected policy ID: ${policyId}`);
                            this.logger.error(`❌ Raw ui_policy value: ${JSON.stringify(uiPolicyValue)}`);
                            this.logger.error(`❌ Parsed ui_policy value: ${actualUiPolicyId}`);
                            this.logger.error(`❌ Action data sent:`, JSON.stringify(actionData, null, 2));
                            this.logger.error(`❌ Full action verification response:`, JSON.stringify(createdAction, null, 2));
                            // ✅ ENHANCED ERROR: Try to understand ServiceNow's response pattern
                            this.logger.error(`ℹ️ DIAGNOSTIC INFO:`);
                            this.logger.error(`   - Policy verified to exist: YES (${policyId})`);
                            this.logger.error(`   - Action created successfully: YES (${createdActionId})`);
                            this.logger.error(`   - ui_policy field type: ${typeof uiPolicyValue}`);
                            this.logger.error(`   - ui_policy field value length: ${String(uiPolicyValue || '').length}`);
                            this.logger.error(`   - All action fields:`, Object.keys(createdAction));
                            // Check if it's a ServiceNow API timing issue
                            this.logger.warn(`🔄 ATTEMPTING SECONDARY VERIFICATION (possible timing issue)...`);
                            // Wait a moment and try again
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            const secondVerification = await this.client.searchRecords('catalog_ui_policy_action', `sys_id=${createdActionId}`, 1);
                            if (secondVerification.success && secondVerification.data.result.length > 0) {
                                const reCheckedAction = secondVerification.data.result[0];
                                const reCheckedUiPolicy = reCheckedAction.ui_policy;
                                this.logger.error(`🔄 Secondary verification ui_policy: ${JSON.stringify(reCheckedUiPolicy)}`);
                                if (reCheckedUiPolicy && reCheckedUiPolicy !== '' && reCheckedUiPolicy !== '{}') {
                                    this.logger.warn(`⚠️ This was a timing issue - ui_policy populated after delay`);
                                    // Continue with the re-checked value
                                    return; // Skip the error throwing
                                }
                            }
                            throw new Error(`Action ${i + 1} created but ui_policy field is empty - action will not work! This may be a ServiceNow API or table structure issue.`);
                        }
                        // For reference fields, ServiceNow might return an object - extract the value
                        const uiPolicySysId = typeof uiPolicyValue === 'object' && uiPolicyValue.value ?
                            uiPolicyValue.value : uiPolicyValue;
                        this.logger.info(`✅ ui_policy field populated successfully: ${actualUiPolicyId}`);
                        if (uiPolicySysId !== policyId) {
                            this.logger.warn(`⚠️ ui_policy mismatch - Expected: ${policyId}, Got: ${uiPolicySysId}`);
                        }
                        else {
                            this.logger.info(`✅ ui_policy reference matches expected value`);
                        }
                        // Check catalog_variable (should have IO: prefix)
                        if (!catalogVariableValue || catalogVariableValue === '') {
                            this.logger.error(`❌ CRITICAL: catalog_variable field is EMPTY for action ${i + 1}!`);
                            this.logger.error(`❌ Expected: ${catalogVariableWithPrefix}, Got: ${catalogVariableValue}`);
                            throw new Error(`Action ${i + 1} created but catalog_variable field is empty - action will not work!`);
                        }
                        if (!catalogVariableValue.startsWith('IO:')) {
                            this.logger.warn(`⚠️ catalog_variable missing IO: prefix - Got: ${catalogVariableValue}`);
                        }
                        // Check catalog_item reference
                        if (!catalogItemValue || catalogItemValue === '' || catalogItemValue === '{}') {
                            this.logger.error(`❌ CRITICAL: catalog_item field is EMPTY for action ${i + 1}!`);
                            this.logger.error(`❌ Expected: ${args.cat_item}, Got: ${catalogItemValue}`);
                            throw new Error(`Action ${i + 1} created but catalog_item field is empty - action will not work!`);
                        }
                        const catalogItemSysId = typeof catalogItemValue === 'object' && catalogItemValue.value ?
                            catalogItemValue.value : catalogItemValue;
                        if (catalogItemSysId !== args.cat_item) {
                            this.logger.warn(`⚠️ catalog_item mismatch - Expected: ${args.cat_item}, Got: ${catalogItemSysId}`);
                        }
                        this.logger.info(`✅ Action ${i + 1} verified in database with all fields populated`);
                        createdActions.push({
                            sys_id: createdActionId,
                            variable: action.catalog_variable,
                            details: this.formatActionDetails(action)
                        });
                    }
                    else {
                        const errorMsg = `❌ Failed to create action ${i + 1}: ${actionResponse.error || 'Unknown error'}`;
                        this.logger.error(errorMsg);
                        this.logger.error('❌ Action data was:', actionData);
                        this.logger.error('❌ Response details:', {
                            success: actionResponse.success,
                            error: actionResponse.error,
                            data: actionResponse.data
                        });
                        // BELANGRIJK: Gooi een error zodat de gebruiker weet dat het faalt!
                        throw new Error(errorMsg);
                    }
                }
            }
            // 🔍 FINAL VERIFICATION: Policy creation in catalog_ui_policy table
            this.logger.info('🔍 Final verification: Checking policy in catalog_ui_policy table...');
            const policyVerification = await this.client.searchRecords('catalog_ui_policy', `sys_id=${policyId}`, 1);
            if (!policyVerification.success || policyVerification.data.result.length === 0) {
                this.logger.error('❌ POLICY VERIFICATION FAILED: Policy not found in catalog_ui_policy table!');
                throw new Error(`Policy creation verification failed - policy not found in catalog_ui_policy table`);
            }
            this.logger.info('✅ Policy verified in catalog_ui_policy table');
            // Build comprehensive response
            let responseText = `✅ Catalog UI Policy created successfully!

📋 **${args.short_description}**
🆔 Policy sys_id: ${policyId}
📊 Table: catalog_ui_policy (correct table for catalog actions)
🎯 Catalog Item: ${args.cat_item}
🔄 Active: ${args.active !== false ? 'Yes' : 'No'}
⚡ Applies On: ${args.applies_on || 'true'}
🔁 Reverse if False: ${args.reverse_if_false !== false ? 'Yes' : 'No'}

🔍 **Verification Results:**
✅ Policy record created in catalog_ui_policy table
✅ ${createdActions.length} actions created in catalog_ui_policy_action table`;
            if (conditionString) {
                responseText += `\n\n📝 **Conditions:**\n${conditionString}`;
            }
            if (createdActions.length > 0) {
                responseText += `\n\n⚡ **Actions Created (${createdActions.length}):**\n`;
                createdActions.forEach((action, i) => {
                    responseText += `   ${i + 1}. ${action.details} on ${action.variable}\n`;
                });
            }
            responseText += `\n\n✨ UI policy configured successfully with ${createdActions.length} actions!`;
            return {
                content: [{
                        type: 'text',
                        text: responseText
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create catalog UI policy:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create catalog UI policy: ${error}`);
        }
    }
    /**
     * Helper function to format action details for display
     */
    formatActionDetails(action) {
        const details = [];
        if (action.mandatory !== undefined) {
            details.push(`Mandatory: ${action.mandatory}`);
        }
        if (action.visible !== undefined) {
            details.push(`Visible: ${action.visible}`);
        }
        if (action.readonly !== undefined) {
            details.push(`Read-only: ${action.readonly}`);
        }
        if (action.value !== undefined && action.value !== '') {
            details.push(`Value: "${action.value}"`);
        }
        return details.length > 0 ? details.join(', ') : 'No specific action';
    }
    /**
     * Create Catalog Client Script
     * Uses catalog_script_client table
     */
    async createCatalogClientScript(args) {
        try {
            this.logger.info('Creating catalog client script...');
            const scriptData = {
                cat_item: args.cat_item,
                name: args.name,
                script: args.script,
                type: args.type,
                applies_to: args.applies_to || 'item',
                cat_variable: args.variable || '',
                active: args.active !== false
            };
            const response = await this.client.createRecord('catalog_script_client', scriptData);
            if (!response.success) {
                throw new Error(`Failed to create catalog client script: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Catalog Client Script created successfully!

📜 **${args.name}**
🆔 sys_id: ${response.data.sys_id}
🎯 Type: ${args.type}
📍 Applies to: ${args.applies_to || 'item'}
${args.variable ? `📝 Variable: ${args.variable}` : ''}
🔄 Active: ${args.active !== false ? 'Yes' : 'No'}

✨ Client script added to catalog item!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create catalog client script:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create catalog client script: ${error}`);
        }
    }
    /**
     * Search Service Catalog
     */
    async searchCatalog(args) {
        try {
            this.logger.info('Searching service catalog...');
            let query = args.query ? `nameLIKE${args.query}^ORshort_descriptionLIKE${args.query}` : '';
            if (args.category) {
                query += query ? '^' : '';
                query += `category=${args.category}`;
            }
            if (args.catalog) {
                query += query ? '^' : '';
                query += `sc_catalogs=${args.catalog}`;
            }
            if (args.active_only) {
                query += query ? '^' : '';
                query += 'active=true';
            }
            const limit = args.limit || 20;
            this.logger.trackAPICall('SEARCH', 'sc_cat_item', limit);
            const response = await this.client.searchRecords('sc_cat_item', query, limit);
            if (!response.success) {
                throw new Error('Failed to search catalog');
            }
            const items = response.data.result;
            if (!items.length) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ No catalog items found${args.query ? ` matching "${args.query}"` : ''}`
                        }]
                };
            }
            const itemList = items.map((item) => {
                return `🛍️ **${item.name}**
🆔 ${item.sys_id}
📝 ${item.short_description}
${item.price && item.price !== '0' ? `💰 Price: $${item.price}` : ''}
🔄 Active: ${item.active ? 'Yes' : 'No'}`;
            }).join('\n\n');
            return {
                content: [{
                        type: 'text',
                        text: `🔍 Catalog Search Results${args.query ? ` for "${args.query}"` : ''}:

${itemList}

✨ Found ${items.length} catalog item(s)`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to search catalog:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to search catalog: ${error}`);
        }
    }
    /**
     * Order Catalog Item
     * Creates sc_request and sc_req_item records
     */
    async orderCatalogItem(args) {
        try {
            this.logger.info('Ordering catalog item...');
            // Create service catalog request
            const requestData = {
                requested_for: args.requested_for,
                opened_by: args.requested_for,
                special_instructions: args.special_instructions || ''
            };
            const requestResponse = await this.client.createRecord('sc_request', requestData);
            if (!requestResponse.success) {
                throw new Error(`Failed to create request: ${requestResponse.error}`);
            }
            const requestId = requestResponse.data.sys_id;
            // Create requested item (RITM)
            const ritmData = {
                request: requestId,
                cat_item: args.cat_item,
                requested_for: args.requested_for,
                quantity: args.quantity || 1,
                delivery_address: args.delivery_address || ''
            };
            const ritmResponse = await this.client.createRecord('sc_req_item', ritmData);
            if (!ritmResponse.success) {
                throw new Error(`Failed to create requested item: ${ritmResponse.error}`);
            }
            const ritmId = ritmResponse.data.sys_id;
            const ritmNumber = ritmResponse.data.number;
            // Set variable values if provided
            if (args.variables) {
                for (const [varName, varValue] of Object.entries(args.variables)) {
                    const varData = {
                        request_item: ritmId,
                        name: varName,
                        value: varValue
                    };
                    await this.client.createRecord('sc_item_option_mtom', varData);
                }
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Catalog Item ordered successfully!

🛍️ **Order Placed**
🆔 Request: ${requestId}
📦 RITM: ${ritmNumber}
👤 Requested For: ${args.requested_for}
📊 Quantity: ${args.quantity || 1}
${args.delivery_address ? `📍 Delivery: ${args.delivery_address}` : ''}
${args.special_instructions ? `📝 Instructions: ${args.special_instructions}` : ''}

✨ Order submitted for fulfillment!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to order catalog item:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to order catalog item: ${error}`);
        }
    }
    /**
     * Get Catalog Item Details
     */
    async getCatalogItemDetails(args) {
        try {
            this.logger.info('Getting catalog item details...', { sys_id: args.sys_id });
            // 🔍 DEBUGGING: Try different methods to find the item
            this.logger.info('🔍 Step 1: Trying getRecord method...');
            let itemResponse = await this.client.getRecord('sc_cat_item', args.sys_id);
            if (!itemResponse.success) {
                this.logger.warn('❌ getRecord failed, trying searchRecords as fallback...');
                this.logger.warn('getRecord error:', itemResponse.error);
                // Fallback: try searchRecords method
                itemResponse = await this.client.searchRecords('sc_cat_item', `sys_id=${args.sys_id}`, 1);
                if (!itemResponse.success || itemResponse.data.result.length === 0) {
                    this.logger.error('❌ Both getRecord and searchRecords failed');
                    this.logger.error('searchRecords error:', itemResponse.error);
                    // Final fallback: try to query with different parameters
                    const queryResponse = await this.client.searchRecords('sc_cat_item', `sys_id=${args.sys_id}`, 1);
                    if (queryResponse.success && queryResponse.data.result.length > 0) {
                        this.logger.info('✅ Found item using queryTable fallback');
                        itemResponse = { success: true, data: queryResponse.data.result[0] };
                    }
                    else {
                        this.logger.error('❌ All methods failed to find catalog item');
                        throw new Error(`Catalog item not found with sys_id: ${args.sys_id}. Tried getRecord, searchRecords, and queryTable.`);
                    }
                }
                else {
                    this.logger.info('✅ Found item using searchRecords fallback');
                    itemResponse = { success: true, data: itemResponse.data.result[0] };
                }
            }
            else {
                this.logger.info('✅ Found item using getRecord');
            }
            const item = itemResponse.data;
            let details = `🛍️ **${item.name}**
🆔 sys_id: ${item.sys_id}
📝 ${item.short_description}
📄 ${item.description || 'No detailed description'}
${item.price && item.price !== '0' ? `💰 Price: $${item.price}` : ''}
${item.recurring_price && item.recurring_price !== '0' ? `🔄 Recurring: $${item.recurring_price}` : ''}
📦 Delivery: ${item.delivery_time || '3 business days'}
🔄 Active: ${item.active ? 'Yes' : 'No'}`;
            // Get variables if requested
            if (args.include_variables) {
                const varResponse = await this.client.searchRecords('sc_cat_item_option', `cat_item=${args.sys_id}`, 50);
                if (varResponse.success && varResponse.data.result.length) {
                    const variables = varResponse.data.result.map((v) => `  - ${v.question_text} (${v.type})${v.mandatory ? ' *Required' : ''}`).join('\n');
                    details += `\n\n📋 **Variables:**\n${variables}`;
                }
            }
            return {
                content: [{
                        type: 'text',
                        text: details + '\n\n✨ Catalog item details retrieved!'
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to get catalog item details:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to get catalog item details: ${error}`);
        }
    }
    /**
     * Discover Service Catalogs
     */
    async discoverCatalogs(args) {
        try {
            this.logger.info('Discovering service catalogs...');
            let query = '';
            if (args.active_only) {
                query = 'active=true';
            }
            const catalogResponse = await this.client.searchRecords('sc_catalog', query, 50);
            if (!catalogResponse.success) {
                throw new Error('Failed to discover catalogs');
            }
            const catalogs = catalogResponse.data.result;
            // Get categories if requested
            const catalogsWithDetails = await Promise.all(catalogs.map(async (catalog) => {
                if (args.include_categories) {
                    const catResponse = await this.client.searchRecords('sc_category', `sc_catalog=${catalog.sys_id}`, 20);
                    const categories = catResponse.success ? catResponse.data.result : [];
                    return { ...catalog, categories };
                }
                return catalog;
            }));
            const catalogText = catalogsWithDetails.map((catalog) => {
                let text = `🛍️ **${catalog.title}** ${catalog.active ? '✅' : '❌'}
🆔 ${catalog.sys_id}
📝 ${catalog.description || 'No description'}`;
                if (catalog.categories) {
                    const categoryList = catalog.categories.map((cat) => `  - ${cat.title}`).join('\n');
                    text += `\n📂 Categories:\n${categoryList || '  No categories'}`;
                }
                return text;
            }).join('\n\n');
            return {
                content: [{
                        type: 'text',
                        text: `🔍 Discovered Service Catalogs:

${catalogText}

✨ Found ${catalogs.length} catalog(s)`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to discover catalogs:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to discover catalogs: ${error}`);
        }
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('ServiceNow Knowledge & Catalog MCP Server running on stdio');
    }
}
const server = new ServiceNowKnowledgeCatalogMCP();
server.run().catch(console.error);
//# sourceMappingURL=servicenow-knowledge-catalog-mcp.js.map