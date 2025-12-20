/**
 * MCP Resource Manager
 * Comprehensive resource management for MCP servers
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { Logger } from '../../utils/logger.js';

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

export class MCPResourceManager {
  private logger: Logger;
  private resourceCache: Map<string, MCPResourceContent> = new Map();
  private resourceIndex: Map<string, MCPResource> = new Map();
  private categories: ResourceCategory[] = [];

  constructor(serverName: string = 'mcp-server') {
    this.logger = new Logger(`ResourceManager:${serverName}`);
    this.initializeCategories();
  }

  /**
   * Initialize resource categories
   */
  private initializeCategories(): void {
    const projectRoot = this.getProjectRoot();
    
    this.categories = [
      {
        name: 'templates',
        description: 'ServiceNow artifact templates (widgets, flows, scripts, etc.)',
        basePath: join(projectRoot, 'src/templates'),
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
        basePath: join(projectRoot, 'src/schemas'),
        uriPrefix: 'servicenow://schemas/'
      },
      {
        name: 'examples',
        description: 'Example implementations and sample data',
        basePath: join(projectRoot, 'src/templates/examples'),
        uriPrefix: 'servicenow://examples/'
      },
      {
        name: 'help',
        description: 'Help content and guidance documents',
        basePath: join(projectRoot, 'src/sparc'),
        uriPrefix: 'servicenow://help/'
      }
    ];
  }

  /**
   * Get project root directory
   */
  private getProjectRoot(): string {
    // Use process.cwd() to get the current working directory
    // This should be the project root when running the application
    return process.cwd();
  }

  /**
   * List all available resources
   */
  async listResources(): Promise<MCPResource[]> {
    if (this.resourceIndex.size === 0) {
      await this.buildResourceIndex();
    }
    
    return Array.from(this.resourceIndex.values());
  }

  /**
   * Read a specific resource by URI
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    this.logger.debug(`Reading resource: ${uri}`);

    // Check cache first
    if (this.resourceCache.has(uri)) {
      this.logger.debug(`Resource found in cache: ${uri}`);
      return this.resourceCache.get(uri)!;
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
    } catch (error) {
      this.logger.error(`Failed to read resource ${uri}:`, error);
      throw new Error(`Resource not found or inaccessible: ${uri}`);
    }
  }

  /**
   * Build comprehensive resource index
   */
  private async buildResourceIndex(): Promise<void> {
    this.logger.info('Building resource index...');
    
    for (const category of this.categories) {
      try {
        await this.indexCategory(category);
      } catch (error) {
        this.logger.warn(`Failed to index category ${category.name}:`, error);
      }
    }

    this.logger.info(`Resource index built: ${this.resourceIndex.size} resources`);
  }

  /**
   * Index resources in a specific category
   */
  private async indexCategory(category: ResourceCategory): Promise<void> {
    try {
      const stats = await stat(category.basePath);
      if (!stats.isDirectory()) {
        this.logger.debug(`Category path is not a directory: ${category.basePath}`);
        return;
      }
    } catch (error) {
      this.logger.debug(`Category path does not exist: ${category.basePath}`);
      return;
    }

    if (category.name === 'documentation') {
      await this.indexDocumentationFiles(category);
    } else {
      await this.indexDirectoryRecursive(category.basePath, category);
    }
  }

  /**
   * Index documentation files (special handling for .md files in root)
   */
  private async indexDocumentationFiles(category: ResourceCategory): Promise<void> {
    try {
      const files = await readdir(category.basePath);
      
      for (const file of files) {
        if (file.endsWith('.md') && file.toUpperCase().includes('SERVICENOW')) {
          const filePath = join(category.basePath, file);
          const uri = `${category.uriPrefix}${file}`;
          
          const resource: MCPResource = {
            uri,
            name: this.formatResourceName(file),
            description: `ServiceNow documentation: ${this.formatResourceName(file)}`,
            mimeType: this.getMimeType(file)
          };
          
          this.resourceIndex.set(uri, resource);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to index documentation files:`, error);
    }
  }

  /**
   * Index directory recursively
   */
  private async indexDirectoryRecursive(
    dirPath: string, 
    category: ResourceCategory, 
    relativePath: string = ''
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const entryRelativePath = relativePath ? join(relativePath, entry) : entry;
        
        try {
          const stats = await stat(fullPath);
          
          if (stats.isDirectory()) {
            await this.indexDirectoryRecursive(fullPath, category, entryRelativePath);
          } else if (this.isResourceFile(entry)) {
            const uri = `${category.uriPrefix}${entryRelativePath.replace(/\\/g, '/')}`;
            
            const resource: MCPResource = {
              uri,
              name: this.formatResourceName(entry),
              description: this.generateResourceDescription(entry, category.name),
              mimeType: this.getMimeType(entry)
            };
            
            this.resourceIndex.set(uri, resource);
          }
        } catch (error) {
          this.logger.debug(`Failed to process ${fullPath}:`, error);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read directory ${dirPath}:`, error);
    }
  }

  /**
   * Check if file should be exposed as a resource
   */
  private isResourceFile(filename: string): boolean {
    const resourceExtensions = ['.json', '.md', '.yaml', '.yml', '.txt', '.ts', '.js'];
    const ext = extname(filename).toLowerCase();
    return resourceExtensions.includes(ext);
  }

  /**
   * Convert URI to file path
   */
  private uriToFilePath(uri: string): string | null {
    for (const category of this.categories) {
      if (uri.startsWith(category.uriPrefix)) {
        const relativePath = uri.substring(category.uriPrefix.length);
        
        if (category.name === 'documentation') {
          // Documentation files are in root
          return join(category.basePath, relativePath);
        } else {
          return join(category.basePath, relativePath);
        }
      }
    }
    
    return null;
  }

  /**
   * Load resource content from file
   */
  private async loadResourceContent(filePath: string, uri: string): Promise<MCPResourceContent> {
    const content = await readFile(filePath, 'utf-8');
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
  private getMimeType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
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
  private formatResourceName(filename: string): string {
    const nameWithoutExt = basename(filename, extname(filename));
    
    // Convert various naming conventions to readable names
    return nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\.(template|schema|example)/i, '');
  }

  /**
   * Generate resource description based on filename and category
   */
  private generateResourceDescription(filename: string, categoryName: string): string {
    const name = this.formatResourceName(filename);
    
    const descriptions: { [key: string]: string } = {
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
  clearCache(): void {
    this.resourceCache.clear();
    this.resourceIndex.clear();
    this.logger.debug('Resource cache cleared');
  }

  /**
   * Get resource statistics
   */
  getResourceStats(): {
    total: number;
    cached: number;
    categories: { [key: string]: number };
  } {
    const categories: { [key: string]: number } = {};
    
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