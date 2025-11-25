import { Command } from 'commander';
import * as prompts from '@clack/prompts';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { Logger } from '../utils/logger.js';
import { existsSync, chmodSync } from 'fs';
import {
  addEnterpriseMcpServer,
  isEnterpriseMcpConfigured,
  type EnterpriseMcpConfig,
} from '../config/snow-code-config.js';
import { validateLicenseKey } from '../mcp/enterprise-proxy/proxy.js';
import { syncMcpConfigs } from '../utils/sync-mcp-configs.js';

const authLogger = new Logger('auth');

// Helper function to fix binary permissions (critical for containers/codespaces)
function fixSnowCodeBinaryPermissions(): void {
  try {
    const platforms = [
      'snow-code-darwin-arm64',
      'snow-code-darwin-x64',
      'snow-code-linux-arm64',
      'snow-code-linux-x64',
      'snow-code-windows-x64'
    ];

    platforms.forEach(platform => {
      // Try both global and local node_modules
      const paths = [
        path.join(process.cwd(), 'node_modules', '@groeimetai', platform, 'bin', 'snow-code'),
        path.join(os.homedir(), '.npm', '_npx', 'node_modules', '@groeimetai', platform, 'bin', 'snow-code'),
        path.join(__dirname, '..', '..', 'node_modules', '@groeimetai', platform, 'bin', 'snow-code')
      ];

      paths.forEach(binaryPath => {
        if (existsSync(binaryPath)) {
          try {
            chmodSync(binaryPath, 0o755);
            authLogger.debug(`Fixed permissions for ${platform}`);
          } catch (err) {
            // Silently continue if chmod fails
          }
        }
      });
    });
  } catch (error) {
    // Silently continue if permission fixing fails
  }
}

/**
 * Enterprise License Flow
 * Prompts user for enterprise license and configures enterprise MCP server
 */
