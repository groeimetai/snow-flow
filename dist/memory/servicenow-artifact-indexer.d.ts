/**
 * ServiceNow Artifact Indexer
 * Intelligent indexing system for large ServiceNow artifacts
 */
export interface ServiceNowArtifact {
    sys_id: string;
    name?: string;
    title?: string;
    table: string;
    sys_class_name: string;
    sys_updated_on: string;
    [key: string]: any;
}
export interface FlowArtifact extends ServiceNowArtifact {
    flow_definition: string;
    trigger_conditions?: string;
    active: boolean;
    description?: string;
}
export interface WidgetArtifact extends ServiceNowArtifact {
    template?: string;
    css?: string;
    client_script?: string;
    server_script?: string;
    option_schema?: string;
}
export interface IndexedArtifact {
    meta: {
        sys_id: string;
        name: string;
        type: string;
        last_updated: string;
        size_estimate: string;
    };
    structure: ArtifactStructure;
    context: ArtifactContext;
    relationships: ArtifactRelationships;
    claudeSummary: string;
    modificationPoints: ModificationPoint[];
    searchTerms: string[];
    editHistory: EditHistory[];
}
export interface ArtifactStructure {
    type: string;
    components: any;
    complexity: 'low' | 'medium' | 'high';
    editableFields: string[];
}
export interface ArtifactContext {
    usage: string;
    dependencies: string[];
    impact: string;
    commonModifications: string[];
}
export interface ArtifactRelationships {
    relatedArtifacts: string[];
    dependencies: string[];
    usage: string[];
}
export interface ModificationPoint {
    location: string;
    type: string;
    description: string;
    examples: string[];
}
export interface EditHistory {
    date: string;
    change: string;
    by: string;
}
export declare class ServiceNowArtifactIndexer {
    private logger;
    private memoryPath;
    constructor(memoryPath?: string);
    intelligentlyIndex(artifact: ServiceNowArtifact): Promise<IndexedArtifact>;
    private decomposeArtifact;
    private decomposeWidget;
    private decomposeFlow;
    private decomposeScript;
    private decomposeApplication;
    private decomposeGeneric;
    private extractContext;
    private mapRelationships;
    private createClaudeSummary;
    private identifyModificationPoints;
    private generateSearchTerms;
    private parseFlowDefinition;
    private assessHTMLComplexity;
    private assessCSSComplexity;
    private assessJSComplexity;
    private assessOverallComplexity;
    private assessFlowComplexity;
    private assessScriptComplexity;
    private extractHTMLFeatures;
    private extractJSFunctions;
    private extractJSVariables;
    private extractServiceNowAPIs;
    private extractDependencies;
    private parseOptionSchema;
    private describeTrigger;
    private generateStepDescription;
    private identifyEditableFields;
    private determineUsage;
    private findDependencies;
    private assessImpact;
    private getCommonModifications;
    private findRelatedArtifacts;
    private findUsage;
    private getReadableType;
    private inferPurpose;
    private getModificationSuggestions;
    private extractKeyFunctions;
    private estimateSize;
    private storeInMemory;
    loadFromMemory(sys_id: string): Promise<IndexedArtifact | null>;
    searchMemory(query: string): Promise<IndexedArtifact[]>;
    private matchesQuery;
}
//# sourceMappingURL=servicenow-artifact-indexer.d.ts.map