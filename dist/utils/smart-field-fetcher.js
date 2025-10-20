"use strict";
/**
 * Smart Field Fetcher for ServiceNow Artifacts
 *
 * Intelligently fetches large artifacts by splitting fields into chunks
 * while maintaining context relationships between fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartFieldFetcher = void 0;
exports.createFetchStrategyHint = createFetchStrategyHint;
const artifact_registry_js_1 = require("./artifact-sync/artifact-registry.js");
const mcp_timeout_config_js_1 = require("./mcp-timeout-config.js");
// Widget field groups with relationship context - 20K per field for better context
const WIDGET_FIELD_GROUPS = [
    {
        groupName: 'metadata',
        fields: ['sys_id', 'name', 'title', 'id', 'sys_created_on', 'sys_updated_on', 'sys_scope'],
        description: 'Basic widget identification and metadata',
        maxTokens: 2000
    },
    {
        groupName: 'template',
        fields: ['template'],
        description: 'HTML template - defines UI structure and Angular bindings (ng-click, {{data.x}})',
        maxTokens: 200000 // Claude's full context window
    },
    {
        groupName: 'server_script',
        fields: ['script'], // Note: 'script' is the actual field name, not 'server_script'
        description: 'Server-side script (ES5 only) - initializes data object and handles input.action requests',
        maxTokens: 200000 // Claude's full context window
    },
    {
        groupName: 'client_script',
        fields: ['client_script'],
        description: 'Client-side AngularJS controller - implements methods called by template ng-click and calls c.server.get()',
        maxTokens: 200000 // Claude's full context window
    },
    {
        groupName: 'styling',
        fields: ['css'],
        description: 'Widget-specific CSS styles - classes used in template',
        maxTokens: 200000 // Claude's full context window
    },
    {
        groupName: 'configuration',
        fields: ['option_schema', 'data_table', 'demo_data', 'public', 'roles'],
        description: 'Widget configuration options, data sources and access control',
        maxTokens: 10000 // Increased for better config context
    },
    {
        groupName: 'dependencies',
        fields: ['dependencies', 'link'],
        description: 'Widget dependencies and Angular providers required',
        maxTokens: 5000
    }
];
// Flow field groups
const FLOW_FIELD_GROUPS = [
    {
        groupName: 'metadata',
        fields: ['sys_id', 'name', 'label', 'description', 'active'],
        description: 'Flow identification and basic info',
        maxTokens: 1000
    },
    {
        groupName: 'definition',
        fields: ['definition'],
        description: 'Complete flow definition JSON - contains all steps, actions, and conditions',
        maxTokens: 20000
    },
    {
        groupName: 'configuration',
        fields: ['trigger_type', 'trigger_condition', 'run_as'],
        description: 'Flow trigger and execution configuration',
        maxTokens: 2000
    }
];
// Business Rule field groups
const BUSINESS_RULE_FIELD_GROUPS = [
    {
        groupName: 'metadata',
        fields: ['sys_id', 'name', 'collection', 'active', 'order'],
        description: 'Business rule identification and table',
        maxTokens: 1000
    },
    {
        groupName: 'conditions',
        fields: ['when', 'condition', 'filter_condition'],
        description: 'When rule runs and filter conditions',
        maxTokens: 2000
    },
    {
        groupName: 'script',
        fields: ['script'],
        description: 'Business rule script (ES5) - current, previous, gs available',
        maxTokens: 10000
    },
    {
        groupName: 'advanced',
        fields: ['advanced', 'role_conditions', 'abort_action'],
        description: 'Advanced configuration and actions',
        maxTokens: 2000
    }
];
class SmartFieldFetcher {
    constructor(client) {
        this.client = client;
    }
    /**
     * DYNAMIC fetch any artifact using registry configuration
     */
    async fetchArtifact(table, sys_id) {
        console.log(`\n🔍 Smart fetching ${table}: ${sys_id}`);
        const fieldGroups = this.getFieldGroups(table);
        const config = (0, artifact_registry_js_1.getArtifactConfig)(table);
        const results = {
            _fetch_strategy: 'smart_chunked',
            _context_hint: config ? `${config.displayName} - fields fetched in groups to respect token limits` : 'Fields fetched separately but are related',
            _field_groups: {}
        };
        // Fetch each field group
        for (const group of fieldGroups) {
            console.log(`📦 Fetching ${group.groupName}: ${group.description}`);
            try {
                const response = await this.client.getRecord(table, sys_id);
                if (response) {
                    results._field_groups[group.groupName] = {
                        data: response,
                        description: group.description,
                        fields: group.fields
                    };
                    // FIX: getRecord returns direct object, not response.result[0]
                    Object.assign(results, response);
                }
            }
            catch (error) {
                console.log(`⚠️ Failed to fetch ${group.groupName}: ${error.message}`);
                // If group fails due to size, fetch fields individually
                if (error.message?.includes('exceeds maximum allowed tokens')) {
                    results._field_groups[group.groupName] = await this.fetchFieldsIndividually(table, sys_id, group.fields, group.description);
                }
            }
        }
        // Add coherence validation hints if it's a widget
        if (table === 'sp_widget') {
            results._coherence_hints = this.generateCoherenceHints(results);
        }
        return results;
    }
    /**
     * Intelligently fetch widget fields with context preservation
     * (Wrapper for backward compatibility)
     */
    async fetchWidget(sys_id) {
        console.log(`\n🔍 Smart fetching widget: ${sys_id}`);
        const results = {
            _fetch_strategy: 'smart_chunked',
            _context_hint: 'Widget fields fetched separately but are interconnected: template references {{data.x}} from server script, calls methods from client script, and uses CSS classes',
            _field_groups: {}
        };
        // Try to fetch all fields first, then fall back to individual fields if too large
        console.log(`📦 Attempting to fetch complete widget data...`);
        const timeoutConfig = (0, mcp_timeout_config_js_1.getMCPTimeoutConfig)();
        try {
            // Try to get all fields at once with timeout protection
            const response = await (0, mcp_timeout_config_js_1.withMCPTimeout)(this.client.searchRecords('sp_widget', `sys_id=${sys_id}`, 1), timeoutConfig.queryToolTimeout, `Fetch complete widget ${sys_id}`);
            if (response && response.success && response.data && response.data.result && response.data.result.length > 0) {
                const widgetData = response.data.result[0];
                console.log(`✅ Successfully fetched complete widget`);
                // Organize into field groups for better context
                for (const group of WIDGET_FIELD_GROUPS) {
                    const groupData = {};
                    for (const fieldName of group.fields) {
                        if (widgetData[fieldName] !== undefined) {
                            groupData[fieldName] = widgetData[fieldName];
                        }
                    }
                    results._field_groups[group.groupName] = {
                        data: groupData,
                        description: group.description,
                        fields: group.fields
                    };
                }
                // Add complete widget data to flat structure
                Object.assign(results, widgetData);
            }
            else {
                throw new Error('Widget not found or no data returned');
            }
        }
        catch (error) {
            console.log(`⚠️ Complete fetch failed: ${error.message}`);
            console.log(`🔄 Switching to more robust fetching approach...`);
            // First, get the widget with minimal fields to ensure it exists
            try {
                const basicResponse = await (0, mcp_timeout_config_js_1.withMCPTimeout)(this.client.searchRecords('sp_widget', `sys_id=${sys_id}`, 1), timeoutConfig.queryToolTimeout, `Basic widget fetch ${sys_id}`);
                if (!basicResponse || !basicResponse.success || !basicResponse.data || !basicResponse.data.result || basicResponse.data.result.length === 0) {
                    throw new Error(`Widget with sys_id ${sys_id} not found`);
                }
                // Widget exists, now get it via getRecord which might handle large fields better
                const widgetData = basicResponse.data.result[0];
                // Store what we got
                if (widgetData) {
                    // Add all available fields to results
                    Object.assign(results, widgetData);
                    // Organize into field groups
                    for (const group of WIDGET_FIELD_GROUPS) {
                        const groupData = {};
                        for (const fieldName of group.fields) {
                            if (widgetData[fieldName] !== undefined) {
                                groupData[fieldName] = widgetData[fieldName];
                            }
                        }
                        results._field_groups[group.groupName] = {
                            data: groupData,
                            description: group.description,
                            fields: group.fields
                        };
                    }
                    // Log what we got
                    console.log(`📊 Retrieved widget fields:`);
                    console.log(`  - name: ${widgetData.name || 'N/A'}`);
                    console.log(`  - template: ${widgetData.template ? widgetData.template.length + ' chars' : 'empty'}`);
                    console.log(`  - script: ${widgetData.script ? widgetData.script.length + ' chars' : 'empty'}`);
                    console.log(`  - client_script: ${widgetData.client_script ? widgetData.client_script.length + ' chars' : 'empty'}`);
                    console.log(`  - css: ${widgetData.css ? widgetData.css.length + ' chars' : 'empty'}`);
                }
                // If critical fields are missing, try alternative approach
                if (!widgetData.script && !widgetData.client_script && !widgetData.template) {
                    console.log(`⚠️ Critical fields missing, trying direct API call...`);
                    // Try using getRecord instead of searchRecords with short timeout
                    const directResponse = await (0, mcp_timeout_config_js_1.withMCPTimeout)(this.client.getRecord('sp_widget', sys_id), 5000, // 5 second timeout for direct fetch
                    `Direct widget fetch ${sys_id}`);
                    if (directResponse) {
                        // FIX: getRecord returns direct object, not nested structure
                        const directData = directResponse;
                        // Merge any new data we got
                        Object.assign(results, directData);
                        console.log(`📊 Direct API retrieved:`);
                        console.log(`  - template: ${directData.template ? directData.template.length + ' chars' : 'empty'}`);
                        console.log(`  - script: ${directData.script ? directData.script.length + ' chars' : 'empty'}`);
                        console.log(`  - client_script: ${directData.client_script ? directData.client_script.length + ' chars' : 'empty'}`);
                    }
                }
            }
            catch (fallbackError) {
                console.log(`❌ All fetch attempts failed: ${fallbackError.message}`);
                // At least return basic structure with sys_id
                results.sys_id = sys_id;
                results.name = 'Unknown Widget';
                results.template = '';
                results.script = '';
                results.client_script = '';
                results.css = '';
            }
            // Make sure we have at least the sys_id
            if (!results.sys_id) {
                results.sys_id = sys_id;
            }
        }
        // Add coherence validation hints
        results._coherence_hints = this.generateCoherenceHints(results);
        return results;
    }
    /**
     * Fetch flow with intelligent chunking
     * (Wrapper for backward compatibility)
     */
    async fetchFlow(sys_id) {
        return this.fetchArtifact('sys_hub_flow', sys_id);
    }
    /**
     * Fetch business rule with intelligent chunking
     * (Wrapper for backward compatibility)
     */
    async fetchBusinessRule(sys_id) {
        return this.fetchArtifact('sys_script', sys_id);
    }
    /**
     * Fetch fields one by one when group is too large
     */
    async fetchFieldsIndividually(table, sys_id, fields, groupDescription) {
        console.log(`  ↪️ Group too large, fetching fields individually...`);
        const result = {
            data: {},
            description: groupDescription,
            _fetched_individually: true,
            _field_status: {}
        };
        for (const field of fields) {
            try {
                console.log(`    📄 Fetching field: ${field}`);
                const response = await this.client.getRecord(table, sys_id);
                if (response) {
                    // FIX: getRecord returns direct object
                    result.data[field] = response[field];
                    result._field_status[field] = 'success';
                }
            }
            catch (fieldError) {
                console.log(`      ⚠️ Field ${field} failed: ${fieldError.message}`);
                result._field_status[field] = 'failed';
                result.data[field] = `[Error: Field too large or inaccessible]`;
            }
        }
        return result;
    }
    /**
     * Generate coherence hints for widget validation
     */
    generateCoherenceHints(widget) {
        const hints = [];
        // Check template references
        if (widget.template) {
            const dataRefs = widget.template.match(/\{\{data\.(\w+)\}\}/g) || [];
            const methodRefs = widget.template.match(/ng-click="(\w+)\(/g) || [];
            if (dataRefs.length > 0) {
                hints.push(`Template references data properties: ${dataRefs.join(', ')}`);
            }
            if (methodRefs.length > 0) {
                hints.push(`Template calls methods: ${methodRefs.join(', ')}`);
            }
        }
        // Check server script data initialization
        if (widget.script) {
            const dataInits = widget.script.match(/data\.(\w+)\s*=/g) || [];
            if (dataInits.length > 0) {
                hints.push(`Server script initializes: ${dataInits.join(', ')}`);
            }
        }
        // Check client script methods
        if (widget.client_script) {
            const scopeMethods = widget.client_script.match(/\$scope\.(\w+)\s*=/g) || [];
            const serverCalls = widget.client_script.match(/c\.server\.get\(\{action:\s*['"](\w+)['"]/g) || [];
            if (scopeMethods.length > 0) {
                hints.push(`Client script implements: ${scopeMethods.join(', ')}`);
            }
            if (serverCalls.length > 0) {
                hints.push(`Client calls server actions: ${serverCalls.join(', ')}`);
            }
        }
        return hints;
    }
    /**
     * Search within fields using GlideRecord queries
     */
    async searchInField(table, field, searchTerm, additionalQuery) {
        console.log(`\n🔎 Searching in ${table}.${field} for: ${searchTerm}`);
        // Use CONTAINS operator for field search
        const query = `${field}CONTAINS${searchTerm}${additionalQuery ? '^' + additionalQuery : ''}`;
        try {
            const response = await this.client.searchRecords(table, query, 10);
            console.log(`  ✅ Found ${response.result?.length || 0} matches`);
            return response.result || [];
        }
        catch (error) {
            console.log(`  ⚠️ Search failed: ${error}`);
            return [];
        }
    }
    /**
     * Debug method to directly test API calls
     */
    async debugFetchWidget(sys_id) {
        console.log(`\n🔍 DEBUG: Testing different fetch approaches for widget ${sys_id}\n`);
        const results = {};
        const timeoutConfig = (0, mcp_timeout_config_js_1.getMCPTimeoutConfig)();
        // Test 1: Basic searchRecords with timeout
        try {
            console.log(`Test 1: searchRecords (${timeoutConfig.queryToolTimeout / 1000}s timeout)...`);
            const test1 = await (0, mcp_timeout_config_js_1.withMCPTimeout)(this.client.searchRecords('sp_widget', `sys_id=${sys_id}`, 1), timeoutConfig.queryToolTimeout, 'searchRecords test');
            console.log(`  - Response structure: success=${test1?.success}, has data=${!!test1?.data}, has result=${!!test1?.data?.result}`);
            if (test1?.data?.result?.[0]) {
                const widget = test1.data.result[0];
                console.log(`  - Fields received: ${Object.keys(widget).join(', ')}`);
                console.log(`  - Script length: ${widget.script?.length || 0}`);
                console.log(`  - Client script length: ${widget.client_script?.length || 0}`);
                console.log(`  - Template length: ${widget.template?.length || 0}`);
                results.searchRecords = widget;
            }
        }
        catch (e) {
            console.log(`  ❌ Error: ${e.message}`);
        }
        // Test 2: getRecord with timeout
        try {
            console.log(`Test 2: getRecord (${timeoutConfig.queryToolTimeout / 1000}s timeout)...`);
            const test2 = await (0, mcp_timeout_config_js_1.withMCPTimeout)(this.client.getRecord('sp_widget', sys_id), timeoutConfig.queryToolTimeout, 'getRecord test');
            console.log(`  - Response structure: success=${test2?.success}, has data=${!!test2?.data}, has result=${!!test2?.data?.result}`);
            if (test2?.data?.result) {
                const widget = test2.data.result;
                console.log(`  - Fields received: ${Object.keys(widget).join(', ')}`);
                console.log(`  - Script length: ${widget.script?.length || 0}`);
                console.log(`  - Client script length: ${widget.client_script?.length || 0}`);
                console.log(`  - Template length: ${widget.template?.length || 0}`);
                results.getRecord = widget;
            }
        }
        catch (e) {
            console.log(`  ❌ Error: ${e.message}`);
        }
        // Test 3: searchRecordsWithFields with timeout
        try {
            console.log(`Test 3: searchRecordsWithFields (${timeoutConfig.queryToolTimeout / 1000}s timeout)...`);
            const test3 = await (0, mcp_timeout_config_js_1.withMCPTimeout)(this.client.searchRecordsWithFields('sp_widget', `sys_id=${sys_id}`, ['name', 'script', 'client_script', 'template', 'css'], 1), timeoutConfig.queryToolTimeout, 'searchRecordsWithFields test');
            console.log(`  - Response structure: success=${test3?.success}, has data=${!!test3?.data}, has result=${!!test3?.data?.result}`);
            if (test3?.data?.result?.[0]) {
                const widget = test3.data.result[0];
                console.log(`  - Fields received: ${Object.keys(widget).join(', ')}`);
                console.log(`  - Script length: ${widget.script?.length || 0}`);
                console.log(`  - Client script length: ${widget.client_script?.length || 0}`);
                console.log(`  - Template length: ${widget.template?.length || 0}`);
                results.searchRecordsWithFields = widget;
            }
        }
        catch (e) {
            console.log(`  ❌ Error: ${e.message}`);
        }
        console.log(`\n📊 Debug Results Summary:`);
        console.log(`  - searchRecords got: ${results.searchRecords ? Object.keys(results.searchRecords).length + ' fields' : 'failed'}`);
        console.log(`  - getRecord got: ${results.getRecord ? Object.keys(results.getRecord).length + ' fields' : 'failed'}`);
        console.log(`  - searchRecordsWithFields got: ${results.searchRecordsWithFields ? Object.keys(results.searchRecordsWithFields).length + ' fields' : 'failed'}`);
        return results;
    }
    /**
     * Get smart fetch strategy based on table - NOW USES ARTIFACT REGISTRY!
     */
    getFieldGroups(table) {
        // First check if we have specific groups defined
        switch (table) {
            case 'sp_widget':
                return WIDGET_FIELD_GROUPS;
            case 'sys_hub_flow':
                return FLOW_FIELD_GROUPS;
            case 'sys_script':
                return BUSINESS_RULE_FIELD_GROUPS;
        }
        // Try to get from artifact registry
        const config = (0, artifact_registry_js_1.getArtifactConfig)(table);
        if (config) {
            return this.createFieldGroupsFromRegistry(config);
        }
        // Generic strategy for unknown tables
        return [
            {
                groupName: 'metadata',
                fields: ['sys_id', 'name', 'sys_created_on', 'sys_updated_on'],
                description: 'Basic record information',
                maxTokens: 1000
            },
            {
                groupName: 'content',
                fields: ['*'], // Fetch all other fields
                description: 'Record content',
                maxTokens: 20000
            }
        ];
    }
    /**
     * Create field groups from artifact registry configuration
     */
    createFieldGroupsFromRegistry(config) {
        const groups = [];
        // Group 1: Metadata fields
        const metadataFields = ['sys_id', 'sys_created_on', 'sys_updated_on', config.identifierField];
        groups.push({
            groupName: 'metadata',
            fields: [...new Set(metadataFields)], // Remove duplicates
            description: `${config.displayName} metadata`,
            maxTokens: 2000
        });
        // Group 2-N: Each field mapping as its own group if large
        for (const mapping of config.fieldMappings) {
            if (mapping.maxTokens > 5000) {
                // Large field gets its own group
                groups.push({
                    groupName: mapping.serviceNowField,
                    fields: [mapping.serviceNowField],
                    description: mapping.description,
                    maxTokens: mapping.maxTokens
                });
            }
        }
        // Group N+1: Small fields together
        const smallFields = config.fieldMappings
            .filter(m => m.maxTokens <= 5000)
            .map(m => m.serviceNowField);
        if (smallFields.length > 0) {
            groups.push({
                groupName: 'configuration',
                fields: smallFields,
                description: `${config.displayName} configuration`,
                maxTokens: 10000
            });
        }
        return groups;
    }
}
exports.SmartFieldFetcher = SmartFieldFetcher;
/**
 * Helper function to create fetch strategy hint for Claude
 */
function createFetchStrategyHint(table, sys_id) {
    return `
🔍 SMART FETCH STRATEGY for ${table} (${sys_id}):

When the artifact is too large (>200000 tokens), I'll fetch fields in intelligent groups:
1. First fetch metadata (name, title, sys_id)
2. Then fetch each content field separately (template, script, client_script, css)
3. Maintain context: These fields work together!
   - Template HTML references {{data.x}} from server script
   - Template ng-click calls methods from client script  
   - CSS classes are used in template
   - Server script handles input.action from client script

This ensures you get ALL necessary fields while respecting token limits.
The fields are fetched separately but represent ONE cohesive widget.
`;
}
//# sourceMappingURL=smart-field-fetcher.js.map