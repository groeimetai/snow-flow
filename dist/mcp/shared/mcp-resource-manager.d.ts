/**
 * MCP Resource Manager
 * Comprehensive resource management for MCP servers
 */
export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType: string;
}
export interface MCPResourceContent {
    uri: string;
    mimeType: string;
    text: string;
}
export interface ResourceCategory {
    name: string;
    description: string;
    basePath: string;
    uriPrefix: string;
}
export declare class MCPResourceManager {
    private logger;
    private resourceCache;
    private resourceIndex;
    private categories;
    constructor(serverName?: string);
    /**
     * Initialize resource categories
     */
    private initializeCategories;
    /**
     * Get project root directory
     */
    private getProjectRoot;
    /**
     * List all available resources
     */
    listResources(): Promise<MCPResource[]>;
    /**
     * Read a specific resource by URI
     */
    readResource(uri: string): Promise<MCPResourceContent>;
    /**
     * Build comprehensive resource index
     */
    private buildResourceIndex;
    /**
     * Index resources in a specific category
     */
    private indexCategory;
    /**
     * Index documentation files (special handling for .md files in root)
     */
    private indexDocumentationFiles;
    /**
     * Index directory recursively
     */
    private indexDirectoryRecursive;
    /**
     * Check if file should be exposed as a resource
     */
    private isResourceFile;
    /**
     * Convert URI to file path
     */
    private uriToFilePath;
    /**
     * Load resource content from file
     */
    private loadResourceContent;
    /**
     * Get MIME type for file
     */
    private getMimeType;
    /**
     * Format resource name for display
     */
    private formatResourceName;
    /**
     * Generate resource description based on filename and category
     */
    private generateResourceDescription;
    /**
     * Clear resource cache
     */
    clearCache(): void;
    /**
     * Get resource statistics
     */
    getResourceStats(): {
        total: number;
        cached: number;
        categories: {
            [key: string]: number;
        };
    };
}
//# sourceMappingURL=mcp-resource-manager.d.ts.map