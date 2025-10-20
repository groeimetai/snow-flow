"use strict";
/**
 * Tool Registry with Auto-Discovery
 *
 * Automatically discovers and registers tools from the tools/ directory.
 * Supports dynamic loading, validation, and hot-reload during development.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = exports.ToolRegistry = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class ToolRegistry {
    constructor(config = {}) {
        this.tools = new Map();
        this.discoveryInProgress = false;
        this.config = {
            toolsDirectory: path.join(__dirname, '../tools'),
            autoDiscovery: true,
            enableCaching: true,
            cacheMaxAge: 60000, // 1 minute
            validateOnRegister: true,
            ...config
        };
    }
    /**
     * Initialize tool registry with auto-discovery
     */
    async initialize() {
        console.log('[ToolRegistry] Initializing with auto-discovery...');
        const startTime = Date.now();
        const result = {
            toolsFound: 0,
            toolsRegistered: 0,
            toolsFailed: 0,
            domains: [],
            errors: [],
            duration: 0
        };
        try {
            // Discover all domains (subdirectories in tools/)
            const domains = await this.discoverDomains();
            result.domains = domains;
            console.log(`[ToolRegistry] Found ${domains.length} domains: ${domains.join(', ')}`);
            // Discover and register tools from each domain
            for (const domain of domains) {
                const domainPath = path.join(this.config.toolsDirectory, domain);
                const domainResult = await this.discoverDomainTools(domain, domainPath);
                result.toolsFound += domainResult.toolsFound;
                result.toolsRegistered += domainResult.toolsRegistered;
                result.toolsFailed += domainResult.toolsFailed;
                result.errors.push(...domainResult.errors);
            }
            result.duration = Date.now() - startTime;
            console.log('[ToolRegistry] Discovery complete:');
            console.log(`  - Tools found: ${result.toolsFound}`);
            console.log(`  - Tools registered: ${result.toolsRegistered}`);
            console.log(`  - Tools failed: ${result.toolsFailed}`);
            console.log(`  - Duration: ${result.duration}ms`);
            // Export tool definitions to JSON
            if (result.toolsRegistered > 0) {
                await this.exportToolDefinitions();
            }
        }
        catch (error) {
            console.error('[ToolRegistry] Discovery failed:', error.message);
            throw error;
        }
        return result;
    }
    /**
     * Discover all domain directories
     */
    async discoverDomains() {
        try {
            const entries = await fs.readdir(this.config.toolsDirectory, { withFileTypes: true });
            return entries
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)
                .filter(name => !name.startsWith('.') && !name.startsWith('_'));
        }
        catch (error) {
            console.error('[ToolRegistry] Failed to discover domains:', error.message);
            return [];
        }
    }
    /**
     * Discover tools in a specific domain
     */
    async discoverDomainTools(domain, domainPath) {
        const result = {
            toolsFound: 0,
            toolsRegistered: 0,
            toolsFailed: 0,
            domains: [domain],
            errors: [],
            duration: 0
        };
        try {
            // Read all .js files in domain directory (except index.js)
            // In compiled output, we want .js files, not .ts or .d.ts
            const entries = await fs.readdir(domainPath, { withFileTypes: true });
            const toolFiles = entries
                .filter(entry => entry.isFile() &&
                entry.name.endsWith('.js') &&
                entry.name !== 'index.js' &&
                !entry.name.endsWith('.d.ts') && // Exclude TypeScript declaration files
                !entry.name.endsWith('.js.map') // Exclude source maps
            )
                .map(entry => entry.name);
            result.toolsFound = toolFiles.length;
            // Load each tool file
            for (const toolFile of toolFiles) {
                const toolPath = path.join(domainPath, toolFile);
                try {
                    await this.loadAndRegisterTool(domain, toolPath);
                    result.toolsRegistered++;
                }
                catch (error) {
                    result.toolsFailed++;
                    result.errors.push({
                        filePath: toolPath,
                        error: error.message
                    });
                    console.error(`[ToolRegistry] Failed to load ${toolPath}:`, error.message);
                }
            }
        }
        catch (error) {
            console.error(`[ToolRegistry] Failed to discover tools in ${domain}:`, error.message);
        }
        return result;
    }
    /**
     * Load and register a tool from a file
     */
    async loadAndRegisterTool(domain, filePath) {
        try {
            // Dynamic import of tool module
            const toolModule = await Promise.resolve(`${filePath}`).then(s => __importStar(require(s)));
            // Validate tool module exports
            if (!toolModule.toolDefinition) {
                throw new Error('Tool module must export "toolDefinition"');
            }
            if (!toolModule.execute) {
                throw new Error('Tool module must export "execute" function');
            }
            const definition = toolModule.toolDefinition;
            const executor = toolModule.execute;
            // Validate tool definition
            if (this.config.validateOnRegister) {
                const validation = this.validateToolDefinition(definition);
                if (!validation.valid) {
                    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
                }
            }
            // Register tool
            const registeredTool = {
                definition,
                executor,
                domain,
                filePath,
                metadata: {
                    addedAt: new Date(),
                    version: toolModule.version || '1.0.0',
                    author: toolModule.author
                }
            };
            this.tools.set(definition.name, registeredTool);
            console.log(`[ToolRegistry] Registered: ${definition.name} (${domain})`);
        }
        catch (error) {
            throw new Error(`Failed to load tool from ${filePath}: ${error.message}`);
        }
    }
    /**
     * Validate tool definition structure
     */
    validateToolDefinition(definition) {
        const errors = [];
        const warnings = [];
        // Required fields
        if (!definition.name) {
            errors.push('Tool name is required');
        }
        else if (!/^[a-z_][a-z0-9_]*$/.test(definition.name)) {
            errors.push('Tool name must match pattern: ^[a-z_][a-z0-9_]*$ (snake_case)');
        }
        if (!definition.description) {
            errors.push('Tool description is required');
        }
        else if (definition.description.length < 10) {
            warnings.push('Tool description should be more descriptive (at least 10 characters)');
        }
        if (!definition.inputSchema) {
            errors.push('Tool inputSchema is required');
        }
        else {
            if (definition.inputSchema.type !== 'object') {
                errors.push('Tool inputSchema.type must be "object"');
            }
            if (!definition.inputSchema.properties) {
                warnings.push('Tool should define input properties');
            }
        }
        // Check for duplicate names
        if (this.tools.has(definition.name)) {
            errors.push(`Tool name "${definition.name}" is already registered`);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Get all registered tool definitions (for MCP server)
     */
    getToolDefinitions() {
        return Array.from(this.tools.values()).map(tool => tool.definition);
    }
    /**
     * Get registered tool by name
     */
    getTool(name) {
        return this.tools.get(name);
    }
    /**
     * Execute a tool by name
     */
    async executeTool(name, args, context) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        try {
            console.log(`[ToolRegistry] Executing: ${name}`);
            const result = await tool.executor(args, context);
            console.log(`[ToolRegistry] Success: ${name}`);
            return result;
        }
        catch (error) {
            console.error(`[ToolRegistry] Failed: ${name}`, error.message);
            throw error;
        }
    }
    /**
     * Get tools by domain
     */
    getToolsByDomain(domain) {
        return Array.from(this.tools.values()).filter(tool => tool.domain === domain);
    }
    /**
     * Get all domains
     */
    getDomains() {
        const domains = new Set();
        this.tools.forEach(tool => domains.add(tool.domain));
        return Array.from(domains).sort();
    }
    /**
     * Get registry statistics
     */
    getStatistics() {
        const domains = this.getDomains();
        const stats = {
            totalTools: this.tools.size,
            totalDomains: domains.length,
            toolsByDomain: {}
        };
        domains.forEach(domain => {
            stats.toolsByDomain[domain] = this.getToolsByDomain(domain).length;
        });
        return stats;
    }
    /**
     * Export tool definitions to JSON file
     */
    async exportToolDefinitions() {
        const configPath = path.join(__dirname, '../config/tool-definitions.json');
        const metadata = [];
        this.tools.forEach((tool, name) => {
            metadata.push({
                name,
                domain: tool.domain,
                description: tool.definition.description,
                version: tool.metadata.version,
                author: tool.metadata.author,
                tags: [tool.domain]
            });
        });
        try {
            await fs.mkdir(path.dirname(configPath), { recursive: true });
            await fs.writeFile(configPath, JSON.stringify(metadata, null, 2), 'utf-8');
            console.log(`[ToolRegistry] Exported ${metadata.length} tool definitions to ${configPath}`);
        }
        catch (error) {
            console.error('[ToolRegistry] Failed to export tool definitions:', error.message);
        }
    }
    /**
     * Reload tools from disk (for development hot-reload)
     */
    async reload() {
        console.log('[ToolRegistry] Reloading tools...');
        this.tools.clear();
        return await this.initialize();
    }
    /**
     * Clear all registered tools
     */
    clear() {
        this.tools.clear();
        console.log('[ToolRegistry] Cleared all registered tools');
    }
}
exports.ToolRegistry = ToolRegistry;
// Export singleton instance
exports.toolRegistry = new ToolRegistry();
//# sourceMappingURL=tool-registry.js.map