async function enterpriseLicenseFlow(): Promise<void> {
  try {
    // Check if already configured
    const alreadyConfigured = await isEnterpriseMcpConfigured();

    if (alreadyConfigured) {
      const reconfigure = await prompts.confirm({
        message: 'Enterprise MCP server is already configured. Reconfigure?',
        initialValue: false,
      });

      if (prompts.isCancel(reconfigure) || !reconfigure) {
        authLogger.debug('Skipping enterprise configuration (already configured)');
        return;
      }
    }

    // Ask if user has enterprise license
    const hasEnterprise = await prompts.confirm({
      message: 'Do you have a Snow-Flow Enterprise license?',
      initialValue: false,
    });

    if (prompts.isCancel(hasEnterprise) || !hasEnterprise) {
      authLogger.debug('Skipping enterprise configuration (user does not have license)');
      return;
    }

    // Prompt for license key
    const licenseKey = await prompts.text({
      message: 'Enter your Enterprise License Key:',
      placeholder: 'SNOW-ENT-CUST-ABC123',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'License key is required';
        }
        if (!value.startsWith('SNOW-ENT-') && !value.startsWith('SNOW-SI-')) {
          return 'License key must start with SNOW-ENT- or SNOW-SI-';
        }
        return undefined;
      },
    });

    if (prompts.isCancel(licenseKey)) {
      authLogger.debug('Enterprise configuration cancelled by user');
      return;
    }

    // Validate license key with enterprise server
    prompts.log.step('Validating enterprise license...');

    // Set license key temporarily for validation
    const originalLicenseKey = process.env.SNOW_LICENSE_KEY;
    process.env.SNOW_LICENSE_KEY = licenseKey;

    let validation: { valid: boolean; error?: string; features?: string[]; serverUrl?: string };

    try {
      validation = await validateLicenseKey(licenseKey);

      if (!validation.valid) {
        prompts.log.error(`License validation failed: ${validation.error || 'Unknown error'}`);
        authLogger.error(`License validation failed: ${validation.error}`);

        // Restore original license key
        if (originalLicenseKey) {
          process.env.SNOW_LICENSE_KEY = originalLicenseKey;
        } else {
          delete process.env.SNOW_LICENSE_KEY;
        }

        return;
      }

      prompts.log.success('✅ License validated successfully');
      authLogger.info('Enterprise license validated successfully');

      // Show available features
      if (validation.features && validation.features.length > 0) {
        prompts.log.info(`Available enterprise features: ${validation.features.join(', ')}`);
      }
    } catch (error: any) {
      prompts.log.error(`Failed to validate license: ${error.message}`);
      authLogger.error(`License validation error: ${error.message}`);

      // Restore original license key
      if (originalLicenseKey) {
        process.env.SNOW_LICENSE_KEY = originalLicenseKey;
      } else {
        delete process.env.SNOW_LICENSE_KEY;
      }

      return;
    }

    // Ask for user role (required for seat management and JWT generation)
    const role = await prompts.select({
      message: 'Select your role',
      options: [
        {
          value: 'developer',
          label: 'Developer (Full access)',
          hint: 'Full read/write access to all enterprise tools',
        },
        {
          value: 'stakeholder',
          label: 'Stakeholder (Read-only)',
          hint: 'Read-only access for managers and stakeholders',
        },
        {
          value: 'admin',
          label: 'Admin (Management)',
          hint: 'Administrative access for team leads',
        },
      ],
      initialValue: 'developer',
    });

    if (prompts.isCancel(role)) {
      authLogger.debug('Enterprise configuration cancelled by user');

      // Restore original license key
      if (originalLicenseKey) {
        process.env.SNOW_LICENSE_KEY = originalLicenseKey;
      } else {
        delete process.env.SNOW_LICENSE_KEY;
      }

      return;
    }

    // Ask about credential mode
    const credentialMode = await prompts.select({
      message: 'How would you like to provide enterprise credentials?',
      options: [
        {
          value: 'server',
          label: 'Server-side (credentials stored encrypted on enterprise server)',
          hint: 'Recommended - most secure, requires portal configuration',
        },
        {
          value: 'skip',
          label: 'Skip for now (configure credentials later in portal)',
        },
      ],
      initialValue: 'server',
    });

    if (prompts.isCancel(credentialMode)) {
      authLogger.debug('Enterprise configuration cancelled by user');

      // Restore original license key
      if (originalLicenseKey) {
        process.env.SNOW_LICENSE_KEY = originalLicenseKey;
      } else {
        delete process.env.SNOW_LICENSE_KEY;
      }

      return;
    }

    const enterpriseConfig: EnterpriseMcpConfig = {
      licenseKey,
      role: role as 'developer' | 'stakeholder' | 'admin',
      serverUrl: validation.serverUrl,
    };

    // Inform user about server-side credentials
    if (credentialMode === 'server') {
      prompts.log.info('💡 Credentials for Jira/Azure/Confluence are configured in the enterprise portal');
      prompts.log.info('   Visit: https://enterprise.snow-flow.dev to configure integrations');
    }

    // Add enterprise MCP server to SnowCode config (generates JWT)
    prompts.log.step('Generating enterprise JWT token...');

    await addEnterpriseMcpServer(enterpriseConfig);

    prompts.log.success('✅ Enterprise MCP server configured');
    prompts.log.info('Enterprise tools are now available in SnowCode CLI');

    authLogger.info('Enterprise MCP server configuration completed');

    // Update documentation with enterprise features
    // Enterprise license includes all integrations by default
    const defaultEnterpriseServices = ['jira', 'azdo', 'confluence'];
    await updateDocumentationWithEnterprise(defaultEnterpriseServices);
  } catch (error: any) {
    if (error.message.includes('.mcp.json not found')) {
      prompts.log.error('⚠️  Project not initialized');
      prompts.log.message('');
      prompts.log.info('💡 Next steps:');
      prompts.log.message('  1. Run: snow-flow init');
      prompts.log.message('  2. Then run: snow-flow auth login (to configure enterprise)');
      prompts.log.message('');
    } else {
      prompts.log.error(`Enterprise configuration failed: ${error.message}`);
    }
    authLogger.error(`Enterprise configuration error: ${error.message}`);
  }
}

/**
 * Update project documentation (CLAUDE.md and AGENTS.md) with enterprise server information
 * Replaces any existing enterprise section with the new comprehensive instructions
 */
