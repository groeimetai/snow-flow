/**
 * Tool Registry with Auto-Discovery
 *
 * Automatically discovers and registers tools from the tools/ directory.
 * Supports dynamic loading, validation, and hot-reload during development.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MCPToolDefinition,
  RegisteredTool,
  ToolDiscoveryResult,
  ToolExecutor,
  ToolRegistryConfig,
  ToolValidationResult,
  ToolMetadata
} from './types';

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private config: ToolRegistryConfig;
  private discoveryInProgress = false;

  constructor(config: Partial<ToolRegistryConfig> = {}) {
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
  async initialize(): Promise<ToolDiscoveryResult> {
    console.log('[ToolRegistry] Initializing with auto-discovery...');

    const startTime = Date.now();
    const result: ToolDiscoveryResult = {
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

    } catch (error: any) {
      console.error('[ToolRegistry] Discovery failed:', error.message);
      throw error;
    }

    return result;
  }

  /**
   * Discover all domain directories
   */
  private async discoverDomains(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.config.toolsDirectory, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => !name.startsWith('.') && !name.startsWith('_'));
    } catch (error: any) {
      console.error('[ToolRegistry] Failed to discover domains:', error.message);
      return [];
    }
  }

  /**
   * Discover tools in a specific domain
   */
  private async discoverDomainTools(
    domain: string,
    domainPath: string
  ): Promise<ToolDiscoveryResult> {
    const result: ToolDiscoveryResult = {
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
        .filter(entry =>
          entry.isFile() &&
          entry.name.endsWith('.js') &&
          entry.name !== 'index.js' &&
          !entry.name.endsWith('.d.ts') && // Exclude TypeScript declaration files
          !entry.name.endsWith('.js.map')  // Exclude source maps
        )
        .map(entry => entry.name);

      result.toolsFound = toolFiles.length;

      // Load each tool file
      for (const toolFile of toolFiles) {
        const toolPath = path.join(domainPath, toolFile);
        try {
          await this.loadAndRegisterTool(domain, toolPath);
          result.toolsRegistered++;
        } catch (error: any) {
          result.toolsFailed++;
          result.errors.push({
            filePath: toolPath,
            error: error.message
          });
          console.error(`[ToolRegistry] Failed to load ${toolPath}:`, error.message);
        }
      }

    } catch (error: any) {
      console.error(`[ToolRegistry] Failed to discover tools in ${domain}:`, error.message);
    }

    return result;
  }

  /**
   * Load and register a tool from a file
   */
  private async loadAndRegisterTool(domain: string, filePath: string): Promise<void> {
    try {
      // Dynamic import of tool module
      const toolModule = await import(filePath);

      // Validate tool module exports
      if (!toolModule.toolDefinition) {
        throw new Error('Tool module must export "toolDefinition"');
      }
      if (!toolModule.execute) {
        throw new Error('Tool module must export "execute" function');
      }

      const definition: MCPToolDefinition = toolModule.toolDefinition;
      const executor: ToolExecutor = toolModule.execute;

      // Validate tool definition
      if (this.config.validateOnRegister) {
        const validation = this.validateToolDefinition(definition);
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Register tool
      const registeredTool: RegisteredTool = {
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

    } catch (error: any) {
      throw new Error(`Failed to load tool from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Validate tool definition structure
   */
  private validateToolDefinition(definition: MCPToolDefinition): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!definition.name) {
      errors.push('Tool name is required');
    } else if (!/^[a-z_][a-z0-9_]*$/.test(definition.name)) {
      errors.push('Tool name must match pattern: ^[a-z_][a-z0-9_]*$ (snake_case)');
    }

    if (!definition.description) {
      errors.push('Tool description is required');
    } else if (definition.description.length < 10) {
      warnings.push('Tool description should be more descriptive (at least 10 characters)');
    }

    if (!definition.inputSchema) {
      errors.push('Tool inputSchema is required');
    } else {
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
  getToolDefinitions(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  /**
   * Get registered tool by name
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    name: string,
    args: Record<string, any>,
    context: any
  ): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      console.log(`[ToolRegistry] Executing: ${name}`);
      const result = await tool.executor(args, context);
      console.log(`[ToolRegistry] Success: ${name}`);
      return result;
    } catch (error: any) {
      console.error(`[ToolRegistry] Failed: ${name}`, error.message);
      throw error;
    }
  }

  /**
   * Get tools by domain
   */
  getToolsByDomain(domain: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.domain === domain);
  }

  /**
   * Get all domains
   */
  getDomains(): string[] {
    const domains = new Set<string>();
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
      toolsByDomain: {} as Record<string, number>
    };

    domains.forEach(domain => {
      stats.toolsByDomain[domain] = this.getToolsByDomain(domain).length;
    });

    return stats;
  }

  /**
   * Export tool definitions to JSON file
   */
  private async exportToolDefinitions(): Promise<void> {
    const configPath = path.join(__dirname, '../config/tool-definitions.json');
    const metadata: ToolMetadata[] = [];

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
    } catch (error: any) {
      console.error('[ToolRegistry] Failed to export tool definitions:', error.message);
    }
  }

  /**
   * Reload tools from disk (for development hot-reload)
   */
  async reload(): Promise<ToolDiscoveryResult> {
    console.log('[ToolRegistry] Reloading tools...');
    this.tools.clear();
    return await this.initialize();
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    console.log('[ToolRegistry] Cleared all registered tools');
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
