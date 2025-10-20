#!/usr/bin/env node
/**
 * Update Set Importer
 *
 * Programmatically imports Update Set XML files into ServiceNow
 * via REST API with full error handling and verification
 */
export interface ImportOptions {
    autoPreview?: boolean;
    autoCommit?: boolean;
    skipOnConflict?: boolean;
    backupBeforeCommit?: boolean;
    validateFirst?: boolean;
}
export interface ImportResult {
    success: boolean;
    remoteUpdateSetId?: string;
    localUpdateSetId?: string;
    previewStatus?: 'clean' | 'conflicts' | 'errors';
    previewProblems?: any[];
    commitStatus?: 'success' | 'failed' | 'skipped';
    error?: string;
    backupPath?: string;
    flowSysId?: string;
    flowUrl?: string;
}
export declare class UpdateSetImporter {
    private client;
    private oauth;
    private logger;
    constructor();
    /**
     * Import Update Set XML file to ServiceNow
     */
    importUpdateSet(xmlFilePath: string, options?: ImportOptions): Promise<ImportResult>;
    /**
     * Import XML as remote update set
     */
    private importRemoteUpdateSet;
    /**
     * Load remote update set to create local update set
     */
    private loadRemoteUpdateSet;
    /**
     * Preview update set
     */
    private previewUpdateSet;
    /**
     * Commit update set
     */
    private commitUpdateSet;
    /**
     * Backup update set before commit
     */
    private backupUpdateSet;
    /**
     * Find deployed flow from update set
     */
    private findDeployedFlow;
    /**
     * Validate XML structure
     */
    private validateXML;
    /**
     * Static helper to import with default options
     */
    static importFlow(xmlFilePath: string): Promise<ImportResult>;
}
export declare function deployFlowXML(xmlFilePath: string, autoCommit?: boolean): Promise<ImportResult>;
export declare function previewFlowXML(xmlFilePath: string): Promise<ImportResult>;
export default UpdateSetImporter;
//# sourceMappingURL=update-set-importer.d.ts.map