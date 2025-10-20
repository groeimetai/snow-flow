/**
 * Artifact Tracker - Manages consistent sys_id tracking and validation
 * Solves the sys_id inconsistency problem identified in feedback
 */
export interface ArtifactSession {
    sessionId: string;
    artifacts: Map<string, TrackedArtifact>;
    createdAt: Date;
    lastAccessed: Date;
}
export interface TrackedArtifact {
    sys_id: string;
    table: string;
    name: string;
    type: string;
    status: 'pending' | 'deployed' | 'modified' | 'error';
    operations: ArtifactOperation[];
    lastValidated: Date;
    updateSetId?: string;
}
export interface ArtifactOperation {
    operation: 'create' | 'update' | 'delete' | 'validate';
    timestamp: Date;
    success: boolean;
    details: string;
    error?: string;
}
export declare class ArtifactTracker {
    private logger;
    private client;
    private sessions;
    private currentSessionId;
    constructor();
    /**
     * Create or resume a tracking session
     */
    startSession(sessionId?: string): string;
    /**
     * Track a new artifact
     */
    trackArtifact(sys_id: string, table: string, name: string, type: string, operation?: 'create' | 'update'): TrackedArtifact;
    /**
     * Validate that a sys_id actually exists in ServiceNow
     */
    validateArtifact(sys_id: string): Promise<boolean>;
    /**
     * Record an operation on a tracked artifact
     */
    recordOperation(sys_id: string, operation: 'create' | 'update' | 'delete', success: boolean, details: string, error?: string): void;
    /**
     * Get all tracked artifacts in current session
     */
    getTrackedArtifacts(): TrackedArtifact[];
    /**
     * Get specific artifact by sys_id
     */
    getArtifact(sys_id: string): TrackedArtifact | null;
    /**
     * Find sys_id inconsistencies
     */
    findInconsistencies(): Array<{
        artifacts: TrackedArtifact[];
        issue: string;
    }>;
    /**
     * Generate session summary for debugging
     */
    getSessionSummary(): any;
    private findArtifactKey;
    private generateSessionId;
}
export declare const artifactTracker: ArtifactTracker;
//# sourceMappingURL=artifact-tracker.d.ts.map