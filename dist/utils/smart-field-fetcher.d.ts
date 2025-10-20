/**
 * Smart Field Fetcher for ServiceNow Artifacts
 *
 * Intelligently fetches large artifacts by splitting fields into chunks
 * while maintaining context relationships between fields.
 */
import { ServiceNowClient } from './servicenow-client.js';
export interface FetchStrategy {
    table: string;
    sys_id: string;
    primaryFields: string[];
    contentFields: string[];
    contextHint?: string;
}
export interface FieldGroup {
    groupName: string;
    fields: string[];
    description: string;
    maxTokens?: number;
}
export declare class SmartFieldFetcher {
    private client;
    constructor(client: ServiceNowClient);
    /**
     * DYNAMIC fetch any artifact using registry configuration
     */
    fetchArtifact(table: string, sys_id: string): Promise<any>;
    /**
     * Intelligently fetch widget fields with context preservation
     * (Wrapper for backward compatibility)
     */
    fetchWidget(sys_id: string): Promise<any>;
    /**
     * Fetch flow with intelligent chunking
     * (Wrapper for backward compatibility)
     */
    fetchFlow(sys_id: string): Promise<any>;
    /**
     * Fetch business rule with intelligent chunking
     * (Wrapper for backward compatibility)
     */
    fetchBusinessRule(sys_id: string): Promise<any>;
    /**
     * Fetch fields one by one when group is too large
     */
    private fetchFieldsIndividually;
    /**
     * Generate coherence hints for widget validation
     */
    private generateCoherenceHints;
    /**
     * Search within fields using GlideRecord queries
     */
    searchInField(table: string, field: string, searchTerm: string, additionalQuery?: string): Promise<any[]>;
    /**
     * Debug method to directly test API calls
     */
    debugFetchWidget(sys_id: string): Promise<any>;
    /**
     * Get smart fetch strategy based on table - NOW USES ARTIFACT REGISTRY!
     */
    getFieldGroups(table: string): FieldGroup[];
    /**
     * Create field groups from artifact registry configuration
     */
    private createFieldGroupsFromRegistry;
}
/**
 * Helper function to create fetch strategy hint for Claude
 */
export declare function createFetchStrategyHint(table: string, sys_id: string): string;
//# sourceMappingURL=smart-field-fetcher.d.ts.map