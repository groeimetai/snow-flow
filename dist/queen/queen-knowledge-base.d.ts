/**
 * Queen Agent Knowledge Base
 *
 * Central repository of ServiceNow development patterns, tools, and capabilities
 * that the Queen Agent uses for strategic decision making.
 */
export declare const QUEEN_KNOWLEDGE_BASE: {
    /**
     * ServiceNow Development Patterns
     */
    developmentPatterns: {
        widgetDevelopment: {
            description: string;
            approaches: {
                name: string;
                description: string;
                optimal_for: string[];
                workflow: string[];
                advantages: string[];
            }[];
        };
        scriptDevelopment: {
            description: string;
            approaches: {
                name: string;
                description: string;
                optimal_for: string[];
                workflow: string[];
                advantages: string[];
            }[];
        };
        flowDevelopment: {
            description: string;
            approaches: {
                name: string;
                description: string;
                optimal_for: string[];
                workflow: string[];
                limitations: string[];
            }[];
        };
    };
    /**
     * Tool Selection Criteria
     */
    toolSelectionCriteria: {
        useLocalSync: {
            when: string[];
            artifacts: string[];
        };
        useDirectDeployment: {
            when: string[];
        };
        useDirectUpdate: {
            when: string[];
        };
    };
    /**
     * Artifact Type Capabilities
     */
    artifactCapabilities: {
        sp_widget: {
            localSync: boolean;
            directDeploy: boolean;
            directUpdate: boolean;
            coherenceValidation: boolean;
            es5Required: string[];
            fields: string[];
        };
        sys_script_include: {
            localSync: boolean;
            directDeploy: boolean;
            directUpdate: boolean;
            es5Required: string[];
            fields: string[];
        };
        sys_script: {
            localSync: boolean;
            directDeploy: boolean;
            directUpdate: boolean;
            es5Required: string[];
            fields: string[];
        };
        sys_hub_flow: {
            localSync: boolean;
            directDeploy: boolean;
            directUpdate: boolean;
            fields: string[];
        };
        sys_ui_page: {
            localSync: boolean;
            directDeploy: boolean;
            directUpdate: boolean;
            es5Required: string[];
            fields: string[];
        };
    };
    /**
     * Strategic Recommendations
     */
    strategicRecommendations: {
        complexWidgetEdit: {
            pattern: string;
            reasoning: string;
            steps: string[];
        };
        bulkRefactoring: {
            pattern: string;
            reasoning: string;
            steps: string[];
        };
        quickPrototype: {
            pattern: string;
            reasoning: string;
            steps: string[];
        };
    };
    /**
     * Common Pitfalls to Avoid
     */
    pitfallsToAvoid: {
        pitfall: string;
        solution: string;
    }[];
    /**
     * MCP Server Mapping
     */
    mcpServerMapping: {
        snow_pull_artifact: string;
        snow_push_artifact: string;
        snow_validate_artifact_coherence: string;
        snow_list_supported_artifacts: string;
        snow_sync_status: string;
        snow_sync_cleanup: string;
        snow_convert_to_es5: string;
        snow_deploy: string;
        snow_update: string;
        snow_query_table: string;
        snow_create_script_include: string;
    };
};
/**
 * Helper function for Queen to determine optimal approach
 */
export declare function determineOptimalApproach(objective: string, artifactType: string, context: {
    hasExistingArtifact: boolean;
    complexity: 'low' | 'medium' | 'high';
    requiresRefactoring: boolean;
    userMentionedModifications: boolean;
}): string;
//# sourceMappingURL=queen-knowledge-base.d.ts.map