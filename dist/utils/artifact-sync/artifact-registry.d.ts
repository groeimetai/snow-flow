/**
 * Artifact Registry - Central configuration for ALL ServiceNow artifact types
 *
 * This is the foundation for dynamic artifact handling.
 * Each artifact type defines how it should be synced to local files.
 *
 * CAREFULLY DESIGNED FOR EXTENSIBILITY
 */
export interface FieldMapping {
    serviceNowField: string;
    localFileName: string;
    fileExtension: string;
    description: string;
    wrapperHeader?: string;
    wrapperFooter?: string;
    maxTokens: number;
    isRequired: boolean;
    validateES5?: boolean;
    preprocessor?: (content: string) => string;
    postprocessor?: (content: string) => string;
}
export interface ArtifactTypeConfig {
    tableName: string;
    displayName: string;
    folderName: string;
    identifierField: string;
    fieldMappings: FieldMapping[];
    coherenceRules?: CoherenceRule[];
    searchableFields: string[];
    supportsBulkOperations: boolean;
    customValidation?: (artifact: any) => ValidationResult;
    documentation?: string;
}
export interface CoherenceRule {
    name: string;
    description: string;
    validate: (files: Map<string, string>) => ValidationResult;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    hints: string[];
}
/**
 * COMPLETE REGISTRY OF ALL SERVICENOW ARTIFACT TYPES
 * Each entry is carefully configured for optimal local development
 */
export declare const ARTIFACT_REGISTRY: Record<string, ArtifactTypeConfig>;
/**
 * Get artifact configuration by table name
 */
export declare function getArtifactConfig(tableName: string): ArtifactTypeConfig | undefined;
/**
 * Get all supported table names
 */
export declare function getSupportedTables(): string[];
/**
 * Check if a table is supported
 */
export declare function isTableSupported(tableName: string): boolean;
/**
 * Get display name for a table
 */
export declare function getTableDisplayName(tableName: string): string;
//# sourceMappingURL=artifact-registry.d.ts.map