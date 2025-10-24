/**
 * Artifact Local Sync System
 *
 * Creates temporary local files from ServiceNow artifacts so SnowCode
 * (or Claude Code) can use its native tools (search, edit, multi-file operations, etc.)
 * Then syncs changes back to ServiceNow.
 *
 * THIS IS THE BRIDGE BETWEEN SERVICENOW AND YOUR AI CODING ASSISTANT!
 */
import { ServiceNowClient } from './servicenow-client.js';
import { ArtifactTypeConfig, FieldMapping, ValidationResult } from './artifact-sync/artifact-registry';
export interface LocalArtifact {
    sys_id: string;
    name: string;
    type: string;
    tableName: string;
    localPath: string;
    files: LocalFile[];
    metadata: any;
    syncStatus: 'synced' | 'modified' | 'pending_upload';
    createdAt: Date;
    lastSyncedAt: Date;
    artifactConfig?: ArtifactTypeConfig;
    isGeneric?: boolean;
}
export interface LocalFile {
    filename: string;
    path: string;
    field: string;
    type: string;
    originalContent: string;
    currentContent?: string;
    isModified: boolean;
    fieldMapping?: FieldMapping;
    existedBefore?: boolean;
    previousContent?: string;
}
export declare class ArtifactLocalSync {
    private baseDir;
    private artifacts;
    private client;
    private smartFetcher;
    constructor(client: ServiceNowClient, customBaseDir?: string);
    /**
     * DYNAMIC pull artifact from ServiceNow using artifact registry
     * Works with ANY artifact type defined in the registry!
     */
    pullArtifact(tableName: string, sys_id: string): Promise<LocalArtifact>;
    /**
     * Pull a widget from ServiceNow and create local files
     * This is the magic that lets your AI coding assistant use its native tools!
     * (Wrapper for backward compatibility)
     */
    pullWidget(sys_id: string): Promise<LocalArtifact>;
    /**
     * DYNAMIC push local changes back to ServiceNow using artifact registry
     */
    pushArtifact(sys_id: string): Promise<boolean>;
    /**
     * Push generic artifact changes back to ServiceNow
     * Only updates known script fields to avoid data corruption
     */
    pushGenericArtifact(artifact: LocalArtifact): Promise<boolean>;
    /**
     * Push local changes back to ServiceNow
     * (Wrapper for backward compatibility)
     */
    pushWidget(sys_id: string): Promise<boolean>;
    /**
     * Clean up local files after successful sync
     */
    cleanup(sys_id: string, force?: boolean): Promise<void>;
    /**
     * Create a local file with appropriate headers
     */
    private createLocalFile;
    /**
     * Generate README with artifact-specific context using registry
     */
    private generateArtifactReadme;
    /**
     * Replace placeholders in wrapper strings
     */
    private replacePlaceholders;
    /**
     * Generate README with widget context
     * (Wrapper for backward compatibility)
     */
    private generateWidgetReadme;
    /**
     * Validate ES5 compliance
     */
    private validateES5;
    /**
     * AGGRESSIVE STRIP FUNCTION: Remove ALL possible Snow-Flow wrapper variations
     * FIXED: Handles multiple/nested wrappers and all patterns
     */
    private stripAddedWrappers;
    /**
     * CONSERVATIVE WRAPPER DETECTION: Only add wrappers if content is truly minimal
     * FIXED: Now properly detects ALL types of existing wrappers/comments
     */
    private needsWrappers;
    /**
     * Sanitize filename for filesystem
     */
    private sanitizeFilename;
    /**
     * List all local artifacts
     */
    listLocalArtifacts(): LocalArtifact[];
    /**
     * Get sync status for an artifact
     */
    getSyncStatus(sys_id: string): string;
    /**
     * Pull any supported artifact type by detecting table from sys_id
     * ENHANCED: Now uses sys_metadata to find ANY table, not just registered ones!
     */
    pullArtifactBySysId(sys_id: string): Promise<LocalArtifact>;
    /**
     * Pull a generic artifact from an unknown/custom table
     * Creates a basic file structure for any ServiceNow record
     */
    pullGenericArtifact(tableName: string, sys_id: string): Promise<LocalArtifact>;
    /**
     * Get supported artifact types
     */
    getSupportedTypes(): string[];
    /**
     * Validate coherence for an artifact
     */
    validateArtifactCoherence(sys_id: string): Promise<ValidationResult[]>;
}
//# sourceMappingURL=artifact-local-sync.d.ts.map