"use strict";
/**
 * MCP Resource Manager
 * Comprehensive resource management for MCP servers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPResourceManager = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const logger_js_1 = require("../../utils/logger.js");
class MCPResourceManager {
    constructor(serverName = 'mcp-server') {
        this.resourceCache = new Map();
        this.resourceIndex = new Map();
        this.categories = [];
        this.logger = new logger_js_1.Logger(`ResourceManager:${serverName}`);
        this.initializeCategories();
    }
    /**
     * Initialize resource categories
     */
    initializeCategories() {
        const projectRoot = this.getProjectRoot();
        this.categories = [
            {
                name: 'templates',
                description: 'ServiceNow artifact templates (widgets, flows, scripts, etc.)',
                basePath: (0, path_1.join)(projectRoot, 'src/templates'),
                uriPrefix: 'servicenow://templates/'
            },
            {
                name: 'documentation',
                description: 'Setup guides, deployment documentation, and API references',
                basePath: projectRoot,
                uriPrefix: 'servicenow://docs/'
            },
            {
                name: 'schemas',
                description: 'Data validation schemas and API schemas',
                basePath: (0, path_1.join)(projectRoot, 'src/schemas'),
                uriPrefix: 'servicenow://schemas/'
            },
            {
                name: 'examples',
                description: 'Example implementations and sample data',
                basePath: (0, path_1.join)(projectRoot, 'src/templates/examples'),
                uriPrefix: 'servicenow://examples/'
            },
            {
                name: 'help',
                description: 'Help content and guidance documents',
                basePath: (0, path_1.join)(projectRoot, 'src/sparc'),
                uriPrefix: 'servicenow://help/'
            }
        ];
    }
    /**
     * Get project root directory
     */
    getProjectRoot() {
        // Use process.cwd() to get the current working directory
        // This should be the project root when running the application
        return process.cwd();
    }
    /**
     * List all available resources
     */
    async listResources() {
        if (this.resourceIndex.size === 0) {
            await this.buildResourceIndex();
        }
        return Array.from(this.resourceIndex.values());
    }
    /**
     * Read a specific resource by URI
     */
    async readResource(uri) {
        this.logger.debug(`Reading resource: ${uri}`);
        // Check cache first
        if (this.resourceCache.has(uri)) {
            this.logger.debug(`Resource found in cache: ${uri}`);
            return this.resourceCache.get(uri);
        }
        // Parse URI and determine file path
        const filePath = this.uriToFilePath(uri);
        if (!filePath) {
            throw new Error(`Invalid resource URI: ${uri}`);
        }
        try {
            const content = await this.loadResourceContent(filePath, uri);
            // Cache the content
            this.resourceCache.set(uri, content);
            return content;
        }
        catch (error) {
            this.logger.error(`Failed to read resource ${uri}:`, error);
            throw new Error(`Resource not found or inaccessible: ${uri}`);
        }
    }
    /**
     * Build comprehensive resource index
     */
    async buildResourceIndex() {
        this.logger.info('Building resource index...');
        for (const category of this.categories) {
            try {
                await this.indexCategory(category);
            }
            catch (error) {
                this.logger.warn(`Failed to index category ${category.name}:`, error);
            }
        }
        this.logger.info(`Resource index built: ${this.resourceIndex.size} resources`);
    }
    /**
     * Index resources in a specific category
     */
    async indexCategory(category) {
        try {
            const stats = await (0, promises_1.stat)(category.basePath);
            if (!stats.isDirectory()) {
                this.logger.debug(`Category path is not a directory: ${category.basePath}`);
                return;
            }
        }
        catch (error) {
            this.logger.debug(`Category path does not exist: ${category.basePath}`);
            return;
        }
        if (category.name === 'documentation') {
            await this.indexDocumentationFiles(category);
        }
        else {
            await this.indexDirectoryRecursive(category.basePath, category);
        }
    }
    /**
     * Index documentation files (special handling for .md files in root)
     */
    async indexDocumentationFiles(category) {
        try {
            const files = await (0, promises_1.readdir)(category.basePath);
            for (const file of files) {
                if (file.endsWith('.md') && file.toUpperCase().includes('SERVICENOW')) {
                    const filePath = (0, path_1.join)(category.basePath, file);
                    const uri = `${category.uriPrefix}${file}`;
                    const resource = {
                        uri,
                        name: this.formatResourceName(file),
                        description: `ServiceNow documentation: ${this.formatResourceName(file)}`,
                        mimeType: this.getMimeType(file)
                    };
                    this.resourceIndex.set(uri, resource);
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to index documentation files:`, error);
        }
    }
    /**
     * Index directory recursively
     */
    async indexDirectoryRecursive(dirPath, category, relativePath = '') {
        try {
            const entries = await (0, promises_1.readdir)(dirPath);
            for (const entry of entries) {
                const fullPath = (0, path_1.join)(dirPath, entry);
                const entryRelativePath = relativePath ? (0, path_1.join)(relativePath, entry) : entry;
                try {
                    const stats = await (0, promises_1.stat)(fullPath);
                    if (stats.isDirectory()) {
                        await this.indexDirectoryRecursive(fullPath, category, entryRelativePath);
                    }
                    else if (this.isResourceFile(entry)) {
                        const uri = `${category.uriPrefix}${entryRelativePath.replace(/\\/g, '/')}`;
                        const resource = {
                            uri,
                            name: this.formatResourceName(entry),
                            description: this.generateResourceDescription(entry, category.name),
                            mimeType: this.getMimeType(entry)
                        };
                        this.resourceIndex.set(uri, resource);
                    }
                }
                catch (error) {
                    this.logger.debug(`Failed to process ${fullPath}:`, error);
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to read directory ${dirPath}:`, error);
        }
    }
    /**
     * Check if file should be exposed as a resource
     */
    isResourceFile(filename) {
        const resourceExtensions = ['.json', '.md', '.yaml', '.yml', '.txt', '.ts', '.js'];
        const ext = (0, path_1.extname)(filename).toLowerCase();
        return resourceExtensions.includes(ext);
    }
    /**
     * Convert URI to file path
     */
    uriToFilePath(uri) {
        for (const category of this.categories) {
            if (uri.startsWith(category.uriPrefix)) {
                const relativePath = uri.substring(category.uriPrefix.length);
                if (category.name === 'documentation') {
                    // Documentation files are in root
                    return (0, path_1.join)(category.basePath, relativePath);
                }
                else {
                    return (0, path_1.join)(category.basePath, relativePath);
                }
            }
        }
        return null;
    }
    /**
     * Load resource content from file
     */
    async loadResourceContent(filePath, uri) {
        const content = await (0, promises_1.readFile)(filePath, 'utf-8');
        const mimeType = this.getMimeType(filePath);
        return {
            uri,
            mimeType,
            text: content
        };
    }
    /**
     * Get MIME type for file
     */
    getMimeType(filePath) {
        const ext = (0, path_1.extname)(filePath).toLowerCase();
        const mimeTypes = {
            '.json': 'application/json',
            '.md': 'text/markdown',
            '.yaml': 'application/yaml',
            '.yml': 'application/yaml',
            '.txt': 'text/plain',
            '.ts': 'text/typescript',
            '.js': 'text/javascript',
            '.html': 'text/html',
            '.css': 'text/css'
        };
        return mimeTypes[ext] || 'text/plain';
    }
    /**
     * Format resource name for display
     */
    formatResourceName(filename) {
        const nameWithoutExt = (0, path_1.basename)(filename, (0, path_1.extname)(filename));
        // Convert various naming conventions to readable names
        return nameWithoutExt
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/\.(template|schema|example)/i, '');
    }
    /**
     * Generate resource description based on filename and category
     */
    generateResourceDescription(filename, categoryName) {
        const name = this.formatResourceName(filename);
        const descriptions = {
            'templates': `ServiceNow ${name} template`,
            'documentation': `Documentation: ${name}`,
            'schemas': `Validation schema for ${name}`,
            'examples': `Example implementation: ${name}`,
            'help': `Help content: ${name}`
        };
        return descriptions[categoryName] || `Resource: ${name}`;
    }
    /**
     * Clear resource cache
     */
    clearCache() {
        this.resourceCache.clear();
        this.resourceIndex.clear();
        this.logger.debug('Resource cache cleared');
    }
    /**
     * Get resource statistics
     */
    getResourceStats() {
        const categories = {};
        for (const resource of this.resourceIndex.values()) {
            for (const category of this.categories) {
                if (resource.uri.startsWith(category.uriPrefix)) {
                    categories[category.name] = (categories[category.name] || 0) + 1;
                    break;
                }
            }
        }
        return {
            total: this.resourceIndex.size,
            cached: this.resourceCache.size,
            categories
        };
    }
}
exports.MCPResourceManager = MCPResourceManager;
//# sourceMappingURL=mcp-resource-manager.js.map