async function updateDocumentationWithEnterprise(enabledServices?: string[]): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    const agentsMdPath = path.join(projectRoot, 'AGENTS.md');

    // Use the comprehensive enterprise instructions from enterprise-docs-generator.ts
    let enterpriseDocSection = '';

    if (enabledServices && enabledServices.length > 0) {
      const { generateEnterpriseInstructions } = await import('./enterprise-docs-generator.js');
      enterpriseDocSection = generateEnterpriseInstructions(enabledServices);
    } else {
      authLogger.warn('No enterprise services specified, skipping documentation update');
      return;
    }

    // Helper function to remove existing enterprise sections
    const removeExistingEnterpriseSections = (content: string): string => {
      // Remove old comprehensive enterprise section (from enterprise-docs-generator)
      const comprehensiveStart = content.indexOf('# 🚀 ENTERPRISE INTEGRATIONS - AUTONOMOUS DEVELOPMENT WORKFLOW');
      if (comprehensiveStart !== -1) {
        // Find the end - it ends before the next major section or at EOF
        const afterStart = content.slice(comprehensiveStart);
        const nextMajorSection = afterStart.search(/\n# [^🚀]/); // Next # that's not the enterprise header
        if (nextMajorSection !== -1) {
          content = content.slice(0, comprehensiveStart) + content.slice(comprehensiveStart + nextMajorSection);
        } else {
          content = content.slice(0, comprehensiveStart);
        }
      }

      // Remove old simple enterprise section (## 🚀 Enterprise Features)
      const simpleStart = content.indexOf('## 🚀 Enterprise Features');
      if (simpleStart !== -1) {
        const afterSimple = content.slice(simpleStart);
        const nextSection = afterSimple.search(/\n## [^🚀]/);
        if (nextSection !== -1) {
          content = content.slice(0, simpleStart) + content.slice(simpleStart + nextSection);
        } else {
          content = content.slice(0, simpleStart);
        }
      }

      // Clean up multiple consecutive newlines
      content = content.replace(/\n{4,}/g, '\n\n\n');

      return content.trim();
    };

    // Update CLAUDE.md
    try {
      await fs.access(claudeMdPath);
      let claudeContent = await fs.readFile(claudeMdPath, 'utf-8');

      // Remove existing enterprise sections
      claudeContent = removeExistingEnterpriseSections(claudeContent);

      // Find the best insertion point (before "## 🎓 FINAL MANDATE" or at the end)
      let insertionPoint = claudeContent.indexOf('## 🎓 FINAL MANDATE');
      if (insertionPoint === -1) {
        insertionPoint = claudeContent.lastIndexOf('---');
        if (insertionPoint === -1) {
          insertionPoint = claudeContent.length;
        }
      }

      const updatedContent =
        claudeContent.slice(0, insertionPoint) +
        enterpriseDocSection +
        '\n\n' +
        claudeContent.slice(insertionPoint);

      await fs.writeFile(claudeMdPath, updatedContent, 'utf-8');
      authLogger.info('✅ Updated CLAUDE.md with enterprise features documentation');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        authLogger.debug(`Could not update CLAUDE.md: ${err.message}`);
      }
    }

    // Update AGENTS.md
    try {
      await fs.access(agentsMdPath);
      let agentsContent = await fs.readFile(agentsMdPath, 'utf-8');

      // Remove existing enterprise sections
      agentsContent = removeExistingEnterpriseSections(agentsContent);

      // Find the best insertion point (before "## 🎓 FINAL MANDATE" or at the end)
      let insertionPoint = agentsContent.indexOf('## 🎓 FINAL MANDATE');
      if (insertionPoint === -1) {
        insertionPoint = agentsContent.lastIndexOf('---');
        if (insertionPoint === -1) {
          insertionPoint = agentsContent.length;
        }
      }

      const updatedContent =
        agentsContent.slice(0, insertionPoint) +
        enterpriseDocSection +
        '\n\n' +
        agentsContent.slice(insertionPoint);

      await fs.writeFile(agentsMdPath, updatedContent, 'utf-8');
      authLogger.info('✅ Updated AGENTS.md with enterprise features documentation');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        authLogger.debug(`Could not update AGENTS.md: ${err.message}`);
      }
    }

    prompts.log.success('✅ Documentation updated with comprehensive enterprise workflow instructions');
  } catch (error: any) {
    authLogger.warn(`Failed to update documentation: ${error.message}`);
    // Don't throw - this is not critical
  }
}

/**
 * Setup Enterprise Flow
 * DEPRECATED: Enterprise setup is now integrated into snow-code auth flow
 * This function redirects users to use snow-code auth login instead
 */
export async function setupEnterpriseFlow(): Promise<void> {
  prompts.log.message('');
  prompts.log.info('⚠️  Enterprise setup has moved to snow-code auth flow');
  prompts.log.message('');
  prompts.log.info('Please use: snow-code auth login');
  prompts.log.info('Then select "enterprise" when prompted for authentication provider');
  prompts.log.message('');
}

/**
 * Ensure auth.json is in the correct location (snow-code with dash, not snowcode without)
 *
 * Snow-code binary may create auth.json at ~/.local/share/snowcode/ (without dash)
 * but the correct location is ~/.local/share/snow-code/ (with dash).
 * This function moves it if needed and creates a symlink for compatibility.
 */
