#!/usr/bin/env node
/**
 * Claude Desktop Exporter - Export Snow-Flow MCP configuration to Claude Desktop
 * Handles automatic credential injection, backup, and merge operations
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
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
export async function exportToClaudeDesktop(options: ExportOptions): Promise<ExportResult> {
  try {
    console.log('🔍 Detecting Claude Desktop configuration location...');
    
    // Step 1: Detect Claude Desktop config location
    const claudeConfigPath = await detectClaudeDesktopConfigPath();
    const outputPath = options.outputPath || claudeConfigPath;
    
    if (!outputPath) {
      return {
        success: false,
        error: 'Could not detect Claude Desktop configuration location. Specify --output <path> manually.'
      };
    }
    
    console.log(`📂 Claude Desktop config: ${outputPath}`);
    
    // Step 2: Load .env credentials
    console.log('🔐 Loading credentials from .env file...');
    const credentials = await loadCredentialsFromEnv();
    
    if (credentials.missingCredentials && credentials.missingCredentials.length > 0) {
      return {
        success: false,
        error: 'Missing required credentials in .env file',
        missingCredentials: credentials.missingCredentials
      };
    }
    
    console.log(`✅ Credentials loaded for instance: ${credentials.instance}`);
    
    // Step 3: Load Snow-Flow MCP template
    console.log('📋 Loading Snow-Flow MCP template...');
    const mcpTemplate = await loadSnowFlowMCPTemplate();
    
    // Step 4: Inject credentials into template
    console.log('💉 Injecting credentials into MCP configuration...');
    const mcpConfig = injectCredentials(mcpTemplate, credentials);
    
    // Step 5: Handle existing config (backup/merge)
    let existingConfig = null;
    let backupPath = null;
    
    if (fs.existsSync(outputPath)) {
      console.log('📁 Existing Claude Desktop config found');
      
      if (options.backup) {
        backupPath = await createBackup(outputPath);
        console.log(`🗃️ Backup created: ${backupPath}`);
      }
      
      if (options.merge) {
        console.log('🔗 Merging configurations...');
        existingConfig = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      }
    }
    
    // Step 6: Generate final config
    const finalConfig = options.merge && existingConfig ? 
      mergeConfigurations(existingConfig, mcpConfig) : mcpConfig;
    
    // Step 7: Write config (or dry run)
    if (options.dryRun) {
      console.log('🔬 DRY RUN - Preview of configuration:');
      console.log(JSON.stringify(finalConfig, null, 2));
    } else {
      // Ensure directory exists
      const configDir = path.dirname(outputPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        console.log(`📁 Created directory: ${configDir}`);
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(finalConfig, null, 2));
      console.log(`✅ Configuration written to: ${outputPath}`);
    }
    
    return {
      success: true,
      configPath: outputPath,
      backupPath: backupPath,
      merged: !!options.merge,
      existingServers: existingConfig ? Object.keys(existingConfig.mcpServers || {}).length : 0,
      credentials: {
        instance: credentials.instance,
        clientId: credentials.clientId ? '[CONFIGURED]' : '[MISSING]',
        clientSecret: credentials.clientSecret ? '[CONFIGURED]' : '[MISSING]'
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Export failed: ${error}`
    };
  }
}

/**
 * Detect Claude Desktop configuration path for different platforms
 */
async function detectClaudeDesktopConfigPath(): Promise<string | null> {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin': // macOS
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    
    case 'win32': // Windows
      return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    
    case 'linux': // Linux
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    
    default:
      return null;
  }
}

/**
 * Load credentials from .env file
 */
async function loadCredentialsFromEnv(): Promise<any> {
  const envPath = path.join(process.cwd(), '.env');
  const missingCredentials: string[] = [];
  
  if (!fs.existsSync(envPath)) {
    return {
      missingCredentials: ['SNOW_INSTANCE', 'SNOW_CLIENT_ID', 'SNOW_CLIENT_SECRET']
    };
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars: { [key: string]: string } = {};
  
  // Parse .env file
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
  
  // Check required credentials
  const requiredCreds = ['SNOW_INSTANCE', 'SNOW_CLIENT_ID', 'SNOW_CLIENT_SECRET'];
  
  requiredCreds.forEach(cred => {
    if (!envVars[cred]) {
      missingCredentials.push(cred);
    }
  });
  
  return {
    instance: envVars.SNOW_INSTANCE,
    clientId: envVars.SNOW_CLIENT_ID,
    clientSecret: envVars.SNOW_CLIENT_SECRET,
    missingCredentials: missingCredentials.length > 0 ? missingCredentials : null
  };
}

/**
 * Load Snow-Flow MCP template
 */
async function loadSnowFlowMCPTemplate(): Promise<any> {
  // Try to load from current project
  let templatePath = path.join(process.cwd(), '.mcp.json.template');
  
  if (!fs.existsSync(templatePath)) {
    // Try to load from Snow-Flow installation (global npm package)
    const globalSnowFlowPath = path.join(os.homedir(), '.nvm', 'versions', 'node', process.version, 'lib', 'node_modules', 'snow-flow');
    templatePath = path.join(globalSnowFlowPath, '.mcp.json.template');
  }
  
  if (!fs.existsSync(templatePath)) {
    throw new Error('Snow-Flow MCP template not found. Run "snow-flow init" first.');
  }
  
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  return JSON.parse(templateContent);
}

/**
 * Inject credentials into MCP configuration
 */
function injectCredentials(mcpTemplate: any, credentials: any): any {
  const configJson = JSON.stringify(mcpTemplate, null, 2)
    .replace(/\{\{SNOW_INSTANCE\}\}/g, credentials.instance)
    .replace(/\{\{SNOW_CLIENT_ID\}\}/g, credentials.clientId)
    .replace(/\{\{SNOW_CLIENT_SECRET\}\}/g, credentials.clientSecret)
    .replace(/\{\{PROJECT_ROOT\}\}/g, path.join(os.homedir(), '.nvm', 'versions', 'node', process.version, 'lib', 'node_modules', 'snow-flow'))
    .replace(/\{\{SNOW_DEPLOYMENT_TIMEOUT\}\}/g, '300000')
    .replace(/\{\{MCP_DEPLOYMENT_TIMEOUT\}\}/g, '30000');
  
  return JSON.parse(configJson);
}

/**
 * Create backup of existing Claude Desktop config
 */
async function createBackup(configPath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = configPath.replace('.json', `_backup_${timestamp}.json`);
  
  fs.copyFileSync(configPath, backupPath);
  return backupPath;
}

/**
 * Merge Snow-Flow config with existing Claude Desktop config
 */
function mergeConfigurations(existing: any, snowFlow: any): any {
  const merged = {
    ...existing,
    mcpServers: {
      ...existing.mcpServers,
      ...snowFlow.servers  // Snow-Flow uses 'servers' key, Claude Desktop uses 'mcpServers'
    }
  };
  
  return merged;
}