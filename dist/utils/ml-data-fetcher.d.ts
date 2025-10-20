/**
 * Smart ML Data Fetcher
 * Handles intelligent data fetching for ML training with batching and field discovery
 * Prevents token limit errors and optimizes data retrieval
 */
export interface MLDataFetchOptions {
    table: string;
    query?: string;
    totalSamples?: number;
    batchSize?: number;
    fields?: string[];
    discoverFields?: boolean;
    includeContent?: boolean;
}
export interface FieldDiscoveryResult {
    allFields: string[];
    recommendedFields: string[];
    sampleData: any[];
}
export interface BatchFetchResult {
    data: any[];
    totalFetched: number;
    batchesProcessed: number;
    fields: string[];
}
export declare class MLDataFetcher {
    private operationsMCP;
    constructor(operationsMCP: any);
    /**
     * Smart fetch with automatic field discovery and batching
     */
    smartFetch(options: MLDataFetchOptions): Promise<BatchFetchResult>;
    /**
     * Get total count of records matching query
     */
    private getRecordCount;
    /**
     * Discover available fields by sampling a few records
     */
    private discoverFields;
    /**
     * Fetch a single batch of data
     */
    private fetchBatch;
    /**
     * Extract data from MCP tool result - More robust parsing
     */
    private extractDataFromResult;
    /**
     * Calculate optimal batch size based on data characteristics
     */
    private calculateOptimalBatchSize;
    /**
     * Select appropriate fields for ML training
     */
    private selectMLFields;
    /**
     * Get default fields for a table type
     */
    private getDefaultFields;
    /**
     * Get key fields that should always be included
     */
    private getKeyFields;
}
//# sourceMappingURL=ml-data-fetcher.d.ts.map