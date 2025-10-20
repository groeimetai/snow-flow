"use strict";
/**
 * Artifact Registry - Central configuration for ALL ServiceNow artifact types
 *
 * This is the foundation for dynamic artifact handling.
 * Each artifact type defines how it should be synced to local files.
 *
 * CAREFULLY DESIGNED FOR EXTENSIBILITY
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARTIFACT_REGISTRY = void 0;
exports.getArtifactConfig = getArtifactConfig;
exports.getSupportedTables = getSupportedTables;
exports.isTableSupported = isTableSupported;
exports.getTableDisplayName = getTableDisplayName;
/**
 * COMPLETE REGISTRY OF ALL SERVICENOW ARTIFACT TYPES
 * Each entry is carefully configured for optimal local development
 */
exports.ARTIFACT_REGISTRY = {
    // ========== WIDGETS ==========
    'sp_widget': {
        tableName: 'sp_widget',
        displayName: 'Service Portal Widget',
        folderName: 'widgets',
        identifierField: 'name',
        searchableFields: ['name', 'title', 'template', 'script', 'client_script', 'css'],
        supportsBulkOperations: true,
        fieldMappings: [
            {
                serviceNowField: 'template',
                localFileName: '{name}.template',
                fileExtension: 'html',
                description: 'HTML template with Angular bindings',
                wrapperHeader: '<!-- ServiceNow Widget Template: {name} -->\n<!-- Angular bindings: {{data.x}}, ng-click="method()" -->\n\n',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: true
            },
            {
                serviceNowField: 'script',
                localFileName: '{name}.server',
                fileExtension: 'js',
                description: 'Server-side script (ES5 ONLY)',
                wrapperHeader: '/**\n * Server Script for Widget: {name}\n * ES5 ONLY - No arrow functions, const/let, template literals\n * Available: data, input, options, gs, $sp\n */\n\n(function() {\n',
                wrapperFooter: '\n})();',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: false,
                validateES5: true
            },
            {
                serviceNowField: 'client_script',
                localFileName: '{name}.client',
                fileExtension: 'js',
                description: 'Client-side AngularJS controller',
                wrapperHeader: '/**\n * Client Controller for Widget: {name}\n * AngularJS 1.x\n * Available: c (this), c.data, c.server, $scope\n */\n\nfunction(',
                wrapperFooter: ')',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: false
            },
            {
                serviceNowField: 'css',
                localFileName: '{name}',
                fileExtension: 'css',
                description: 'Widget-specific CSS styles',
                wrapperHeader: '/* Styles for Widget: {name} */\n/* Prefix classes to avoid conflicts */\n\n',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: false
            },
            {
                serviceNowField: 'option_schema',
                localFileName: '{name}.options',
                fileExtension: 'json',
                description: 'Widget instance options configuration',
                maxTokens: 5000,
                isRequired: false,
                preprocessor: (content) => {
                    try {
                        return JSON.stringify(JSON.parse(content), null, 2);
                    }
                    catch {
                        return content;
                    }
                }
            }
        ],
        coherenceRules: [
            {
                name: 'Template-Server Data Binding',
                description: 'Every {{data.x}} in template must have data.x in server script',
                validate: (files) => {
                    const template = files.get('template') || '';
                    const server = files.get('script') || '';
                    const dataRefs = template.match(/\{\{data\.(\w+)/g) || [];
                    const errors = [];
                    dataRefs.forEach(ref => {
                        const prop = ref.replace('{{data.', '');
                        if (!server.includes(`data.${prop}`)) {
                            errors.push(`Template references {{data.${prop}}} but server doesn't set it`);
                        }
                    });
                    return {
                        valid: errors.length === 0,
                        errors,
                        warnings: [],
                        hints: []
                    };
                }
            },
            {
                name: 'Template-Client Method Binding',
                description: 'Every ng-click in template must have matching method in client',
                validate: (files) => {
                    const template = files.get('template') || '';
                    const client = files.get('client_script') || '';
                    const methods = template.match(/ng-click="(\w+)\(/g) || [];
                    const errors = [];
                    methods.forEach(method => {
                        const methodName = method.replace('ng-click="', '').replace('(', '');
                        if (!client.includes(`$scope.${methodName}`) && !client.includes(`c.${methodName}`)) {
                            errors.push(`Template calls ${methodName}() but client doesn't implement it`);
                        }
                    });
                    return {
                        valid: errors.length === 0,
                        errors,
                        warnings: [],
                        hints: []
                    };
                }
            }
        ],
        documentation: `
## Widget Development Guidelines

1. **Server Script** must be ES5 (no modern JavaScript)
2. **Template** references must match server data properties
3. **Client Script** must implement all template methods
4. **CSS** should use prefixed classes
5. Test widget in Service Portal after pushing
`
    },
    // ========== FLOWS ==========
    'sys_hub_flow': {
        tableName: 'sys_hub_flow',
        displayName: 'Flow Designer Flow',
        folderName: 'flows',
        identifierField: 'name',
        searchableFields: ['name', 'label', 'description', 'definition'],
        supportsBulkOperations: false,
        fieldMappings: [
            {
                serviceNowField: 'definition',
                localFileName: '{name}.flow',
                fileExtension: 'json',
                description: 'Complete flow definition with all steps and actions',
                maxTokens: 200000, // Claude's context window is 200k tokens // Flows can be huge
                isRequired: true,
                preprocessor: (content) => {
                    try {
                        return JSON.stringify(JSON.parse(content), null, 2);
                    }
                    catch {
                        return content;
                    }
                },
                postprocessor: (content) => {
                    try {
                        return JSON.stringify(JSON.parse(content)); // Minify for ServiceNow
                    }
                    catch {
                        return content;
                    }
                }
            },
            {
                serviceNowField: 'description',
                localFileName: '{name}.description',
                fileExtension: 'md',
                description: 'Flow description and documentation',
                maxTokens: 5000,
                isRequired: false
            }
        ],
        documentation: `
## Flow Development Notes

1. Flows are JSON structures - be careful with syntax
2. Test thoroughly after pushing changes
3. Consider using subflows for reusable logic
4. Check trigger conditions carefully
`
    },
    // ========== SCRIPT INCLUDES ==========
    'sys_script_include': {
        tableName: 'sys_script_include',
        displayName: 'Script Include',
        folderName: 'script_includes',
        identifierField: 'api_name',
        searchableFields: ['api_name', 'name', 'script', 'description'],
        supportsBulkOperations: true,
        fieldMappings: [
            {
                serviceNowField: 'script',
                localFileName: '{api_name}',
                fileExtension: 'js',
                description: 'Server-side class or function (ES5)',
                wrapperHeader: '/**\n * Script Include: {name}\n * API Name: {api_name}\n * Type: {client_callable ? "Client Callable" : "Server Only"}\n */\n\n',
                maxTokens: 30000,
                isRequired: true,
                validateES5: true
            },
            {
                serviceNowField: 'description',
                localFileName: '{api_name}.docs',
                fileExtension: 'md',
                description: 'Documentation for the Script Include',
                maxTokens: 5000,
                isRequired: false
            }
        ],
        documentation: `
## Script Include Guidelines

1. Use prototype pattern for classes
2. Document all public methods
3. Handle errors gracefully
4. Consider making client-callable if needed
`
    },
    // ========== BUSINESS RULES ==========
    'sys_script': {
        tableName: 'sys_script',
        displayName: 'Business Rule',
        folderName: 'business_rules',
        identifierField: 'name',
        searchableFields: ['name', 'collection', 'script', 'condition'],
        supportsBulkOperations: true,
        fieldMappings: [
            {
                serviceNowField: 'script',
                localFileName: '{name}',
                fileExtension: 'js',
                description: 'Business rule script',
                wrapperHeader: '/**\n * Business Rule: {name}\n * Table: {collection}\n * When: {when}\n * Order: {order}\n * Available: current, previous, gs, g_scratchpad\n */\n\n(function executeRule(current, previous /*null when async*/) {\n',
                wrapperFooter: '\n})(current, previous);',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: true,
                validateES5: true
            },
            {
                serviceNowField: 'condition',
                localFileName: '{name}.condition',
                fileExtension: 'js',
                description: 'Business rule condition script',
                maxTokens: 5000,
                isRequired: false
            }
        ]
    },
    // ========== UI PAGES ==========
    'sys_ui_page': {
        tableName: 'sys_ui_page',
        displayName: 'UI Page',
        folderName: 'ui_pages',
        identifierField: 'name',
        searchableFields: ['name', 'html', 'client_script', 'processing_script'],
        supportsBulkOperations: true,
        fieldMappings: [
            {
                serviceNowField: 'html',
                localFileName: '{name}',
                fileExtension: 'html',
                description: 'HTML content with Jelly scripting',
                wrapperHeader: '<!-- UI Page: {name} -->\n<?xml version="1.0" encoding="utf-8" ?>\n<j:jelly trim="false" xmlns:j="jelly:core" xmlns:g="glide" xmlns:j2="null" xmlns:g2="null">\n',
                wrapperFooter: '\n</j:jelly>',
                maxTokens: 30000,
                isRequired: true
            },
            {
                serviceNowField: 'client_script',
                localFileName: '{name}.client',
                fileExtension: 'js',
                description: 'Client-side JavaScript',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: false
            },
            {
                serviceNowField: 'processing_script',
                localFileName: '{name}.server',
                fileExtension: 'js',
                description: 'Server-side processing script (ES5)',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: false,
                validateES5: true
            }
        ]
    },
    // ========== CLIENT SCRIPTS ==========
    'sys_script_client': {
        tableName: 'sys_script_client',
        displayName: 'Client Script',
        folderName: 'client_scripts',
        identifierField: 'name',
        searchableFields: ['name', 'table', 'script', 'description'],
        supportsBulkOperations: true,
        fieldMappings: [
            {
                serviceNowField: 'script',
                localFileName: '{name}',
                fileExtension: 'js',
                description: 'Client-side form script',
                wrapperHeader: '/**\n * Client Script: {name}\n * Table: {table}\n * Type: {type}\n * Available: g_form, g_user, g_list\n */\n\n',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: true
            }
        ]
    },
    // ========== UI POLICIES ==========
    'sys_ui_policy': {
        tableName: 'sys_ui_policy',
        displayName: 'UI Policy',
        folderName: 'ui_policies',
        identifierField: 'short_description',
        searchableFields: ['short_description', 'table', 'conditions'],
        supportsBulkOperations: true,
        fieldMappings: [
            {
                serviceNowField: 'script_true',
                localFileName: '{short_description}.true',
                fileExtension: 'js',
                description: 'Script when condition is true',
                maxTokens: 10000,
                isRequired: false
            },
            {
                serviceNowField: 'script_false',
                localFileName: '{short_description}.false',
                fileExtension: 'js',
                description: 'Script when condition is false',
                maxTokens: 10000,
                isRequired: false
            }
        ]
    },
    // ========== REST MESSAGES ==========
    'sys_rest_message': {
        tableName: 'sys_rest_message',
        displayName: 'REST Message',
        folderName: 'rest_messages',
        identifierField: 'name',
        searchableFields: ['name', 'description', 'rest_endpoint'],
        supportsBulkOperations: false,
        fieldMappings: [
            {
                serviceNowField: 'description',
                localFileName: '{name}',
                fileExtension: 'md',
                description: 'REST message documentation',
                maxTokens: 5000,
                isRequired: false
            }
        ]
    },
    // ========== TRANSFORM MAPS ==========
    'sys_transform_map': {
        tableName: 'sys_transform_map',
        displayName: 'Transform Map',
        folderName: 'transform_maps',
        identifierField: 'name',
        searchableFields: ['name', 'source_table', 'target_table'],
        supportsBulkOperations: false,
        fieldMappings: [
            {
                serviceNowField: 'script',
                localFileName: '{name}',
                fileExtension: 'js',
                description: 'Transform map script',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: false,
                validateES5: true
            }
        ]
    },
    // ========== SCHEDULED JOBS ==========
    'sysauto_script': {
        tableName: 'sysauto_script',
        displayName: 'Scheduled Job',
        folderName: 'scheduled_jobs',
        identifierField: 'name',
        searchableFields: ['name', 'script'],
        supportsBulkOperations: true,
        fieldMappings: [
            {
                serviceNowField: 'script',
                localFileName: '{name}',
                fileExtension: 'js',
                description: 'Scheduled job script (ES5)',
                wrapperHeader: '/**\n * Scheduled Job: {name}\n * Run as: {run_as}\n * Time zone: {time_zone}\n */\n\n',
                maxTokens: 200000, // Claude's context window is 200k tokens
                isRequired: true,
                validateES5: true
            }
        ]
    },
    // ========== FIX SCRIPTS ==========
    'sys_script_fix': {
        tableName: 'sys_script_fix',
        displayName: 'Fix Script',
        folderName: 'fix_scripts',
        identifierField: 'name',
        searchableFields: ['name', 'script', 'description'],
        supportsBulkOperations: true,
        fieldMappings: [
            {
                serviceNowField: 'script',
                localFileName: '{name}',
                fileExtension: 'js',
                description: 'Fix script for one-time execution',
                maxTokens: 30000,
                isRequired: true,
                validateES5: true
            }
        ]
    }
};
/**
 * Get artifact configuration by table name
 */
function getArtifactConfig(tableName) {
    return exports.ARTIFACT_REGISTRY[tableName];
}
/**
 * Get all supported table names
 */
function getSupportedTables() {
    return Object.keys(exports.ARTIFACT_REGISTRY);
}
/**
 * Check if a table is supported
 */
function isTableSupported(tableName) {
    return tableName in exports.ARTIFACT_REGISTRY;
}
/**
 * Get display name for a table
 */
function getTableDisplayName(tableName) {
    return exports.ARTIFACT_REGISTRY[tableName]?.displayName || tableName;
}
//# sourceMappingURL=artifact-registry.js.map