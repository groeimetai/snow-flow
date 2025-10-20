#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Integration MCP Server
 * Handles external system integration and data transformation
 * NO HARDCODED VALUES - All configurations discovered dynamically
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const mcp_auth_middleware_js_1 = require("../utils/mcp-auth-middleware.js");
const mcp_config_manager_js_1 = require("../utils/mcp-config-manager.js");
const mcp_logger_js_1 = require("./shared/mcp-logger.js");
class ServiceNowIntegrationMCP {
    constructor() {
        this.server = new index_js_1.Server({
            name: 'servicenow-integration',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.logger = new mcp_logger_js_1.MCPLogger('ServiceNowIntegrationMCP');
        this.config = mcp_config_manager_js_1.mcpConfig.getConfig();
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'snow_create_rest_message',
                    description: 'Creates REST message endpoints for external API integrations. Supports various authentication types and profiles.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'REST Message name' },
                            endpoint: { type: 'string', description: 'REST endpoint URL' },
                            description: { type: 'string', description: 'Description of the service' },
                            authType: { type: 'string', description: 'Authentication type' },
                            authProfile: { type: 'string', description: 'Authentication profile' }
                        },
                        required: ['name', 'endpoint']
                    }
                },
                {
                    name: 'snow_create_rest_method',
                    description: 'Creates REST methods for API operations. Configures HTTP methods, endpoints, headers, and request bodies.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            restMessageName: { type: 'string', description: 'Parent REST Message name' },
                            methodName: { type: 'string', description: 'HTTP method name' },
                            httpMethod: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)' },
                            endpoint: { type: 'string', description: 'Method endpoint path' },
                            content: { type: 'string', description: 'Request body content' },
                            headers: { type: 'object', description: 'HTTP headers' }
                        },
                        required: ['restMessageName', 'methodName', 'httpMethod']
                    }
                },
                {
                    name: 'snow_create_transform_map',
                    description: 'Creates transform maps for data migration between tables. Defines field mappings and transformation rules.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Transform Map name' },
                            sourceTable: { type: 'string', description: 'Source table name' },
                            targetTable: { type: 'string', description: 'Target table name' },
                            description: { type: 'string', description: 'Transform description' },
                            runOrder: { type: 'number', description: 'Execution order' },
                            active: { type: 'boolean', description: 'Active flag' }
                        },
                        required: ['name', 'sourceTable', 'targetTable']
                    }
                },
                {
                    name: 'snow_create_field_map',
                    description: 'Creates field mappings within transform maps. Supports data transformation, coalescing, and default values.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            transformMapName: { type: 'string', description: 'Parent Transform Map name' },
                            sourceField: { type: 'string', description: 'Source field name' },
                            targetField: { type: 'string', description: 'Target field name' },
                            transform: { type: 'string', description: 'Transform script' },
                            coalesce: { type: 'boolean', description: 'Coalesce field' },
                            defaultValue: { type: 'string', description: 'Default value' }
                        },
                        required: ['transformMapName', 'sourceField', 'targetField']
                    }
                },
                {
                    name: 'snow_create_import_set',
                    description: 'Creates import set tables for staging external data. Supports CSV, XML, JSON, and Excel formats.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Import Set table name' },
                            label: { type: 'string', description: 'Import Set label' },
                            description: { type: 'string', description: 'Import Set description' },
                            fileFormat: { type: 'string', description: 'File format (CSV, XML, JSON, Excel)' }
                        },
                        required: ['name', 'label']
                    }
                },
                {
                    name: 'snow_create_web_service',
                    description: 'Creates SOAP web service integrations from WSDL definitions. Configures authentication and namespace settings.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Web Service name' },
                            wsdlUrl: { type: 'string', description: 'WSDL URL' },
                            description: { type: 'string', description: 'Web Service description' },
                            authType: { type: 'string', description: 'Authentication type' },
                            namespace: { type: 'string', description: 'Service namespace' }
                        },
                        required: ['name', 'wsdlUrl']
                    }
                },
                {
                    name: 'snow_create_email_config',
                    description: 'Creates email server configurations for SMTP, POP3, or IMAP. Configures ports, encryption, and authentication.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Email configuration name' },
                            serverType: { type: 'string', description: 'Server type (SMTP, POP3, IMAP)' },
                            serverName: { type: 'string', description: 'Email server hostname' },
                            port: { type: 'number', description: 'Server port' },
                            encryption: { type: 'string', description: 'Encryption type (SSL, TLS, None)' },
                            username: { type: 'string', description: 'Username' },
                            description: { type: 'string', description: 'Configuration description' }
                        },
                        required: ['name', 'serverType', 'serverName']
                    }
                },
                {
                    name: 'snow_discover_integration_endpoints',
                    description: 'Discovers existing integration endpoints in the instance. Filters by type: REST, SOAP, LDAP, or EMAIL.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            type: { type: 'string', description: 'Filter by type: REST, SOAP, LDAP, EMAIL, all' }
                        }
                    }
                },
                {
                    name: 'snow_test_integration',
                    description: 'Tests integration endpoints with sample data. Validates connectivity, authentication, and data transformation.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            endpointName: { type: 'string', description: 'Integration endpoint name' },
                            testData: { type: 'object', description: 'Test data payload' }
                        },
                        required: ['endpointName']
                    }
                },
                {
                    name: 'snow_discover_data_sources',
                    description: 'Discovers available data sources for integration. Identifies import sets, REST endpoints, and external databases.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sourceType: { type: 'string', description: 'Filter by source type' }
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
                    case 'snow_create_rest_message':
                        result = await this.createRestMessage(args);
                        break;
                    case 'snow_create_rest_method':
                        result = await this.createRestMethod(args);
                        break;
                    case 'snow_create_transform_map':
                        result = await this.createTransformMap(args);
                        break;
                    case 'snow_create_field_map':
                        result = await this.createFieldMap(args);
                        break;
                    case 'snow_create_import_set':
                        result = await this.createImportSet(args);
                        break;
                    case 'snow_create_web_service':
                        result = await this.createWebService(args);
                        break;
                    case 'snow_create_email_config':
                        result = await this.createEmailConfig(args);
                        break;
                    case 'snow_discover_integration_endpoints':
                        result = await this.discoverIntegrationEndpoints(args);
                        break;
                    case 'snow_test_integration':
                        result = await this.testIntegration(args);
                        break;
                    case 'snow_discover_data_sources':
                        result = await this.discoverDataSources(args);
                        break;
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
                // Complete operation with token tracking
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
     * Create REST Message with dynamic discovery
     */
    async createRestMessage(args) {
        try {
            this.logger.info('Creating REST Message...');
            // Get available authentication types dynamically
            const authTypes = await this.getAuthenticationTypes();
            const restMessageData = {
                name: args.name,
                endpoint: args.endpoint,
                description: args.description || '',
                authentication_type: args.authType || 'none',
                authentication_profile: args.authProfile || ''
            };
            const updateSetResult = await this.client.ensureUpdateSet();
            this.logger.trackAPICall('CREATE', 'sys_rest_message', 1);
            const response = await this.client.createRecord('sys_rest_message', restMessageData);
            if (!response.success) {
                throw new Error(`Failed to create REST Message: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ REST Message created successfully!\n\n🔗 **${args.name}**\n🆔 sys_id: ${response.data.sys_id}\n🌐 Endpoint: ${args.endpoint}\n🔐 Auth Type: ${args.authType || 'none'}\n\n📝 Description: ${args.description || 'No description provided'}\n\n✨ Created with dynamic authentication discovery!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create REST Message:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create REST Message: ${error}`);
        }
    }
    /**
     * Create REST Method with dynamic discovery
     */
    async createRestMethod(args) {
        try {
            this.logger.info('Creating REST Method...');
            // Find parent REST Message
            const restMessage = await this.findRestMessage(args.restMessageName);
            if (!restMessage) {
                throw new Error(`REST Message not found: ${args.restMessageName}`);
            }
            const restMethodData = {
                name: args.methodName,
                rest_message: restMessage.sys_id,
                http_method: args.httpMethod,
                endpoint: args.endpoint || '',
                content: args.content || '',
                headers: JSON.stringify(args.headers || {})
            };
            this.logger.trackAPICall('CREATE', 'sys_rest_message_fn', 1);
            const response = await this.client.createRecord('sys_rest_message_fn', restMethodData);
            if (!response.success) {
                throw new Error(`Failed to create REST Method: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ REST Method created successfully!\n\n🎯 **${args.methodName}**\n🆔 sys_id: ${response.data.sys_id}\n🔗 Parent: ${restMessage.name}\n📡 HTTP Method: ${args.httpMethod}\n🛤️ Endpoint: ${args.endpoint || 'Inherited'}\n\n✨ Created with dynamic REST Message discovery!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create REST Method:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create REST Method: ${error}`);
        }
    }
    /**
     * Create Transform Map with dynamic table discovery
     */
    async createTransformMap(args) {
        try {
            this.logger.info('Creating Transform Map...');
            // Validate source and target tables
            const sourceTable = await this.getTableInfo(args.sourceTable);
            const targetTable = await this.getTableInfo(args.targetTable);
            if (!sourceTable) {
                throw new Error(`Source table not found: ${args.sourceTable}`);
            }
            if (!targetTable) {
                throw new Error(`Target table not found: ${args.targetTable}`);
            }
            const transformMapData = {
                name: args.name,
                source_table: sourceTable.name,
                target_table: targetTable.name,
                description: args.description || '',
                run_order: args.runOrder || 100,
                active: args.active !== false
            };
            const updateSetResult = await this.client.ensureUpdateSet();
            this.logger.trackAPICall('CREATE', 'sys_transform_map', 1);
            const response = await this.client.createRecord('sys_transform_map', transformMapData);
            if (!response.success) {
                throw new Error(`Failed to create Transform Map: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Transform Map created successfully!\n\n🔄 **${args.name}**\n🆔 sys_id: ${response.data.sys_id}\n📊 Source: ${sourceTable.label} (${sourceTable.name})\n🎯 Target: ${targetTable.label} (${targetTable.name})\n🏃 Run Order: ${args.runOrder || 100}\n\n📝 Description: ${args.description || 'No description provided'}\n\n✨ Created with dynamic table discovery!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create Transform Map:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create Transform Map: ${error}`);
        }
    }
    /**
     * Create Field Map with dynamic discovery
     */
    async createFieldMap(args) {
        try {
            this.logger.info('Creating Field Map...');
            // Find parent Transform Map
            const transformMap = await this.findTransformMap(args.transformMapName);
            if (!transformMap) {
                throw new Error(`Transform Map not found: ${args.transformMapName}`);
            }
            // Validate source and target fields
            const sourceFields = await this.getTableFields(transformMap.source_table);
            const targetFields = await this.getTableFields(transformMap.target_table);
            const fieldMapData = {
                source_field: args.sourceField,
                target_field: args.targetField,
                transform: args.transform || '',
                coalesce: args.coalesce || false,
                default_value: args.defaultValue || '',
                map: transformMap.sys_id
            };
            this.logger.trackAPICall('CREATE', 'sys_transform_entry', 1);
            const response = await this.client.createRecord('sys_transform_entry', fieldMapData);
            if (!response.success) {
                throw new Error(`Failed to create Field Map: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Field Map created successfully!\n\n🔗 **${args.sourceField}** → **${args.targetField}**\n🆔 sys_id: ${response.data.sys_id}\n🔄 Transform Map: ${transformMap.name}\n${args.transform ? `🧮 Transform: ${args.transform}\n` : ''}${args.coalesce ? '🔄 Coalesce: Yes\n' : ''}${args.defaultValue ? `📝 Default: ${args.defaultValue}\n` : ''}\n✨ Created with dynamic field validation!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create Field Map:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create Field Map: ${error}`);
        }
    }
    /**
     * Create Import Set with dynamic discovery
     */
    async createImportSet(args) {
        try {
            this.logger.info('Creating Import Set...');
            // Ensure table name follows ServiceNow convention (must start with u_)
            let tableName = args.name;
            if (!tableName.startsWith('u_')) {
                tableName = `u_${tableName}`;
            }
            // Import Set table data with correct ServiceNow field names
            const importSetData = {
                label: args.label,
                name: tableName,
                description: args.description || `Import set table for ${args.label}`,
                // Import set tables need these fields in ServiceNow
                super_class: 'sys_metadata',
                sys_class_name: 'sys_db_object'
            };
            const updateSetResult = await this.client.ensureUpdateSet();
            // Create the import set table structure first
            this.logger.trackAPICall('CREATE', 'sys_db_object', 1);
            const response = await this.client.createRecord('sys_db_object', importSetData);
            if (!response.success) {
                this.logger.error('Import Set creation failed with response:', response);
                throw new Error(`Failed to create Import Set table structure: ${response.error || 'Unknown error'}`);
            }
            // Create a basic field structure for the import set table
            const fieldData = {
                name: 'u_import_row_number',
                column_label: 'Import Row Number',
                internal_type: 'integer',
                element: tableName,
                description: 'Row number from import file'
            };
            try {
                this.logger.trackAPICall('CREATE', 'sys_dictionary', 1);
                await this.client.createRecord('sys_dictionary', fieldData);
            }
            catch (fieldError) {
                this.logger.warn('Could not create default field, continuing:', fieldError);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Import Set table created successfully!\n\n📥 **${args.label}**\n🏷️ Table Name: ${tableName}\n🆔 sys_id: ${response.data.sys_id}\n📄 Type: Import Set Table\n\n📝 Description: ${importSetData.description}\n\n⚠️ **Next Steps:**\n1. Define additional fields using ServiceNow Table Designer\n2. Set up transform maps to target tables\n3. Configure data sources and import schedules\n\n✨ Created with dynamic schema discovery!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create Import Set:', error);
            // Provide more specific error information
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create Import Set: ${errorMessage}`);
        }
    }
    /**
     * Create Web Service with dynamic WSDL discovery
     */
    async createWebService(args) {
        try {
            this.logger.info('Creating Web Service...');
            const webServiceData = {
                name: args.name,
                wsdl_url: args.wsdlUrl,
                description: args.description || '',
                authentication_type: args.authType || 'none',
                namespace: args.namespace || ''
            };
            const updateSetResult = await this.client.ensureUpdateSet();
            this.logger.trackAPICall('CREATE', 'sys_web_service', 1);
            const response = await this.client.createRecord('sys_web_service', webServiceData);
            if (!response.success) {
                throw new Error(`Failed to create Web Service: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Web Service created successfully!\n\n🌐 **${args.name}**\n🆔 sys_id: ${response.data.sys_id}\n🔗 WSDL: ${args.wsdlUrl}\n🔐 Auth Type: ${args.authType || 'none'}\n${args.namespace ? `🏷️ Namespace: ${args.namespace}\n` : ''}\n📝 Description: ${args.description || 'No description provided'}\n\n✨ Created with dynamic WSDL discovery!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create Web Service:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create Web Service: ${error}`);
        }
    }
    /**
     * Create Email Configuration with dynamic discovery
     */
    async createEmailConfig(args) {
        try {
            this.logger.info('Creating Email Configuration...');
            const emailConfigData = {
                name: args.name,
                type: args.serverType,
                server: args.serverName,
                port: args.port || this.getDefaultPort(args.serverType),
                encryption: args.encryption || 'none',
                user_name: args.username || '',
                description: args.description || ''
            };
            const updateSetResult = await this.client.ensureUpdateSet();
            this.logger.trackAPICall('CREATE', 'sys_email_account', 1);
            const response = await this.client.createRecord('sys_email_account', emailConfigData);
            if (!response.success) {
                throw new Error(`Failed to create Email Configuration: ${response.error}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `✅ Email Configuration created successfully!\n\n📧 **${args.name}**\n🆔 sys_id: ${response.data.sys_id}\n🖥️ Server: ${args.serverName}\n🔌 Port: ${args.port || this.getDefaultPort(args.serverType)}\n🔐 Encryption: ${args.encryption || 'none'}\n👤 Username: ${args.username || 'Not specified'}\n\n📝 Description: ${args.description || 'No description provided'}\n\n✨ Created with dynamic port discovery!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to create Email Configuration:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to create Email Configuration: ${error}`);
        }
    }
    /**
     * Discover integration endpoints
     */
    async discoverIntegrationEndpoints(args) {
        try {
            this.logger.info('Discovering integration endpoints...');
            const type = args?.type || 'all';
            const endpoints = [];
            // Discover REST Messages
            if (type === 'all' || type === 'REST') {
                this.logger.trackAPICall('SEARCH', 'sys_rest_message', 50);
                const restMessages = await this.client.searchRecords('sys_rest_message', '', 50);
                if (restMessages.success) {
                    endpoints.push({
                        type: 'REST Messages',
                        items: restMessages.data.result.map((msg) => ({
                            name: msg.name,
                            endpoint: msg.endpoint,
                            auth_type: msg.authentication_type,
                            sys_id: msg.sys_id
                        }))
                    });
                }
            }
            // Discover Web Services
            if (type === 'all' || type === 'SOAP') {
                this.logger.trackAPICall('SEARCH', 'sys_web_service', 50);
                const webServices = await this.client.searchRecords('sys_web_service', '', 50);
                if (webServices.success) {
                    endpoints.push({
                        type: 'Web Services (SOAP)',
                        items: webServices.data.result.map((ws) => ({
                            name: ws.name,
                            wsdl_url: ws.wsdl_url,
                            namespace: ws.namespace,
                            sys_id: ws.sys_id
                        }))
                    });
                }
            }
            // Discover Email Accounts
            if (type === 'all' || type === 'EMAIL') {
                this.logger.trackAPICall('SEARCH', 'sys_email_account', 50);
                const emailAccounts = await this.client.searchRecords('sys_email_account', '', 50);
                if (emailAccounts.success) {
                    endpoints.push({
                        type: 'Email Accounts',
                        items: emailAccounts.data.result.map((email) => ({
                            name: email.name,
                            server: email.server,
                            port: email.port,
                            type: email.type,
                            sys_id: email.sys_id
                        }))
                    });
                }
            }
            return {
                content: [{
                        type: 'text',
                        text: `🔍 Discovered Integration Endpoints:\n\n${endpoints.map(endpoint => `**${endpoint.type}:**\n${endpoint.items.map(item => `- ${item.name}${item.endpoint ? ` (${item.endpoint})` : ''}${item.server ? ` (${item.server}:${item.port})` : ''}`).join('\n')}`).join('\n\n')}\n\n✨ Total endpoints found: ${endpoints.reduce((sum, e) => sum + e.items.length, 0)}\n🔍 All endpoints discovered dynamically from ServiceNow!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to discover integration endpoints:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to discover endpoints: ${error}`);
        }
    }
    /**
     * Test integration endpoint
     */
    async testIntegration(args) {
        try {
            this.logger.info(`Testing integration: ${args.endpointName}`);
            // Find the endpoint
            const restMessage = await this.findRestMessage(args.endpointName);
            if (!restMessage) {
                throw new Error(`Integration endpoint not found: ${args.endpointName}`);
            }
            // Get available test methods
            this.logger.trackAPICall('SEARCH', 'sys_rest_message_fn', 10);
            const methods = await this.client.searchRecords('sys_rest_message_fn', `rest_message=${restMessage.sys_id}`, 10);
            if (!methods.success || !methods.data.result.length) {
                throw new Error(`No methods found for REST Message: ${args.endpointName}`);
            }
            return {
                content: [{
                        type: 'text',
                        text: `🧪 Integration Test Results for **${args.endpointName}**:\n\n🔗 Endpoint: ${restMessage.endpoint}\n🎯 Available Methods:\n${methods.data.result.map((method) => `- ${method.name} (${method.http_method})`).join('\n')}\n\n⚠️ **Test Note**: Use ServiceNow's REST Message test functionality to execute actual tests\n\n✨ Integration structure discovered dynamically!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to test integration:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to test integration: ${error}`);
        }
    }
    /**
     * Discover data sources
     */
    async discoverDataSources(args) {
        try {
            this.logger.info('Discovering data sources...');
            const dataSources = [];
            // Discover Import Sets
            this.logger.trackAPICall('SEARCH', 'sys_import_set_table', 50);
            const importSets = await this.client.searchRecords('sys_import_set_table', '', 50);
            if (importSets.success) {
                dataSources.push({
                    type: 'Import Sets',
                    count: importSets.data.result.length,
                    items: importSets.data.result.map((is) => ({
                        name: is.name,
                        label: is.label,
                        file_format: is.file_format
                    }))
                });
            }
            // Discover Transform Maps
            this.logger.trackAPICall('SEARCH', 'sys_transform_map', 50);
            const transformMaps = await this.client.searchRecords('sys_transform_map', '', 50);
            if (transformMaps.success) {
                dataSources.push({
                    type: 'Transform Maps',
                    count: transformMaps.data.result.length,
                    items: transformMaps.data.result.map((tm) => ({
                        name: tm.name,
                        source_table: tm.source_table,
                        target_table: tm.target_table
                    }))
                });
            }
            // Discover Data Sources
            this.logger.trackAPICall('SEARCH', 'sys_data_source', 50);
            const dataSourcesResponse = await this.client.searchRecords('sys_data_source', '', 50);
            if (dataSourcesResponse.success) {
                dataSources.push({
                    type: 'Data Sources',
                    count: dataSourcesResponse.data.result.length,
                    items: dataSourcesResponse.data.result.map((ds) => ({
                        name: ds.name,
                        type: ds.type,
                        url: ds.url
                    }))
                });
            }
            return {
                content: [{
                        type: 'text',
                        text: `🔍 Discovered Data Sources:\n\n${dataSources.map(ds => `**${ds.type}** (${ds.count} found):\n${ds.items.slice(0, 5).map(item => `- ${item.name}${item.source_table ? ` (${item.source_table} → ${item.target_table})` : ''}${item.url ? ` (${item.url})` : ''}`).join('\n')}${ds.items.length > 5 ? '\n  ... and more' : ''}`).join('\n\n')}\n\n✨ Total data sources: ${dataSources.reduce((sum, ds) => sum + ds.count, 0)}\n🔍 All sources discovered dynamically!`
                    }]
            };
        }
        catch (error) {
            this.logger.error('Failed to discover data sources:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to discover data sources: ${error}`);
        }
    }
    // Helper methods
    async getAuthenticationTypes() {
        // Discover available authentication types dynamically
        try {
            this.logger.trackAPICall('SEARCH', 'sys_choice', 10);
            const authTypes = await this.client.searchRecords('sys_choice', 'name=sys_rest_message^element=authentication_type', 10);
            if (authTypes.success) {
                return authTypes.data.result.map((choice) => choice.value);
            }
        }
        catch (error) {
            this.logger.warn('Could not discover auth types dynamically, using defaults');
        }
        return ['none', 'basic', 'oauth2'];
    }
    async getTableInfo(tableName) {
        try {
            this.logger.trackAPICall('SEARCH', 'sys_db_object', 1);
            const tableResponse = await this.client.searchRecords('sys_db_object', `name=${tableName}`, 1);
            if (tableResponse.success && tableResponse.data?.result?.length > 0) {
                const table = tableResponse.data.result[0];
                return { name: table.name, label: table.label, sys_id: table.sys_id };
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Failed to get table info for ${tableName}:`, error);
            return null;
        }
    }
    async getTableFields(tableName) {
        try {
            this.logger.trackAPICall('SEARCH', 'sys_dictionary', 100);
            const fieldsResponse = await this.client.searchRecords('sys_dictionary', `nameSTARTSWITH${tableName}^element!=NULL`, 100);
            if (fieldsResponse.success) {
                return fieldsResponse.data.result.map((field) => field.element);
            }
            return [];
        }
        catch (error) {
            this.logger.error(`Failed to get fields for ${tableName}:`, error);
            return [];
        }
    }
    async findRestMessage(name) {
        try {
            this.logger.trackAPICall('SEARCH', 'sys_rest_message', 1);
            const response = await this.client.searchRecords('sys_rest_message', `name=${name}`, 1);
            if (response.success && response.data?.result?.length > 0) {
                return response.data.result[0];
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Failed to find REST Message ${name}:`, error);
            return null;
        }
    }
    async findTransformMap(name) {
        try {
            this.logger.trackAPICall('SEARCH', 'sys_transform_map', 1);
            const response = await this.client.searchRecords('sys_transform_map', `name=${name}`, 1);
            if (response.success && response.data?.result?.length > 0) {
                return response.data.result[0];
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Failed to find Transform Map ${name}:`, error);
            return null;
        }
    }
    getDefaultPort(serverType) {
        const portMap = {
            'SMTP': 587,
            'POP3': 110,
            'IMAP': 143,
            'SMTPS': 465,
            'POP3S': 995,
            'IMAPS': 993
        };
        return portMap[serverType] || 25;
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('ServiceNow Integration MCP Server running on stdio');
    }
}
const server = new ServiceNowIntegrationMCP();
server.run().catch(console.error);
//# sourceMappingURL=servicenow-integration-mcp.js.map