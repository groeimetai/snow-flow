/**
 * Artifact Local Sync System
 *
 * Creates temporary local files from ServiceNow artifacts so OpenCode
 * (or Claude Code) can use its native tools (search, edit, multi-file operations, etc.)
 * Then syncs changes back to ServiceNow.
 *
 * THIS IS THE BRIDGE BETWEEN SERVICENOW AND YOUR AI CODING ASSISTANT!
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ServiceNowClient } from './servicenow-client.js';
import { SmartFieldFetcher } from './smart-field-fetcher.js';
import { withMCPTimeout, getMCPTimeoutConfig } from './mcp-timeout-config.js';
import { ChunkingManager } from './chunking-manager.js';
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
  isGeneric?: boolean;  // True for custom/unknown tables
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
  existedBefore?: boolean;  // Did file exist before pull?
  previousContent?: string;  // Content before overwrite
}

export class ArtifactLocalSync {
  private baseDir: string;
  private artifacts: Map<string, LocalArtifact> = new Map();
  private client: ServiceNowClient;
  private smartFetcher: SmartFieldFetcher;
  
  constructor(client: ServiceNowClient, customBaseDir?: string) {
    this.client = client;
    this.smartFetcher = new SmartFieldFetcher(client);
    
    // Version check for debugging
    console.log(`🔧 ArtifactLocalSync v3.5.10 initializing...`);
    
    // Use custom directory, environment variable, or default to current project's servicenow folder
    if (customBaseDir) {
      this.baseDir = customBaseDir;
      console.log(`  📍 Using custom directory: ${customBaseDir}`);
    } else if (process.env.SNOW_FLOW_ARTIFACTS_DIR) {
      this.baseDir = process.env.SNOW_FLOW_ARTIFACTS_DIR;
      console.log(`  📍 Using environment variable directory: ${this.baseDir}`);
    } else {
      // Default to 'servicenow' folder in current working directory
      this.baseDir = path.join(process.cwd(), 'servicenow');
      console.log(`  📍 Using project directory: ${this.baseDir}`);
    }
    
    // Create base directory if it doesn't exist
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
      console.log(`  ✅ Created ServiceNow artifacts directory`);
    } else {
      console.log(`  ✅ Directory exists`);
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
    console.log(`📋 Snow-Flow v3.5.16 - ULTRA-CONSERVATIVE Wrapper System (No More Duplicates!)`);
    console.log(`⚠️  CRITICAL FIX: Aggressive strip & minimal wrapper addition only`);
    
    // Get timeout configuration
    const timeoutConfig = getMCPTimeoutConfig();
    
    // Use smart fetcher for known types, otherwise direct query
    let artifactData: any;
    // Fetch with timeout protection
    try {
      if (tableName === 'sp_widget') {
        artifactData = await withMCPTimeout(
          this.smartFetcher.fetchWidget(sys_id),
          timeoutConfig.pullToolTimeout,
          `Fetch widget ${sys_id}`
        );
      } else if (tableName === 'sys_hub_flow') {
        artifactData = await withMCPTimeout(
          this.smartFetcher.fetchFlow(sys_id),
          timeoutConfig.pullToolTimeout,
          `Fetch flow ${sys_id}`
        );
      } else if (tableName === 'sys_script') {
        artifactData = await withMCPTimeout(
          this.smartFetcher.fetchBusinessRule(sys_id),
          timeoutConfig.pullToolTimeout,
          `Fetch business rule ${sys_id}`
        );
      } else {
        // Generic fetch for other types
        const allFields = config.fieldMappings.map(fm => fm.serviceNowField);
        const response = await withMCPTimeout(
          this.client.searchRecords(tableName, `sys_id=${sys_id}`, 1),
          timeoutConfig.queryToolTimeout,
          `Query ${tableName} ${sys_id}`
        );
        artifactData = response.result?.[0];
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        console.error(`⏱️ Fetch timed out - ServiceNow may be slow or artifact is very large`);
        console.error(`💡 Try using snow_debug_widget_fetch to diagnose the issue`);
      }
      throw error;
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
      
      // ULTRA-CONSERVATIVE WRAPPER SYSTEM: When in doubt, don't add wrappers
      let header = '';
      let footer = '';
      
      // FAILSAFE: Only add wrappers if we're absolutely certain it's safe
      if (mapping.wrapperHeader && mapping.wrapperFooter) {
        const shouldAddWrappers = this.needsWrappers(processedContent, mapping);
        
        if (shouldAddWrappers && processedContent.trim().length < 50) {
          // EXTRA SAFETY: Only for very short content
          header = this.replacePlaceholders(mapping.wrapperHeader, artifactData);
          footer = this.replacePlaceholders(mapping.wrapperFooter, artifactData);
          console.log(`   🔧 Adding wrappers for ${filename} (content is minimal: ${processedContent.trim().length} chars)`);
        } else {
          console.log(`   ✅ Skipping wrappers for ${filename} (conservative approach)`);
        }
      }
      
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
    console.log(`\n💡 OpenCode (or Claude Code) can now use its native tools on these files!`);
    console.log(`   Edit, search, refactor - then run 'pushArtifact' to sync back.`);

    return artifact;
  }

  /**
   * Pull a widget from ServiceNow and create local files
   * This is the magic that lets your AI coding assistant use its native tools!
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
    
    // Handle generic artifacts differently
    if (artifact.isGeneric) {
      return this.pushGenericArtifact(artifact);
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
            // Check if field needs chunking (large server scripts)
            if (ChunkingManager.needsChunking(processedContent)) {
              console.log(`   ⚠️ Large field detected: ${file.field} (${processedContent.length} chars)`);
              
              // Attempt chunked update
              const chunkResult = await ChunkingManager.attemptChunkedUpdate(
                this.client,
                config.tableName,
                sys_id,
                file.field,
                processedContent
              );
              
              if (!chunkResult.success) {
                // Add to validation results as a manual instruction
                validationResults.push({
                  valid: false,
                  errors: [],
                  warnings: [`Large ${file.field} requires manual update`],
                  hints: [chunkResult.message]
                });
                continue; // Skip adding to updates
              }
            }
            
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
    
    // Update in ServiceNow with timeout protection
    try {
      console.log(`\n📤 Updating ${config.displayName} in ServiceNow...`);
      const timeoutConfig = getMCPTimeoutConfig();
      
      const updateResult = await withMCPTimeout(
        this.client.updateRecord(config.tableName, sys_id, updates),
        timeoutConfig.pushToolTimeout,
        `Update ${config.displayName} ${sys_id}`
      );
      
      // CRITICAL FIX: Check if the API call was actually successful
      if (!updateResult || !updateResult.success) {
        const errorMsg = updateResult?.error || 'Unknown API error';
        console.error(`❌ ServiceNow API returned failure: ${errorMsg}`);
        artifact.syncStatus = 'pending_upload';
        return false;
      }
      
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
   * Push generic artifact changes back to ServiceNow
   * Only updates known script fields to avoid data corruption
   */
  async pushGenericArtifact(artifact: LocalArtifact): Promise<boolean> {
    console.log(`\n🔄 Pushing generic artifact changes to ${artifact.tableName}...`);
    
    const updates: any = {};
    let hasChanges = false;
    
    // Only update known script fields for safety
    const scriptFields = ['script', 'condition', 'script_plain', 'advanced', 
                        'client_script', 'server_script', 'template', 'body'];
    
    for (const file of artifact.files) {
      if (file.field && scriptFields.includes(file.field)) {
        if (fs.existsSync(file.path)) {
          const currentContent = fs.readFileSync(file.path, 'utf8');
          if (currentContent !== file.originalContent) {
            hasChanges = true;
            updates[file.field] = currentContent;
            console.log(`   📝 Changed: ${file.filename} (${file.field})`);
          }
        }
      }
    }
    
    if (!hasChanges) {
      console.log(`✅ No changes detected. Generic artifact is up to date.`);
      return true;
    }
    
    try {
      console.log(`\n📤 Updating generic artifact in ServiceNow...`);
      const timeoutConfig = getMCPTimeoutConfig();
      
      const updateResult = await withMCPTimeout(
        this.client.updateRecord(artifact.tableName, artifact.sys_id, updates),
        timeoutConfig.pushToolTimeout,
        `Update generic artifact ${artifact.sys_id}`
      );
      
      if (!updateResult || !updateResult.success) {
        const errorMsg = updateResult?.error || 'Unknown API error';
        console.error(`❌ ServiceNow API returned failure: ${errorMsg}`);
        artifact.syncStatus = 'pending_upload';
        return false;
      }
      
      artifact.syncStatus = 'synced';
      artifact.lastSyncedAt = new Date();
      
      console.log(`✅ Generic artifact successfully updated in ServiceNow!`);
      console.log(`🔗 Table: ${artifact.tableName}`);
      console.log(`🔗 sys_id: ${artifact.sys_id}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to update generic artifact:`, error);
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
    
    // CRITICAL FIX: Check if file exists and handle overwrites intelligently
    let fileExists = false;
    let existingContent = '';
    
    if (fs.existsSync(filePath)) {
      fileExists = true;
      existingContent = fs.readFileSync(filePath, 'utf8');
      
      // Check if existing content is the same (avoid unnecessary writes)
      if (existingContent === fullContent) {
        console.log(`   📄 Unchanged: ${filename} (identical content, skipping write)`);
        return {
          filename,
          path: filePath,
          field,
          type: type as any,
          originalContent: content,
          isModified: false
        };
      }
      
      console.log(`   🔄 Overwriting: ${filename}`);
      console.log(`   ℹ️ File size: ${existingContent.length} → ${fullContent.length} chars`);
    } else {
      console.log(`   📝 Creating: ${filename}`);
    }
    
    // Write the file
    fs.writeFileSync(filePath, fullContent, 'utf8');
    
    return {
      filename,
      path: filePath,
      field,
      type: type as any,
      originalContent: content,
      isModified: fileExists, // Mark as modified if we overwrote existing file
      existedBefore: fileExists,
      previousContent: existingContent
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

1. **Edit files** using your AI coding assistant's native tools (OpenCode, Claude Code, etc.)
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

1. **Edit files** using your AI coding assistant's native tools (OpenCode, Claude Code, etc.)
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
   * AGGRESSIVE STRIP FUNCTION: Remove ALL possible Snow-Flow wrapper variations
   * FIXED: Handles multiple/nested wrappers and all patterns
   */
  private stripAddedWrappers(content: string, type: string, fieldMapping?: FieldMapping): string {
    let cleaned = content;
    
    // STEP 1: Remove ALL HTML comment variations (multiple times if needed)
    if (type === 'html') {
      let previousLength;
      do {
        previousLength = cleaned.length;
        
        // Remove ServiceNow Widget Template comments (all variations)
        cleaned = cleaned.replace(/^\s*<!--\s*ServiceNow\s+Widget\s+Template[\s\S]*?-->\s*\n?/gmi, '');
        
        // Remove Angular bindings comments
        cleaned = cleaned.replace(/^\s*<!--\s*Angular\s+bindings[\s\S]*?-->\s*\n?/gmi, '');
        
        // Remove any other HTML comments at start
        cleaned = cleaned.replace(/^\s*<!--[\s\S]*?-->\s*\n?/gm, '');
        
      } while (cleaned.length !== previousLength); // Keep going until no more changes
    }
    
    // STEP 2: Remove ALL JS comment variations (multiple times if needed)
    if (type === 'js') {
      let previousLength;
      do {
        previousLength = cleaned.length;
        
        // Remove Server/Client script comment blocks
        cleaned = cleaned.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*\n?/gm, '');
        
        // Remove function wrappers
        cleaned = cleaned.replace(/^\s*\(function\s*\(\s*\)\s*\{\s*\n?/gm, '');
        cleaned = cleaned.replace(/\s*\n?\s*\}\s*\)\s*\(\s*\)\s*;?\s*$/gm, '');
        
        // Remove function( wrappers for client scripts
        cleaned = cleaned.replace(/^\s*function\s*\(\s*$/gm, '');
        cleaned = cleaned.replace(/^\s*\)\s*$/gm, '');
        
      } while (cleaned.length !== previousLength);
    }
    
    // STEP 3: Remove ALL CSS comment variations
    if (type === 'css') {
      let previousLength;
      do {
        previousLength = cleaned.length;
        
        // Remove widget style comments
        cleaned = cleaned.replace(/^\s*\/\*[\s\S]*?\*\/\s*\n?/gm, '');
        
      } while (cleaned.length !== previousLength);
    }
    
    // STEP 4: Clean up excessive whitespace
    cleaned = cleaned.replace(/^\s*\n+/gm, ''); // Remove empty lines at start
    cleaned = cleaned.replace(/\n\s*$/gm, '');  // Remove trailing whitespace
    
    return cleaned.trim();
  }
  
  
  /**
   * CONSERVATIVE WRAPPER DETECTION: Only add wrappers if content is truly minimal
   * FIXED: Now properly detects ALL types of existing wrappers/comments
   */
  private needsWrappers(content: string, mapping: FieldMapping): boolean {
    if (!content || !content.trim()) {
      return false; // Empty content doesn't need wrappers
    }
    
    const trimmed = content.trim();
    
    // CONSERVATIVE APPROACH: If content has ANY of these indicators, skip wrappers
    
    // 1. Already has HTML comments (ANY HTML comments)
    if (trimmed.includes('<!--')) {
      console.log(`   🔍 Detected existing HTML comments - skipping wrappers`);
      return false;
    }
    
    // 2. Already has JS comments (ANY block comments)
    if (trimmed.includes('/**') || trimmed.includes('/*')) {
      console.log(`   🔍 Detected existing JS comments - skipping wrappers`);
      return false;
    }
    
    // 3. Already has function wrappers (ANY function patterns)
    if (trimmed.includes('(function') || trimmed.match(/^function\s*\(/)) {
      console.log(`   🔍 Detected existing function patterns - skipping wrappers`);
      return false;
    }
    
    // 4. Content is substantial (more than just basic code)
    if (trimmed.length > 200) {
      console.log(`   🔍 Content is substantial (${trimmed.length} chars) - skipping wrappers`);
      return false;
    }
    
    // 5. Contains ServiceNow-specific patterns
    const serviceNowPatterns = [
      'data.', 'input.', 'options.', '$scope.', 'c.server', 'gs.', '$sp.',
      'ng-', 'angular', 'spModal', 'spUtil', '{{', 'glide'
    ];
    
    for (const pattern of serviceNowPatterns) {
      if (trimmed.toLowerCase().includes(pattern.toLowerCase())) {
        console.log(`   🔍 Detected ServiceNow pattern '${pattern}' - skipping wrappers`);
        return false;
      }
    }
    
    // ONLY add wrappers for truly minimal/empty content
    console.log(`   ✨ Content is minimal and clean - adding wrappers`);
    return true;
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
   * ENHANCED: Now uses sys_metadata to find ANY table, not just registered ones!
   */
  async pullArtifactBySysId(sys_id: string): Promise<LocalArtifact> {
    console.log(`\n🔍 Auto-detecting artifact type for sys_id: ${sys_id}`);
    
    // CRITICAL: Add MAXIMUM operation timeout to prevent infinite hanging
    const MAX_OPERATION_TIME = 30000; // 30 seconds max for entire operation
    const operationStart = Date.now();
    const timeoutConfig = getMCPTimeoutConfig();
    
    // STEP 1: Try to find the table name using sys_metadata (works for ANY table!)
    console.log(`🔮 Querying sys_metadata to find table name...`);
    try {
      const metadataResponse = await withMCPTimeout(
        this.client.searchRecords('sys_metadata', `sys_id=${sys_id}`, 1),
        5000,
        `Query sys_metadata for ${sys_id}`
      );
      
      if (metadataResponse.result?.[0]?.sys_class_name) {
        const tableName = metadataResponse.result[0].sys_class_name;
        console.log(`   ✅ Found in sys_metadata! Table: ${tableName}`);
        
        // Check if this table is in our registry
        if (ARTIFACT_REGISTRY[tableName]) {
          console.log(`   ✅ Table is supported! Proceeding with pull...`);
          return this.pullArtifact(tableName, sys_id);
        } else {
          console.log(`   ⚠️ Table '${tableName}' is not in artifact registry`);
          console.log(`   🔧 Attempting generic pull for custom table...`);
          return this.pullGenericArtifact(tableName, sys_id);
        }
      }
    } catch (error) {
      console.log(`   ⚠️ sys_metadata query failed: ${error instanceof Error ? error.message : error}`);
      console.log(`   📋 Falling back to registered table search...`);
    }
    
    // STEP 2: If sys_metadata fails, try all registered tables with improved strategy
    
    console.log(`\n📋 Systematically checking ${Object.keys(ARTIFACT_REGISTRY).length} artifact types...`);
    const allTables = Object.keys(ARTIFACT_REGISTRY);
    
    // Prioritize by most common ServiceNow artifacts
    const priorityTables = [
      'sp_widget',           // Service Portal widgets
      'sys_script_include',  // Script includes
      'sys_script',          // Business rules
      'sys_ui_page',         // UI pages
      'sys_script_client',   // Client scripts
      'sys_ui_policy',       // UI policies
      'sys_rest_message',    // REST messages
      'sys_transform_map',   // Transform maps
      'sys_hub_flow'         // Flow Designer flows
    ];
    const otherTables = allTables.filter(t => !priorityTables.includes(t));
    const tables = [...priorityTables, ...otherTables]; // Priority order
    const errors: Array<{table: string, error: string}> = [];
    
    for (const table of tables) {
      // Check if we've exceeded maximum operation time
      if (Date.now() - operationStart > MAX_OPERATION_TIME) {
        console.log(`\n⏱️ Maximum operation time (30s) exceeded. Stopping search.`);
        break;
      }
      
      try {
        console.log(`   🔎 Checking table: ${table}...`);
        
        // Enhanced timeout for all artifact types
        const isPriorityTable = ['sp_widget', 'sys_script_include', 'sys_script', 'sys_ui_page'].includes(table);
        const timeoutPerTable = isPriorityTable ? 6000 : 4000; // Longer for common artifacts
        
        const response = await withMCPTimeout(
          this.client.searchRecords(table, `sys_id=${sys_id}`, 1),
          timeoutPerTable,
          `Detect ${getTableDisplayName(table) || table} artifact`
        );
        
        // Enhanced logging for all artifact types
        if (isPriorityTable) {
          console.log(`   🔍 ${getTableDisplayName(table)} detection:`, {
            table,
            timeout: timeoutPerTable,
            success: response.success,
            found: response.result?.length > 0
          });
        }
        
        if (response.result?.[0]) {
          console.log(`   ✅ Found in table: ${table}`);
          console.log(`🎆 Auto-detection successful! Proceeding with pull...`);
          return this.pullArtifact(table, sys_id);
        } else {
          console.log(`   ❌ Not found in: ${table}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`   ⚠️ Error checking ${table}: ${errorMsg}`);
        errors.push({ table, error: errorMsg });
      }
    }
    
    // STEP 3: Try a few common custom tables as last resort
    const customTables = ['sys_ui_script', 'sys_processor', 'sys_ws_operation', 'sys_portal_page'];
    console.log(`\n🔍 Checking additional custom tables...`);
    
    for (const table of customTables) {
      if (Date.now() - operationStart > MAX_OPERATION_TIME) break;
      
      try {
        console.log(`   🔎 Checking custom table: ${table}...`);
        const response = await withMCPTimeout(
          this.client.searchRecords(table, `sys_id=${sys_id}`, 1),
          3000,
          `Check custom table ${table}`
        );
        
        if (response.result?.[0]) {
          console.log(`   ✅ Found in custom table: ${table}`);
          return this.pullGenericArtifact(table, sys_id);
        }
      } catch (error) {
        // Silent fail for custom tables
      }
    }
    
    // Check if errors suggest OAuth/authentication issues
    const authErrors = errors.filter(({error}) => {
      const errorStr = error.toLowerCase();
      return errorStr.includes('401') || 
             errorStr.includes('unauthorized') || 
             errorStr.includes('token') || 
             errorStr.includes('oauth') ||
             errorStr.includes('authentication') ||
             errorStr.includes('access denied') ||
             errorStr.includes('forbidden') && errorStr.includes('token');
    });
    
    if (authErrors.length > 0) {
      console.log(`\n🔐 OAuth/Authentication Error Detected!`);
      console.log(`❌ All API calls are failing with authentication errors`);
      console.log(`\n⚠️ Authentication errors:`);
      authErrors.forEach(({table, error}) => {
        console.log(`   ${table}: ${error}`);
      });
      console.log(`\n🔧 OAuth Token Resolution Steps:`);
      console.log(`   1. Your OAuth token has expired or is invalid`);
      console.log(`   2. Run: snow-flow auth login`);
      console.log(`   3. Or check if your ServiceNow instance is accessible`);
      console.log(`   4. Verify your client credentials are correct`);
      
      throw new Error(`OAuth authentication failed. Your ServiceNow access token has expired or is invalid. Please run 'snow-flow auth login' to re-authenticate.`);
    }
    
    // Generate detailed error message for non-auth errors
    console.log(`\n❌ Artifact detection failed!`);
    console.log(`🔍 Searched sys_metadata + ${tables.length} registered tables + ${customTables.length} custom tables`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️ Errors encountered:`);
      errors.forEach(({table, error}) => {
        console.log(`   ${table}: ${error}`);
      });
    }
    
    console.log(`\n💡 Troubleshooting tips:`);
    console.log(`   1. Verify the sys_id exists in ServiceNow`);
    console.log(`   2. Check your permissions for the target table`);
    console.log(`   3. Try specifying the table explicitly: snow_pull_artifact({sys_id, table: 'table_name'})`);
    console.log(`   4. The artifact might be in a custom or scoped application table`);
    
    throw new Error(`Could not find artifact with sys_id ${sys_id}. It may be in a custom table or you may lack permissions.`);
  }

  /**
   * Pull a generic artifact from an unknown/custom table
   * Creates a basic file structure for any ServiceNow record
   */
  async pullGenericArtifact(tableName: string, sys_id: string): Promise<LocalArtifact> {
    console.log(`\n🔧 Pulling generic artifact from custom table: ${tableName}`);
    
    try {
      // Fetch the record with all fields
      const response = await withMCPTimeout(
        this.client.searchRecords(tableName, `sys_id=${sys_id}`, 1),
        10000,
        `Fetch generic artifact from ${tableName}`
      );
      
      const record = response.result?.[0];
      if (!record) {
        throw new Error(`Record not found in ${tableName}`);
      }
      
      // Create a generic folder structure
      const name = record.name || record.short_description || record.sys_name || sys_id;
      const sanitizedName = this.sanitizeFilename(name);
      const artifactPath = path.join(this.baseDir, 'custom', tableName, sanitizedName);
      
      // Clean up existing files
      if (fs.existsSync(artifactPath)) {
        fs.rmSync(artifactPath, { recursive: true });
      }
      fs.mkdirSync(artifactPath, { recursive: true });
      
      const files: LocalFile[] = [];
      
      // Create JSON file with all fields
      const jsonFile = this.createLocalFile(
        artifactPath,
        `${sanitizedName}.json`,
        JSON.stringify(record, null, 2),
        'all_fields',
        'json'
      );
      files.push(jsonFile);
      
      // Extract common script fields if they exist
      const scriptFields = ['script', 'condition', 'script_plain', 'advanced', 
                          'client_script', 'server_script', 'template', 'body'];
      
      for (const field of scriptFields) {
        if (record[field] && typeof record[field] === 'string' && record[field].trim()) {
          const ext = field.includes('template') || field === 'body' ? 'html' : 'js';
          const scriptFile = this.createLocalFile(
            artifactPath,
            `${sanitizedName}.${field}.${ext}`,
            record[field],
            field,
            ext
          );
          files.push(scriptFile);
        }
      }
      
      // Create README
      const readmeContent = `# Generic Artifact: ${name}\n\n` +
        `**Table:** ${tableName}\n` +
        `**Sys ID:** ${sys_id}\n` +
        `**Created:** ${record.sys_created_on || 'Unknown'}\n` +
        `**Updated:** ${record.sys_updated_on || 'Unknown'}\n\n` +
        `## Notice\n\n` +
        `This is a generic artifact from a custom/unknown table.\n` +
        `Snow-Flow has created a basic file structure to allow editing.\n\n` +
        `## Files\n\n` +
        `- **${sanitizedName}.json** - Complete record data\n` +
        (files.length > 1 ? files.slice(1).map(f => 
          `- **${f.filename}** - ${f.field} field content\n`).join('') : '') +
        `\n## Push Support\n\n` +
        `Generic artifacts have limited push support. ` +
        `Only script fields will be updated when pushing back.\n`;
      
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
        sys_id: sys_id,
        name: name,
        type: `Custom (${tableName})`,
        tableName: tableName,
        localPath: artifactPath,
        files: files,
        metadata: record,
        syncStatus: 'synced',
        createdAt: new Date(),
        lastSyncedAt: new Date(),
        isGeneric: true  // Mark as generic for special handling
      };
      
      this.artifacts.set(sys_id, artifact);
      
      const relativePath = path.relative(process.cwd(), artifactPath);
      const displayPath = relativePath.startsWith('..') ? artifactPath : relativePath;
      
      console.log(`✅ Generic artifact pulled successfully!`);
      console.log(`📁 Location: ${displayPath}`);
      console.log(`📄 Files created:`);
      files.forEach(f => console.log(`   - ${f.filename} (${f.type})`));
      console.log(`\n⚠️ Note: This is a generic pull from a custom table.`);
      console.log(`   Full push support may be limited.`);
      
      return artifact;
      
    } catch (error) {
      console.error(`❌ Failed to pull generic artifact:`, error);
      throw error;
    }
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