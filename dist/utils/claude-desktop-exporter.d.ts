#!/usr/bin/env node
/**
 * Claude Desktop Exporter - Export Snow-Flow MCP configuration to Claude Desktop
 * Handles automatic credential injection, backup, and merge operations
 */
interface ExportOptions {
    outputPath?: string;
    backup?: boolean;
    merge?: boolean;
    dryRun?: boolean;
}
interface ExportResult {
    success: boolean;
    error?: string;
    configPath?: string;
    backupPath?: string;
    merged?: boolean;
    existingServers?: number;
    credentials?: {
        instance: string;
        clientId: string;
        clientSecret: string;
    };
    missingCredentials?: string[];
}
/**
 * Export Snow-Flow MCP configuration to Claude Desktop
 */
export declare function exportToClaudeDesktop(options: ExportOptions): Promise<ExportResult>;
export {};
//# sourceMappingURL=claude-desktop-exporter.d.ts.map