#!/usr/bin/env node
/**
 * Progressive Indexing Strategy for ServiceNow Artifacts
 * Prevents overwhelming the system with too much data
 */
export interface IndexingStrategy {
    mode: 'lazy' | 'eager' | 'progressive' | 'context-aware';
    maxInitialArtifacts: number;
    relevanceThreshold: number;
    contextWindow: number;
}
export interface ArtifactRelevance {
    artifact_id: string;
    relevance_score: number;
    last_accessed: Date;
    access_count: number;
    related_to_current_task: boolean;
}
export declare class ServiceNowProgressiveIndexer {
    private logger;
    private client;
    private indexedArtifacts;
    private relevanceMap;
    private currentContext;
    constructor();
    /**
     * Smart indexing based on current task context
     */
    indexForContext(context: string, userInstruction: string): Promise<any>;
    /**
     * Extract key concepts from natural language
     */
    private extractConcepts;
    /**
     * Determine which artifact types are relevant
     */
    private determineRelevantTypes;
    /**
     * Find artifacts relevant to concepts
     */
    private findRelevantArtifacts;
    /**
     * Calculate relevance score
     */
    private calculateRelevance;
    /**
     * Search artifacts by type
     */
    private searchArtifactsByType;
    /**
     * Index artifacts immediately
     */
    private indexArtifacts;
    /**
     * Schedule lazy indexing
     */
    private scheduleLazyIndexing;
    /**
     * Index artifact in Neo4j graph
     */
    private indexInGraph;
    /**
     * Update relevance tracking
     */
    private updateRelevance;
    /**
     * Get indexing strategy based on context
     */
    private getIndexingStrategy;
    /**
     * Clean up old irrelevant artifacts
     */
    cleanupIrrelevantArtifacts(): Promise<number>;
    /**
     * Get indexing statistics
     */
    getIndexingStats(): any;
}
//# sourceMappingURL=servicenow-progressive-indexer.d.ts.map