/**
 * Smart Query Enhancement for MCP Operations
 *
 * Automatically handles large artifact queries by intelligent field splitting
 * while maintaining context relationships for Claude.
 */
import { MCPToolResult } from '../shared/mcp-types';
export declare class SmartQueryEnhancement {
    private smartFetcher;
    constructor(serviceNowClient: any);
    /**
     * Enhance snow_query_table to handle large artifacts intelligently
     */
    enhanceQueryTable(originalArgs: any): Promise<MCPToolResult>;
    /**
     * Generate context message for widget fetch
     */
    private generateWidgetContextMessage;
    /**
     * Generate context message for flow fetch
     */
    private generateFlowContextMessage;
    /**
     * Generate context message for business rule fetch
     */
    private generateBusinessRuleContextMessage;
    /**
     * Execute original query when smart fetch not needed
     */
    private executeOriginalQuery;
    /**
     * Search within specific fields
     */
    searchInFields(args: {
        table: string;
        field: string;
        searchTerm: string;
        additionalQuery?: string;
    }): Promise<MCPToolResult>;
}
/**
 * Helper to detect if a query will likely exceed token limits
 */
export declare function willExceedTokenLimit(fields: string[], table: string): boolean;
/**
 * Generate hint for Claude about using smart fetch
 */
export declare function generateSmartFetchHint(): string;
//# sourceMappingURL=smart-query-enhancement.d.ts.map