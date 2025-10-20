"use strict";
/**
 * ServiceNow System Properties MCP Server
 *
 * Provides comprehensive system property management through official ServiceNow APIs
 * Uses the standard Table API on sys_properties table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowSystemPropertiesMCP = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const mcp_logger_js_1 = require("./shared/mcp-logger.js");
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
/**
 * ServiceNow System Properties MCP Server
 * Manages system properties through official ServiceNow REST APIs
 */
class ServiceNowSystemPropertiesMCP {
    constructor() {
        this.propertyCache = new Map();
        this.server = new index_js_1.Server({
            name: 'servicenow-system-properties',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
        this.logger = new mcp_logger_js_1.MCPLogger('ServiceNowSystemProperties');
        this.setupHandlers();
        this.setupTools();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'snow_property_get',
                    description: 'Get a system property value by name',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                description: 'Property name (e.g., glide.servlet.uri)'
                            },
                            include_metadata: {
                                type: 'boolean',
                                description: 'Include full property metadata',
                                default: false
                            }
                        },
                        required: ['name']
                    }
                },
                {
                    name: 'snow_property_set',
                    description: 'Set or update a system property value',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                description: 'Property name'
                            },
                            value: {
                                type: 'string',
                                description: 'Property value'
                            },
                            description: {
                                type: 'string',
                                description: 'Property description (optional)'
                            },
                            type: {
                                type: 'string',
                                description: 'Property type (string, boolean, integer, etc.)',
                                default: 'string'
                            },
                            choices: {
                                type: 'string',
                                description: 'Comma-separated list of valid choices (optional)'
                            },
                            is_private: {
                                type: 'boolean',
                                description: 'Mark property as private',
                                default: false
                            },
                            suffix: {
                                type: 'string',
                                description: 'Property suffix/scope (optional)'
                            }
                        },
                        required: ['name', 'value']
                    }
                },
                {
                    name: 'snow_property_list',
                    description: 'List system properties with optional filtering',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            pattern: {
                                type: 'string',
                                description: 'Name pattern to filter (e.g., glide.* for all glide properties)'
                            },
                            category: {
                                type: 'string',
                                description: 'Property category filter'
                            },
                            is_private: {
                                type: 'boolean',
                                description: 'Filter by private properties'
                            },
                            limit: {
                                type: 'number',
                                description: 'Maximum number of properties to return',
                                default: 100
                            },
                            include_values: {
                                type: 'boolean',
                                description: 'Include property values in response',
                                default: true
                            }
                        }
                    }
                },
                {
                    name: 'snow_property_delete',
                    description: 'Delete a system property',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                description: 'Property name to delete'
                            },
                            confirm: {
                                type: 'boolean',
                                description: 'Confirmation flag (must be true)',
                                default: false
                            }
                        },
                        required: ['name', 'confirm']
                    }
                },
                {
                    name: 'snow_property_search',
                    description: 'Search properties by name or value content',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            search_term: {
                                type: 'string',
                                description: 'Search term to find in property names or values'
                            },
                            search_in: {
                                type: 'string',
                                description: 'Where to search: name, value, description, or all',
                                default: 'all'
                            },
                            limit: {
                                type: 'number',
                                description: 'Maximum results',
                                default: 50
                            }
                        },
                        required: ['search_term']
                    }
                },
                {
                    name: 'snow_property_bulk_get',
                    description: 'Get multiple properties at once',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            names: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Array of property names to retrieve'
                            },
                            include_metadata: {
                                type: 'boolean',
                                description: 'Include full metadata for each property',
                                default: false
                            }
                        },
                        required: ['names']
                    }
                },
                {
                    name: 'snow_property_bulk_set',
                    description: 'Set multiple properties at once',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            properties: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        value: { type: 'string' },
                                        description: { type: 'string' },
                                        type: { type: 'string' }
                                    },
                                    required: ['name', 'value']
                                },
                                description: 'Array of properties to set'
                            }
                        },
                        required: ['properties']
                    }
                },
                {
                    name: 'snow_property_export',
                    description: 'Export system properties to JSON format',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            pattern: {
                                type: 'string',
                                description: 'Pattern to filter properties (e.g., glide.*)'
                            },
                            include_system: {
                                type: 'boolean',
                                description: 'Include system properties',
                                default: false
                            },
                            include_private: {
                                type: 'boolean',
                                description: 'Include private properties',
                                default: false
                            }
                        }
                    }
                },
                {
                    name: 'snow_property_import',
                    description: 'Import system properties from JSON',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            properties: {
                                type: 'object',
                                description: 'JSON object with property names as keys'
                            },
                            overwrite: {
                                type: 'boolean',
                                description: 'Overwrite existing properties',
                                default: false
                            },
                            dry_run: {
                                type: 'boolean',
                                description: 'Preview changes without applying',
                                default: false
                            }
                        },
                        required: ['properties']
                    }
                },
                {
                    name: 'snow_property_validate',
                    description: 'Validate property value against its type and constraints',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                description: 'Property name'
                            },
                            value: {
                                type: 'string',
                                description: 'Value to validate'
                            }
                        },
                        required: ['name', 'value']
                    }
                },
                {
                    name: 'snow_property_categories',
                    description: 'List all property categories',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            include_counts: {
                                type: 'boolean',
                                description: 'Include count of properties per category',
                                default: true
                            }
                        }
                    }
                },
                {
                    name: 'snow_property_history',
                    description: 'Get audit history for a property',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                description: 'Property name'
                            },
                            limit: {
                                type: 'number',
                                description: 'Number of history records',
                                default: 10
                            }
                        },
                        required: ['name']
                    }
                }
            ]
        }));
    }
    setupTools() {
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                // Start operation with token tracking
                this.logger.operationStart(name, args);
                // Ensure authentication
                const isAuthenticated = await this.oauth.isAuthenticated();
                if (!isAuthenticated) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, 'Not authenticated. Please run "snow-flow auth login" first.');
                }
                let result;
                switch (name) {
                    case 'snow_property_get':
                        result = await this.getProperty(args);
                        break;
                    case 'snow_property_set':
                        result = await this.setProperty(args);
                        break;
                    case 'snow_property_list':
                        result = await this.listProperties(args);
                        break;
                    case 'snow_property_delete':
                        result = await this.deleteProperty(args);
                        break;
                    case 'snow_property_search':
                        result = await this.searchProperties(args);
                        break;
                    case 'snow_property_bulk_get':
                        result = await this.bulkGetProperties(args);
                        break;
                    case 'snow_property_bulk_set':
                        result = await this.bulkSetProperties(args);
                        break;
                    case 'snow_property_export':
                        result = await this.exportProperties(args);
                        break;
                    case 'snow_property_import':
                        result = await this.importProperties(args);
                        break;
                    case 'snow_property_validate':
                        result = await this.validateProperty(args);
                        break;
                    case 'snow_property_categories':
                        result = await this.getCategories(args);
                        break;
                    case 'snow_property_history':
                        result = await this.getPropertyHistory(args);
                        break;
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
                // Complete operation with token tracking
                result = this.logger.addTokenUsageToResponse(result);
                result = this.logger.addTokenUsageToResponse(result);
                this.logger.operationComplete(name, result);
                // Add token usage to response
                result = this.logger.addTokenUsageToResponse(result);
                return result;
            }
            catch (error) {
                this.logger.error(`Tool execution failed: ${name}`, error);
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Get a system property value
     */
    async getProperty(args) {
        const { name, include_metadata = false } = args;
        this.logger.info(`Getting property: ${name}`);
        try {
            this.logger.trackAPICall('SEARCH', 'sys_properties', 1);
            const response = await this.client.searchRecords('sys_properties', `name=${name}`, 1);
            if (!response.success || !response.data?.result?.length) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Property not found: ${name}`
                        }]
                };
            }
            const property = response.data.result[0];
            // Cache the property
            this.propertyCache.set(name, property);
            if (include_metadata) {
                return {
                    content: [{
                            type: 'text',
                            text: `📋 **Property: ${name}**

**Value:** ${property.value || '(empty)'}
**Type:** ${property.type || 'string'}
**Description:** ${property.description || 'No description'}
**Suffix:** ${property.suffix || 'global'}
**Private:** ${property.is_private === 'true' ? 'Yes' : 'No'}
**Choices:** ${property.choices || 'None'}
**sys_id:** ${property.sys_id}

✅ Property retrieved successfully`
                        }]
                };
            }
            else {
                return {
                    content: [{
                            type: 'text',
                            text: property.value || ''
                        }]
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to get property:', error);
            throw error;
        }
    }
    /**
     * Set or create a system property
     */
    async setProperty(args) {
        const { name, value, description, type = 'string', choices, is_private = false, suffix } = args;
        this.logger.info(`Setting property: ${name} = ${value}`);
        try {
            // Check if property exists
            this.logger.trackAPICall('SEARCH', 'sys_properties', 1);
            const existing = await this.client.searchRecords('sys_properties', `name=${name}`, 1);
            let result;
            if (existing.success && existing.data?.result?.length > 0) {
                // Update existing property
                const sys_id = existing.data.result[0].sys_id;
                this.logger.trackAPICall('UPDATE', 'sys_properties', 1);
                result = await this.client.updateRecord('sys_properties', sys_id, {
                    value,
                    ...(description && { description }),
                    ...(type && { type }),
                    ...(choices && { choices }),
                    ...(suffix && { suffix }),
                    is_private: is_private ? 'true' : 'false'
                });
                this.logger.info(`Updated property: ${name}`);
            }
            else {
                // Create new property
                this.logger.trackAPICall('CREATE', 'sys_properties', 1);
                result = await this.client.createRecord('sys_properties', {
                    name,
                    value,
                    description: description || `Created by Snow-Flow`,
                    type,
                    choices: choices || '',
                    is_private: is_private ? 'true' : 'false',
                    suffix: suffix || 'global'
                });
                this.logger.info(`Created new property: ${name}`);
            }
            if (!result.success) {
                throw new Error(`Failed to set property: ${result.error}`);
            }
            // Clear cache
            this.propertyCache.delete(name);
            return {
                content: [{
                        type: 'text',
                        text: `✅ Property set successfully!

**Name:** ${name}
**Value:** ${value}
**Type:** ${type}
${description ? `**Description:** ${description}` : ''}
${choices ? `**Choices:** ${choices}` : ''}
**Private:** ${is_private ? 'Yes' : 'No'}

💡 Changes take effect immediately in ServiceNow`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to set property:', error);
            throw error;
        }
    }
    /**
     * List system properties
     */
    async listProperties(args) {
        const { pattern, category, is_private, limit = 100, include_values = true } = args;
        this.logger.info('Listing properties', { pattern, category, limit });
        try {
            let query = '';
            const conditions = [];
            if (pattern) {
                if (pattern.includes('*')) {
                    // Convert wildcard to LIKE query
                    const likePattern = pattern.replace(/\*/g, '');
                    conditions.push(`nameLIKE${likePattern}`);
                }
                else {
                    conditions.push(`name=${pattern}`);
                }
            }
            if (category) {
                conditions.push(`suffix=${category}`);
            }
            if (is_private !== undefined) {
                conditions.push(`is_private=${is_private ? 'true' : 'false'}`);
            }
            query = conditions.join('^');
            const response = await this.client.searchRecords('sys_properties', query, limit);
            if (!response.success || !response.data?.result) {
                throw new Error('Failed to list properties');
            }
            const properties = response.data.result;
            // Group by category/suffix
            const grouped = {};
            for (const prop of properties) {
                const category = prop.suffix || 'global';
                if (!grouped[category])
                    grouped[category] = [];
                grouped[category].push(prop);
            }
            let output = `📋 **System Properties** (Found: ${properties.length})\n\n`;
            for (const [cat, props] of Object.entries(grouped)) {
                output += `**Category: ${cat}**\n`;
                for (const prop of props) {
                    if (include_values) {
                        output += `• ${prop.name} = "${prop.value || ''}"\n`;
                        if (prop.description) {
                            output += `  ↳ ${prop.description}\n`;
                        }
                    }
                    else {
                        output += `• ${prop.name}\n`;
                    }
                }
                output += '\n';
            }
            return {
                content: [{
                        type: 'text',
                        text: output
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to list properties:', error);
            throw error;
        }
    }
    /**
     * Delete a system property
     */
    async deleteProperty(args) {
        const { name, confirm } = args;
        if (!confirm) {
            return {
                content: [{
                        type: 'text',
                        text: `⚠️ Deletion requires confirmation. Set confirm: true to proceed.

**Property to delete:** ${name}

⚠️ WARNING: Deleting system properties can affect ServiceNow functionality!`
                    }]
            };
        }
        this.logger.info(`Deleting property: ${name}`);
        try {
            // Find the property
            const response = await this.client.searchRecords('sys_properties', `name=${name}`, 1);
            if (!response.success || !response.data?.result?.length) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Property not found: ${name}`
                        }]
                };
            }
            const sys_id = response.data.result[0].sys_id;
            const result = await this.client.deleteRecord('sys_properties', sys_id);
            if (!result.success) {
                throw new Error(`Failed to delete property: ${result.error}`);
            }
            // Clear cache
            this.propertyCache.delete(name);
            return {
                content: [{
                        type: 'text',
                        text: `✅ Property deleted successfully: ${name}

⚠️ Note: Some properties may be recreated by ServiceNow on next access with default values.`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to delete property:', error);
            throw error;
        }
    }
    /**
     * Search properties
     */
    async searchProperties(args) {
        const { search_term, search_in = 'all', limit = 50 } = args;
        this.logger.info(`Searching properties for: ${search_term}`);
        try {
            let query = '';
            switch (search_in) {
                case 'name':
                    query = `nameLIKE${search_term}`;
                    break;
                case 'value':
                    query = `valueLIKE${search_term}`;
                    break;
                case 'description':
                    query = `descriptionLIKE${search_term}`;
                    break;
                case 'all':
                default:
                    query = `nameLIKE${search_term}^ORvalueLIKE${search_term}^ORdescriptionLIKE${search_term}`;
            }
            const response = await this.client.searchRecords('sys_properties', query, limit);
            if (!response.success || !response.data?.result) {
                throw new Error('Search failed');
            }
            const results = response.data.result;
            if (results.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `No properties found matching: "${search_term}"`
                        }]
                };
            }
            let output = `🔍 **Search Results** (Found: ${results.length})\n`;
            output += `Search term: "${search_term}" in ${search_in}\n\n`;
            for (const prop of results) {
                output += `**${prop.name}**\n`;
                output += `• Value: ${prop.value || '(empty)'}\n`;
                if (prop.description) {
                    output += `• Description: ${prop.description}\n`;
                }
                output += '\n';
            }
            return {
                content: [{
                        type: 'text',
                        text: output
                    }]
            };
        }
        catch (error) {
            this.logger.error('Search failed:', error);
            throw error;
        }
    }
    /**
     * Bulk get properties
     */
    async bulkGetProperties(args) {
        const { names, include_metadata = false } = args;
        this.logger.info(`Bulk getting ${names.length} properties`);
        const results = {};
        const errors = [];
        for (const name of names) {
            try {
                // Check cache first
                if (this.propertyCache.has(name)) {
                    results[name] = this.propertyCache.get(name);
                    continue;
                }
                const response = await this.client.searchRecords('sys_properties', `name=${name}`, 1);
                if (response.success && response.data?.result?.length > 0) {
                    const prop = response.data.result[0];
                    results[name] = include_metadata ? prop : prop.value;
                    this.propertyCache.set(name, prop);
                }
                else {
                    results[name] = null;
                    errors.push(name);
                }
            }
            catch (error) {
                this.logger.error(`Failed to get property ${name}:`, error);
                results[name] = null;
                errors.push(name);
            }
        }
        let output = `📋 **Bulk Property Retrieval**\n\n`;
        if (include_metadata) {
            output += JSON.stringify(results, null, 2);
        }
        else {
            for (const [name, value] of Object.entries(results)) {
                output += `• ${name} = ${value !== null ? `"${value}"` : 'NOT FOUND'}\n`;
            }
        }
        if (errors.length > 0) {
            output += `\n⚠️ Properties not found: ${errors.join(', ')}`;
        }
        return {
            content: [{
                    type: 'text',
                    text: output
                }]
        };
    }
    /**
     * Bulk set properties
     */
    async bulkSetProperties(args) {
        const { properties } = args;
        this.logger.info(`Bulk setting ${properties.length} properties`);
        const results = {
            created: [],
            updated: [],
            failed: []
        };
        for (const prop of properties) {
            try {
                // Check if exists
                const existing = await this.client.searchRecords('sys_properties', `name=${prop.name}`, 1);
                let result;
                if (existing.success && existing.data?.result?.length > 0) {
                    // Update
                    const sys_id = existing.data.result[0].sys_id;
                    result = await this.client.updateRecord('sys_properties', sys_id, {
                        value: prop.value,
                        ...(prop.description && { description: prop.description }),
                        ...(prop.type && { type: prop.type })
                    });
                    if (result.success) {
                        results.updated.push(prop.name);
                    }
                    else {
                        results.failed.push(`${prop.name}: ${result.error}`);
                    }
                }
                else {
                    // Create
                    this.logger.trackAPICall('CREATE', 'sys_properties', 1);
                    result = await this.client.createRecord('sys_properties', {
                        name: prop.name,
                        value: prop.value,
                        description: prop.description || `Created by Snow-Flow bulk operation`,
                        type: prop.type || 'string'
                    });
                    if (result.success) {
                        results.created.push(prop.name);
                    }
                    else {
                        results.failed.push(`${prop.name}: ${result.error}`);
                    }
                }
                // Clear cache
                this.propertyCache.delete(prop.name);
            }
            catch (error) {
                this.logger.error(`Failed to set property ${prop.name}:`, error);
                results.failed.push(`${prop.name}: ${error}`);
            }
        }
        return {
            content: [{
                    type: 'text',
                    text: `📦 **Bulk Property Update Results**

✅ **Created:** ${results.created.length}
${results.created.map(n => `• ${n}`).join('\n')}

🔄 **Updated:** ${results.updated.length}
${results.updated.map(n => `• ${n}`).join('\n')}

${results.failed.length > 0 ? `❌ **Failed:** ${results.failed.length}\n${results.failed.map(f => `• ${f}`).join('\n')}` : ''}

Total processed: ${properties.length}`
                }]
        };
    }
    /**
     * Export properties
     */
    async exportProperties(args) {
        const { pattern, include_system = false, include_private = false } = args;
        this.logger.info('Exporting properties', { pattern, include_system, include_private });
        try {
            let query = '';
            const conditions = [];
            if (pattern) {
                if (pattern.includes('*')) {
                    const likePattern = pattern.replace(/\*/g, '');
                    conditions.push(`nameLIKE${likePattern}`);
                }
                else {
                    conditions.push(`name=${pattern}`);
                }
            }
            if (!include_system) {
                conditions.push(`name!=glide.*^name!=sys.*`);
            }
            if (!include_private) {
                conditions.push(`is_private=false`);
            }
            query = conditions.join('^');
            const response = await this.client.searchRecords('sys_properties', query, 1000);
            if (!response.success || !response.data?.result) {
                throw new Error('Export failed');
            }
            const properties = response.data.result;
            const exportData = {};
            for (const prop of properties) {
                exportData[prop.name] = {
                    value: prop.value,
                    type: prop.type || 'string',
                    description: prop.description || '',
                    suffix: prop.suffix || 'global',
                    is_private: prop.is_private === 'true',
                    choices: prop.choices || ''
                };
            }
            return {
                content: [{
                        type: 'text',
                        text: `📤 **Properties Export** (${properties.length} properties)

\`\`\`json
${JSON.stringify(exportData, null, 2)}
\`\`\`

✅ Export complete. You can save this JSON for backup or migration.`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Export failed:', error);
            throw error;
        }
    }
    /**
     * Import properties
     */
    async importProperties(args) {
        const { properties, overwrite = false, dry_run = false } = args;
        this.logger.info('Importing properties', { count: Object.keys(properties).length, overwrite, dry_run });
        const results = {
            would_create: [],
            would_update: [],
            would_skip: [],
            created: [],
            updated: [],
            skipped: [],
            failed: []
        };
        for (const [name, data] of Object.entries(properties)) {
            try {
                // Check if exists
                const existing = await this.client.searchRecords('sys_properties', `name=${name}`, 1);
                const exists = existing.success && existing.data?.result?.length > 0;
                if (dry_run) {
                    if (exists && overwrite) {
                        results.would_update.push(name);
                    }
                    else if (exists && !overwrite) {
                        results.would_skip.push(name);
                    }
                    else {
                        results.would_create.push(name);
                    }
                    continue;
                }
                if (exists && !overwrite) {
                    results.skipped.push(name);
                    continue;
                }
                const propertyData = typeof data === 'object' ? data : { value: data };
                if (exists) {
                    // Update
                    const sys_id = existing.data.result[0].sys_id;
                    const result = await this.client.updateRecord('sys_properties', sys_id, {
                        value: propertyData.value,
                        ...(propertyData.description && { description: propertyData.description }),
                        ...(propertyData.type && { type: propertyData.type }),
                        ...(propertyData.suffix && { suffix: propertyData.suffix }),
                        ...(propertyData.choices && { choices: propertyData.choices }),
                        ...(propertyData.is_private !== undefined && { is_private: propertyData.is_private ? 'true' : 'false' })
                    });
                    if (result.success) {
                        results.updated.push(name);
                    }
                    else {
                        results.failed.push(`${name}: ${result.error}`);
                    }
                }
                else {
                    // Create
                    this.logger.trackAPICall('CREATE', 'sys_properties', 1);
                    const result = await this.client.createRecord('sys_properties', {
                        name,
                        value: propertyData.value,
                        description: propertyData.description || `Imported by Snow-Flow`,
                        type: propertyData.type || 'string',
                        suffix: propertyData.suffix || 'global',
                        choices: propertyData.choices || '',
                        is_private: propertyData.is_private ? 'true' : 'false'
                    });
                    if (result.success) {
                        results.created.push(name);
                    }
                    else {
                        results.failed.push(`${name}: ${result.error}`);
                    }
                }
                // Clear cache
                this.propertyCache.delete(name);
            }
            catch (error) {
                this.logger.error(`Failed to import property ${name}:`, error);
                results.failed.push(`${name}: ${error}`);
            }
        }
        if (dry_run) {
            return {
                content: [{
                        type: 'text',
                        text: `🔍 **Import Preview (Dry Run)**

Would create: ${results.would_create.length}
${results.would_create.slice(0, 10).map(n => `• ${n}`).join('\n')}${results.would_create.length > 10 ? `\n... and ${results.would_create.length - 10} more` : ''}

Would update: ${results.would_update.length}
${results.would_update.slice(0, 10).map(n => `• ${n}`).join('\n')}${results.would_update.length > 10 ? `\n... and ${results.would_update.length - 10} more` : ''}

Would skip: ${results.would_skip.length}
${results.would_skip.slice(0, 10).map(n => `• ${n}`).join('\n')}${results.would_skip.length > 10 ? `\n... and ${results.would_skip.length - 10} more` : ''}

✅ Run with dry_run: false to apply changes`
                    }]
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `📥 **Import Results**

✅ Created: ${results.created.length}
🔄 Updated: ${results.updated.length}
⏭️ Skipped: ${results.skipped.length}
${results.failed.length > 0 ? `❌ Failed: ${results.failed.length}\n${results.failed.join('\n')}` : ''}

Total processed: ${Object.keys(properties).length}`
                }]
        };
    }
    /**
     * Validate property value
     */
    async validateProperty(args) {
        const { name, value } = args;
        this.logger.info(`Validating property: ${name} = ${value}`);
        try {
            // Get property metadata
            const response = await this.client.searchRecords('sys_properties', `name=${name}`, 1);
            if (!response.success || !response.data?.result?.length) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Property not found: ${name}. Cannot validate.`
                        }]
                };
            }
            const property = response.data.result[0];
            const validationResults = [];
            let isValid = true;
            // Type validation
            if (property.type) {
                switch (property.type) {
                    case 'boolean':
                        if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
                            validationResults.push('❌ Value must be true/false');
                            isValid = false;
                        }
                        else {
                            validationResults.push('✅ Valid boolean value');
                        }
                        break;
                    case 'integer':
                        if (!/^-?\d+$/.test(value)) {
                            validationResults.push('❌ Value must be an integer');
                            isValid = false;
                        }
                        else {
                            validationResults.push('✅ Valid integer value');
                        }
                        break;
                    case 'float':
                    case 'decimal':
                        if (!/^-?\d*\.?\d+$/.test(value)) {
                            validationResults.push('❌ Value must be a number');
                            isValid = false;
                        }
                        else {
                            validationResults.push('✅ Valid numeric value');
                        }
                        break;
                    case 'string':
                    default:
                        validationResults.push('✅ Valid string value');
                }
            }
            // Choices validation
            if (property.choices) {
                const validChoices = property.choices.split(',').map((c) => c.trim());
                if (!validChoices.includes(value)) {
                    validationResults.push(`❌ Value must be one of: ${validChoices.join(', ')}`);
                    isValid = false;
                }
                else {
                    validationResults.push('✅ Valid choice');
                }
            }
            return {
                content: [{
                        type: 'text',
                        text: `🔍 **Property Validation: ${name}**

**Current Value:** ${property.value}
**New Value:** ${value}
**Type:** ${property.type || 'string'}
${property.choices ? `**Valid Choices:** ${property.choices}` : ''}

**Validation Results:**
${validationResults.join('\n')}

**Overall:** ${isValid ? '✅ VALID' : '❌ INVALID'}`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Validation failed:', error);
            throw error;
        }
    }
    /**
     * Get property categories
     */
    async getCategories(args) {
        const { include_counts = true } = args;
        this.logger.info('Getting property categories');
        try {
            // Get distinct suffixes (categories)
            const response = await this.client.searchRecords('sys_properties', '', 1000);
            if (!response.success || !response.data?.result) {
                throw new Error('Failed to get categories');
            }
            const categories = {};
            for (const prop of response.data.result) {
                const category = prop.suffix || 'global';
                categories[category] = (categories[category] || 0) + 1;
            }
            const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
            let output = `📂 **Property Categories**\n\n`;
            for (const [category, count] of sorted) {
                if (include_counts) {
                    output += `• **${category}** (${count} properties)\n`;
                }
                else {
                    output += `• ${category}\n`;
                }
            }
            output += `\n📊 Total categories: ${sorted.length}`;
            output += `\n📋 Total properties: ${response.data.result.length}`;
            return {
                content: [{
                        type: 'text',
                        text: output
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to get categories:', error);
            throw error;
        }
    }
    /**
     * Get property audit history
     */
    async getPropertyHistory(args) {
        const { name, limit = 10 } = args;
        this.logger.info(`Getting history for property: ${name}`);
        try {
            // First, get the property to get its sys_id
            const propResponse = await this.client.searchRecords('sys_properties', `name=${name}`, 1);
            if (!propResponse.success || !propResponse.data?.result?.length) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Property not found: ${name}`
                        }]
                };
            }
            const sys_id = propResponse.data.result[0].sys_id;
            // Get audit history
            const auditResponse = await this.client.searchRecords('sys_audit', `documentkey=${sys_id}^tablename=sys_properties`, limit);
            if (!auditResponse.success || !auditResponse.data?.result?.length) {
                return {
                    content: [{
                            type: 'text',
                            text: `📜 No audit history found for property: ${name}`
                        }]
                };
            }
            let output = `📜 **Audit History: ${name}**\n\n`;
            for (const audit of auditResponse.data.result) {
                output += `**${audit.sys_created_on}**\n`;
                output += `• User: ${audit.sys_created_by}\n`;
                output += `• Field: ${audit.fieldname}\n`;
                output += `• Old: ${audit.oldvalue || '(empty)'}\n`;
                output += `• New: ${audit.newvalue || '(empty)'}\n`;
                output += '\n';
            }
            return {
                content: [{
                        type: 'text',
                        text: output
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to get history:', error);
            // Audit might not be available
            return {
                content: [{
                        type: 'text',
                        text: `⚠️ Audit history not available for this property or table.

Note: Audit history requires sys_audit to be enabled for sys_properties table.`
                    }]
            };
        }
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        // Use stderr for logs to keep stdout clean for JSON-RPC
        console.error('ServiceNow System Properties MCP Server running on stdio');
    }
}
exports.ServiceNowSystemPropertiesMCP = ServiceNowSystemPropertiesMCP;
// Start the server
const server = new ServiceNowSystemPropertiesMCP();
server.run().catch((error) => {
    console.error('Failed to start ServiceNow System Properties MCP:', error);
    process.exit(1);
});
//# sourceMappingURL=servicenow-system-properties-mcp.js.map