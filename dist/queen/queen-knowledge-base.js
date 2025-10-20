"use strict";
/**
 * Queen Agent Knowledge Base
 *
 * Central repository of ServiceNow development patterns, tools, and capabilities
 * that the Queen Agent uses for strategic decision making.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEEN_KNOWLEDGE_BASE = void 0;
exports.determineOptimalApproach = determineOptimalApproach;
exports.QUEEN_KNOWLEDGE_BASE = {
    /**
     * ServiceNow Development Patterns
     */
    developmentPatterns: {
        widgetDevelopment: {
            description: 'Service Portal Widget Development',
            approaches: [
                {
                    name: 'Local Sync Development',
                    description: 'Pull widget to local files, edit with Claude Code, push back',
                    optimal_for: ['complex widgets', 'multi-file editing', 'refactoring', 'bulk changes'],
                    workflow: [
                        'snow_pull_artifact({ sys_id, table: "sp_widget" })',
                        'Edit with Claude Code native tools',
                        'snow_validate_artifact_coherence({ sys_id })',
                        'snow_push_artifact({ sys_id })'
                    ],
                    advantages: [
                        'Full IDE capabilities',
                        'Multi-file search and replace',
                        'Git integration possible',
                        'Offline development',
                        'Advanced refactoring'
                    ]
                },
                {
                    name: 'Direct Deployment',
                    description: 'Deploy widget directly to ServiceNow',
                    optimal_for: ['new widgets', 'simple widgets', 'quick prototypes'],
                    workflow: [
                        'snow_deploy({ type: "widget", config: {...} })'
                    ],
                    advantages: [
                        'Fast deployment',
                        'No local files needed',
                        'Immediate availability'
                    ]
                },
                {
                    name: 'Direct Update',
                    description: 'Update existing widget fields directly',
                    optimal_for: ['small changes', 'field updates', 'quick fixes'],
                    workflow: [
                        'snow_update({ type: "widget", identifier, config: {...} })'
                    ],
                    advantages: [
                        'Minimal overhead',
                        'Targeted updates',
                        'Fast iteration'
                    ]
                }
            ]
        },
        scriptDevelopment: {
            description: 'Script Include and Business Rule Development',
            approaches: [
                {
                    name: 'Local Sync Development',
                    description: 'Pull script to local file, edit, validate ES5, push back',
                    optimal_for: ['complex scripts', 'refactoring', 'bulk operations'],
                    workflow: [
                        'snow_pull_artifact({ sys_id, table: "sys_script_include" })',
                        'Edit with full IDE support',
                        'Validate ES5 compliance',
                        'snow_push_artifact({ sys_id })'
                    ],
                    advantages: [
                        'ES5 validation',
                        'Syntax highlighting',
                        'Code completion',
                        'Search across scripts'
                    ]
                }
            ]
        },
        flowDevelopment: {
            description: 'Flow Designer Development',
            approaches: [
                {
                    name: 'Local Sync for Analysis',
                    description: 'Pull flow definition for analysis and documentation',
                    optimal_for: ['flow analysis', 'documentation', 'debugging'],
                    workflow: [
                        'snow_pull_artifact({ sys_id, table: "sys_hub_flow" })',
                        'Analyze JSON structure',
                        'Document flow logic'
                    ],
                    limitations: [
                        'Flow creation must be done in ServiceNow UI',
                        'Cannot programmatically create flows'
                    ]
                }
            ]
        }
    },
    /**
     * Tool Selection Criteria
     */
    toolSelectionCriteria: {
        useLocalSync: {
            when: [
                'User requests editing existing artifact',
                'Complex multi-file changes needed',
                'Refactoring required',
                'Bulk search/replace operations',
                'User wants to use Claude Code native tools',
                'Need offline development capability'
            ],
            artifacts: [
                'sp_widget',
                'sys_script_include',
                'sys_script',
                'sys_ui_page',
                'sys_script_client',
                'sys_ui_policy',
                'sysauto_script',
                'sys_script_fix'
            ]
        },
        useDirectDeployment: {
            when: [
                'Creating new artifact from scratch',
                'Simple artifact with minimal complexity',
                'Quick prototype needed',
                'No existing artifact to modify'
            ]
        },
        useDirectUpdate: {
            when: [
                'Small targeted changes',
                'Single field update',
                'Quick fix needed',
                'No complex editing required'
            ]
        }
    },
    /**
     * Artifact Type Capabilities
     */
    artifactCapabilities: {
        sp_widget: {
            localSync: true,
            directDeploy: true,
            directUpdate: true,
            coherenceValidation: true,
            es5Required: ['script'],
            fields: ['template', 'script', 'client_script', 'css', 'option_schema']
        },
        sys_script_include: {
            localSync: true,
            directDeploy: true,
            directUpdate: true,
            es5Required: ['script'],
            fields: ['script', 'api_name', 'description']
        },
        sys_script: {
            localSync: true,
            directDeploy: true,
            directUpdate: true,
            es5Required: ['script'],
            fields: ['script', 'condition', 'collection', 'when']
        },
        sys_hub_flow: {
            localSync: true,
            directDeploy: false, // Cannot create flows programmatically
            directUpdate: false,
            fields: ['definition', 'description']
        },
        sys_ui_page: {
            localSync: true,
            directDeploy: true,
            directUpdate: true,
            es5Required: ['processing_script'],
            fields: ['html', 'client_script', 'processing_script']
        }
    },
    /**
     * Strategic Recommendations
     */
    strategicRecommendations: {
        complexWidgetEdit: {
            pattern: 'Local Sync Development',
            reasoning: 'Complex widgets benefit from full IDE capabilities and multi-file editing',
            steps: [
                'Pull widget to local files',
                'Use Claude Code search/replace across template, scripts, CSS',
                'Validate coherence between components',
                'Push back when complete'
            ]
        },
        bulkRefactoring: {
            pattern: 'Local Sync Development',
            reasoning: 'Refactoring requires searching and replacing across multiple files',
            steps: [
                'Pull all related artifacts',
                'Use regex search/replace',
                'Validate changes',
                'Push all artifacts back'
            ]
        },
        quickPrototype: {
            pattern: 'Direct Deployment',
            reasoning: 'Prototypes need speed over complex editing capabilities',
            steps: [
                'Generate basic structure',
                'Deploy directly to ServiceNow',
                'Iterate quickly with direct updates'
            ]
        }
    },
    /**
     * Common Pitfalls to Avoid
     */
    pitfallsToAvoid: [
        {
            pitfall: 'Using modern JavaScript in ServiceNow',
            solution: 'Always validate ES5 compliance for server-side scripts'
        },
        {
            pitfall: 'Breaking widget coherence',
            solution: 'Run coherence validation before pushing widget changes'
        },
        {
            pitfall: 'Not fetching latest version before editing',
            solution: 'Always pull latest artifact if user mentions they modified it'
        },
        {
            pitfall: 'Trying to create flows programmatically',
            solution: 'Direct users to ServiceNow Flow Designer UI for flow creation'
        }
    ],
    /**
     * MCP Server Mapping
     */
    mcpServerMapping: {
        'snow_pull_artifact': 'servicenow-local-development',
        'snow_push_artifact': 'servicenow-local-development',
        'snow_validate_artifact_coherence': 'servicenow-local-development',
        'snow_list_supported_artifacts': 'servicenow-local-development',
        'snow_sync_status': 'servicenow-local-development',
        'snow_sync_cleanup': 'servicenow-local-development',
        'snow_convert_to_es5': 'servicenow-local-development',
        'snow_deploy': 'servicenow-deployment',
        'snow_update': 'servicenow-deployment',
        'snow_query_table': 'servicenow-operations',
        'snow_create_script_include': 'servicenow-platform-development'
    }
};
/**
 * Helper function for Queen to determine optimal approach
 */
function determineOptimalApproach(objective, artifactType, context) {
    // If user mentioned modifications, always sync first
    if (context.userMentionedModifications && context.hasExistingArtifact) {
        return 'Local Sync Development';
    }
    // For complex operations or refactoring
    if (context.requiresRefactoring || context.complexity === 'high') {
        return 'Local Sync Development';
    }
    // For new artifacts
    if (!context.hasExistingArtifact) {
        return context.complexity === 'low' ? 'Direct Deployment' : 'Local Sync Development';
    }
    // For simple updates
    if (context.complexity === 'low' && context.hasExistingArtifact) {
        return 'Direct Update';
    }
    // Default to local sync for safety
    return 'Local Sync Development';
}
//# sourceMappingURL=queen-knowledge-base.js.map