async function ensureCorrectAuthLocation(): Promise<void> {
  try {
    const correctPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');
    const incorrectPath = path.join(os.homedir(), '.local', 'share', 'snowcode', 'auth.json');

    // Check if file exists at incorrect location
    try {
      const stats = await fs.lstat(incorrectPath);

      // If it's already a symlink pointing to the correct location, we're done
      if (stats.isSymbolicLink()) {
        const linkTarget = await fs.readlink(incorrectPath);
        if (linkTarget === correctPath || path.resolve(path.dirname(incorrectPath), linkTarget) === correctPath) {
          authLogger.debug('Symlink already exists at correct location');
          return;
        }
      }

      // File exists at wrong location and is NOT a symlink - move it
      authLogger.info('Found auth.json at incorrect location (snowcode/ without dash)');
      authLogger.info('Moving to correct location (snow-code/ with dash)...');

      // Ensure correct directory exists
      const correctDir = path.dirname(correctPath);
      await fs.mkdir(correctDir, { recursive: true });

      // Copy file to correct location
      await fs.copyFile(incorrectPath, correctPath);
      authLogger.info(`✅ Moved auth.json to: ${correctPath}`);

      // Create symlink at old location for backwards compatibility
      try {
        const incorrectDir = path.dirname(incorrectPath);
        await fs.mkdir(incorrectDir, { recursive: true });

        // Remove old file after successful copy
        await fs.unlink(incorrectPath);

        // Create symlink
        await fs.symlink(correctPath, incorrectPath);
        authLogger.debug('Created symlink for backwards compatibility');
      } catch (symlinkError: any) {
        // Symlink creation failed, but that's OK - just log it
        authLogger.debug(`Could not create symlink: ${symlinkError.message}`);
      }

      prompts.log.success('✅ Auth credentials stored at correct location');
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // File doesn't exist at incorrect location - check if it's already at correct location
        try {
          await fs.access(correctPath);
          authLogger.debug('Auth.json already at correct location');
        } catch {
          authLogger.debug('Auth.json not found at either location (will be created on next auth)');
        }
      }
    }
  } catch (error: any) {
    authLogger.warn(`Failed to ensure correct auth location: ${error.message}`);
    // Don't throw - this is not critical enough to fail the auth process
  }
}

/**
 * Update PROJECT-LEVEL MCP server config with ServiceNow credentials from auth.json
 *
 * IMPORTANT: This function ONLY updates project-level .mcp.json, NOT global config!
 * Each snow-flow project maintains its own isolated MCP configuration.
 */
async function updateMCPServerConfig() {
  try {
    // Read SnowCode auth.json
    const authPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');

    // Check if auth.json exists
    try {
      await fs.access(authPath);
    } catch {
      authLogger.debug('auth.json does not exist yet, skipping MCP config update');
      return;
    }

    const authJson = JSON.parse(await fs.readFile(authPath, 'utf-8'));

    // Check if ServiceNow credentials exist
    const servicenowCreds = authJson['servicenow'];
    if (!servicenowCreds || servicenowCreds.type !== 'servicenow-oauth') {
      authLogger.debug('No ServiceNow OAuth credentials found in auth.json');
      return;
    }

    // Update PROJECT-LEVEL .mcp.json ONLY (no global config!)
    const projectMcpPath = path.join(process.cwd(), '.mcp.json');
    try {
      await fs.access(projectMcpPath);

      const projectMcp = JSON.parse(await fs.readFile(projectMcpPath, 'utf-8'));

      // Support both .mcpServers and .servers key formats (OpenCode vs Claude Desktop)
      const serversKey = projectMcp.mcpServers ? 'mcpServers' : 'servers';

      if (projectMcp[serversKey] && projectMcp[serversKey]['servicenow-unified']) {
        const server = projectMcp[serversKey]['servicenow-unified'];

        // Support both "environment" (OpenCode) and "env" (Claude Desktop) keys
        const envKey = server.environment !== undefined ? 'environment' : 'env';

        if (!server[envKey]) {
          server[envKey] = {};
        }

        // Update credentials in the environment object
        server[envKey]['SERVICENOW_INSTANCE_URL'] = servicenowCreds.instance;
        server[envKey]['SERVICENOW_CLIENT_ID'] = servicenowCreds.clientId;
        server[envKey]['SERVICENOW_CLIENT_SECRET'] = servicenowCreds.clientSecret;

        await fs.writeFile(projectMcpPath, JSON.stringify(projectMcp, null, 2), 'utf-8');

        prompts.log.success('✅ Updated project .mcp.json with ServiceNow credentials');
      } else {
        authLogger.debug('No servicenow-unified MCP server found in project .mcp.json');
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        authLogger.warn('Project .mcp.json not found. Run "snow-flow init" to create one.');
        prompts.log.warn('⚠️  No .mcp.json found in current directory');
        prompts.log.info('💡 Run: snow-flow init');
      } else {
        authLogger.debug(`Could not update project .mcp.json: ${err.message}`);
      }
    }
  } catch (error: any) {
    authLogger.warn(`Failed to update MCP server config: ${error.message}`);
    // Don't throw - this is not critical
  }
}

