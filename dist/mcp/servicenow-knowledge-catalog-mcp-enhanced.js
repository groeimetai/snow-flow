#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Knowledge Management & Service Catalog MCP Server - ENHANCED VERSION
 * With logging, token tracking, and progress indicators
 */
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const enhanced_base_mcp_server_js_1 = require("./shared/enhanced-base-mcp-server.js");
const mcp_config_manager_js_1 = require("../utils/mcp-config-manager.js");
class ServiceNowKnowledgeCatalogMCPEnhanced extends enhanced_base_mcp_server_js_1.EnhancedBaseMCPServer {
    constructor() {
        super('servicenow-knowledge-catalog-enhanced', '2.0.0');
        this.config = mcp_config_manager_js_1.mcpConfig.getConfig();
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                // Knowledge Management Tools
                {
                    name: 'snow_create_knowledge_article',
                    description: 'Creates a knowledge article in ServiceNow Knowledge Base using kb_knowledge table.',
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
                    description: 'Searches knowledge articles in kb_knowledge table with full-text search.',
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
                    description: 'Updates existing knowledge article in kb_knowledge table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: { type: 'string', description: 'Article sys_id to update' },
                            short_description: { type: 'string', description: 'Article title' },
                            text: { type: 'string', description: 'Article content' },
                            workflow_state: { type: 'string', description: 'State: draft, review, published' },
                            valid_to: { type: 'string', description: 'Expiration date' },
                            keywords: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_retire_knowledge_article',
                    description: 'Retires knowledge article by setting workflow_state to retired in kb_knowledge table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: { type: 'string', description: 'Article sys_id' },
                            retirement_reason: { type: 'string', description: 'Reason for retirement' }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_create_knowledge_base',
                    description: 'Creates new knowledge base using kb_knowledge_base table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Knowledge base name' },
                            description: { type: 'string', description: 'KB description' },
                            owner: { type: 'string', description: 'Owner user/group' },
                            kb_managers: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['title']
                    }
                },
                {
                    name: 'snow_discover_knowledge_bases',
                    description: 'Lists all knowledge bases from kb_knowledge_base table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            active_only: { type: 'boolean', default: true }
                        }
                    }
                },
                {
                    name: 'snow_get_knowledge_stats',
                    description: 'Gets statistics for knowledge articles from kb_knowledge table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            kb_knowledge_base: { type: 'string', description: 'Filter by KB' },
                            date_range: { type: 'string', description: 'Date range filter' }
                        }
                    }
                },
                {
                    name: 'snow_knowledge_feedback',
                    description: 'Manages feedback for knowledge articles using kb_feedback table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            article_id: { type: 'string', description: 'Article sys_id' },
                            rating: { type: 'number', description: 'Rating 1-5' },
                            comments: { type: 'string', description: 'Feedback comments' }
                        },
                        required: ['article_id']
                    }
                },
                // Service Catalog Tools
                {
                    name: 'snow_create_catalog_item',
                    description: 'Creates service catalog item using sc_cat_item table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Catalog item name' },
                            short_description: { type: 'string', description: 'Brief description' },
                            category: { type: 'string', description: 'Category sys_id' },
                            price: { type: 'string', description: 'Item price' },
                            workflow: { type: 'string', description: 'Fulfillment workflow' }
                        },
                        required: ['name', 'short_description']
                    }
                },
                {
                    name: 'snow_create_catalog_variable',
                    description: 'Creates variables for catalog items using item_option_new table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            cat_item: { type: 'string', description: 'Catalog item sys_id' },
                            name: { type: 'string', description: 'Variable name' },
                            question_text: { type: 'string', description: 'Question to display' },
                            type: { type: 'string', description: 'Variable type' },
                            mandatory: { type: 'boolean', default: false }
                        },
                        required: ['cat_item', 'name', 'question_text']
                    }
                },
                {
                    name: 'snow_create_catalog_ui_policy',
                    description: 'Creates UI policies for catalog items using catalog_ui_policy table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            cat_item: { type: 'string', description: 'Catalog item sys_id' },
                            short_description: { type: 'string', description: 'Policy name' },
                            condition: { type: 'string', description: 'When to apply' },
                            actions: { type: 'array', items: { type: 'object' } }
                        },
                        required: ['cat_item', 'short_description']
                    }
                },
                {
                    name: 'snow_order_catalog_item',
                    description: 'Submits catalog item order using sc_req_item table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            cat_item: { type: 'string', description: 'Catalog item sys_id' },
                            requested_for: { type: 'string', description: 'User sys_id' },
                            variables: { type: 'object', description: 'Variable values' },
                            quantity: { type: 'number', default: 1 }
                        },
                        required: ['cat_item']
                    }
                },
                {
                    name: 'snow_search_catalog',
                    description: 'Searches service catalog items in sc_cat_item table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search text' },
                            category: { type: 'string', description: 'Filter by category' },
                            active_only: { type: 'boolean', default: true },
                            limit: { type: 'number', default: 10 }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'snow_get_catalog_item_details',
                    description: 'Gets full details of catalog item from sc_cat_item table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sys_id: { type: 'string', description: 'Catalog item sys_id' },
                            include_variables: { type: 'boolean', default: true }
                        },
                        required: ['sys_id']
                    }
                },
                {
                    name: 'snow_discover_catalogs',
                    description: 'Discovers catalog structure from sc_catalog table.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            include_categories: { type: 'boolean', default: true }
                        }
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
                        case 'snow_create_knowledge_article':
                            return await this.createKnowledgeArticle(args);
                        case 'snow_search_knowledge':
                            return await this.searchKnowledge(args);
                        case 'snow_update_knowledge_article':
                            return await this.updateKnowledgeArticle(args);
                        case 'snow_retire_knowledge_article':
                            return await this.retireKnowledgeArticle(args);
                        case 'snow_create_knowledge_base':
                            return await this.createKnowledgeBase(args);
                        case 'snow_discover_knowledge_bases':
                            return await this.discoverKnowledgeBases(args);
                        case 'snow_get_knowledge_stats':
                            return await this.getKnowledgeStats(args);
                        case 'snow_knowledge_feedback':
                            return await this.knowledgeFeedback(args);
                        case 'snow_create_catalog_item':
                            return await this.createCatalogItem(args);
                        case 'snow_create_catalog_variable':
                            return await this.createCatalogVariable(args);
                        case 'snow_create_catalog_ui_policy':
                            return await this.createCatalogUIPolicy(args);
                        case 'snow_order_catalog_item':
                            return await this.orderCatalogItem(args);
                        case 'snow_search_catalog':
                            return await this.searchCatalog(args);
                        case 'snow_get_catalog_item_details':
                            return await this.getCatalogItemDetails(args);
                        case 'snow_discover_catalogs':
                            return await this.discoverCatalogs(args);
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
    /**
     * Create Knowledge Article with enhanced tracking
     */
    async createKnowledgeArticle(args) {
        this.logger.info('Creating knowledge article...', {
            title: args.short_description,
            hasContent: !!args.text,
            contentLength: args.text?.length
        });
        // Validate connection
        const connCheck = await this.validateConnection();
        if (!connCheck.success) {
            return this.createResponse(`❌ Connection failed: ${connCheck.error}`);
        }
        // Progress indicator
        this.logger.progress('Building knowledge article data...');
        const articleData = {
            short_description: args.short_description,
            text: args.text,
            kb_knowledge_base: args.kb_knowledge_base || '',
            kb_category: args.kb_category || '',
            article_type: args.article_type || 'text',
            workflow_state: args.workflow_state || 'draft',
            valid_to: args.valid_to || '',
            meta_description: args.meta_description || '',
            keywords: args.keywords?.join(',') || '',
            author: args.author || ''
        };
        this.logger.progress('Creating article in ServiceNow...');
        // Create with tracking
        const response = await this.createRecord('kb_knowledge', articleData);
        if (!response.success) {
            this.logger.error('Failed to create knowledge article', response.error);
            return this.createResponse(`❌ Failed to create article: ${response.error}`);
        }
        // Success with details
        const result = response.data;
        this.logger.info('✅ Knowledge article created successfully', {
            sys_id: result.sys_id,
            number: result.number,
            title: args.short_description
        });
        return this.createResponse(`✅ Knowledge Article created successfully!

📚 **${args.short_description}**
🆔 sys_id: ${result.sys_id}
📋 Number: ${result.number}
📊 State: ${args.workflow_state || 'draft'}
📝 Type: ${args.article_type || 'text'}
${args.kb_knowledge_base ? `📁 Knowledge Base: ${args.kb_knowledge_base}` : ''}
${args.kb_category ? `🏷️ Category: ${args.kb_category}` : ''}
${args.valid_to ? `📅 Valid Until: ${args.valid_to}` : ''}

✨ Article created and ready for review!`);
    }
    /**
     * Search Knowledge with enhanced tracking
     */
    async searchKnowledge(args) {
        this.logger.info('Searching knowledge articles...', {
            query: args.query,
            limit: args.limit || 10,
            includeContent: args.include_content
        });
        // Build query
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
        this.logger.progress(`Searching kb_knowledge table for: "${args.query}"...`);
        // Search with tracking
        const limit = args.limit || 10;
        const response = await this.queryTable('kb_knowledge', query, limit);
        if (!response.success) {
            this.logger.error('Knowledge search failed', response.error);
            return this.createResponse(`❌ Search failed: ${response.error}`);
        }
        const articles = response.data.result;
        if (!articles.length) {
            this.logger.info('No articles found', { query: args.query });
            return this.createResponse(`❌ No knowledge articles found matching "${args.query}"`);
        }
        this.logger.info(`Found ${articles.length} knowledge articles`);
        // Format results
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
        return this.createResponse(`🔍 Knowledge Search Results for "${args.query}":

${articleList}

✨ Found ${articles.length} article(s)`);
    }
    /**
     * Update Knowledge Article
     */
    async updateKnowledgeArticle(args) {
        this.logger.info('Updating knowledge article...', { sys_id: args.sys_id });
        const updateData = {};
        if (args.short_description)
            updateData.short_description = args.short_description;
        if (args.text)
            updateData.text = args.text;
        if (args.workflow_state)
            updateData.workflow_state = args.workflow_state;
        if (args.valid_to)
            updateData.valid_to = args.valid_to;
        if (args.keywords)
            updateData.keywords = args.keywords.join(',');
        this.logger.progress('Updating article in ServiceNow...');
        const response = await this.updateRecord('kb_knowledge', args.sys_id, updateData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to update article: ${response.error}`);
        }
        this.logger.info('✅ Article updated successfully');
        return this.createResponse(`✅ Knowledge article updated successfully!\n🆔 sys_id: ${args.sys_id}`);
    }
    /**
     * Retire Knowledge Article
     */
    async retireKnowledgeArticle(args) {
        this.logger.info('Retiring knowledge article...', { sys_id: args.sys_id });
        const updateData = {
            workflow_state: 'retired',
            u_retirement_reason: args.retirement_reason || 'Retired via API'
        };
        const response = await this.updateRecord('kb_knowledge', args.sys_id, updateData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to retire article: ${response.error}`);
        }
        this.logger.info('✅ Article retired successfully');
        return this.createResponse(`✅ Knowledge article retired!\n🆔 sys_id: ${args.sys_id}`);
    }
    /**
     * Create Knowledge Base
     */
    async createKnowledgeBase(args) {
        this.logger.info('Creating knowledge base...', { title: args.title });
        const kbData = {
            title: args.title,
            description: args.description || '',
            owner: args.owner || '',
            kb_managers: args.kb_managers?.join(',') || ''
        };
        this.logger.progress('Creating KB in ServiceNow...');
        const response = await this.createRecord('kb_knowledge_base', kbData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create KB: ${response.error}`);
        }
        const result = response.data;
        this.logger.info('✅ Knowledge base created', { sys_id: result.sys_id });
        return this.createResponse(`✅ Knowledge Base created!\n📚 **${args.title}**\n🆔 sys_id: ${result.sys_id}`);
    }
    /**
     * Discover Knowledge Bases
     */
    async discoverKnowledgeBases(args) {
        this.logger.info('Discovering knowledge bases...');
        const query = args.active_only ? 'active=true' : '';
        const response = await this.queryTable('kb_knowledge_base', query, 50);
        if (!response.success) {
            return this.createResponse(`❌ Failed to discover KBs: ${response.error}`);
        }
        const kbs = response.data.result;
        this.logger.info(`Found ${kbs.length} knowledge bases`);
        const kbList = kbs.map((kb) => `📚 **${kb.title}**\n🆔 ${kb.sys_id}\n📝 ${kb.description || 'No description'}`).join('\n\n');
        return this.createResponse(`📚 Knowledge Bases Found:\n\n${kbList}\n\n✨ Total: ${kbs.length} knowledge base(s)`);
    }
    /**
     * Get Knowledge Stats
     */
    async getKnowledgeStats(args) {
        this.logger.info('Getting knowledge statistics...');
        let query = 'active=true';
        if (args.kb_knowledge_base) {
            query += `^kb_knowledge_base=${args.kb_knowledge_base}`;
        }
        this.logger.progress('Gathering statistics...');
        // Get article counts by state
        const states = ['draft', 'review', 'published', 'retired'];
        const stats = { total: 0, by_state: {} };
        for (const state of states) {
            const stateQuery = `${query}^workflow_state=${state}`;
            const response = await this.queryTable('kb_knowledge', stateQuery, 1);
            if (response.success && response.data.headers) {
                const count = parseInt(response.data.headers['x-total-count'] || '0');
                stats.by_state[state] = count;
                stats.total += count;
            }
        }
        this.logger.info('✅ Statistics gathered', stats);
        return this.createResponse(`📊 Knowledge Base Statistics:\n\n` +
            `📚 Total Articles: ${stats.total}\n` +
            `📝 Draft: ${stats.by_state.draft || 0}\n` +
            `👁️ In Review: ${stats.by_state.review || 0}\n` +
            `✅ Published: ${stats.by_state.published || 0}\n` +
            `🗄️ Retired: ${stats.by_state.retired || 0}`);
    }
    /**
     * Knowledge Feedback
     */
    async knowledgeFeedback(args) {
        this.logger.info('Managing knowledge feedback...', { article_id: args.article_id });
        if (args.rating || args.comments) {
            // Create feedback
            const feedbackData = {
                article: args.article_id,
                rating: args.rating || 0,
                comments: args.comments || '',
                user: 'api_user'
            };
            this.logger.progress('Submitting feedback...');
            const response = await this.createRecord('kb_feedback', feedbackData);
            if (!response.success) {
                return this.createResponse(`❌ Failed to submit feedback: ${response.error}`);
            }
            this.logger.info('✅ Feedback submitted');
            return this.createResponse(`✅ Feedback submitted!\n⭐ Rating: ${args.rating || 'N/A'}`);
        }
        else {
            // Get feedback for article
            const query = `article=${args.article_id}`;
            const response = await this.queryTable('kb_feedback', query, 10);
            if (!response.success) {
                return this.createResponse(`❌ Failed to get feedback: ${response.error}`);
            }
            const feedback = response.data.result;
            const avgRating = feedback.length > 0 ?
                (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length).toFixed(1) :
                'N/A';
            return this.createResponse(`📊 Article Feedback:\n⭐ Average Rating: ${avgRating}\n💬 ${feedback.length} feedback entries`);
        }
    }
    /**
     * Create Catalog Item
     */
    async createCatalogItem(args) {
        this.logger.info('Creating catalog item...', { name: args.name });
        const itemData = {
            name: args.name,
            short_description: args.short_description,
            category: args.category || '',
            price: args.price || '0',
            workflow: args.workflow || '',
            active: true
        };
        this.logger.progress('Creating item in ServiceNow...');
        const response = await this.createRecord('sc_cat_item', itemData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create catalog item: ${response.error}`);
        }
        const result = response.data;
        this.logger.info('✅ Catalog item created', { sys_id: result.sys_id });
        return this.createResponse(`✅ Catalog Item created!\n🛍️ **${args.name}**\n🆔 sys_id: ${result.sys_id}\n💰 Price: ${args.price || '0'}`);
    }
    /**
     * Create Catalog Variable
     */
    async createCatalogVariable(args) {
        this.logger.info('Creating catalog variable...', { name: args.name });
        const varData = {
            cat_item: args.cat_item,
            name: args.name,
            question_text: args.question_text,
            type: args.type || '6', // Single line text
            mandatory: args.mandatory || false,
            order: 100
        };
        this.logger.progress('Creating variable...');
        const response = await this.createRecord('item_option_new', varData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create variable: ${response.error}`);
        }
        this.logger.info('✅ Variable created');
        return this.createResponse(`✅ Catalog variable created!\n📝 ${args.question_text}\n🔤 Name: ${args.name}`);
    }
    /**
     * Create Catalog UI Policy
     */
    async createCatalogUIPolicy(args) {
        this.logger.info('Creating catalog UI policy...', { short_description: args.short_description });
        const policyData = {
            cat_item: args.cat_item,
            short_description: args.short_description,
            condition: args.condition || '',
            active: true
        };
        this.logger.progress('Creating UI policy...');
        const response = await this.createRecord('catalog_ui_policy', policyData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to create UI policy: ${response.error}`);
        }
        this.logger.info('✅ UI policy created');
        return this.createResponse(`✅ Catalog UI Policy created!\n📋 ${args.short_description}\n🆔 sys_id: ${response.data.sys_id}`);
    }
    /**
     * Order Catalog Item
     */
    async orderCatalogItem(args) {
        this.logger.info('Ordering catalog item...', { cat_item: args.cat_item });
        const orderData = {
            cat_item: args.cat_item,
            requested_for: args.requested_for || 'current_user',
            quantity: args.quantity || 1,
            variables: JSON.stringify(args.variables || {})
        };
        this.logger.progress('Submitting order...');
        const response = await this.createRecord('sc_req_item', orderData);
        if (!response.success) {
            return this.createResponse(`❌ Failed to order item: ${response.error}`);
        }
        const result = response.data;
        this.logger.info('✅ Order submitted', { number: result.number });
        return this.createResponse(`✅ Catalog item ordered!\n📦 Request: ${result.number}\n🆔 sys_id: ${result.sys_id}\n📊 Status: ${result.state || 'Submitted'}`);
    }
    /**
     * Search Catalog
     */
    async searchCatalog(args) {
        this.logger.info('Searching service catalog...', { query: args.query });
        let query = `nameLIKE${args.query}^ORshort_descriptionLIKE${args.query}`;
        if (args.category) {
            query += `^category=${args.category}`;
        }
        if (args.active_only) {
            query += '^active=true';
        }
        this.logger.progress('Searching catalog...');
        const response = await this.queryTable('sc_cat_item', query, args.limit || 10);
        if (!response.success) {
            return this.createResponse(`❌ Search failed: ${response.error}`);
        }
        const items = response.data.result;
        if (!items.length) {
            return this.createResponse(`❌ No catalog items found matching "${args.query}"`);
        }
        this.logger.info(`Found ${items.length} catalog items`);
        const itemList = items.map((item) => `🛍️ **${item.name}**\n📝 ${item.short_description}\n💰 ${item.price || '0'}\n🆔 ${item.sys_id}`).join('\n\n');
        return this.createResponse(`🔍 Catalog Search Results:\n\n${itemList}\n\n✨ Found ${items.length} item(s)`);
    }
    /**
     * Get Catalog Item Details
     */
    async getCatalogItemDetails(args) {
        this.logger.info('Getting catalog item details...', { sys_id: args.sys_id });
        const response = await this.getRecord('sc_cat_item', args.sys_id);
        if (!response.success) {
            return this.createResponse(`❌ Failed to get item details: ${response.error}`);
        }
        const item = response.data;
        let details = `🛍️ **${item.name}**\n` +
            `📝 ${item.short_description}\n` +
            `💰 Price: ${item.price || '0'}\n` +
            `📊 Active: ${item.active}\n` +
            `🆔 sys_id: ${item.sys_id}`;
        if (args.include_variables) {
            // Get variables
            const varQuery = `cat_item=${args.sys_id}`;
            const varResponse = await this.queryTable('item_option_new', varQuery, 50);
            if (varResponse.success && varResponse.data.result.length > 0) {
                const variables = varResponse.data.result;
                details += `\n\n📋 Variables (${variables.length}):\n`;
                variables.forEach((v) => {
                    details += `  • ${v.question_text} (${v.name})\n`;
                });
            }
        }
        this.logger.info('✅ Retrieved item details');
        return this.createResponse(details);
    }
    /**
     * Discover Catalogs
     */
    async discoverCatalogs(args) {
        this.logger.info('Discovering service catalogs...');
        const response = await this.queryTable('sc_catalog', 'active=true', 20);
        if (!response.success) {
            return this.createResponse(`❌ Failed to discover catalogs: ${response.error}`);
        }
        const catalogs = response.data.result;
        this.logger.info(`Found ${catalogs.length} catalogs`);
        let catalogInfo = `📚 Service Catalogs:\n\n`;
        for (const catalog of catalogs) {
            catalogInfo += `🛍️ **${catalog.title}**\n🆔 ${catalog.sys_id}\n`;
            if (args.include_categories) {
                // Get categories for this catalog
                const catQuery = `sc_catalog=${catalog.sys_id}^active=true`;
                const catResponse = await this.queryTable('sc_category', catQuery, 10);
                if (catResponse.success && catResponse.data.result.length > 0) {
                    catalogInfo += `📁 Categories:\n`;
                    catResponse.data.result.forEach((cat) => {
                        catalogInfo += `  • ${cat.title}\n`;
                    });
                }
            }
            catalogInfo += '\n';
        }
        return this.createResponse(`${catalogInfo}✨ Total: ${catalogs.length} catalog(s) discovered`);
    }
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        // Log ready state
        this.logger.info('🚀 ServiceNow Knowledge & Catalog MCP Server (Enhanced) running');
        this.logger.info('📊 Token tracking enabled');
        this.logger.info('⏳ Progress indicators active');
    }
}
// Start the enhanced server
const server = new ServiceNowKnowledgeCatalogMCPEnhanced();
server.start().catch((error) => {
    console.error('Failed to start enhanced server:', error);
    process.exit(1);
});
//# sourceMappingURL=servicenow-knowledge-catalog-mcp-enhanced.js.map