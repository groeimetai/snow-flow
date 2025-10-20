export declare class ClaudeFlowMigration {
    private logger;
    constructor();
    /**
     * Check if migration is needed
     */
    checkMigrationNeeded(): Promise<boolean>;
    /**
     * Perform migration from .snow-flow to .snow-flow
     */
    migrate(): Promise<void>;
    /**
     * Recursively copy directory
     */
    private copyDirectory;
    /**
     * Clean up old .snow-flow directory (only after user confirmation)
     */
    cleanup(): Promise<void>;
}
export declare const migrationUtil: ClaudeFlowMigration;
//# sourceMappingURL=migrate-snow-flow.d.ts.map