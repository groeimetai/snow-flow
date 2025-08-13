/**
 * Artifact Local Sync System
 * 
 * Creates temporary local files from ServiceNow artifacts so Claude Code
 * can use its native tools (search, edit, multi-file operations, etc.)
 * Then syncs changes back to ServiceNow.
 * 
 * THIS IS THE BRIDGE BETWEEN SERVICENOW AND CLAUDE CODE!
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ServiceNowClient } from './servicenow-client.js';
import { SmartFieldFetcher } from './smart-field-fetcher.js';
import { 
  ARTIFACT_REGISTRY, 
  ArtifactTypeConfig, 
  FieldMapping, 
  ValidationResult,
  getArtifactConfig,
  isTableSupported,
  getTableDisplayName
} from './artifact-sync/artifact-registry';

export interface LocalArtifact {
  sys_id: string;
  name: string;
  type: string;  // Dynamic type from registry
  tableName: string;  // Table name for ServiceNow
  localPath: string;
  files: LocalFile[];
  metadata: any;
  syncStatus: 'synced' | 'modified' | 'pending_upload';
  createdAt: Date;
  lastSyncedAt: Date;
  artifactConfig?: ArtifactTypeConfig;  // Reference to registry config
}

export interface LocalFile {
  filename: string;
  path: string;
  field: string;  // Maps to ServiceNow field
  type: string;  // Dynamic type from registry
  originalContent: string;
  currentContent?: string;
  isModified: boolean;
  fieldMapping?: FieldMapping;  // Reference to field mapping from registry
}

export class ArtifactLocalSync {
  private baseDir: string;
  private artifacts: Map<string, LocalArtifact> = new Map();
  private client: ServiceNowClient;
  private smartFetcher: SmartFieldFetcher;
  
  constructor(client: ServiceNowClient, customBaseDir?: string) {
    this.client = client;
    this.smartFetcher = new SmartFieldFetcher(client);
    
    // Use custom directory, environment variable, or default to current project's servicenow folder
    if (customBaseDir) {
      this.baseDir = customBaseDir;
    } else if (process.env.SNOW_FLOW_ARTIFACTS_DIR) {
      this.baseDir = process.env.SNOW_FLOW_ARTIFACTS_DIR;
    } else {
      // Default to 'servicenow' folder in current working directory
      this.baseDir = path.join(process.cwd(), 'servicenow');
    }
    
    // Create base directory if it doesn't exist
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
      console.log(`📁 Created ServiceNow artifacts directory: ${this.baseDir}`);
    } else {
      console.log(`📁 Using ServiceNow artifacts directory: ${this.baseDir}`);
    }
    
    // Create .gitignore if it doesn't exist to optionally exclude from version control
    const gitignorePath = path.join(this.baseDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, 
        '# ServiceNow Artifacts\n' +
        '# Uncomment the following lines to exclude from version control:\n' +
        '# *\n' +
        '# !.gitignore\n' +
        '# !README.md\n'
      );
    }
    
    // Create README if it doesn't exist
    const readmePath = path.join(this.baseDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, 
        '# ServiceNow Artifacts Directory\n\n' +
        'This directory contains ServiceNow artifacts synchronized from your instance for local development.\n\n' +
        '## Structure\n\n' +
        '```\n' +
        'servicenow/\n' +
        '├── widgets/          # Service Portal widgets\n' +
        '├── script_includes/  # Script Includes\n' +
        '├── business_rules/   # Business Rules\n' +
        '├── flows/           # Flow Designer flows\n' +
        '├── ui_pages/        # UI Pages\n' +
        '└── ...              # Other artifact types\n' +
        '```\n\n' +
        '## Workflow\n\n' +
        '1. **Pull artifacts**: `snow_pull_artifact` downloads artifacts here\n' +
        '2. **Edit locally**: Use your IDE/editor to modify files\n' +
        '3. **Push changes**: `snow_push_artifact` syncs changes back to ServiceNow\n' +
        '4. **Clean up**: `snow_sync_cleanup` removes local files after sync\n\n' +
        '## Version Control\n\n' +
        'You can choose to:\n' +
        '- **Track changes**: Keep artifacts in git for version history\n' +
        '- **Ignore artifacts**: Edit `.gitignore` to exclude from git\n\n' +
        '## Configuration\n\n' +
        'Set custom location with environment variable:\n' +
        '```bash\n' +
        'export SNOW_FLOW_ARTIFACTS_DIR=/path/to/artifacts\n' +
        '```\n'
      );
    }
  }

  /**
   * DYNAMIC pull artifact from ServiceNow using artifact registry
   * Works with ANY artifact type defined in the registry!
   */
  async pullArtifact(tableName: string, sys_id: string): Promise<LocalArtifact> {
    const config = getArtifactConfig(tableName);
    if (!config) {
      throw new Error(`Unsupported artifact type: ${tableName}. Supported types: ${Object.keys(ARTIFACT_REGISTRY).join(', ')}`);
    }

    console.log(`\n🔄 Pulling ${config.displayName} (${sys_id}) to local files...`);
    
    // Use smart fetcher for known types, otherwise direct query
    let artifactData: any;
    if (tableName === 'sp_widget') {
      artifactData = await this.smartFetcher.fetchWidget(sys_id);
    } else if (tableName === 'sys_hub_flow') {
      artifactData = await this.smartFetcher.fetchFlow(sys_id);
    } else if (tableName === 'sys_script') {
      artifactData = await this.smartFetcher.fetchBusinessRule(sys_id);
    } else {
      // Generic fetch for other types
      const allFields = config.fieldMappings.map(fm => fm.serviceNowField);
      const response = await this.client.searchRecords(tableName, `sys_id=${sys_id}`, 1);
      artifactData = response.result?.[0];
    }

    if (!artifactData) {
      throw new Error(`Artifact not found: ${tableName}/${sys_id}`);
    }

    // Use identifier field from config
    const identifier = artifactData[config.identifierField] || `${config.folderName}_${sys_id}`;
    const sanitizedName = this.sanitizeFilename(identifier);
    const artifactPath = path.join(this.baseDir, config.folderName, sanitizedName);
    
    // Clean up existing files
    if (fs.existsSync(artifactPath)) {
      fs.rmSync(artifactPath, { recursive: true });
    }
    fs.mkdirSync(artifactPath, { recursive: true });
    
    // Create local files based on field mappings
    const files: LocalFile[] = [];
    
    for (const mapping of config.fieldMappings) {
      const fieldValue = artifactData[mapping.serviceNowField];
      
      // Skip empty fields unless required
      if (!fieldValue && !mapping.isRequired) {
        continue;
      }
      
      // Apply preprocessor if defined
      let processedContent = fieldValue || '';
      if (mapping.preprocessor) {
        processedContent = mapping.preprocessor(processedContent);
      }
      
      // Generate filename with placeholder replacement
      const filename = mapping.localFileName
        .replace('{name}', sanitizedName)
        .replace('{api_name}', artifactData.api_name || sanitizedName)
        .replace('{short_description}', artifactData.short_description || sanitizedName);
      
      // Generate header/footer with replacements
      const header = this.replacePlaceholders(mapping.wrapperHeader || '', artifactData);
      const footer = this.replacePlaceholders(mapping.wrapperFooter || '', artifactData);
      
      const file = this.createLocalFile(
        artifactPath,
        `${filename}.${mapping.fileExtension}`,
        processedContent,
        mapping.serviceNowField,
        mapping.fileExtension,
        header,
        footer
      );
      
      file.fieldMapping = mapping;
      files.push(file);
    }
    
    // Generate README with artifact-specific context
    const readmeContent = this.generateArtifactReadme(config, artifactData, files);
    const readmeFile = this.createLocalFile(
      artifactPath,
      'README.md',
      readmeContent,
      'documentation',
      'md'
    );
    files.push(readmeFile);
    
    // Create artifact record
    const artifact: LocalArtifact = {
      sys_id: artifactData.sys_id,
      name: identifier,
      type: config.displayName,
      tableName: tableName,
      localPath: artifactPath,
      files: files,
      metadata: artifactData,
      syncStatus: 'synced',
      createdAt: new Date(),
      lastSyncedAt: new Date(),
      artifactConfig: config
    };
    
    this.artifacts.set(sys_id, artifact);
    
    // Show relative path if in project directory
    const relativePath = path.relative(process.cwd(), artifactPath);
    const displayPath = relativePath.startsWith('..') ? artifactPath : relativePath;
    
    console.log(`✅ ${config.displayName} synced to local files:`);
    console.log(`📁 Location: ${displayPath}`);
    console.log(`📄 Files created:`);
    files.forEach(f => console.log(`   - ${f.filename} (${f.type})`));
    console.log(`\n💡 Claude Code can now use its native tools on these files!`);
    console.log(`   Edit, search, refactor - then run 'pushArtifact' to sync back.`);
    
    return artifact;
  }

  /**
   * Pull a widget from ServiceNow and create local files
   * This is the magic that lets Claude Code use its native tools!
   * (Wrapper for backward compatibility)
   */
  async pullWidget(sys_id: string): Promise<LocalArtifact> {
    return this.pullArtifact('sp_widget', sys_id);
  }

  /**
   * DYNAMIC push local changes back to ServiceNow using artifact registry
   */
  async pushArtifact(sys_id: string): Promise<boolean> {
    const artifact = this.artifacts.get(sys_id);
    if (!artifact) {
      throw new Error(`No local artifact found for ${sys_id}. Run pullArtifact first.`);
    }
    
    const config = artifact.artifactConfig;
    if (!config) {
      throw new Error(`No configuration found for artifact ${sys_id}`);
    }
    
    console.log(`\n🔄 Pushing local changes back to ServiceNow...`);
    console.log(`   Type: ${config.displayName}`);
    console.log(`   Table: ${config.tableName}`);
    
    // Read current content from all files
    const updates: any = {};
    let hasChanges = false;
    const validationResults: ValidationResult[] = [];
    
    for (const file of artifact.files) {
      if (fs.existsSync(file.path) && file.fieldMapping) {
        const currentContent = fs.readFileSync(file.path, 'utf8');
        
        // Strip our added headers/footers for comparison
        const cleanContent = this.stripAddedWrappers(currentContent, file.type, file.fieldMapping);
        
        if (cleanContent !== file.originalContent) {
          hasChanges = true;
          file.currentContent = cleanContent;
          file.isModified = true;
          
          // Apply postprocessor if defined
          let processedContent = cleanContent;
          if (file.fieldMapping.postprocessor) {
            processedContent = file.fieldMapping.postprocessor(processedContent);
          }
          
          // Map back to ServiceNow field
          if (file.field && file.field !== 'documentation' && file.field !== 'metadata') {
            updates[file.field] = processedContent;
            console.log(`   📝 Changed: ${file.filename} (${file.field})`);
            
            // Validate ES5 if required
            if (file.fieldMapping.validateES5) {
              const es5Issues = this.validateES5(processedContent);
              if (es5Issues.length > 0) {
                validationResults.push({
                  valid: false,
                  errors: es5Issues.map(issue => `${file.field}: ${issue}`),
                  warnings: [],
                  hints: []
                });
              }
            }
          }
        }
      }
    }
    
    if (!hasChanges) {
      console.log(`✅ No changes detected. ${config.displayName} is up to date.`);
      return true;
    }
    
    // Run coherence validation if defined
    if (config.coherenceRules) {
      const fileContents = new Map<string, string>();
      for (const file of artifact.files) {
        if (file.field && file.currentContent) {
          fileContents.set(file.field, file.currentContent);
        }
      }
      
      for (const rule of config.coherenceRules) {
        const result = rule.validate(fileContents);
        if (!result.valid) {
          validationResults.push(result);
        }
      }
    }
    
    // Show validation issues
    if (validationResults.length > 0) {
      console.log(`\n⚠️ Validation Issues Found:`);
      for (const result of validationResults) {
        result.errors.forEach(err => console.log(`   ❌ ${err}`));
        result.warnings.forEach(warn => console.log(`   ⚠️ ${warn}`));
        result.hints.forEach(hint => console.log(`   💡 ${hint}`));
      }
      console.log(`\n❓ Continue with deployment anyway? (Issues might cause runtime errors)`);
      // In real implementation, prompt for confirmation
    }
    
    // Update in ServiceNow
    try {
      console.log(`\n📤 Updating ${config.displayName} in ServiceNow...`);
      await this.client.updateRecord(config.tableName, sys_id, updates);
      
      artifact.syncStatus = 'synced';
      artifact.lastSyncedAt = new Date();
      
      console.log(`✅ ${config.displayName} successfully updated in ServiceNow!`);
      console.log(`🔗 sys_id: ${sys_id}`);
      console.log(`🏆 All changes have been deployed!`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to update ${config.displayName}:`, error);
      artifact.syncStatus = 'pending_upload';
      return false;
    }
  }

  /**
   * Push local changes back to ServiceNow
   * (Wrapper for backward compatibility)
   */
  async pushWidget(sys_id: string): Promise<boolean> {
    return this.pushArtifact(sys_id);
  }

  /**
   * Clean up local files after successful sync
   */
  async cleanup(sys_id: string, force: boolean = false): Promise<void> {
    const artifact = this.artifacts.get(sys_id);
    if (!artifact) return;
    
    if (!force && artifact.syncStatus !== 'synced') {
      console.log(`⚠️ Cannot cleanup - artifact has unsaved changes. Use force=true to override.`);
      return;
    }
    
    console.log(`\n🧹 Cleaning up local files for ${artifact.name}...`);
    
    if (fs.existsSync(artifact.localPath)) {
      fs.rmSync(artifact.localPath, { recursive: true });
    }
    
    this.artifacts.delete(sys_id);
    console.log(`✅ Local files removed.`);
  }

  /**
   * Create a local file with appropriate headers
   */
  private createLocalFile(
    dirPath: string,
    filename: string,
    content: string,
    field: string,
    type: string,
    header: string = '',
    footer: string = ''
  ): LocalFile {
    const filePath = path.join(dirPath, filename);
    const fullContent = header + content + footer;
    
    fs.writeFileSync(filePath, fullContent, 'utf8');
    
    return {
      filename,
      path: filePath,
      field,
      type: type as any,
      originalContent: content,
      isModified: false
    };
  }

  /**
   * Generate README with artifact-specific context using registry
   */
  private generateArtifactReadme(config: ArtifactTypeConfig, artifact: any, files: LocalFile[]): string {
    const header = `# ServiceNow ${config.displayName}: ${artifact[config.identifierField] || 'Unnamed'}

## Overview
- **Type**: ${config.displayName}
- **Table**: ${config.tableName}
- **sys_id**: ${artifact.sys_id}
- **Created**: ${artifact.sys_created_on || 'Unknown'}
- **Updated**: ${artifact.sys_updated_on || 'Unknown'}
`;

    const fileSection = `
## Files
${files.map(f => `- **${f.filename}** - ${f.fieldMapping?.description || f.field}`).join('\n')}
`;

    // Add coherence rules if defined
    let coherenceSection = '';
    if (config.coherenceRules && config.coherenceRules.length > 0) {
      coherenceSection = `
## Validation Rules
${config.coherenceRules.map(rule => `### ${rule.name}\n${rule.description}`).join('\n\n')}
`;
    }

    // Add artifact-specific documentation
    const docSection = config.documentation || '';

    // Add editing instructions
    const instructions = `
## Editing Instructions

1. **Edit files** using Claude Code's native tools
2. **Maintain coherence** between related files
${config.fieldMappings.some(fm => fm.validateES5) ? '3. **Use ES5 only** in server-side scripts (no modern JavaScript)' : ''}
4. **Test locally** if possible
5. **Run pushArtifact** to sync changes back to ServiceNow

## Commands

\`\`\`bash
# Push changes back to ServiceNow
snow-flow sync push-artifact ${artifact.sys_id}

# Cleanup local files (after sync)
snow-flow sync cleanup ${artifact.sys_id}

# Check sync status
snow-flow sync status ${artifact.sys_id}
\`\`\`
`;

    return header + fileSection + coherenceSection + docSection + instructions;
  }

  /**
   * Replace placeholders in wrapper strings
   */
  private replacePlaceholders(template: string, data: any): string {
    if (!template) return '';
    
    return template
      .replace(/\{name\}/g, data.name || '')
      .replace(/\{api_name\}/g, data.api_name || '')
      .replace(/\{title\}/g, data.title || '')
      .replace(/\{collection\}/g, data.collection || data.table || '')
      .replace(/\{when\}/g, data.when || '')
      .replace(/\{order\}/g, data.order || '')
      .replace(/\{type\}/g, data.type || '')
      .replace(/\{client_callable\}/g, data.client_callable ? 'Client Callable' : 'Server Only')
      .replace(/\{run_as\}/g, data.run_as || '')
      .replace(/\{time_zone\}/g, data.time_zone || '')
      .replace(/\{table\}/g, data.table || '')
      .replace(/\{short_description\}/g, data.short_description || '');
  }

  /**
   * Generate README with widget context
   * (Wrapper for backward compatibility)
   */
  private generateWidgetReadme(widget: any, files: LocalFile[]): string {
    const config = getArtifactConfig('sp_widget');
    if (!config) {
      throw new Error('Widget configuration not found in registry');
    }
    return this.generateArtifactReadme(config, widget, files);
    return `# ServiceNow Widget: ${widget.name}

## Overview
- **sys_id**: ${widget.sys_id}
- **Title**: ${widget.title || 'N/A'}
- **Created**: ${widget.sys_created_on}
- **Updated**: ${widget.sys_updated_on}

## Files
${files.map(f => `- **${f.filename}** - ${f.field}`).join('\n')}

## Widget Coherence Rules

### Template (HTML)
- References \`{{data.propertyName}}\` from server script
- Calls methods via \`ng-click="methodName()"\` from client script
- Uses CSS classes defined in the CSS file

### Server Script (ES5 ONLY!)
- Initializes all \`data.*\` properties referenced in template
- Handles all \`input.action\` requests from client
- Must use ES5 syntax (no const/let/arrow functions)

### Client Script (AngularJS)
- Implements all methods called by template ng-click
- Uses \`c.server.get({action: 'name'})\` to call server
- Updates \`c.data\` when server responds

### CSS
- Defines all classes used in template
- Should be prefixed to avoid conflicts

## Editing Instructions

1. **Edit files** using Claude Code's native tools
2. **Maintain coherence** between template, scripts, and CSS
3. **Use ES5 only** in server script (no modern JavaScript)
4. **Test locally** if possible
5. **Run pushWidget** to sync changes back to ServiceNow

## Coherence Hints
${widget._coherence_hints?.map((h: string) => `- ${h}`).join('\n') || 'No automatic hints detected'}

## Commands

\`\`\`bash
# Push changes back to ServiceNow
snow-flow sync push-widget ${widget.sys_id}

# Cleanup local files (after sync)
snow-flow sync cleanup ${widget.sys_id}

# Check sync status
snow-flow sync status ${widget.sys_id}
\`\`\`
`;
  }

  /**
   * Validate ES5 compliance
   */
  private validateES5(script: string): string[] {
    const issues: string[] = [];
    
    // Check for ES6+ syntax
    if (/\bconst\s+/.test(script)) issues.push('Uses "const" - use "var" instead');
    if (/\blet\s+/.test(script)) issues.push('Uses "let" - use "var" instead');
    if (/=>\s*{/.test(script)) issues.push('Uses arrow functions - use function() instead');
    if (/`[^`]*\$\{[^}]*\}[^`]*`/.test(script)) issues.push('Uses template literals - use string concatenation');
    if (/\.\.\.\w+/.test(script)) issues.push('Uses spread operator - not supported in ES5');
    if (/class\s+\w+/.test(script)) issues.push('Uses ES6 classes - use function constructors');
    if (/async\s+function/.test(script)) issues.push('Uses async/await - use callbacks');
    if (/\bfor\s*\(\s*(?:const|let)\s+\w+\s+of\s+/.test(script)) issues.push('Uses for...of - use traditional for loop');
    
    return issues;
  }

  /**
   * Strip headers/footers we added - now uses field mapping for accuracy
   */
  private stripAddedWrappers(content: string, type: string, fieldMapping?: FieldMapping): string {
    // Remove our added comments and wrappers
    let cleaned = content;
    
    if (type === 'js') {
      // Remove wrapper function if we added it
      cleaned = cleaned.replace(/^\(function\(\) \{\n/, '');
      cleaned = cleaned.replace(/\n\}\)\(\);$/, '');
      
      // Remove our header comments
      cleaned = cleaned.replace(/^\/\*\*[\s\S]*?\*\/\n\n/, '');
      cleaned = cleaned.replace(/^function\(/, 'function(');
    } else if (type === 'html') {
      // Remove our HTML comments
      cleaned = cleaned.replace(/^<!-- ServiceNow Widget Template -->[\s\S]*?-->\n\n/, '');
    } else if (type === 'css') {
      // Remove our CSS comments
      cleaned = cleaned.replace(/^\/\* ServiceNow Widget Styles \*\/[\s\S]*?\*\/\n\n/, '');
    }
    
    return cleaned.trim();
  }

  /**
   * Sanitize filename for filesystem
   */
  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
  }

  /**
   * List all local artifacts
   */
  listLocalArtifacts(): LocalArtifact[] {
    return Array.from(this.artifacts.values());
  }

  /**
   * Get sync status for an artifact
   */
  getSyncStatus(sys_id: string): string {
    const artifact = this.artifacts.get(sys_id);
    return artifact ? artifact.syncStatus : 'not_synced';
  }

  /**
   * Pull any supported artifact type by detecting table from sys_id
   */
  async pullArtifactBySysId(sys_id: string): Promise<LocalArtifact> {
    // Try to detect table by querying common tables
    const tables = Object.keys(ARTIFACT_REGISTRY);
    
    for (const table of tables) {
      try {
        const response = await this.client.searchRecords(table, `sys_id=${sys_id}`, 1);
        
        if (response.result?.[0]) {
          console.log(`🎆 Found artifact in table: ${table}`);
          return this.pullArtifact(table, sys_id);
        }
      } catch (error) {
        // Table might not exist, continue searching
      }
    }
    
    throw new Error(`Could not find artifact with sys_id ${sys_id} in any supported table`);
  }

  /**
   * Get supported artifact types
   */
  getSupportedTypes(): string[] {
    return Object.keys(ARTIFACT_REGISTRY);
  }

  /**
   * Validate coherence for an artifact
   */
  async validateArtifactCoherence(sys_id: string): Promise<ValidationResult[]> {
    const artifact = this.artifacts.get(sys_id);
    if (!artifact || !artifact.artifactConfig) {
      throw new Error(`No local artifact found for ${sys_id}`);
    }
    
    const config = artifact.artifactConfig;
    const results: ValidationResult[] = [];
    
    if (config.coherenceRules) {
      const fileContents = new Map<string, string>();
      for (const file of artifact.files) {
        if (file.field && fs.existsSync(file.path)) {
          const content = fs.readFileSync(file.path, 'utf8');
          const cleanContent = this.stripAddedWrappers(content, file.type, file.fieldMapping);
          fileContents.set(file.field, cleanContent);
        }
      }
      
      for (const rule of config.coherenceRules) {
        const result = rule.validate(fileContents);
        results.push(result);
      }
    }
    
    // Custom validation if defined
    if (config.customValidation) {
      const customResult = config.customValidation(artifact.metadata);
      results.push(customResult);
    }
    
    return results;
  }
}