export function registerAuthCommands(program: Command) {
  const auth = program.command('auth').description('Authentication management (powered by SnowCode)');

  // List available models for a provider
  auth
    .command('models')
    .description('List available models for LLM providers')
    .option('-p, --provider <provider>', 'Provider to list models for (anthropic, openai, google, ollama)')
    .action(async (options) => {
      const { getAllProviderModels, getProviderModels } = await import('../utils/dynamic-models.js');

      prompts.log.step('Available LLM Models');

      if (options.provider) {
        // List models for specific provider
        prompts.log.info(`${options.provider.toUpperCase()}:`);
        const models = await getProviderModels(options.provider);

        if (models.length > 0) {
          models.forEach((model, i) => {
            prompts.log.message(`  ${i + 1}. ${model.name}`);
            prompts.log.message(`     ID: ${model.value}`);
            if (model.contextWindow) {
              prompts.log.message(`     Context: ${model.contextWindow.toLocaleString()} tokens`);
            }
            prompts.log.message('');
          });
        } else {
          prompts.log.warn('  No models available for this provider');
        }
      } else {
        // List all providers
        const allModels = await getAllProviderModels();

        for (const [provider, models] of Object.entries(allModels)) {
          prompts.log.info(`${provider.toUpperCase()}:`);

          if (models.length > 0) {
            models.forEach((model, i) => {
              prompts.log.message(`  ${i + 1}. ${model.name}`);
              prompts.log.message(`     ID: ${model.value}`);
              prompts.log.message('');
            });
          } else {
            prompts.log.warn('  No models available');
          }
        }
      }

      prompts.log.message('Tip: Use --provider to see models for a specific provider');
      prompts.log.message('Example: snow-flow auth models --provider anthropic');
    });

  // Login - delegate to SnowCode
  auth
    .command('login')
    .description('Authenticate with LLM providers, ServiceNow, and Enterprise (via SnowCode)')
    .action(async () => {
      try {
        // Check if snowcode is installed
        try {
          execSync('which snow-code', { stdio: 'ignore' });
        } catch {
          prompts.log.error('SnowCode is not installed');
          prompts.log.warn('Please run: npm install -g snow-flow');
          prompts.log.info('This will install both snow-flow and snow-code');
          return;
        }

        // Determine which SnowCode to use: prefer local, fallback to global
        const localSnowCode = path.join(process.cwd(), 'node_modules', '@groeimetai', 'snow-code', 'bin', 'snow-code');
        let snowcodeCommand = 'snow-code'; // fallback to global

        try {
          const fs = require('fs');
          if (fs.existsSync(localSnowCode)) {
            snowcodeCommand = localSnowCode;
            authLogger.debug('Using local SnowCode installation');
          }
        } catch {
          authLogger.debug('Using global SnowCode installation');
        }

        prompts.intro('🚀 Starting authentication flow (powered by SnowCode)');

        // Fix binary permissions before calling snow-code (critical for containers/codespaces)
        fixSnowCodeBinaryPermissions();

        // Call SnowCode auth login for LLM providers and ServiceNow OAuth
        execSync(`${snowcodeCommand} auth login`, { stdio: 'inherit' });

        // Post-processing: Ensure auth.json is in correct location
        await ensureCorrectAuthLocation();

        // Update MCP server config with ServiceNow credentials
        await updateMCPServerConfig();

        // 🔥 FIX: After snow-code auth login, check if enterprise was configured
        // If so, we need to convert LOCAL config to REMOTE config with JWT
        const authPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');
        try {
          const authJson = JSON.parse(await fs.readFile(authPath, 'utf-8'));
          const enterpriseCreds = authJson['enterprise'];

          if (enterpriseCreds && enterpriseCreds.type === 'enterprise') {
            prompts.log.message('');
            prompts.log.step('Converting enterprise configuration to MCP-compatible format...');

            // Use role from auth.json (already asked by snow-code)
            const role = enterpriseCreds.role || 'developer';
            authLogger.info(`Using role from snow-code auth: ${role}`);

            // Convert to JWT-based MCP config
            // IMPORTANT: portal.snow-flow.dev handles BOTH portal AND MCP auth
            await addEnterpriseMcpServer({
              licenseKey: enterpriseCreds.licenseKey,
              role: role as 'developer' | 'stakeholder' | 'admin',
              serverUrl: 'https://portal.snow-flow.dev',  // ← Portal server handles MCP auth
            });

            prompts.log.success('✅ Enterprise MCP server configured with JWT authentication');
            prompts.log.info('   Enterprise tools are now available via LOCAL proxy connection');

            // 🔥 CRITICAL FIX: Sync .mcp.json to .claude/mcp-config.json
            // This ensures Claude Code sees the enterprise server when running swarm commands
            try {
              prompts.log.step('Syncing MCP configurations for Claude Code...');
              await syncMcpConfigs(process.cwd());
              prompts.log.success('✅ MCP configurations synced - enterprise tools ready for swarm command');
            } catch (syncErr: any) {
              prompts.log.warn(`⚠️  MCP config sync warning: ${syncErr.message}`);
              authLogger.warn(`MCP sync error: ${syncErr.message}`);
            }
          }
        } catch (err: any) {
          // Show warning if enterprise configuration failed
          if (err.message && err.message.includes('.mcp.json not found')) {
            prompts.log.message('');
            prompts.log.warn('⚠️  Enterprise MCP configuration skipped');
            prompts.log.info('   Run "snow-flow init" first to create .mcp.json');
            prompts.log.info('   Then run "snow-flow auth login" again to enable enterprise tools');
          } else if (err.message && !err.message.includes('ENOENT')) {
            // Only show error if it's not just "file doesn't exist"
            prompts.log.message('');
            prompts.log.warn('⚠️  Enterprise MCP configuration failed');
            prompts.log.info(`   ${err.message}`);
            authLogger.error(`Enterprise MCP configuration error: ${err.stack || err.message}`);
          } else {
            // Silently continue for expected cases (no auth.json, no enterprise creds)
            authLogger.debug(`Enterprise conversion check: ${err.message}`);
          }
        }

        // 🔥 ALWAYS sync MCP configs after auth login completes
        // This ensures .claude/mcp-config.json is up-to-date even if enterprise wasn't configured
        try {
          authLogger.debug('Final MCP config sync after auth completion');
          await syncMcpConfigs(process.cwd());
        } catch (syncErr: any) {
          // Silent - already logged above if enterprise was configured
          authLogger.debug(`Final sync: ${syncErr.message}`);
        }
      } catch (error: any) {
        // Error details are already shown via stdio: 'inherit'
        // Only provide helpful context here
        prompts.log.message('');

        if (error.code === 'ENOENT') {
          prompts.log.error('SnowCode command not found');
          prompts.log.info('Please ensure snow-code is properly installed');
        } else {
          prompts.log.error('Authentication process was interrupted or failed');

          if (error.status) {
            prompts.log.info(`Exit code: ${error.status}`);
          }

          prompts.log.message('');
          prompts.log.info('💡 Troubleshooting tips:');
          prompts.log.message('  • Check your license key format (SNOW-ENT-* or SNOW-SI-*)');
          prompts.log.message('  • Verify enterprise server is accessible');
          prompts.log.message('  • Try running: snow-code auth login (for detailed errors)');
          prompts.log.message('  • Check logs in ~/.local/share/snow-code/');
        }

        prompts.log.message('');
      }
    });

  // List credentials
  auth
    .command('list')
    .alias('ls')
    .description('List configured credentials (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        execSync('snow-code auth list', { stdio: 'inherit' });
      } catch (error: any) {
        prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
      }
    });

  // Logout
  auth
    .command('logout')
    .description('Log out from a configured provider (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        execSync('snow-code auth logout', { stdio: 'inherit' });
      } catch (error: any) {
        prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
      }
    });

  // Provider - configure LLM provider only
  auth
    .command('provider')
    .description('Configure LLM provider and model only (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        prompts.intro('🤖 Configure LLM Provider (powered by SnowCode)');
        execSync('snow-code auth provider', { stdio: 'inherit' });
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
        } else {
          prompts.log.error('Provider configuration was interrupted or failed');
        }
      }
    });

  // ServiceNow - configure ServiceNow connection only
  auth
    .command('servicenow')
    .description('Configure ServiceNow connection only (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        prompts.intro('❄️ Configure ServiceNow (powered by SnowCode)');
        execSync('snow-code auth servicenow', { stdio: 'inherit' });

        // Post-processing: Ensure auth.json is in correct location
        await ensureCorrectAuthLocation();

        // Update MCP server config with ServiceNow credentials
        await updateMCPServerConfig();

        // Sync MCP configs for Claude Code
        try {
          await syncMcpConfigs(process.cwd());
        } catch (syncErr: any) {
          authLogger.debug(`MCP sync: ${syncErr.message}`);
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
        } else {
          prompts.log.error('ServiceNow configuration was interrupted or failed');
        }
      }
    });

  // Integrations - configure third-party tools only
  auth
    .command('integrations')
    .description('Configure third-party integrations (Jira, Azure DevOps, Confluence) via SnowCode')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        prompts.intro('🔗 Configure Third-Party Integrations (powered by SnowCode)');
        execSync('snow-code auth integrations', { stdio: 'inherit' });

        // Post-processing: Check if enterprise was configured and sync MCP
        const authPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');
        try {
          const authJson = JSON.parse(await fs.readFile(authPath, 'utf-8'));
          const enterpriseCreds = authJson['enterprise'];

          if (enterpriseCreds && enterpriseCreds.type === 'enterprise' && enterpriseCreds.licenseKey) {
            // Re-configure enterprise MCP server with updated credentials
            await addEnterpriseMcpServer({
              licenseKey: enterpriseCreds.licenseKey,
              role: (enterpriseCreds.role || 'developer') as 'developer' | 'stakeholder' | 'admin',
              serverUrl: enterpriseCreds.enterpriseUrl || 'https://portal.snow-flow.dev',
            });

            // Sync MCP configs
            await syncMcpConfigs(process.cwd());
            prompts.log.success('✅ MCP configurations synced with new integrations');
          }
        } catch (err: any) {
          authLogger.debug(`Integration sync: ${err.message}`);
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
        } else {
          prompts.log.error('Integration configuration was interrupted or failed');
        }
      }
    });

  // Enterprise Login - device authorization flow
  auth
    .command('enterprise-login')
    .description('Authenticate with Snow-Flow Enterprise using browser (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        prompts.intro('🏢 Snow-Flow Enterprise Login (powered by SnowCode)');
        execSync('snow-code auth enterprise-login', { stdio: 'inherit' });
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
        } else {
          prompts.log.error('Enterprise login was interrupted or failed');
        }
      }
    });

  // Enterprise Sync - re-sync credentials from portal
  auth
    .command('enterprise-sync')
    .description('Re-sync enterprise credentials from portal (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        execSync('snow-code auth enterprise-sync', { stdio: 'inherit' });
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
        } else {
          prompts.log.error('Enterprise sync was interrupted or failed');
        }
      }
    });

  // Enterprise Status - show current enterprise status
  auth
    .command('enterprise-status')
    .description('Show enterprise authentication status (via SnowCode)')
    .action(async () => {
      try {
        fixSnowCodeBinaryPermissions();
        execSync('snow-code auth enterprise-status', { stdio: 'inherit' });
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          prompts.log.error('SnowCode is not installed. Run: npm install -g snow-flow');
        } else {
          prompts.log.error('Enterprise status check failed');
        }
      }
    });

  // Sync credentials to portal
  auth
    .command('sync')
    .description('Sync local credentials to Enterprise Portal')
    .action(async () => {
      prompts.intro('Credential Sync');

      try {
        // Read .env file from current directory
        const envPath = path.join(process.cwd(), '.env');
        const envContent = await fs.readFile(envPath, 'utf-8');

        // Parse environment variables
        const envVars: Record<string, string> = {};
        envContent.split('\n').forEach(line => {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
          }
        });

        const licenseKey = envVars.SNOW_ENTERPRISE_LICENSE_KEY;
        const enterpriseUrl = envVars.SNOW_ENTERPRISE_URL || 'https://portal.snow-flow.dev';

        if (!licenseKey) {
          prompts.log.error('No enterprise license key found in .env');
          prompts.outro('Sync failed');
          return;
        }

        // Login first to get customer token
        prompts.log.step('Authenticating with enterprise portal...');

        const username = envVars.SNOW_ENTERPRISE_USERNAME;
        const password = envVars.SNOW_ENTERPRISE_PASSWORD;

        if (!username || !password) {
          prompts.log.error('Username or password not found in .env');
          prompts.log.info('Add SNOW_ENTERPRISE_USERNAME and SNOW_ENTERPRISE_PASSWORD to .env');
          prompts.outro('Sync failed');
          return;
        }

        const loginResponse = await fetch(`${enterpriseUrl}/api/user-auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey, username, password })
        });

        const loginData: any = await loginResponse.json();

        if (!loginResponse.ok || !loginData.success) {
          prompts.log.error('Authentication failed: ' + (loginData.error || 'Invalid credentials'));
          prompts.outro('Sync failed');
          return;
        }

        const token: string = loginData.token;
        const credentialsToSync: Array<{ service: string; data: any }> = [];

        // Check Jira credentials
        if (envVars.SNOW_JIRA_BASE_URL && envVars.SNOW_JIRA_EMAIL && envVars.SNOW_JIRA_API_TOKEN) {
          credentialsToSync.push({
            service: 'jira',
            data: {
              service: 'jira',
              username: envVars.SNOW_JIRA_EMAIL,
              apiToken: envVars.SNOW_JIRA_API_TOKEN,
              instanceUrl: envVars.SNOW_JIRA_BASE_URL
            }
          });
        }

        // Check Azure DevOps credentials
        if (envVars.SNOW_AZURE_ORG && envVars.SNOW_AZURE_PAT) {
          credentialsToSync.push({
            service: 'azdo',
            data: {
              service: 'azdo',
              username: envVars.SNOW_AZURE_ORG,
              apiToken: envVars.SNOW_AZURE_PAT,
              instanceUrl: `https://dev.azure.com/${envVars.SNOW_AZURE_ORG}`
            }
          });
        }

        // Check Confluence credentials
        if (envVars.SNOW_CONFLUENCE_BASE_URL && envVars.SNOW_CONFLUENCE_EMAIL && envVars.SNOW_CONFLUENCE_API_TOKEN) {
          credentialsToSync.push({
            service: 'confluence',
            data: {
              service: 'confluence',
              username: envVars.SNOW_CONFLUENCE_EMAIL,
              apiToken: envVars.SNOW_CONFLUENCE_API_TOKEN,
              instanceUrl: envVars.SNOW_CONFLUENCE_BASE_URL
            }
          });
        }

        if (credentialsToSync.length === 0) {
          prompts.log.warn('No credentials found in .env to sync');
          prompts.outro('Nothing to sync');
          return;
        }

        prompts.log.step(`Syncing ${credentialsToSync.length} credential(s)...`);

        // Sync each credential
        for (const cred of credentialsToSync) {
          try {
            const response = await fetch(`${enterpriseUrl}/api/credentials/store`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(cred.data)
            });

            const result: any = await response.json();

            if (response.ok && result.success) {
              prompts.log.success(`✓ ${cred.service} credentials synced`);
            } else {
              prompts.log.error(`✗ ${cred.service} failed: ${result.error || 'Unknown error'}`);
            }
          } catch (error: any) {
            prompts.log.error(`✗ ${cred.service} failed: ${error.message}`);
          }
        }

        prompts.log.message('');
        prompts.log.success('Credential sync complete!');
        prompts.log.info('View your credentials at: ' + enterpriseUrl + '/portal/credentials');

        // Update AGENTS.md and CLAUDE.md with enterprise workflow instructions
        prompts.log.message('');
        prompts.log.step('Updating project documentation with autonomous workflow...');

        const enabledServices = credentialsToSync.map(c => c.service);
        await updateDocumentationWithEnterprise(enabledServices);

        prompts.log.message('');
        prompts.log.info('📚 AI agents now have full autonomy over:');
        if (enabledServices.includes('jira')) {
          prompts.log.info('   • Jira: Story selection, updates, completion, commenting');
        }
        if (enabledServices.includes('azdo')) {
          prompts.log.info('   • Azure DevOps: Work item management, status updates');
        }
        if (enabledServices.includes('confluence')) {
          prompts.log.info('   • Confluence: Create & maintain documentation');
        }
        prompts.log.message('');
        prompts.log.info('Agents will automatically:');
        prompts.log.info('   1. Update stories in real-time during development');
        prompts.log.info('   2. Link Update Sets to stories');
        prompts.log.info('   3. Create comprehensive Confluence documentation');
        prompts.log.info('   4. Move stories to Done with full traceability');

        prompts.outro('Done');

      } catch (error: any) {
        if (error.code === 'ENOENT') {
          prompts.log.error('No .env file found in current directory');
          prompts.log.info('Run: snow-flow auth login first');
        } else {
          prompts.log.error('Sync failed: ' + error.message);
        }
        prompts.outro('Sync failed');
      }
    });
}
