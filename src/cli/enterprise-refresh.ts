/**
 * Enterprise JWT Refresh Command
 * Automatically regenerates JWT token with latest server configuration
 */

import * as prompts from '@clack/prompts';
import path from 'path';
import fs from 'fs/promises';
import { Logger } from '../utils/logger.js';
import { addEnterpriseMcpServer } from '../config/snow-code-config.js';
import os from 'os';

const logger = new Logger('enterprise-refresh');

/**
 * Refresh enterprise JWT token
 * This regenerates the JWT with the latest server configuration (KMS secrets)
 */
export async function refreshEnterpriseJWT(): Promise<void> {
  prompts.intro('🔄 Refreshing Enterprise JWT Token');

  try {
    // Check if .mcp.json exists
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
    try {
      await fs.access(mcpConfigPath);
    } catch {
      prompts.log.error('⚠️  No .mcp.json found in current directory');
      prompts.log.info('💡 Run: snow-flow init');
      prompts.outro('Failed to refresh JWT');
      return;
    }

    // Read existing .mcp.json to get license key
    const mcpContent = await fs.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(mcpContent);

    // Check if enterprise server is configured
    const enterpriseServer = mcpConfig.mcpServers?.['snow-flow-enterprise'];
    if (!enterpriseServer) {
      prompts.log.error('⚠️  Enterprise MCP server not configured');
      prompts.log.info('💡 Run: snow-flow auth login');
      prompts.outro('Failed to refresh JWT');
      return;
    }

    // Check snow-code auth.json for license key and role
    const authPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');
    let licenseKey: string;
    let role: 'developer' | 'stakeholder' | 'admin';

    try {
      const authJson = JSON.parse(await fs.readFile(authPath, 'utf-8'));
      const enterpriseCreds = authJson['enterprise'];

      if (!enterpriseCreds || enterpriseCreds.type !== 'enterprise') {
        throw new Error('Enterprise credentials not found in auth.json');
      }

      licenseKey = enterpriseCreds.licenseKey;
      role = enterpriseCreds.role || 'developer';
    } catch (err: any) {
      prompts.log.error('⚠️  Enterprise credentials not found');
      prompts.log.info('💡 Run: snow-flow auth login');
      prompts.outro('Failed to refresh JWT');
      return;
    }

    prompts.log.step('Regenerating JWT token with latest server configuration...');

    // Regenerate JWT using addEnterpriseMcpServer
    await addEnterpriseMcpServer({
      licenseKey,
      role,
      serverUrl: 'https://portal.snow-flow.dev',
    });

    prompts.log.success('✅ JWT token refreshed successfully!');
    prompts.log.message('');
    prompts.log.info('🎉 Enterprise tools are now ready with updated authentication');
    prompts.log.info('   The JWT has been regenerated with the latest server configuration');
    prompts.log.message('');
    prompts.log.info('💡 Next steps:');
    prompts.log.message('   • Restart any running Claude Code sessions');
    prompts.log.message('   • Try using enterprise tools (Jira, Azure DevOps, Confluence)');
    prompts.outro('JWT refresh complete!');
  } catch (error: any) {
    logger.error(`JWT refresh failed: ${error.message}`);
    prompts.log.error(`❌ Failed to refresh JWT: ${error.message}`);
    prompts.outro('JWT refresh failed');
    throw error;
  }
}
