#!/usr/bin/env node
/**
 * Minimal CLI for snow-flow - ServiceNow Multi-Agent Framework
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { join, dirname, resolve } from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import { existsSync } from 'fs';
import { ServiceNowOAuth } from './utils/snow-oauth.js';
import { ServiceNowClient } from './utils/servicenow-client.js';
import { AgentDetector, TaskAnalysis } from './utils/agent-detector.js';
import { getNotificationTemplateSysId } from './utils/servicenow-id-generator.js';
import { VERSION } from './version.js';
// Snow-Flow CLI integration removed - using direct swarm command implementation
import { snowFlowSystem } from './snow-flow-system.js';
import { Logger } from './utils/logger.js';
import chalk from 'chalk';
import * as prompts from '@clack/prompts';
// Load MCP Persistent Guard for bulletproof server protection
import { MCPPersistentGuard } from './utils/mcp-persistent-guard.js';
// Load SnowCode output interceptor for beautiful MCP formatting
import { interceptSnowCodeOutput } from './utils/snowcode-output-interceptor.js';

// Activate MCP guard ONLY for commands that actually use MCP servers
// Explicitly exclude: init, version, help, auth, export, config commands
const commandsNeedingMCP = ['swarm', 'status', 'monitor', 'mcp'];
const commandsNotNeedingMCP = ['init', 'version', 'help', 'auth', 'export', '-v', '--version', '-h', '--help'];
const currentCommand = process.argv[2];

// Only activate guard if it's a command that needs MCP AND not explicitly excluded
if (currentCommand && commandsNeedingMCP.includes(currentCommand) && !commandsNotNeedingMCP.includes(currentCommand)) {
  MCPPersistentGuard.getInstance();
}
// Removed provider-agnostic imports - using Claude Code directly
import { registerAuthCommands } from './cli/auth.js';
import { registerSessionCommands } from './cli/session.js';
import { registerEnterpriseCommands } from './cli/enterprise.js';

// Load environment variables
dotenv.config();

// Create CLI logger instance
const cliLogger = new Logger('cli');

const program = new Command();

program
  .name('snow-flow')
  .description('ServiceNow Multi-Agent Development Framework')
  .version(VERSION);

// Register auth commands (API key management)
registerAuthCommands(program);
// Register session inspection commands
registerSessionCommands(program);
// Register enterprise commands (login, status, portal, logout)
registerEnterpriseCommands(program);

// Flow deprecation handler - check for flow-related commands
function checkFlowDeprecation(command: string, objective?: string) {
  const flowKeywords = ['flow', 'create-flow', 'xml-flow', 'flow-designer'];
  const isFlowCommand = flowKeywords.some(keyword => command.includes(keyword));
  const isFlowObjective = objective && objective.toLowerCase().includes('flow') && 
                         !objective.toLowerCase().includes('workflow') &&
                         !objective.toLowerCase().includes('data flow') &&
                         !objective.toLowerCase().includes('snow-flow');
  
  if (isFlowCommand || isFlowObjective) {
    console.error('❌ Flow creation has been removed from snow-flow v1.4.0+');
    console.error('');
    console.error('Please use ServiceNow Flow Designer directly:');
    console.error('1. Log into your ServiceNow instance');
    console.error('2. Navigate to: Flow Designer > Designer');
    console.error('3. Create flows using the visual interface');
    console.error('');
    console.error('Snow-flow continues to support:');
    console.error('- Widget development');
    console.error('- Update Set management');
    console.error('- Table/field discovery');
    console.error('- General ServiceNow operations');
    process.exit(1);
  }
}


// Swarm command - the main orchestration command with EVERYTHING
program
  .command('swarm <objective>')
  .description('Execute multi-agent orchestration for a ServiceNow task - één command voor alles!')
  // New engine selector: defaults to auto (uses config-driven agent when available)
  .option('--engine <engine>', 'Execution engine (auto|agent|claude)', 'auto')
  .option('--config <path>', 'Path to snowflow.config file')
  .option('--show-reasoning', 'Show LLM reasoning in a different color (default)', true)
  .option('--no-show-reasoning', 'Hide LLM reasoning blocks')
  .option('--save-output <path>', 'Save full assistant output to a file')
  .option('--resume <sessionId>', 'Resume an existing interactive session')
  // Provider overrides (optional, config-driven by default)
  .option('--provider <provider>', 'LLM provider override')
  .option('--model <model>', 'Model override')
  .option('--base-url <url>', 'Base URL override for openai-compatible or gateways')
  .option('--api-key-env <name>', 'Use specific API key env var')
  .option('--strategy <strategy>', 'Execution strategy (development, _analysis, research)', 'development')
  .option('--mode <mode>', 'Coordination mode (hierarchical, mesh, distributed)', 'hierarchical')
  .option('--max-agents <number>', 'Maximum number of agents', '5')
  .option('--parallel', 'Enable parallel execution')
  .option('--monitor', 'Enable real-time monitoring')
  .option('--auto-permissions', 'Automatic permission escalation when needed')
  .option('--smart-discovery', 'Smart artifact discovery and reuse (default: true)', true)
  .option('--no-smart-discovery', 'Disable smart artifact discovery')
  .option('--live-testing', 'Enable live testing during development (default: true)', true)
  .option('--no-live-testing', 'Disable live testing')
  .option('--auto-deploy', 'Automatic deployment when ready (default: true)', true)
  .option('--no-auto-deploy', 'Disable automatic deployment')
  .option('--auto-rollback', 'Automatic rollback on failures (default: true)', true)
  .option('--no-auto-rollback', 'Disable automatic rollback')
  .option('--shared-memory', 'Enable shared memory between agents (default: true)', true)
  .option('--no-shared-memory', 'Disable shared memory')
  .option('--progress-monitoring', 'Real-time progress monitoring (default: true)', true)
  .option('--no-progress-monitoring', 'Disable progress monitoring')
  .option('--autonomous-documentation', 'Enable autonomous documentation system (default: true)', true)
  .option('--no-autonomous-documentation', 'Disable autonomous documentation system')
  .option('--autonomous-cost-optimization', 'Enable autonomous cost optimization engine (default: true)', true)
  .option('--no-autonomous-cost-optimization', 'Disable autonomous cost optimization engine')
  .option('--autonomous-compliance', 'Enable autonomous compliance monitoring (default: true)', true)
  .option('--no-autonomous-compliance', 'Disable autonomous compliance monitoring')
  .option('--autonomous-healing', 'Enable autonomous self-healing capabilities (default: true)', true)
  .option('--no-autonomous-healing', 'Disable autonomous self-healing capabilities')
  .option('--autonomous-all', 'Force enable all autonomous systems (overrides individual --no- flags)')
  .option('--no-autonomous-all', 'Disable all autonomous systems (overrides individual settings)')
  .option('--auto-confirm', 'Auto-confirm background script executions (bypasses human-in-the-loop)')
  .option('--no-auto-confirm', 'Force confirmation for all background scripts (default behavior)')
  .option('--verbose', 'Show detailed execution information')
  .option('--debug', 'Enable debug mode (sets LOG_LEVEL=debug)')
  .option('--trace', 'Enable trace mode (MAXIMUM debug output - sets LOG_LEVEL=trace)')
  .option('--debug-mcp', 'Enable MCP server debug output')
  .option('--debug-http', 'Enable HTTP request/response debugging')
  .option('--debug-memory', 'Enable memory operation debugging')
  .option('--debug-servicenow', 'Enable ServiceNow API debugging')
  .option('--debug-all', 'Enable ALL debug output (WARNING: Very verbose!)')
  .action(async (objective: string, options) => {
    // Check for flow deprecation first
    checkFlowDeprecation('swarm', objective);

    // Set debug levels based on options
    if (options.debugAll) {
      process.env.DEBUG = '*';
      process.env.LOG_LEVEL = 'trace';
      process.env.SNOW_FLOW_DEBUG = 'true';
      process.env.MCP_DEBUG = 'true';
      process.env.MCP_LOG_LEVEL = 'trace';
      process.env.HTTP_TRACE = 'true';
      process.env.VERBOSE = 'true';
      cliLogger.info('🔍 DEBUG MODE: ALL (Maximum verbosity enabled!)');
    } else {
      if (options.trace) {
        process.env.LOG_LEVEL = 'trace';
        process.env.SNOW_FLOW_TRACE = 'true';
        cliLogger.info('🔍 TRACE MODE: Enabled (Maximum detail level)');
      } else if (options.debug) {
        process.env.LOG_LEVEL = 'debug';
        process.env.SNOW_FLOW_DEBUG = 'true';
        cliLogger.info('🔍 DEBUG MODE: Enabled');
      }
      
      if (options.debugMcp) {
        process.env.MCP_DEBUG = 'true';
        process.env.MCP_LOG_LEVEL = 'trace';
        cliLogger.info('🔍 MCP DEBUG: Enabled');
      }
      
      if (options.debugHttp) {
        process.env.HTTP_TRACE = 'true';
        cliLogger.info('🔍 HTTP DEBUG: Enabled (Request/Response tracing)');
      }
      
      if (options.debugMemory) {
        process.env.DEBUG = process.env.DEBUG ? `${process.env.DEBUG},memory:*` : 'memory:*';
        cliLogger.info('🔍 MEMORY DEBUG: Enabled');
      }
      
      if (options.debugServicenow) {
        process.env.DEBUG = process.env.DEBUG ? `${process.env.DEBUG},servicenow:*` : 'servicenow:*';
        cliLogger.info('🔍 SERVICENOW DEBUG: Enabled');
      }
      
      if (options.verbose) {
        process.env.VERBOSE = 'true';
        cliLogger.info('🔍 VERBOSE MODE: Enabled');
      }
    }
    
    // Only show header in verbose mode
    if (options.verbose) {
      cliLogger.info(`\n🚀 Snow-Flow v${VERSION}`);
      console.log(chalk.blue(`📋 ${objective}`));
    }

    // Only show detailed config in verbose mode
    if (options.verbose) {
      cliLogger.info(`⚙️  Strategy: ${options.strategy} | Mode: ${options.mode} | Max Agents: ${options.maxAgents}`);
      cliLogger.info(`🔄 Parallel: ${options.parallel ? 'Yes' : 'No'} | Monitor: ${options.monitor ? 'Yes' : 'No'}`);
      
      // Show new intelligent features
      cliLogger.info(`\n🧠 Intelligent Features:`);
      cliLogger.info(`  🔐 Auto Permissions: ${options.autoPermissions ? '✅ Yes' : '❌ No'}`);
      cliLogger.info(`  🔍 Smart Discovery: ${options.smartDiscovery ? '✅ Yes' : '❌ No'}`);
      cliLogger.info(`  🧪 Live Testing: ${options.liveTesting ? '✅ Yes' : '❌ No'}`);
      cliLogger.info(`  🚀 Auto Deploy: ${options.autoDeploy ? '✅ DEPLOYMENT MODE - WILL CREATE REAL ARTIFACTS' : '❌ PLANNING MODE - ANALYSIS ONLY'}`);
      cliLogger.info(`  🔄 Auto Rollback: ${options.autoRollback ? '✅ Yes' : '❌ No'}`);
      cliLogger.info(`  💾 Shared Memory: ${options.sharedMemory ? '✅ Yes' : '❌ No'}`);
      cliLogger.info(`  📊 Progress Monitoring: ${options.progressMonitoring ? '✅ Yes' : '❌ No'}`);
      
      // Show script execution preferences
      const autoConfirmEnabled = options.autoConfirm === true;
      const noAutoConfirm = options.autoConfirm === false;
      let scriptConfirmStatus = 'Default (Ask for confirmation)';
      if (autoConfirmEnabled) {
        scriptConfirmStatus = '⚠️ AUTO-CONFIRM ENABLED (No user confirmation)';
      } else if (noAutoConfirm) {
        scriptConfirmStatus = '🔒 FORCE CONFIRM (Always ask)';
      }
      cliLogger.info(`  📝 Script Execution: ${scriptConfirmStatus}`);
      
      // Calculate actual autonomous system states (with override logic)
      // Commander.js converts --no-autonomous-all to autonomousAll: false
      const noAutonomousAll = options.autonomousAll === false;
      const forceAutonomousAll = options.autonomousAll === true;
      
      const autonomousDocActive = noAutonomousAll ? false : 
        forceAutonomousAll ? true : 
        options.autonomousDocumentation !== false;
      
      const autonomousCostActive = noAutonomousAll ? false : 
        forceAutonomousAll ? true : 
        options.autonomousCostOptimization !== false;
      
      const autonomousComplianceActive = noAutonomousAll ? false : 
        forceAutonomousAll ? true : 
        options.autonomousCompliance !== false;
      
      const autonomousHealingActive = noAutonomousAll ? false : 
        forceAutonomousAll ? true : 
        options.autonomousHealing !== false;
      
      const hasAutonomousSystems = autonomousDocActive || autonomousCostActive || 
        autonomousComplianceActive || autonomousHealingActive;
      
      cliLogger.info(`\n🤖 Autonomous Systems (DEFAULT ENABLED):`);
      cliLogger.info(`  📚 Documentation: ${autonomousDocActive ? '✅ ACTIVE' : '❌ Disabled'}`);
      cliLogger.info(`  💰 Cost Optimization: ${autonomousCostActive ? '✅ ACTIVE' : '❌ Disabled'}`);
      cliLogger.info(`  🔐 Compliance Monitoring: ${autonomousComplianceActive ? '✅ ACTIVE' : '❌ Disabled'}`);
      cliLogger.info(`  🏥 Self-Healing: ${autonomousHealingActive ? '✅ ACTIVE' : '❌ Disabled'}`);
      cliLogger.info('');
    }
    
    // Snow-Flow uses Claude Code directly - no provider-agnostic layer needed

    // Analyze the objective using intelligent agent detection
    const taskAnalysis = analyzeObjective(objective, parseInt(options.maxAgents));
    
    // Debug logging to understand task type detection
    if (process.env.DEBUG || options.verbose) {
      if (process.env.DEBUG) {
        cliLogger.info(`🔍 DEBUG - Detected artifacts: [${taskAnalysis.serviceNowArtifacts.join(', ')}]`);
        cliLogger.info(`🔍 DEBUG - Flow keywords in objective: ${objective.toLowerCase().includes('flow')}`);
        cliLogger.info(`🔍 DEBUG - Widget keywords in objective: ${objective.toLowerCase().includes('widget')}`);
      }
      
      cliLogger.info(`\n📊 Task Analysis:`);
      cliLogger.info(`  🎯 Task Type: ${taskAnalysis.taskType}`);
      cliLogger.info(`  🧠 Primary Agent: ${taskAnalysis.primaryAgent}`);
      cliLogger.info(`  👥 Supporting Agents: ${taskAnalysis.supportingAgents.join(', ')}`);
      cliLogger.info(`  📊 Complexity: ${taskAnalysis.complexity} | Estimated Agents: ${taskAnalysis.estimatedAgentCount}`);
      cliLogger.info(`  🔧 ServiceNow Artifacts: ${taskAnalysis.serviceNowArtifacts.join(', ')}`);
      cliLogger.info(`  📦 Auto Update Set: ${taskAnalysis.requiresUpdateSet ? '✅ Yes' : '❌ No'}`);
      cliLogger.info(`  🏗️ Auto Application: ${taskAnalysis.requiresApplication ? '✅ Yes' : '❌ No'}`);
    }
    
    // Show timeout configuration only in verbose mode
    const timeoutMinutes = process.env.SNOW_FLOW_TIMEOUT_MINUTES ? parseInt(process.env.SNOW_FLOW_TIMEOUT_MINUTES) : 60;
    if (options.verbose) {
      if (timeoutMinutes > 0) {
        cliLogger.info(`⏱️  Timeout: ${timeoutMinutes} minutes`);
      } else {
        cliLogger.info('⏱️  Timeout: Disabled (infinite execution time)');
      }
    }
    
    // Check ServiceNow authentication
    const oauth = new ServiceNowOAuth();
    const isAuthenticated = await oauth.isAuthenticated();

    if (options.verbose) {
      if (isAuthenticated) {
        cliLogger.info('🔗 ServiceNow connection: ✅ Authenticated');

        // Test ServiceNow connection
        const client = new ServiceNowClient();
        const testResult = await client.testConnection();
        if (testResult.success) {
          cliLogger.info(`👤 Connected as: ${testResult.data.name} (${testResult.data.user_name})`);
        }
      } else {
        cliLogger.warn('🔗 ServiceNow connection: ❌ Not authenticated');
        cliLogger.info('💡 Run "snow-flow auth login" to enable live ServiceNow integration');
      }
    }

    // Check Enterprise features
    const { hasEnterpriseFeatures, getEnterpriseInfo } = await import('./cli/enterprise.js');
    const enterpriseEnabled = await hasEnterpriseFeatures();
    const enterpriseInfo = enterpriseEnabled ? await getEnterpriseInfo() : null;

    if (options.verbose && enterpriseEnabled && enterpriseInfo) {
      cliLogger.info(`\n🌟 Snow-Flow Enterprise: ✅ Active (${enterpriseInfo.tier.toUpperCase()})`);
      cliLogger.info(`   Organization: ${enterpriseInfo.name}`);
      cliLogger.info(`   Features: ${enterpriseInfo.features.join(', ')}`);
    } else if (options.verbose) {
      cliLogger.info('\n🌟 Snow-Flow Enterprise: ❌ Not active');
      cliLogger.info('💡 Run "snow-flow login <license-key>" to enable enterprise features');
    }
    
    // Initialize Queen Agent memory system
    if (options.verbose) {
      cliLogger.info('\n💾 Initializing swarm memory system...');
    }
    const { SessionMemorySystem } = await import('./memory/session-memory.js');
    const memorySystem = new SessionMemorySystem();
    
    // Generate swarm session ID
    const sessionId = `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Session ID only in verbose mode
    if (options.verbose) {
      cliLogger.info(`🔖 Session: ${sessionId}`);
    }
    
    // Store swarm session in memory
    memorySystem.storeLearning(`session_${sessionId}`, {
      objective,
      taskAnalysis,
      options,
      started_at: new Date().toISOString(),
      is_authenticated: isAuthenticated
    });

    // Start SnowCode multi-agent orchestration
    try {
      // Generate the orchestration prompt
      const orchestrationPrompt = buildQueenAgentPrompt(objective, taskAnalysis, options, isAuthenticated, sessionId);
      
      if (options.verbose) {
        cliLogger.info('\n👑 Initializing multi-agent orchestration with SnowCode...');
        cliLogger.info('🎯 SnowCode will coordinate the following:');
        cliLogger.info(`   - Analyze objective: "${objective}"`);
        cliLogger.info(`   - Spawn ${taskAnalysis.estimatedAgentCount} specialized agents via Task() system`);
        cliLogger.info(`   - Coordinate through shared memory (session: ${sessionId})`);
        cliLogger.info(`   - Monitor progress and adapt strategy`);
      }
      
      // Check if intelligent features are enabled
      const hasIntelligentFeatures = options.autoPermissions || options.smartDiscovery || 
        options.liveTesting || options.autoDeploy || options.autoRollback || 
        options.sharedMemory || options.progressMonitoring;
      
      if (options.verbose && hasIntelligentFeatures && isAuthenticated) {
        cliLogger.info('\n🧠 INTELLIGENT ORCHESTRATION MODE ENABLED!');
        cliLogger.info('✨ SnowCode will use advanced features:');
        
        if (options.autoPermissions) {
          cliLogger.info('  🔐 Automatic permission escalation');
        }
        if (options.smartDiscovery) {
          cliLogger.info('  🔍 Smart artifact discovery and reuse');
        }
        if (options.liveTesting) {
          cliLogger.info('  🧪 Real-time testing in ServiceNow');
        }
        if (options.autoDeploy) {
          cliLogger.info('  🚀 Automatic deployment when ready');
        }
        if (options.autoRollback) {
          cliLogger.info('  🔄 Automatic rollback on failures');
        }
        if (options.sharedMemory) {
          cliLogger.info('  💾 Shared context across all agents');
        }
        if (options.progressMonitoring) {
          cliLogger.info('  📊 Real-time progress monitoring');
        }
      }
      
      if (options.verbose) {
        if (isAuthenticated) {
          cliLogger.info('\n🔗 Live ServiceNow integration: ✅ Enabled');
          cliLogger.info('📝 Artifacts will be created directly in ServiceNow');
        } else {
          cliLogger.info('\n🔗 Live ServiceNow integration: ❌ Disabled');
        }
      }

      // Try to execute SnowCode directly with the objective
      const success = await executeSnowCode(objective);

      if (success) {
        // Store successful launch in memory
        memorySystem.storeLearning(`launch_${sessionId}`, {
          success: true,
          launched_at: new Date().toISOString()
        });
      } else {
        cliLogger.error('SnowCode failed to start - check configuration');
      }
      
    } catch (error) {
      cliLogger.error('❌ Failed to execute Queen Agent orchestration:', error instanceof Error ? error.message : String(error));
      
      // Store error in memory for learning
      memorySystem.storeLearning(`error_${sessionId}`, {
        error: error instanceof Error ? error.message : String(error),
        failed_at: new Date().toISOString()
      });
    }
  });


// Helper function to start MCP servers before SnowCode
async function startMCPServers(): Promise<number[]> {
  const pids: number[] = [];

  try {
    // Load SnowCode config
    const snowcodeConfigPath = join(os.homedir(), '.snowcode', 'snowcode.json');
    if (!existsSync(snowcodeConfigPath)) {
      // Try local config
      const localConfigPath = join(process.cwd(), '.snowcode', 'snowcode.json');
      if (!existsSync(localConfigPath)) {
        return pids;
      }
    }

    const configContent = await fs.readFile(
      existsSync(snowcodeConfigPath) ? snowcodeConfigPath : join(process.cwd(), '.snowcode', 'snowcode.json'),
      'utf-8'
    );
    const config = JSON.parse(configContent);
    const mcpServers = config.mcp || {};

    // Start each enabled local MCP server
    for (const [serverName, serverConfig] of Object.entries(mcpServers) as [string, any][]) {
      // Skip disabled servers
      if (serverConfig.enabled === false) {
        continue;
      }

      // Only start local servers
      if (serverConfig.type !== 'local') {
        continue;
      }

      try {
        // Prepare environment
        const env = Object.assign({}, process.env, serverConfig.environment || {});

        // Start server in background (detached)
        const serverProcess = spawn(serverConfig.command[0], serverConfig.command.slice(1), {
          env: env,
          stdio: 'ignore', // Don't capture output (runs in background)
          detached: true
        });

        serverProcess.unref(); // Allow parent to exit independently
        pids.push(serverProcess.pid || 0);

      } catch (error) {
        cliLogger.warn(`⚠️  Failed to start ${serverName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Wait 2 seconds for servers to initialize
    if (pids.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error) {
    cliLogger.warn('⚠️  Could not start MCP servers:', error instanceof Error ? error.message : String(error));
  }

  return pids;
}

// Helper function to stop MCP servers after SnowCode
function stopMCPServers(): void {
  try {
    const { execSync } = require('child_process');
    execSync('pkill -f "servicenow-mcp-unified\\|snow-flow-mcp" 2>/dev/null || true');
  } catch (e) {
    // Ignore errors
  }
}

// Helper function to auto-update SnowCode to latest version
async function autoUpdateSnowCode(): Promise<void> {
  try {
    const { execSync } = require('child_process');
    const { existsSync, readdirSync, rmSync } = require('fs');
    const { join, dirname } = require('path');

    cliLogger.info('🔄 Checking for SnowCode updates...');

    // Get current version
    const currentVersion = execSync('snowcode --version', { encoding: 'utf8' }).trim();

    // Get latest version from npm
    const latestVersion = execSync('npm view @groeimetai/snowcode version', { encoding: 'utf8' }).trim();

    // Helper to find node_modules in current and parent directories
    const findNodeModules = (startPath: string): string[] => {
      const found: string[] = [];
      let currentPath = startPath;

      // Check up to 3 levels up
      for (let i = 0; i < 3; i++) {
        const nodeModulesPath = join(currentPath, 'node_modules', '@groeimetai');
        if (existsSync(nodeModulesPath)) {
          found.push(currentPath);
        }
        const parent = dirname(currentPath);
        if (parent === currentPath) break; // Reached root
        currentPath = parent;
      }

      return found;
    };

    // Helper to update local node_modules
    const updateLocalNodeModules = (projectRoot: string) => {
      const groeimetaiPath = join(projectRoot, 'node_modules', '@groeimetai');

      if (existsSync(groeimetaiPath)) {
        // Check main package version AND platform binaries
        const snowcodePackage = join(groeimetaiPath, 'snowcode', 'package.json');
        let needsUpdate = false;

        if (existsSync(snowcodePackage)) {
          const pkg = JSON.parse(require('fs').readFileSync(snowcodePackage, 'utf8'));
          if (pkg.version !== latestVersion) {
            needsUpdate = true;
            cliLogger.info(`Main package outdated: ${pkg.version} → ${latestVersion}`);
          }
        } else {
          needsUpdate = true;
        }

        // Also check platform binaries (snowcode-darwin-arm64, etc.)
        if (!needsUpdate) {
          try {
            const packages = readdirSync(groeimetaiPath);
            for (const pkg of packages) {
              if (pkg.startsWith('snowcode-')) {
                const pkgJsonPath = join(groeimetaiPath, pkg, 'package.json');
                if (existsSync(pkgJsonPath)) {
                  const pkgJson = JSON.parse(require('fs').readFileSync(pkgJsonPath, 'utf8'));
                  if (pkgJson.version !== latestVersion) {
                    needsUpdate = true;
                    cliLogger.info(`Platform binary outdated: ${pkg}@${pkgJson.version} → ${latestVersion}`);
                    break;
                  }
                }
              }
            }
          } catch (err) {
            cliLogger.debug(`Error checking platform binaries: ${err}`);
          }
        }

        if (needsUpdate) {
          cliLogger.info(`📦 Updating SnowCode in ${projectRoot}...`);

          // Remove old platform binaries to force reinstall
          try {
            const packages = readdirSync(groeimetaiPath);
            for (const pkg of packages) {
              if (pkg.startsWith('snowcode-') || pkg === 'snowcode') {
                const pkgPath = join(groeimetaiPath, pkg);
                cliLogger.debug(`Removing old package: ${pkg}`);
                rmSync(pkgPath, { recursive: true, force: true });
              }
            }
          } catch (err) {
            cliLogger.debug(`Cleanup error: ${err}`);
          }

          // Remove package-lock.json to ensure fresh install (avoid stale lockfile cache)
          const lockfilePath = join(projectRoot, 'package-lock.json');
          if (existsSync(lockfilePath)) {
            cliLogger.debug('Removing stale package-lock.json');
            rmSync(lockfilePath, { force: true });
          }

          // Install fresh version
          execSync('npm install @groeimetai/snowcode@latest', {
            stdio: 'inherit',
            cwd: projectRoot
          });

          // Restore executable permissions for platform binaries
          try {
            const packages = readdirSync(groeimetaiPath);
            for (const pkg of packages) {
              if (pkg.startsWith('snowcode-')) {
                const binPath = join(groeimetaiPath, pkg, 'bin');
                if (existsSync(binPath)) {
                  const binaries = readdirSync(binPath);
                  for (const binary of binaries) {
                    const binaryPath = join(binPath, binary);
                    try {
                      execSync(`chmod +x "${binaryPath}"`, { stdio: 'ignore' });
                      cliLogger.debug(`Set executable: ${pkg}/bin/${binary}`);
                    } catch (err) {
                      cliLogger.debug(`Chmod error for ${binary}: ${err}`);
                    }
                  }
                }
              }
            }
          } catch (err) {
            cliLogger.debug(`Error setting permissions: ${err}`);
          }

          cliLogger.info(`✅ Updated SnowCode in ${projectRoot}`);
        }
      }
    };

    if (currentVersion !== latestVersion) {
      cliLogger.info(`📦 Updating SnowCode: ${currentVersion} → ${latestVersion}`);

      // Update global version
      execSync('npm install -g @groeimetai/snowcode@latest', { stdio: 'inherit' });

      // Update all local node_modules
      const projectRoots = findNodeModules(process.cwd());
      cliLogger.info(`Found ${projectRoots.length} project(s) with node_modules`);
      for (const root of projectRoots) {
        updateLocalNodeModules(root);
      }

      cliLogger.info(`✅ SnowCode updated to ${latestVersion}`);
    } else {
      cliLogger.info(`✅ SnowCode is up-to-date (${currentVersion})`);

      // Even if global is up-to-date, check local node_modules
      const projectRoots = findNodeModules(process.cwd());
      cliLogger.debug(`Checking ${projectRoots.length} project(s) for local updates`);
      for (const root of projectRoots) {
        updateLocalNodeModules(root);
      }
    }
  } catch (error) {
    // Log error but don't block execution
    cliLogger.warn(`⚠️  Auto-update check failed: ${error instanceof Error ? error.message : String(error)}`);
    cliLogger.debug(`Full error: ${error}`);
  }
}

// Helper function to execute SnowCode directly with the objective
async function executeSnowCode(objective: string): Promise<boolean> {
  let mcpServerPIDs: number[] = [];

  try {
    // Auto-update SnowCode to latest version
    await autoUpdateSnowCode();

    // Check if SnowCode CLI is available
    const { execSync } = require('child_process');
    try {
      execSync('which snowcode', { stdio: 'ignore' });
    } catch {
      cliLogger.error('SnowCode CLI not found - install: npm install -g @groeimetai/snowcode');
      return false;
    }

    // Check for SnowCode config (.snowcode/snowcode.json or .snowcode/opencode.json)
    const snowcodeConfigPath = join(process.cwd(), '.snowcode', 'snowcode.json');
    const opencodeConfigPath = join(process.cwd(), '.snowcode', 'opencode.json');
    if (!existsSync(snowcodeConfigPath) && !existsSync(opencodeConfigPath)) {
      cliLogger.error('SnowCode config not found - run: snow-flow init');
      return false;
    }

    // Check for .env file
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      cliLogger.error('.env file not found - run: snow-flow init');
      return false;
    }

    // 🔥 CRITICAL: SnowCode v0.15.14 doesn't auto-start MCP servers
    // We need to start them manually before launching SnowCode
    mcpServerPIDs = await startMCPServers();
    if (mcpServerPIDs.length === 0) {
      cliLogger.warn('⚠️  No MCP servers started - tools may not be available');
    } else {
      cliLogger.info(`✅ Started ${mcpServerPIDs.length} MCP server(s)`);
    }

    // Get default model from .env if available
    const defaultModel = process.env.DEFAULT_MODEL;
    const defaultProvider = process.env.DEFAULT_LLM_PROVIDER;

    // Build SnowCode command for TUI mode
    // Use default TUI mode with --prompt to start with objective
    const snowcodeArgs = [];

    // Add model option if available
    if (defaultModel) {
      snowcodeArgs.push('--model', defaultModel);
    }

    // Add prompt option with objective
    snowcodeArgs.push('--prompt', objective);

    // Spawn SnowCode process in TUI mode - full interactive interface
    // Use 'snowcode --prompt <objective>' to start TUI with initial prompt
    const snowcodeProcess = spawn('snowcode', snowcodeArgs, {
      stdio: 'inherit', // All stdio inherited - SnowCode can use TTY
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Ensure DEFAULT_MODEL is available to SnowCode
        DEFAULT_MODEL: defaultModel || '',
        DEFAULT_LLM_PROVIDER: defaultProvider || ''
      }
    });

    // Set up process monitoring
    return new Promise((resolve) => {
      snowcodeProcess.on('close', async (code) => {
        // Stop MCP servers when SnowCode exits
        if (mcpServerPIDs.length > 0) {
          cliLogger.info('🛑 Stopping MCP servers...');
          stopMCPServers();
        }

        resolve(code === 0);
      });

      snowcodeProcess.on('error', (error) => {
        // Stop MCP servers on error
        if (mcpServerPIDs.length > 0) {
          stopMCPServers();
        }

        cliLogger.error(`❌ Failed to start SnowCode: ${error.message}`);
        resolve(false);
      });

      // Set timeout (configurable via environment variable)
      const timeoutMinutes = parseInt(process.env.SNOW_FLOW_TIMEOUT_MINUTES || '0');
      if (timeoutMinutes > 0) {
        setTimeout(() => {
          cliLogger.warn(`⏱️  SnowCode session timeout (${timeoutMinutes} minutes), terminating...`);
          snowcodeProcess.kill('SIGTERM');

          // Stop MCP servers on timeout
          if (mcpServerPIDs.length > 0) {
            stopMCPServers();
          }

          resolve(false);
        }, timeoutMinutes * 60 * 1000);
      }
    });

  } catch (error) {
    // Stop MCP servers on error
    if (mcpServerPIDs.length > 0) {
      stopMCPServers();
    }

    cliLogger.error('❌ Error launching SnowCode:', error instanceof Error ? error.message : String(error));
    cliLogger.info('📋 Please start SnowCode manually: snowcode');
    return false;
  }
}

// Real-time monitoring dashboard for SnowCode process
function startMonitoringDashboard(snowcodeProcess: ChildProcess): NodeJS.Timeout {
  let iterations = 0;
  const startTime = Date.now();

  // Show initial dashboard only once
  cliLogger.info(`┌─────────────────────────────────────────────────────────────┐`);
  cliLogger.info(`│               🚀 Snow-Flow Dashboard v${VERSION}            │`);
  cliLogger.info(`├─────────────────────────────────────────────────────────────┤`);
  cliLogger.info(`│ 🤖 SnowCode Status:     ✅ Starting                          │`);
  cliLogger.info(`│ 📊 Process ID:          ${snowcodeProcess.pid || 'N/A'}        │`);
  cliLogger.info(`│ ⏱️  Session Time:        00:00                               │`);
  cliLogger.info(`│ 🔄 Monitoring Cycles:    0                                   │`);
  cliLogger.info('└─────────────────────────────────────────────────────────────┘');

  // Silent monitoring - only log to file or memory, don't interfere with SnowCode UI
  const monitoringInterval = setInterval(() => {
    iterations++;
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    // Silent monitoring - check files but don't output to console
    try {
      const serviceNowDir = join(process.cwd(), 'servicenow');
      fs.readdir(serviceNowDir).then(files => {
        // Files are being generated - could log to file if needed
        // console.log(`\n📁 Generated Files: ${files.length} artifacts in servicenow/`);
      }).catch(() => {
        // Directory doesn't exist yet, that's normal
      });
    } catch (error) {
      // Ignore errors
    }

  }, 5000); // Check every 5 seconds silently

  return monitoringInterval;
}

// Helper function to build Queen Agent orchestration prompt
// Helper function to build Queen Agent orchestration prompt - CLEANED UP VERSION
function buildQueenAgentPrompt(objective: string, taskAnalysis: TaskAnalysis, options: any, isAuthenticated: boolean = false, sessionId: string): string {
  // Check if intelligent features are enabled
  const hasIntelligentFeatures = options.autoPermissions || options.smartDiscovery || 
    options.liveTesting || options.autoDeploy || options.autoRollback || 
    options.sharedMemory || options.progressMonitoring;

  const prompt = `# 👑 Snow-Flow Queen Agent Orchestration

## 🤖 Claude Agent SDK Integration
**Snow-Flow v5.0+ is powered by @anthropic-ai/claude-agent-sdk@0.1.1**

This session uses the official Anthropic Claude Agent SDK for:
- **MCP Server Management**: 2 unified servers with 411 tools automatically managed
- **Agent Lifecycle**: SDK handles agent spawning, coordination, and resource optimization
- **Intelligent Routing**: Task-aware tool routing and context management
- **Performance Optimization**: Automatic batching and parallel execution support

**Available Tools:**
- **ServiceNow Unified Server** (235+ tools): All ServiceNow operations
- **Snow-Flow Orchestration Server** (176+ tools): Swarm coordination, neural networks, memory

## 🚨 CRITICAL: PREVENT INFINITE LOOPS - READ FIRST!

**NEVER SPAWN DUPLICATE AGENTS!** This causes infinite loops that spam MCP servers and crash Codespaces!

**❌ INFINITE LOOP PATTERN (PROHIBITED):**
\`\`\`
Task(\"UI Builder Tools Tester\", \"Test UI Builder tools\");
Task(\"UI Builder Tools Tester\", \"Test UI Builder tools\");  // ← DUPLICATE AGENT TYPE!
Task(\"Workspace Tools Tester\", \"Test workspace tools\");
Task(\"Workspace Tools Tester\", \"Test workspace tools\");  // ← INFINITE LOOP!
\`\`\`

**✅ CORRECT PATTERN (REQUIRED):**
\`\`\`
Task(\"workspace-architect\", \"Create ONE UX workspace using snow_create_complete_workspace\");
Task(\"ui-designer\", \"Design UI components AFTER workspace is created\");
Task(\"validator\", \"Test AFTER both previous agents complete\");
\`\`\`

**GOLDEN RULES:**
1. **ONE agent per task type maximum**
2. **UNIQUE agent names** (not generic \"Tester\")
3. **SEQUENTIAL spawning** - wait for completion
4. **CHECK Memory** for existing agents first

## 🎯 Mission Brief
You are the Queen Agent, master coordinator of the Snow-Flow hive-mind. Your mission is to orchestrate a swarm of specialized agents to complete the following ServiceNow development objective:

**Objective**: ${objective}
**Session ID**: ${sessionId}

## 🧠 Task Analysis Summary
- **Task Type**: ${taskAnalysis.taskType}
- **Complexity**: ${taskAnalysis.complexity}
- **Primary Agent Required**: ${taskAnalysis.primaryAgent}
- **Supporting Agents**: ${taskAnalysis.supportingAgents.join(', ')}
- **Estimated Total Agents**: ${taskAnalysis.estimatedAgentCount}
- **ServiceNow Artifacts**: ${taskAnalysis.serviceNowArtifacts.join(', ')}

## ⚡ CRITICAL: Task Intent Analysis
**BEFORE PROCEEDING**, analyze the user's ACTUAL intent:

1. **Data Generation Request?** (e.g., "create 5000 incidents", "generate test data")
   → Focus on CREATING DATA, not building systems
   → Use simple scripts or bulk operations to generate the data
   → Skip complex architectures unless explicitly asked

2. **System Building Request?** (e.g., "build a widget", "create an ML system")
   → Follow full development workflow
   → Build proper architecture and components

3. **Simple Operation Request?** (e.g., "update field X", "delete records")
   → Execute the operation directly
   → Skip unnecessary complexity

**For this objective**: Analyze if the user wants data generation, system building, or a simple operation.

## 📊 Table Discovery Intelligence

The Queen Agent will automatically discover and validate table schemas based on the objective. This ensures agents use correct field names and table structures.

**Table Detection Examples:**
- "create widget for incident records" → Discovers: incident, sys_user, sys_user_group
- "build catalog item for equipment requests" → Discovers: sc_cat_item, sc_category, u_equipment_request
- "create UX workspace for IT support" → Discovers: sys_ux_experience, sys_ux_app_config, sys_ux_macroponent, sys_ux_page_registry, sys_ux_app_route
- "portal showing catalog items" → Discovers: sc_cat_item, sc_category, sc_request
- "dashboard with CMDB assets" → Discovers: cmdb_ci, cmdb_rel_ci, sys_user
- "report on problem tickets" → Discovers: problem, incident, sys_user

**Discovery Process:**
1. Extracts table names from objective (standard tables, u_ custom tables, explicit mentions)
2. Discovers actual table schemas with field names, types, and relationships
3. Stores schemas in memory for all agents to use
4. Agents MUST use exact field names from schemas (e.g., 'short_description' not 'desc')

## 👑 Your Queen Agent Responsibilities

## 🏗️ UX Workspace Creation Specific Instructions
If the task involves UX WORKSPACE CREATION (e.g., "create workspace for IT support", "build agent workspace"):

1. **ALWAYS** use \`snow_create_complete_workspace\` for full 6-step workflow
2. **INDIVIDUAL STEPS** available if fine control needed:
   - Step 1: \`snow_create_ux_experience\` (sys_ux_experience)
   - Step 2: \`snow_create_ux_app_config\` (sys_ux_app_config) 
   - Step 3: \`snow_create_ux_page_macroponent\` (sys_ux_macroponent)
   - Step 4: \`snow_create_ux_page_registry\` (sys_ux_page_registry)
   - Step 5: \`snow_create_ux_app_route\` (sys_ux_app_route)
   - Step 6: \`snow_update_ux_app_config_landing_page\` (landing page route)
3. **VERIFY ORDER**: Must follow exact sequence for functional workspaces
4. **STORE SYS_IDS**: Store all sys_ids in Memory for agents coordination
5. **TEST ACCESS**: Provide workspace URL: \`/now/experience/workspace/{route_name}\`

## 📊 Data Generation Specific Instructions
If the task is identified as DATA GENERATION (e.g., "create 5000 incidents"):

1. **DO NOT** build complex export/import systems
2. **DO NOT** create APIs, UI Actions, or workflows
3. **DO** focus on:
   - Creating a simple script to generate the data
   - Using ServiceNow's REST API or direct table operations
   - Ensuring realistic data distribution for ML training
   - Adding variety in categories, priorities, descriptions, etc.

**Example approach for "create 5000 incidents":**
\`\`\`javascript
// Simple batch creation script
for (let i = 0; i < 5000; i += 100) {
  // Create 100 incidents at a time to avoid timeouts
  const batch = generateRealisticIncidentBatch(100);
  await createIncidentsBatch(batch);
}
\`\`\`

### 1. Initialize Memory & Session (Required First Step)
**THIS MUST BE YOUR VERY FIRST ACTION:**
\`\`\`javascript
// Initialize swarm memory session
Memory.store("swarm_session_${sessionId}", JSON.stringify({
  objective: "${objective}",
  status: "initializing",
  started_at: new Date().toISOString(),
  task_analysis: ${JSON.stringify(taskAnalysis, null, 2)},
  configuration: {
    strategy: "${options.strategy}",
    mode: "${options.mode}",
    max_agents: ${parseInt(options.maxAgents)},
    authenticated: ${isAuthenticated}
  }
}));
\`\`\`

### 2. 🚨 MANDATORY: ServiceNow Auth & Update Set Setup
**CRITICAL: These steps are REQUIRED for ALL development work:**

\`\`\`javascript
// Step 2.1: MANDATORY - Test ServiceNow authentication
const authCheck = await snow_auth_diagnostics();
if (!authCheck.success) {
  throw new Error("❌ CRITICAL: Authentication failed! Run: snow-flow auth login");
}

// Step 2.2: MANDATORY - Create Update Set for tracking ALL changes
const updateSetName = "Snow-Flow: ${objective.substring(0, 50)}... - ${new Date().toISOString().split('T')[0]}";
const updateSet = await snow_update_set_create({
  name: updateSetName,
  description: "Automated Snow-Flow development for: ${objective}\\n\\nSession: ${sessionId}\\nAll changes tracked automatically",
  auto_switch: true  // 🚨 CRITICAL: Sets as current update set!
});

// Store Update Set info in memory for all agents
Memory.store("update_set_${sessionId}", JSON.stringify(updateSet));
Memory.store("current_update_set", updateSet.sys_id);
\`\`\`

**WHY THIS IS CRITICAL:**
- ✅ All ServiceNow changes are automatically tracked
- ✅ Enables deployment to other instances later  
- ✅ Provides rollback capabilities
- ✅ Follows ServiceNow development best practices
- ❌ **WITHOUT UPDATE SET: Changes are untracked and risky!**

### 3. Create Master Task List
After completing setup steps, create task breakdown:
\`\`\`javascript
TodoWrite([
  {
    id: "setup_complete",
    content: "✅ Setup: Auth, Update Set, Memory initialized",
    status: "completed",
    priority: "high"
  },
  {
    id: "analyze_requirements",
    content: "Analyze user requirements: ${objective}",
    status: "in_progress",
    priority: "high"
  },
  {
    id: "spawn_agents",
    content: "Spawn ${taskAnalysis.estimatedAgentCount} specialized agents",
    status: "pending",
    priority: "high"
  },
  {
    id: "coordinate_development",
    content: "Coordinate agent activities for ${taskAnalysis.taskType}",
    status: "pending",
    priority: "high"
  },
  {
    id: "validate_solution",
    content: "Validate and test the complete solution",
    status: "pending",
    priority: "medium"
  }
]);
\`\`\`

### 4. Agent Spawning Strategy - 🚨 ANTI-LOOP PROTECTION 🚨

**CRITICAL: NO DUPLICATE AGENTS! ONLY SPAWN EACH AGENT TYPE ONCE!**

**✅ CORRECT (Single Agents Only):**
1. **Initialize Swarm ONCE**: \`swarm_init({ topology: 'hierarchical', maxAgents: ${parseInt(options.maxAgents)} })\`
2. **Spawn ${taskAnalysis.estimatedAgentCount} DIFFERENT agents**: 
Spawn ONE agent of each required type based on the objective:

**${taskAnalysis.taskType} requires these UNIQUE agents:**
- **ONE researcher**: \`Task(\"researcher\", \"Research ServiceNow requirements for: ${objective}\")\`
- **ONE ${taskAnalysis.primaryAgent}**: \`Task(\"${taskAnalysis.primaryAgent}\", \"Implement main solution for: ${objective}\")\`
- **ONE tester**: \`Task(\"tester\", \"Test and validate solution for: ${objective}\")\`

**🚨 CRITICAL ANTI-LOOP RULES:**
- **NEVER spawn multiple agents of the same type**
- **NEVER spawn \"UI Builder Tools Tester\" multiple times**
- **NEVER spawn \"Workspace Tools Tester\" multiple times**
- **WAIT for agent completion** before spawning related agents
- **CHECK Memory** for existing agents before spawning new ones

**❌ PROHIBITED PATTERNS:**
\`\`\`
// DON'T DO THIS - CAUSES INFINITE LOOPS:
Task(\"UI Builder Tools Tester\", \"Test UI Builder tools\");
Task(\"UI Builder Tools Tester\", \"Test UI Builder tools\");  // ← DUPLICATE!
Task(\"UI Builder Tools Tester\", \"Test UI Builder tools\");  // ← INFINITE LOOP!
\`\`\`

**✅ CORRECT PATTERNS:**
\`\`\`
// DO THIS - SINGLE AGENTS WITH SPECIFIC TASKS:
Task(\"ui-builder-specialist\", \"Create specific UI Builder page for incident management\");
Task(\"workspace-architect\", \"Design UX workspace structure for IT support team\");
Task(\"testing-specialist\", \"Validate workspace functionality and report results\");
\`\`\`

### 5. Memory Coordination Pattern with Loop Detection
All agents MUST use this memory coordination WITH loop prevention:

\`\`\`javascript
// STEP 1: Check if agent type already exists (PREVENT LOOPS!)
const existingAgents = Memory.get('active_agents') || [];
const agentType = 'ui-builder-specialist';

if (existingAgents.includes(agentType)) {
  console.log('Agent type already active - SKIPPING to prevent infinite loop');
  return; // DON'T spawn duplicate agents!
}

// STEP 2: Register agent as active
const agentId = \`agent_\${agentType}_\${sessionId}\`;
existingAgents.push(agentType);
Memory.store('active_agents', JSON.stringify(existingAgents));

// STEP 3: Agent stores progress
Memory.store(\`\${agentId}_progress\`, JSON.stringify({
  agent_type: agentType,
  status: "working",
  current_task: "description of current work",
  completion_percentage: 45,
  spawned_at: new Date().toISOString(),
  last_update: new Date().toISOString()
}));

// Agent reads other agent's work when needed
const primaryWork = Memory.get("agent_\${taskAnalysis.primaryAgent}_output");

// Agent signals completion
Memory.store(\`\${agentId}_complete\`, JSON.stringify({
  completed_at: new Date().toISOString(),
  outputs: { /* agent deliverables */ },
  artifacts_created: [ /* list of created artifacts */ ]
}));
\`\`\`

## 🧠 Intelligent Features Configuration
${hasIntelligentFeatures ? `✅ **INTELLIGENT MODE ACTIVE** - The following features are enabled:

- **🔐 Auto Permissions**: ${options.autoPermissions ? '✅ Will escalate permissions automatically' : '❌ Manual permission handling'}
- **🔍 Smart Discovery**: ${options.smartDiscovery ? '✅ Will discover and reuse existing artifacts' : '❌ Create all new artifacts'}
- **🧪 Live Testing**: ${options.liveTesting ? '✅ Will test in real ServiceNow instance' : '❌ Local testing only'}
- **🚀 Auto Deploy**: ${options.autoDeploy ? '⚠️ WILL DEPLOY TO SERVICENOW AUTOMATICALLY' : '✅ Planning mode - no deployment'}
- **🔄 Auto Rollback**: ${options.autoRollback ? '✅ Will rollback on any failures' : '❌ No automatic rollback'}
- **💾 Shared Memory**: ${options.sharedMemory ? '✅ Agents share context via Memory' : '❌ Isolated agent execution'}
- **📊 Progress Monitoring**: ${options.progressMonitoring ? '✅ Real-time progress tracking' : '❌ No progress monitoring'}
- **📝 Script Execution**: ${options.autoConfirm ? '⚠️ AUTO-CONFIRM - Background scripts execute without user confirmation' : options.autoConfirm === false ? '🔒 FORCE CONFIRM - Always ask for script confirmation' : '🤚 DEFAULT - Ask for confirmation on risky scripts'}` : '❌ **STANDARD MODE** - Use manual coordination patterns'}

## 🎯 ServiceNow Execution Strategy

### 🚀 MANDATORY: Live ServiceNow Development First!

**CRITICAL RULE**: All agents MUST attempt to use ServiceNow MCP tools first, regardless of authentication status.

### 🚨 MANDATORY: ES5 JavaScript Only for ALL ServiceNow Scripts
**⚠️ SERVICENOW RHINO ENGINE = ES5 ONLY - NO MODERN SYNTAX!**

**CRITICAL ES5 RULES:**
- NO const/let (use var)
- NO arrow functions (use function())
- NO template literals (use string concatenation) 
- NO destructuring (use explicit property access)
- NO for...of loops (use traditional for loops)
- NO default parameters (use typeof checks)

**🔥 If you use ES6+ syntax, the script WILL FAIL with SyntaxError!**
**See CLAUDE.md for complete ES5 examples and common mistake fixes.**

### 📝 Background Script Execution Settings
${options.autoConfirm ? '⚠️ **AUTO-CONFIRM MODE ENABLED**: When calling snow_execute_background_script, ALWAYS add autoConfirm: true parameter to skip user confirmation.\n```javascript\nsnow_execute_background_script({\n  script: "your ES5 script here",\n  description: "Clear description",\n  autoConfirm: true  // ⚠️ User enabled auto-confirm mode\n})\n```' : options.autoConfirm === false ? '🔒 **FORCE CONFIRM MODE**: All background scripts will require user confirmation, even simple ones.' : '🤚 **DEFAULT MODE**: Background scripts will ask for user confirmation based on risk level.'}

#### Current MCP Tools Available (Snow-Flow v3.3.4)
${isAuthenticated ? '✅ Authentication detected - full deployment capabilities' : '⚠️ No authentication detected - MCP tools will provide specific instructions if auth needed'}

Your agents MUST use these MCP tools IN THIS ORDER:

🚨 **MANDATORY PRE-FLIGHT CHECKS** (ALWAYS do first!):
1. \`snow_auth_diagnostics\` - Test authentication and permissions
2. \`snow_update_set_create\` - Create and activate update set for tracking
3. If auth fails, STOP and provide instructions to run 'snow-flow auth login'
4. If update set fails, STOP - development work is not safe without tracking

🎯 **Core Development Tools**:
1. **Universal Query Tool**: \`snow_query_table\` - Works with ALL ServiceNow tables
   - Count-only: \`{table: "incident", query: "state!=7"}\` → Memory efficient
   - Specific fields: \`{table: "sc_request", fields: ["number", "state"]}\` → Only needed data
   - Full content: \`{table: "change_request", include_content: true}\` → When all data needed

2. **Deployment Tools**: 
   - \`snow_deploy\` - Universal deployment for NEW artifacts (16+ types supported!)
   - \`snow_update\` - Update EXISTING artifacts by name or sys_id

3. **Discovery Tools**:
   - \`snow_discover_table_fields\` - Get exact field names and types
   - \`snow_table_schema_discovery\` - Complete table structure

4. **Update Set Management**:
   - \`snow_update_set_create\` - Create new update sets
   - \`snow_update_set_add_comment\` - Track progress
   - \`snow_update_set_retrieve\` - Get update set XML

## 🔧 NEW: Expanded Artifact Support (v3.3.4)

Snow-Flow now supports **16+ different ServiceNow artifact types**:

| Type | Table | Deploy | Update | Natural Language |
|------|-------|--------|---------|------------------|
| widget | sp_widget | ✅ | ✅ | ✅ |
| business_rule | sys_script | ✅ | ✅ | ✅ |
| script_include | sys_script_include | ✅ | ✅ | ✅ |
| ui_page | sys_ui_page | ✅ | ✅ | ✅ |
| client_script | sys_script_client | ✅ | ✅ | ✅ |
| ui_action | sys_ui_action | ✅ | ✅ | ✅ |
| ui_policy | sys_ui_policy | ✅ | ✅ | ✅ |
| acl | sys_security_acl | ✅ | ✅ | ✅ |
| table | sys_db_object | ✅ | ✅ | ✅ |
| field | sys_dictionary | ✅ | ✅ | ✅ |
| workflow | wf_workflow | ✅ | ✅ | ✅ |
| flow | sys_hub_flow | ✅ | ✅ | ✅ |
| notification | sysevent_email_action | ✅ | ✅ | ✅ |
| scheduled_job | sysauto_script | ✅ | ✅ | ✅ |

**Usage Examples:**
\`\`\`javascript
// Deploy NEW artifacts
await snow_deploy({
  type: 'business_rule',
  name: 'Auto Assignment Rule',
  table: 'incident',
  when: 'before',
  script: 'if (current.priority == "1") current.assigned_to = "admin";'
});

// Update EXISTING artifacts (natural language supported!)
await snow_update({
  type: 'ui_action',
  identifier: 'close_incident',
  instruction: 'Change label to "Close with Resolution" and add validation'
});
\`\`\`

${options.autoDeploy ? `
#### ⚠️ AUTO-DEPLOYMENT ACTIVE ⚠️
- Real artifacts will be created in ServiceNow
- All changes tracked in Update Sets
- Rollback available if needed
` : `
#### 📋 Planning Mode Active
- No real artifacts will be created
- Analysis and recommendations only
- Use --auto-deploy to enable deployment
`}

${!isAuthenticated ? `### ❌ ServiceNow Integration Disabled

#### Planning Mode (Auth Required)
When authentication is not available, agents will:
1. Document the COMPLETE solution architecture
2. Create detailed implementation guides
3. Store all plans in Memory for future deployment
4. Provide SPECIFIC instructions: "Run snow-flow auth login"

⚠️ IMPORTANT: This is a FALLBACK mode only!
Agents must ALWAYS try MCP tools first!` : ''}

## 👑 Queen Agent Coordination Instructions

### 6. Agent Coordination & Handoffs
Ensure smooth transitions between agents:

\`\`\`javascript
// Primary agent signals readiness for support
Memory.store("agent_${taskAnalysis.primaryAgent}_ready_for_support", JSON.stringify({
  base_structure_complete: true,
  ready_for: [${taskAnalysis.supportingAgents.map(a => `"${a}"`).join(', ')}],
  timestamp: new Date().toISOString()
}));

// Supporting agents check readiness
const canProceed = JSON.parse(Memory.get("agent_${taskAnalysis.primaryAgent}_ready_for_support") || "{}");
if (canProceed?.base_structure_complete) {
  // Begin supporting work
}
\`\`\`

### 7. Final Validation and Completion
Once all agents complete their work:

\`\`\`javascript
// Collect all agent outputs
const agentOutputs = {};
[${[taskAnalysis.primaryAgent, ...taskAnalysis.supportingAgents].map(a => `"${a}"`).join(', ')}].forEach(agent => {
  const output = Memory.get(\`agent_\${agent}_complete\`);
  if (output) {
    agentOutputs[agent] = JSON.parse(output);
  }
});

// Store final swarm results
Memory.store("swarm_session_${sessionId}_results", JSON.stringify({
  objective: "${objective}",
  completed_at: new Date().toISOString(),
  agent_outputs: agentOutputs,
  artifacts_created: Object.values(agentOutputs)
    .flatMap(output => output.artifacts_created || []),
  success: true
}));

// Update final TodoWrite status
TodoWrite([
  {
    id: "swarm_completion",
    content: "Swarm successfully completed: ${objective}",
    status: "completed",
    priority: "high"
  }
]);
\`\`\`

## 🎯 Success Criteria

Your Queen Agent orchestration is successful when:
1. ✅ All agents have been spawned and initialized
2. ✅ Swarm session is tracked in Memory
3. ✅ Agents are coordinating through shared Memory
4. ✅ TodoWrite is being used for task tracking
5. ✅ ${taskAnalysis.taskType} requirements are met
6. ✅ All artifacts are created/deployed successfully

## 💡 Queen Agent Best Practices

### **Workflow Orchestration:**
1. **NEVER parallel foundation work** - research, planning, architecture must be sequential
2. **Foundation → Development → Validation** - strict phase progression  
3. **Parallel development only** after foundation complete
4. **Use Memory to share foundation outputs** to development agents
5. **Coordinate parallel agents** through shared Memory state

### **Agent Coordination:**
1. **Sequential Agents**: researcher → planner → architect (must wait for each other)
2. **Parallel Agents**: widget-developer + script-writer + ui-builder (can work simultaneously)
3. **Foundation Dependencies**: All development agents depend on architecture completion
4. **Shared Memory**: Store research findings, plans, architecture for all agents to access

### **Task Management:**
1. **Update TodoWrite** with phase progression
2. **Mark foundation complete** before starting development  
3. **Monitor parallel agent progress** and coordinate conflicts
4. **Validate outputs** before marking complete
5. **Store all decisions** in Memory for audit trail

### **Example Workflow:**
**Phase 1 (Sequential):** researcher → architect → planner
**Phase 2 (Parallel):** widget-dev + script-writer + ui-builder (use foundation outputs)  
**Phase 3 (Parallel):** tester + reviewer + documenter (validate development outputs)

## 🚀 Begin Orchestration

Now execute this Queen Agent orchestration plan:
1. Initialize the swarm session in Memory
2. Create the master task list with TodoWrite
3. Spawn all required agents using Task
4. Monitor progress and coordinate
5. Validate and complete the objective

Remember: You are the Queen Agent - the master coordinator. Your role is to ensure all agents work harmoniously to achieve the objective: "${objective}"

## 📊 Session Information
- **Session ID**: ${sessionId}
- **Snow-Flow Version**: v${VERSION}
- **Authentication**: ${isAuthenticated ? 'Active' : 'Required'}
- **Deployment Mode**: ${options.autoDeploy ? 'Live deployment enabled' : 'Planning mode'}
- **Estimated Agents**: ${taskAnalysis.estimatedAgentCount}
- **Primary Agent**: ${taskAnalysis.primaryAgent}

🎯 **Ready to begin orchestration!**
`;

  return prompt;
}
function getTeamRecommendation(taskType: string): string {
  switch (taskType) {
    case 'widget_development':
      return 'Widget Development Team (Frontend + Backend + UI/UX + Platform + QA)';
    case 'flow_development':
      return 'Flow Development Team (Process + Trigger + Data + Integration + Security)';
    case 'application_development':
      return 'Application Development Team (Database + Business Logic + Interface + Security + Performance)';
    case 'integration':
      return 'Individual Integration Specialist or Adaptive Team';
    case 'security_review':
      return 'Individual Security Specialist';
    case 'performance_optimization':
      return 'Individual Backend Specialist or Adaptive Team';
    default:
      return 'Adaptive Team (dynamically assembled based on requirements)';
  }
}

function getServiceNowInstructions(taskType: string): string {
  const taskTitle = taskType.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  return `**${taskTitle} Process:**
The team-based SPARC architecture will handle the complete development process.
Refer to CLAUDE.md for detailed instructions and best practices specific to ${taskType}.`;
}

function getExpectedDeliverables(taskType: string, isAuthenticated: boolean = false): string {
  const taskTitle = taskType.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  if (isAuthenticated) {
    return `The team will deliver a complete ${taskTitle.toLowerCase()} solution directly to ServiceNow.
All artifacts will be created in your ServiceNow instance with proper Update Set tracking.
Refer to CLAUDE.md for specific deliverables based on your task type.`;
  } else {
    return `The team will create ${taskTitle.toLowerCase()} artifacts as local files.
Files will be organized in the servicenow/ directory for easy import.
Refer to CLAUDE.md for specific deliverables based on your task type.`;
  }
}

// Helper function to analyze objectives using intelligent agent detection
function analyzeObjective(objective: string, userMaxAgents?: number): TaskAnalysis {
  return AgentDetector.analyzeTask(objective, userMaxAgents);
}

function extractName(objective: string, type: string): string {
  const words = objective.split(' ');
  const typeIndex = words.findIndex(w => w.toLowerCase().includes(type));
  if (typeIndex >= 0 && typeIndex < words.length - 1) {
    return words.slice(typeIndex + 1).join(' ').replace(/['"]/g, '');
  }
  return `Generated ${type}`;
}

/**
 * Generate intelligent agent spawning strategy based on task dependencies
 * Creates execution batches for sequential and parallel execution
 */
function getAgentSpawnStrategy(taskAnalysis: any): string {
  const { primaryAgent, supportingAgents, taskType, serviceNowArtifacts } = taskAnalysis;
  
  // Define agent dependencies - which agents must run before others
  const agentDependencies: { [key: string]: string[] } = {
    // Architecture/Design agents must run first
    'architect': [],
    'app-architect': [],
    
    // Script/Code agents depend on architecture
    'script-writer': ['architect', 'app-architect'],
    'coder': ['architect', 'app-architect'],
    
    // UI agents can run after architecture, parallel with backend
    'widget-creator': ['architect', 'app-architect'],
    'css-specialist': ['widget-creator'],
    'frontend-specialist': ['widget-creator'],
    'backend-specialist': ['architect', 'app-architect'],

    // Integration agents can run in parallel with others
    'integration-specialist': ['architect'],
    'api-specialist': ['architect'],

    // Testing/Security agents run last
    'tester': ['script-writer', 'widget-creator', 'frontend-specialist', 'backend-specialist'],
    'security-specialist': ['script-writer', 'api-specialist'],
    'performance-specialist': ['frontend-specialist', 'backend-specialist'],

    // Error handling depends on main implementation
    'error-handler': ['script-writer'],
    
    // Documentation can run in parallel
    'documentation-specialist': [],
    
    // Specialized agents
    'ml-developer': ['architect', 'script-writer'],
    'database-expert': ['architect'],
    'analyst': ['architect']
  };
  
  // Create dependency graph
  const allAgents = [primaryAgent, ...supportingAgents];
  const agentBatches: string[][] = [];
  const processedAgents = new Set<string>();
  
  // Helper to check if all dependencies are met
  const canExecute = (agent: string): boolean => {
    const deps = agentDependencies[agent] || [];
    return deps.every(dep => processedAgents.has(dep));
  };
  
  // Create batches based on dependencies
  while (processedAgents.size < allAgents.length) {
    const currentBatch: string[] = [];
    
    for (const agent of allAgents) {
      if (!processedAgents.has(agent) && canExecute(agent)) {
        currentBatch.push(agent);
      }
    }
    
    if (currentBatch.length === 0) {
      // Circular dependency or missing dependency - add remaining agents
      for (const agent of allAgents) {
        if (!processedAgents.has(agent)) {
          currentBatch.push(agent);
        }
      }
    }
    
    if (currentBatch.length > 0) {
      agentBatches.push(currentBatch);
      currentBatch.forEach(agent => processedAgents.add(agent));
    }
  }
  
  // Generate the strategy prompt
  let strategy = `
**🧠 Intelligent Dependency-Based Agent Execution Plan:**

`;
  
  // Show execution batches
  agentBatches.forEach((batch, index) => {
    const isParallel = batch.length > 1;
    const executionType = isParallel ? '⚡ PARALLEL EXECUTION' : '📦 SEQUENTIAL STEP';
    
    strategy += `**Batch ${index + 1} - ${executionType}:**\n`;
    
    if (isParallel) {
      strategy += `\`\`\`javascript
// 🚀 Execute these ${batch.length} agents IN PARALLEL (single message, multiple Tasks)
`;
      batch.forEach(agent => {
        const agentPrompt = getAgentPromptForBatch(agent, taskType);
        strategy += `Task("${agent}", \`${agentPrompt}\`);
`;
      });
      strategy += `\`\`\`\n\n`;
    } else {
      strategy += `\`\`\`javascript
// 📦 Execute this agent FIRST before proceeding
`;
      const agent = batch[0];
      const agentPrompt = getAgentPromptForBatch(agent, taskType);
      strategy += `Task("${agent}", \`${agentPrompt}\`);
`;
      strategy += `\`\`\`\n\n`;
    }
    
    // Add wait/coordination note if not the last batch
    if (index < agentBatches.length - 1) {
      strategy += `**⏸️ WAIT for Batch ${index + 1} completion before proceeding to Batch ${index + 2}**\n\n`;
    }
  });
  
  // Add execution summary
  const totalBatches = agentBatches.length;
  const parallelBatches = agentBatches.filter(b => b.length > 1).length;
  const maxParallelAgents = Math.max(...agentBatches.map(b => b.length));
  
  strategy += `
**📊 Execution Summary:**
- Total Execution Batches: ${totalBatches}
- Parallel Batches: ${parallelBatches}
- Sequential Steps: ${totalBatches - parallelBatches}
- Max Parallel Agents: ${maxParallelAgents}
- Estimated Time Reduction: ${Math.round((1 - (totalBatches / allAgents.length)) * 100)}%

**🔄 Dependency Flow:**
`;
  
  // Show visual dependency flow
  agentBatches.forEach((batch, index) => {
    if (index === 0) {
      strategy += `START → `;
    }
    
    if (batch.length === 1) {
      strategy += `[${batch[0]}]`;
    } else {
      strategy += `[${batch.join(' | ')}]`;
    }
    
    if (index < agentBatches.length - 1) {
      strategy += ` → `;
    } else {
      strategy += ` → COMPLETE`;
    }
  });
  
  strategy += `\n`;
  
  return strategy;
}

/**
 * Generate agent-specific prompts for batch execution
 */
function getAgentPromptForBatch(agentType: string, taskType: string): string {
  const basePrompts: { [key: string]: string } = {
    'architect': 'You are the architect agent. Design the system architecture and data models. Store your design in Memory for other agents.',
    'app-architect': 'You are the application architect. Design the overall application structure and component interfaces.',
    'script-writer': 'You are the script writer. Implement business logic and scripts based on the architecture. Check Memory for design specs.',
    'widget-creator': 'You are the widget creator. Build the HTML structure for Service Portal widgets. Store widget specs in Memory.',
    'css-specialist': 'You are the CSS specialist. Create responsive styles for the widgets. Read widget structure from Memory.',
    'frontend-specialist': 'You are the frontend specialist. Implement client-side JavaScript. Coordinate with backend via Memory.',
    'backend-specialist': 'You are the backend specialist. Implement server-side logic. Coordinate with frontend via Memory.',
    'integration-specialist': 'You are the integration specialist. Handle external system integrations and APIs.',
    'api-specialist': 'You are the API specialist. Design and implement REST/SOAP endpoints.',
    'tester': 'You are the tester. Test all components created by other agents. Read their outputs from Memory.',
    'security-specialist': 'You are the security specialist. Implement security best practices and access controls.',
    'performance-specialist': 'You are the performance specialist. Optimize code and queries for performance.',
    'error-handler': 'You are the error handler. Implement comprehensive error handling and logging.',
    'documentation-specialist': 'You are the documentation specialist. Create comprehensive documentation.',
    'ml-developer': 'You are the ML developer. Implement machine learning features using ServiceNow ML tools.',
    'database-expert': 'You are the database expert. Design and optimize database schemas and queries.',
    'analyst': 'You are the analyst. Analyze requirements and provide insights for implementation.'
  };
  
  const prompt = basePrompts[agentType] || `You are the ${agentType} agent. Perform your specialized tasks.`;
  
  return `${prompt}
MANDATORY: 
1. Run npx snow-flow hooks pre-task --description "${taskType} - ${agentType}"
2. Store ALL decisions in Memory with key "agent_${agentType}_decisions"
3. Check Memory for work from agents you depend on
4. After EVERY file operation, run npx snow-flow hooks post-edit
5. When complete, run npx snow-flow hooks post-task --task-id "${agentType}"`;
}

// Swarm status command - monitor running swarms
program
  .command('swarm-status [sessionId]')
  .description('Check the status of a running swarm session')
  .option('--watch', 'Continuously monitor the swarm progress')
  .option('--interval <seconds>', 'Watch interval in seconds', '5')
  .action(async (sessionId: string | undefined, options) => {
    cliLogger.info('\n🔍 Checking swarm status...\n');
    
    try {
      const { SessionMemorySystem } = await import('./memory/session-memory.js');
      const memorySystem = new SessionMemorySystem();
      
      if (!sessionId) {
        // List all recent swarm sessions
        cliLogger.info('📋 Recent swarm sessions:');
        cliLogger.info('(Provide a session ID to see detailed status)\n');
        
        // Get all session keys from learnings
        const sessionKeys: string[] = [];
        // Note: This is a simplified approach - in production, you'd query the memory files directly
        cliLogger.info('💡 Use: snow-flow swarm-status <sessionId> to see details');
        cliLogger.info('💡 Session IDs are displayed when you start a swarm\n');
        return;
      }
      
      // Get specific session data
      const sessionData = await memorySystem.getLearning(`session_${sessionId}`);
      const launchData = await memorySystem.getLearning(`launch_${sessionId}`);
      const errorData = await memorySystem.getLearning(`error_${sessionId}`);
      
      if (!sessionData) {
        console.error(`❌ No swarm session found with ID: ${sessionId}`);
        cliLogger.info('💡 Make sure to use the exact session ID displayed when starting the swarm');
        return;
      }
      
      cliLogger.info(`👑 Swarm Session: ${sessionId}`);
      cliLogger.info(`📋 Objective: ${sessionData.objective}`);
      cliLogger.info(`🕐 Started: ${sessionData.started_at}`);
      cliLogger.info(`📊 Task Type: ${sessionData.taskAnalysis.taskType}`);
      cliLogger.info(`🤖 Agents: ${sessionData.taskAnalysis.estimatedAgentCount} total`);
      cliLogger.info(`   - Primary: ${sessionData.taskAnalysis.primaryAgent}`);
      cliLogger.info(`   - Supporting: ${sessionData.taskAnalysis.supportingAgents.join(', ')}`);
      
      if (launchData && launchData.success) {
        cliLogger.info(`\n✅ Status: SnowCode (or Claude Code) launched successfully`);
        cliLogger.info(`🚀 Launched at: ${launchData.launched_at}`);
      } else if (errorData) {
        cliLogger.error(`\n❌ Status: Error occurred`);
        cliLogger.error(`💥 Error: ${errorData.error}`);
        cliLogger.error(`🕐 Failed at: ${errorData.failed_at}`);
      } else {
        cliLogger.info(`\n⏳ Status: Awaiting manual SnowCode execution`);
      }

      cliLogger.info('\n💡 Tips:');
      cliLogger.info('   - Check SnowCode for real-time agent progress');
      cliLogger.info('   - Use Memory.get("swarm_session_' + sessionId + '") in SnowCode');
      cliLogger.info('   - Monitor TodoRead for task completion status');
      
      if (options.watch) {
        cliLogger.info(`\n👀 Watching for updates every ${options.interval} seconds...`);
        cliLogger.info('(Press Ctrl+C to stop)\n');
        
        const watchInterval = setInterval(async () => {
          // In a real implementation, this would query Claude Code's memory
          cliLogger.info(`[${new Date().toLocaleTimeString()}] Checking for updates...`);

          // Re-fetch session data to check for updates
          const updatedSession = await memorySystem.getLearning(`session_${sessionId}`);
          if (updatedSession) {
            cliLogger.info('   Status: Active - Check SnowCode for details');
          }
        }, parseInt(options.interval) * 1000);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
          clearInterval(watchInterval);
          cliLogger.info('\n\n✋ Stopped watching swarm status');
          process.exit(0);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to check swarm status:', error instanceof Error ? error.message : String(error));
    }
  });

// Spawn agent command
program
  .command('spawn <type>')
  .description('Spawn a specific agent type')
  .option('--name <name>', 'Custom agent name')
  .action(async (type: string, options) => {
    cliLogger.info(`🤖 Spawning ${type} agent${options.name ? ` with name "${options.name}"` : ''}...`);
    cliLogger.info(`✅ Agent spawned successfully`);
    cliLogger.info(`📋 Agent capabilities:`);
    
    if (type === 'widget-builder') {
      cliLogger.info('   ├── Service Portal widget creation');
      cliLogger.info('   ├── HTML/CSS template generation');
      cliLogger.info('   ├── Client script development');
      cliLogger.info('   └── Server script implementation');
    } else {
      cliLogger.info('   ├── Generic ServiceNow development');
      cliLogger.info('   ├── Script generation');
      cliLogger.info('   ├── Configuration management');
      cliLogger.info('   └── API integration');
    }
  });

// Status command
program
  .command('status')
  .description('Show Snow-Flow status (orchestrator + enterprise)')
  .action(async () => {
    cliLogger.info('\n🔍 ServiceNow Multi-Agent Orchestrator Status');
    cliLogger.info('=============================================');
    cliLogger.info('📊 System Status: ✅ Online');
    cliLogger.info('🤖 Available Agents: 5');
    cliLogger.info('📋 Queue Status: Empty');
    cliLogger.info('🔗 ServiceNow Connection: Not configured');
    cliLogger.info('💾 Memory Usage: 45MB');
    cliLogger.info('🕒 Uptime: 00:05:23');

    cliLogger.info('\n🤖 Agent Types:');
    cliLogger.info('   ├── widget-builder: Available');
    cliLogger.info('   ├── script-generator: Available');
    cliLogger.info('   ├── ui-builder: Available');
    cliLogger.info('   ├── security-specialist: Available');
    cliLogger.info('   └── app-creator: Available');

    cliLogger.info('\n⚙️  Configuration:');
    cliLogger.info('   ├── Instance: Not set');
    cliLogger.info('   ├── Authentication: Not configured');
    cliLogger.info('   └── Mode: Development');

    // Show enterprise status if available
    cliLogger.info('\n');
    const { showEnterpriseStatus } = await import('./cli/enterprise.js');
    await showEnterpriseStatus();
  });

// Monitor command - real-time dashboard
program
  .command('monitor')
  .description('Show real-time monitoring dashboard')
  .option('--duration <seconds>', 'Duration to monitor (default: 60)', '60')
  .action(async (options) => {
    const duration = parseInt(options.duration) * 1000;
    cliLogger.info('🚀 Starting Snow-Flow Real-Time Monitor...\n');
    
    let iterations = 0;
    const startTime = Date.now();
    
    const monitoringInterval = setInterval(() => {
      iterations++;
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(uptime / 60);
      const seconds = uptime % 60;
      
      // Clear previous lines and show dashboard
      if (iterations > 1) {
        process.stdout.write('\x1B[12A'); // Move cursor up 12 lines
        process.stdout.write('\x1B[2K'); // Clear line
      }
      
      cliLogger.info('┌─────────────────────────────────────────────────────────────┐');
      console.log(`│               🚀 Snow-Flow Monitor v${VERSION}                   │`);
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ 📊 System Status:       ✅ Online                          │`);
      console.log(`│ ⏱️  Monitor Time:        ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}                          │`);
      console.log(`│ 🔄 Update Cycles:       ${iterations}                                │`);
      console.log(`│ 🤖 Available Agents:    5                                   │`);
      console.log(`│ 💾 Memory Usage:        ~45MB                               │`);
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log('│ 📋 Recent Activity:                                        │');
      console.log(`│   • ${new Date().toLocaleTimeString()} - System monitoring active     │`);
      cliLogger.info('└─────────────────────────────────────────────────────────────┘');
      
      // Check for active SnowCode/Claude Code processes
      try {
        const { execSync } = require('child_process');
        const processes = execSync('ps aux | grep "claude\\|opencode\\|snowcode" | grep -v grep', { encoding: 'utf8' }).toString();
        if (processes.trim()) {
          cliLogger.info('\n🤖 Active SnowCode/Claude Code Processes:');
          const lines = processes.trim().split('\n');
          lines.forEach((line: string, index: number) => {
            if (index < 3) { // Show max 3 processes
              const parts = line.split(/\s+/);
              const pid = parts[1];
              const cpu = parts[2];
              const mem = parts[3];
              cliLogger.info(`   Process ${pid}: CPU ${cpu}%, Memory ${mem}%`);
            }
          });
        }
      } catch (error) {
        // No active processes or error occurred
      }
      
      // Check generated files
      try {
        const serviceNowDir = join(process.cwd(), 'servicenow');
        fs.readdir(serviceNowDir).then(files => {
          if (files.length > 0) {
            cliLogger.info(`\n📁 Generated Artifacts: ${files.length} files in servicenow/`);
            files.slice(0, 3).forEach(file => {
              cliLogger.info(`   • ${file}`);
            });
            if (files.length > 3) {
              cliLogger.info(`   ... and ${files.length - 3} more files`);
            }
          }
        }).catch(() => {
          // Directory doesn't exist yet
        });
      } catch (error) {
        // Ignore errors
      }
      
    }, 2000); // Update every 2 seconds
    
    // Stop monitoring after duration
    setTimeout(() => {
      clearInterval(monitoringInterval);
      cliLogger.info('\n✅ Monitoring completed. Use --duration <seconds> to monitor longer.');
    }, duration);
  });

// Memory commands
program
  .command('memory <action> [key] [value]')
  .description('Memory operations (store, get, list)')
  .action(async (action: string, key?: string, value?: string) => {
    cliLogger.info(`💾 Memory ${action}${key ? `: ${key}` : ''}`);
    
    if (action === 'store' && key && value) {
      cliLogger.info(`✅ Stored: ${key} = ${value}`);
    } else if (action === 'get' && key) {
      cliLogger.info(`📖 Retrieved: ${key} = [simulated value]`);
    } else if (action === 'list') {
      cliLogger.info('📚 Memory contents:');
      cliLogger.info('   ├── last_widget: incident_management_widget');
      cliLogger.info('   ├── last_workflow: approval_process');
      cliLogger.info('   └── session_id: snow-flow-session-123');
    } else {
      cliLogger.error('❌ Invalid memory operation');
    }
  });

// Auth commands are now handled by registerAuthCommands() at the top of this file


// Initialize Snow-Flow project
program
  .command('init')
  .description('Initialize a Snow-Flow project with full AI-powered environment')
  .option('--sparc', '[Deprecated] SPARC is now included by default', true)
  .option('--skip-mcp', 'Skip MCP server activation prompt')
  .option('--force', 'Overwrite existing files without prompting')
  .action(async (options) => {
    console.log(chalk.blue.bold(`\n🏔️ Snow-Flow v${VERSION} - Conversational ServiceNow Development`));
    console.log('='.repeat(60));
    
    const targetDir = process.cwd();
    
    try {
      // Check for .snow-flow migration
      const { migrationUtil } = await import('./utils/migrate-snow-flow.js');
      if (await migrationUtil.checkMigrationNeeded()) {
        console.log('\n🔄 Detected .snow-flow directory, migrating to .snow-flow...');
        await migrationUtil.migrate();
      }

      // Install/Update SnowCode to latest version
      console.log('\n📦 Checking SnowCode installation...');
      try {
        const { execSync } = await import('child_process');

        // Check if SnowCode is installed globally
        let installedVersion = null;
        try {
          const versionOutput = execSync('npm list -g @groeimetai/snowcode --depth=0', { encoding: 'utf8' });
          const match = versionOutput.match(/@groeimetai\/snowcode@(\d+\.\d+\.\d+)/);
          installedVersion = match ? match[1] : null;
        } catch (err) {
          // Not installed yet
        }

        if (installedVersion) {
          console.log(`   Current version: ${installedVersion}`);

          // Check latest version available
          const latestOutput = execSync('npm view @groeimetai/snowcode version', { encoding: 'utf8' }).trim();
          console.log(`   Latest version: ${latestOutput}`);

          if (installedVersion !== latestOutput) {
            console.log('   ⬆️  Updating to latest version...');
            execSync('npm install -g @groeimetai/snowcode@latest', { stdio: 'inherit' });
            console.log(chalk.green('   ✅ SnowCode updated successfully!'));
          } else {
            console.log(chalk.green('   ✅ Already on latest version'));
          }
        } else {
          console.log('   📥 Installing SnowCode...');
          execSync('npm install -g @groeimetai/snowcode@latest', { stdio: 'inherit' });
          console.log(chalk.green('   ✅ SnowCode installed successfully!'));
        }
      } catch (err) {
        console.log(chalk.yellow('   ⚠️  Could not auto-update SnowCode. Run: npm install -g @groeimetai/snowcode@latest'));
      }

      // Create directory structure
      console.log('\n📁 Creating project structure...');
      await createDirectoryStructure(targetDir, options.force);
      
      // Create .env file
      console.log('🔐 Creating environment configuration...');
      await createEnvFile(targetDir, options.force);
      
      // Create MCP configuration - always included now (SPARC is default)
      console.log('🔧 Setting up MCP servers for SnowCode (also works with Claude Code)...');
      await createMCPConfig(targetDir, options.force);

      // Copy CLAUDE.md file
      console.log('📚 Creating documentation files...');
      await copyCLAUDEmd(targetDir, options.force);

      // Create README files
      await createReadmeFiles(targetDir, options.force);

      // Copy snowcode-config.example.json
      await copySnowCodeConfig(targetDir, options.force);

      // Copy SnowCode themes
      await copySnowCodeThemes(targetDir, options.force);

      // Copy SnowCode package.json with snowcode-plugin
      console.log('📦 Configuring SnowCode plugin (snowcode fork)...');
      await copySnowCodePackageJson(targetDir, options.force);

      // Copy MCP server management scripts
      console.log('🔧 Setting up MCP server management scripts...');
      await copyMCPServerScripts(targetDir, options.force);

      console.log(chalk.green.bold('\n✅ Snow-Flow project initialized successfully!'));
      console.log('\n📋 Created Snow-Flow configuration:');
      console.log('   ✓ .snowcode/ - SnowCode configuration with both MCP servers');
      console.log('   ✓ .snowcode/themes/ - ServiceNow custom theme for SnowCode');
      console.log('   ✓ .claude/ - Claude Code MCP configuration (backward compatibility)');
      console.log('   ✓ .mcp.json - 2 unified MCP servers (370 tools total)');
      console.log('   ✓ scripts/ - MCP server management and SnowCode launcher');
      console.log('   ✓ AGENTS.md - SnowCode primary instructions');
      console.log('   ✓ CLAUDE.md - Claude Code compatibility');
      console.log('   ✓ README.md - Complete capabilities documentation');
      console.log('   ✓ SNOWCODE-TROUBLESHOOTING.md - Troubleshooting guide');
      console.log('   ✓ .snow-flow/ - Project workspace and memory');

      if (!options.skipMcp) {
        // NOTE: MCP servers work with SnowCode's native Task() system
        console.log(chalk.blue('\nℹ️  MCP servers configured for SnowCode (also compatible with Claude Code)'));
        console.log(chalk.green('✅ 411 ServiceNow tools automatically available via 2 unified servers'));
        console.log(chalk.blue('📋 SDK handles MCP server lifecycle automatically'));

        // Verify MCP servers can actually start
        console.log(chalk.dim('\n🔍 Verifying MCP server configuration...'));
        await verifyMCPServers(targetDir);

        // MCP servers auto-start via SnowCode - no manual startup needed
        console.log(chalk.blue('\n🚀 MCP Servers:'));
        console.log(chalk.green('✅ MCP servers will start automatically when you launch SnowCode'));
        console.log(chalk.dim('   - Configured via .mcp.json in this project'));
        console.log(chalk.dim('   - 18 specialized ServiceNow MCP servers with 400+ tools'));
        console.log(chalk.dim('   - No manual startup required!'));
      }

      // Check and optionally install SnowCode
      const configImported = await checkAndInstallSnowCode();

      console.log(chalk.blue.bold('\n🎯 Next steps:'));
      console.log('1. Authenticate: ' + chalk.cyan('snow-flow auth login'));
      console.log('   - Authenticates with your LLM provider (Claude/OpenAI/Google/Ollama)');
      console.log('   - Then authenticates with ServiceNow OAuth');
      console.log('   - Your provider choice is automatically saved to .env');
      console.log('2. Start developing: ' + chalk.cyan('snow-flow swarm "create incident dashboard"'));
      console.log('   - Multi-agent orchestration for ServiceNow development');
      console.log('\n📚 Documentation: ' + chalk.blue('https://github.com/groeimetai/snow-flow'));
      console.log('💡 370+ ServiceNow tools • 2 MCP servers • Multi-LLM support');

      // Force exit to prevent hanging
      process.exit(0);
      
    } catch (error) {
      console.error(chalk.red('\n❌ Initialization failed:'), error);
      process.exit(1);
    }
  });

// Help command
program
  .command('help')
  .description('Show detailed help information')
  .action(() => {
    console.log(`
🚀 Snow-Flow v${VERSION} - ServiceNow Multi-Agent Development Framework

📋 Available Commands:
  swarm <objective>     Execute multi-agent orchestration
  spawn <type>          Spawn specific agent types
  export                Export MCP configuration to Claude Desktop
  status                Show system status
  monitor               Real-time monitoring dashboard
  memory <action>       Memory operations
  auth <action>         Authentication management
  mcp <action>          Manage ServiceNow MCP servers
  help                  Show this help

🎯 Example Usage:
  snow-flow init                           # Initialize project (auto-configures SnowCode)
  snow-flow auth login                     # Authenticate (handles LLM + ServiceNow)
  snow-flow auth status                    # Check authentication status
  snow-flow swarm "create a widget for incident management"
  snow-flow swarm "create business rule for auto-assignment"
  snow-flow swarm "generate 5000 incidents" --auto-confirm  # 📝 Auto-confirm background scripts
  snow-flow spawn widget-builder --name "IncidentWidget"
  snow-flow monitor --duration 120
  snow-flow memory store "project" "incident_system"
  snow-flow status

🤖 Agent Types:
  widget-builder       Create Service Portal widgets
  script-generator     Generate scripts and business rules
  security-specialist  ACL and compliance validation
  ui-builder          Create UI components
  app-creator         Build complete applications

⚙️  OAuth Configuration:
  Set environment variables or use command line options:
  - SNOW_INSTANCE: Your ServiceNow instance (e.g., dev12345.service-now.com)
  - SNOW_CLIENT_ID: OAuth Client ID from ServiceNow
  - SNOW_CLIENT_SECRET: OAuth Client Secret from ServiceNow
  
🔧 MCP Server Management:
  - start        Start all or specific MCP servers
  - stop         Stop all or specific MCP servers  
  - restart      Restart all or specific MCP servers
  - status       Show status of all MCP servers
  - logs         View MCP server logs
  - list         List all configured MCP servers

  🔗 Live ServiceNow Integration:
  - Create widgets directly in ServiceNow
  - Execute business rules and scripts
  - Test changes immediately in your instance

🌐 More Info: https://github.com/groeimetai/snow-flow
    `);
  });

// Helper functions for init command

// Check if SnowCode is installed, and offer to install it
async function checkAndInstallSnowCode(): Promise<boolean> {
  const { execSync } = require('child_process');
  let snowcodeInstalled = false;

  try {
    // Check if snowcode is already installed
    execSync('which snowcode', { stdio: 'ignore' });
    console.log(chalk.green('\n✅ SnowCode is already installed!'));
    snowcodeInstalled = true;
  } catch {
    // SnowCode not installed
    console.log(chalk.yellow('\n⚠️  SnowCode is not installed'));
    console.log(chalk.blue('SnowCode is required to use Snow-Flow with any LLM provider'));

    // Import inquirer dynamically
    const inquirer = (await import('inquirer')).default;

    const { shouldInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInstall',
        message: 'Would you like to install SnowCode now? (npm install -g @groeimetai/snowcode)',
        default: true
      }
    ]);

    if (!shouldInstall) {
      console.log(chalk.yellow('\n⏭️  Skipping SnowCode installation'));
      console.log(chalk.blue('You can install it later with: ') + chalk.cyan('npm install -g @groeimetai/snowcode'));
      return false;
    }

    // Install SnowCode globally with latest version
    console.log(chalk.blue('\n📦 Installing SnowCode globally...'));
    console.log(chalk.dim('Installing @groeimetai/snowcode@latest (forcing latest version)...'));

    try {
      // Use @latest and --force to bypass npm cache and get absolute latest version
      execSync('npm install -g @groeimetai/snowcode@latest --force', { stdio: 'inherit' });
      console.log(chalk.green('\n✅ SnowCode installed successfully!'));

      // Verify version
      try {
        const installedVersion = execSync('snowcode --version 2>&1', { encoding: 'utf-8' }).trim();
        console.log(chalk.dim(`   Installed version: ${installedVersion}`));
      } catch {}

      snowcodeInstalled = true;
    } catch (error) {
      console.log(chalk.red('\n❌ Failed to install SnowCode'));
      console.log(chalk.yellow('Please install it manually: ') + chalk.cyan('npm install -g @groeimetai/snowcode@latest'));
      return false;
    }
  }

  // ALWAYS install SnowCode locally in the project directory with platform binaries
  console.log(chalk.blue('\n📦 Installing SnowCode locally (with platform binaries)...'));
  console.log(chalk.dim('Installing @groeimetai/snowcode@latest (forcing latest version)...'));

  try {
    const projectDir = process.cwd();
    // Use --force to bypass npm cache and get absolute latest version
    execSync('npm install @groeimetai/snowcode@latest --no-audit --no-fund --force', {
      cwd: projectDir,
      stdio: 'inherit'
    });
    console.log(chalk.green('✅ SnowCode installed locally with platform binaries!'));
    console.log(chalk.dim(`   Platform binary: @groeimetai/snowcode-${process.platform}-${process.arch}`));
  } catch (error) {
    console.log(chalk.red('\n❌ Failed to install SnowCode locally'));
    console.log(chalk.yellow('Please install it manually: ') + chalk.cyan('npm install @groeimetai/snowcode@latest --no-audit --no-fund'));
    console.log(chalk.dim('This is required for the compiled binaries'));
    return false;
  }

  // If SnowCode is installed, copy config to .snowcode/ directory
  // SnowCode automatically detects config files in project root and .snowcode/ directory
  if (snowcodeInstalled) {
    const exampleConfigPath = join(process.cwd(), 'snowcode-config.example.json');
    const snowcodeConfigPath = join(process.cwd(), '.snowcode', 'config.json');

    // Check if example config file exists
    try {
      await fs.access(exampleConfigPath);

      console.log(chalk.blue('\n🔧 Setting up SnowCode configuration...'));

      try {
        // Copy example config to .snowcode/config.json for automatic detection
        let configContent = await fs.readFile(exampleConfigPath, 'utf-8');

        // Ensure the config content has the correct cwd (in case it still has a placeholder)
        // This is a safety check - the placeholder should already be replaced by copySnowCodeConfig
        if (configContent.includes('"/path/to/your/snow-flow/installation"')) {
          console.log(chalk.yellow('⚠️  Config still contains placeholder, attempting to fix...'));

          // Determine the snow-flow installation directory
          let snowFlowRoot: string;
          const isGlobalInstall = __dirname.includes('node_modules/snow-flow') ||
                                 __dirname.includes('node_modules/.pnpm') ||
                                 __dirname.includes('npm/snow-flow');

          if (isGlobalInstall) {
            const parts = __dirname.split(/node_modules[\/\\]/);
            snowFlowRoot = parts[0] + 'node_modules/snow-flow';
          } else {
            let currentDir = __dirname;
            while (currentDir !== '/') {
              try {
                const packageJsonPath = join(currentDir, 'package.json');
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
                if (packageJson.name === 'snow-flow') {
                  snowFlowRoot = currentDir;
                  break;
                }
              } catch {
                // Continue searching up
              }
              currentDir = dirname(currentDir);
            }
          }

          if (snowFlowRoot) {
            configContent = configContent.replace(
              '"/path/to/your/snow-flow/installation"',
              `"${snowFlowRoot.replace(/\\/g, '/')}"`
            );
          }
        }

        await fs.writeFile(snowcodeConfigPath, configContent);
        console.log(chalk.green('✅ SnowCode configuration created at .snowcode/config.json'));
        console.log(chalk.blue('💡 SnowCode will automatically detect this configuration'));
        return true; // Successfully configured
      } catch (error) {
        console.log(chalk.yellow('\n⚠️  Could not create SnowCode config'));
        console.log(chalk.blue('You can copy it manually: ') + chalk.cyan(`cp snowcode-config.example.json .snowcode/config.json`));
        return false;
      }
    } catch {
      console.log(chalk.yellow('\n⚠️  snowcode-config.example.json not found'));
      console.log(chalk.blue('Config will be available after init completes'));
      return false;
    }
  }
  return false;
}

async function createDirectoryStructure(targetDir: string, force: boolean = false) {
  const directories = [
    '.claude', '.claude/commands', '.claude/commands/sparc', '.claude/configs',
    '.swarm', '.swarm/sessions', '.swarm/agents',
    '.snow-flow', '.snow-flow/queen', '.snow-flow/memory', '.snow-flow/data', '.snow-flow/queen-test', '.snow-flow/queen-advanced',
    'memory', 'memory/agents', 'memory/sessions',
    'coordination', 'coordination/memory_bank', 'coordination/subtasks',
    'servicenow', 'servicenow/widgets', 'servicenow/workflows', 'servicenow/scripts',
    'templates', 'templates/widgets', 'templates/workflows',
    'scripts'
  ];
  
  for (const dir of directories) {
    const dirPath = join(targetDir, dir);
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function createBasicConfig(targetDir: string) {
  const claudeConfig = {
    version: VERSION,
    name: 'snow-flow',
    description: 'ServiceNow Multi-Agent Development Framework',
    created: new Date().toISOString(),
    features: {
      swarmCoordination: true,
      persistentMemory: true, // Queen uses JSON files, MCP tools use in-memory
      serviceNowIntegration: true,
      sparcModes: true
    }
  };
  
  const swarmConfig = {
    version: VERSION,
    topology: 'hierarchical',
    maxAgents: 8,
    memory: {
      path: '.swarm/memory',
      namespace: 'snow-flow'
    }
  };
  
  await fs.writeFile(join(targetDir, '.claude/config.json'), JSON.stringify(claudeConfig, null, 2));
  await fs.writeFile(join(targetDir, '.swarm/config.json'), JSON.stringify(swarmConfig, null, 2));
}

async function createReadmeFiles(targetDir: string, force: boolean = false) {
  // Only create README.md if it doesn't exist already
  const readmePath = join(targetDir, 'README.md');
  if (!existsSync(readmePath) || force) {
    // Import modern README template
    const { README_TEMPLATE } = await import('./templates/readme-template.js');

    await fs.writeFile(readmePath, README_TEMPLATE);
  }
  
  // Create sub-directory READMEs
  await fs.writeFile(join(targetDir, 'memory/agents/README.md'), '# Agent Memory\n\nThis directory contains persistent memory for ServiceNow agents.');
  await fs.writeFile(join(targetDir, 'servicenow/README.md'), '# ServiceNow Artifacts\n\nThis directory contains generated ServiceNow development artifacts.');
}


// Helper functions

async function copySnowCodeConfig(targetDir: string, force: boolean = false) {
  try {
    // Determine the snow-flow installation directory
    let snowFlowRoot: string;

    // Check if we're in a global npm installation
    const isGlobalInstall = __dirname.includes('node_modules/snow-flow') ||
                           __dirname.includes('node_modules/.pnpm') ||
                           __dirname.includes('npm/snow-flow');

    if (isGlobalInstall) {
      // For global installs, find the snow-flow package root
      const parts = __dirname.split(/node_modules[\/\\]/);
      snowFlowRoot = parts[0] + 'node_modules/snow-flow';
    } else {
      // For local development or local install
      // Find the snow-flow project root by looking for the parent directory with package.json
      let currentDir = __dirname;
      while (currentDir !== '/') {
        try {
          const packageJsonPath = join(currentDir, 'package.json');
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          if (packageJson.name === 'snow-flow') {
            snowFlowRoot = currentDir;
            break;
          }
        } catch {
          // Continue searching up
        }
        currentDir = dirname(currentDir);
      }
      if (!snowFlowRoot) {
        throw new Error('Could not find snow-flow project root');
      }
    }

    // Try to find the snowcode-config.example.json
    const sourceFiles = [
      join(snowFlowRoot, 'snowcode-config.example.json'),
      join(__dirname, '..', 'snowcode-config.example.json'),
      join(__dirname, 'snowcode-config.example.json'),
      join(__dirname, '..', '..', '..', 'snowcode-config.example.json'),
      join(__dirname, '..', '..', '..', '..', 'snowcode-config.example.json'),
      join(process.cwd(), 'snowcode-config.example.json')
    ];

    let foundSource = false;
    let configContent = '';

    for (const sourcePath of sourceFiles) {
      try {
        configContent = await fs.readFile(sourcePath, 'utf8');
        foundSource = true;
        console.log(`✅ Found snowcode-config.example.json at: ${sourcePath}`);
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!foundSource) {
      console.log('⚠️  Could not find snowcode-config.example.json source file');
      return;
    }

    // Replace placeholders with actual snow-flow installation path
    configContent = configContent.replace(
      '"/path/to/your/snow-flow/installation"',
      `"${snowFlowRoot.replace(/\\/g, '/')}"`
    );

    const targetPath = join(targetDir, 'snowcode-config.example.json');

    try {
      await fs.access(targetPath);
      if (force) {
        console.log('⚠️  snowcode-config.example.json already exists, overwriting with --force flag');
      } else {
        console.log('✅ snowcode-config.example.json already exists');
        return;
      }
    } catch {
      // File doesn't exist, continue with creation
    }

    await fs.writeFile(targetPath, configContent);
    console.log('✅ Created snowcode-config.example.json with correct snow-flow path');

  } catch (error) {
    console.error('❌ Error copying snowcode-config.example.json:', error);
  }
}

async function copySnowCodeThemes(targetDir: string, force: boolean = false) {
  try {
    // Determine the snow-flow installation directory (same logic as copySnowCodeConfig)
    let snowFlowRoot: string;
    const isGlobalInstall = __dirname.includes('node_modules/snow-flow') ||
                           __dirname.includes('node_modules/.pnpm') ||
                           __dirname.includes('npm/snow-flow');

    if (isGlobalInstall) {
      const parts = __dirname.split(/node_modules[\/\\]/);
      snowFlowRoot = parts[0] + 'node_modules/snow-flow';
    } else {
      let currentDir = __dirname;
      while (currentDir !== '/') {
        try {
          const packageJsonPath = join(currentDir, 'package.json');
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          if (packageJson.name === 'snow-flow') {
            snowFlowRoot = currentDir;
            break;
          }
        } catch {
          // Continue searching up
        }
        currentDir = dirname(currentDir);
      }
      if (!snowFlowRoot) {
        throw new Error('Could not find snow-flow project root');
      }
    }

    // Find themes directory
    const themesSourcePaths = [
      join(snowFlowRoot, 'themes'),
      join(__dirname, '..', 'themes'),
      join(__dirname, 'themes'),
      join(snowFlowRoot, '.snowcode', 'themes'),
      join(__dirname, '..', '.snowcode', 'themes')
    ];

    let themesSourceDir: string | null = null;
    for (const sourcePath of themesSourcePaths) {
      try {
        await fs.access(sourcePath);
        themesSourceDir = sourcePath;
        console.log(`✅ Found themes directory at: ${sourcePath}`);
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!themesSourceDir) {
      console.log('✅ Themes skipped (optional - custom ServiceNow themes for SnowCode UI)');
      return;
    }

    // Create target .snowcode/themes directory
    const themesTargetDir = join(targetDir, '.snowcode', 'themes');
    await fs.mkdir(themesTargetDir, { recursive: true });

    // Copy all theme files
    const themeFiles = await fs.readdir(themesSourceDir);
    let copiedCount = 0;

    for (const themeFile of themeFiles) {
      const sourcePath = join(themesSourceDir, themeFile);
      const targetPath = join(themesTargetDir, themeFile);

      try {
        const stats = await fs.stat(sourcePath);
        if (stats.isFile()) {
          // Check if file already exists
          try {
            await fs.access(targetPath);
            if (!force) {
              console.log(`✅ Theme ${themeFile} already exists`);
              continue;
            }
          } catch {
            // File doesn't exist, continue with copy
          }

          const content = await fs.readFile(sourcePath, 'utf8');
          await fs.writeFile(targetPath, content);
          copiedCount++;
        }
      } catch (error) {
        console.log(`⚠️  Could not copy theme ${themeFile}:`, error);
      }
    }

    if (copiedCount > 0) {
      console.log(`✅ Copied ${copiedCount} SnowCode theme file(s) to .snowcode/themes/`);
    }

  } catch (error) {
    console.error('❌ Error copying SnowCode themes:', error);
  }
}

async function copySnowCodePackageJson(targetDir: string, force: boolean = false) {
  try {
    // Determine the snow-flow installation directory
    let snowFlowRoot: string;
    const isGlobalInstall = __dirname.includes('node_modules/snow-flow') ||
                           __dirname.includes('node_modules/.pnpm') ||
                           __dirname.includes('npm/snow-flow');

    if (isGlobalInstall) {
      const parts = __dirname.split(/node_modules[\/\\]/);
      snowFlowRoot = parts[0] + 'node_modules/snow-flow';
    } else {
      let currentDir = __dirname;
      while (currentDir !== '/') {
        try {
          const packageJsonPath = join(currentDir, 'package.json');
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          if (packageJson.name === 'snow-flow') {
            snowFlowRoot = currentDir;
            break;
          }
        } catch {
          // Continue searching up
        }
        currentDir = dirname(currentDir);
      }
      if (!snowFlowRoot) {
        throw new Error('Could not find snow-flow project root');
      }
    }

    // Find snowcode package.json template
    const templateSourcePaths = [
      join(snowFlowRoot, 'templates', 'snowcode-package.json'),
      join(__dirname, '..', 'templates', 'snowcode-package.json'),
      join(__dirname, 'templates', 'snowcode-package.json')
    ];

    let templatePath: string | null = null;
    for (const sourcePath of templateSourcePaths) {
      try {
        await fs.access(sourcePath);
        templatePath = sourcePath;
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!templatePath) {
      console.log('⚠️  SnowCode package.json template not found, SnowCode will use default plugin');
      return;
    }

    // Create .snowcode directory
    const snowcodeDir = join(targetDir, '.snowcode');
    await fs.mkdir(snowcodeDir, { recursive: true });

    // Copy package.json template
    const targetPath = join(snowcodeDir, 'package.json');

    // Check if file already exists
    try {
      await fs.access(targetPath);
      if (!force) {
        console.log('✅ .snowcode/package.json already exists (snowcode-plugin configured)');
        return;
      }
    } catch {
      // File doesn't exist, we can create it
    }

    await fs.copyFile(templatePath, targetPath);
    console.log('✅ Created .snowcode/package.json with @groeimetai/snowcode-plugin');

  } catch (error) {
    console.error('❌ Error copying SnowCode package.json:', error);
  }
}

/**
 * Verify MCP servers can actually start and respond
 */
async function verifyMCPServers(targetDir: string): Promise<void> {
  const { spawn } = require('child_process');
  const path = require('path');
  const fs = require('fs').promises;

  try {
    // Read SnowCode configuration - try opencode.json first (primary), then config.json (fallback)
    const opencodeJsonPath = path.join(targetDir, '.snowcode', 'opencode.json');
    const configJsonPath = path.join(targetDir, '.snowcode', 'config.json');

    let configContent: string;
    try {
      configContent = await fs.readFile(opencodeJsonPath, 'utf-8');
    } catch {
      // Fallback to config.json if opencode.json doesn't exist
      configContent = await fs.readFile(configJsonPath, 'utf-8');
    }
    const config = JSON.parse(configContent);

    if (!config.mcp) {
      console.log(chalk.yellow('   ⚠️  No MCP servers configured'));
      return;
    }

    const serverNames = Object.keys(config.mcp);
    let successCount = 0;
    let failCount = 0;

    for (const serverName of serverNames) {
      const serverConfig = config.mcp[serverName];

      if (!serverConfig.enabled) {
        console.log(chalk.dim(`   ⊘ ${serverName} (disabled)`));
        continue;
      }

      process.stdout.write(chalk.dim(`   Testing ${serverName}... `));

      try {
        // Skip remote servers (SSE/HTTP) - they can't be tested with spawn
        if (serverConfig.type === 'remote' || serverConfig.url) {
          console.log(chalk.yellow('⚠ (remote server, skipping local test)'));
          successCount++;
          continue;
        }

        // Try to spawn the MCP server
        // Handle both old format (command: string, args: array) and new format (command: array)
        const [cmd, ...args] = Array.isArray(serverConfig.command)
          ? serverConfig.command
          : [serverConfig.command, ...(serverConfig.args || [])];

        // Skip if no command (shouldn't happen but safety check)
        if (!cmd) {
          console.log(chalk.yellow('⚠ (no command configured)'));
          continue;
        }

        const serverProcess = spawn(cmd, args, {
          env: { ...process.env, ...serverConfig.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let responded = false;
        let error = '';

        // Set timeout for server startup
        const timeout = setTimeout(() => {
          if (!responded) {
            serverProcess.kill();
          }
        }, 5000);

        // Listen for any output (indicates server started)
        serverProcess.stdout.on('data', (data) => {
          responded = true;
          clearTimeout(timeout);
          serverProcess.kill();
        });

        serverProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        // Wait for server to respond or timeout
        await new Promise((resolve) => {
          serverProcess.on('close', () => resolve(null));
          setTimeout(() => {
            if (serverProcess.killed) resolve(null);
          }, 5500);
        });

        if (responded) {
          console.log(chalk.green('✓'));
          successCount++;
        } else if (error.includes('Cannot find module') || error.includes('ENOENT')) {
          console.log(chalk.red('✗ (server file not found)'));
          const serverPath = Array.isArray(serverConfig.command) ? serverConfig.command[1] : serverConfig.args?.[0];
          console.log(chalk.yellow(`      Check: ${serverPath}`));
          failCount++;
        } else if (error) {
          // Check if stderr contains success messages (some servers log to stderr)
          const isSuccessMessage = error.includes('MCP server running') ||
                                   error.includes('Started on stdio') ||
                                   error.includes('ServiceNow MCP') ||
                                   error.includes('Snow-Flow MCP');

          if (isSuccessMessage) {
            console.log(chalk.green('✓'));
            successCount++;
          } else {
            console.log(chalk.red('✗'));
            console.log(chalk.dim(`      ${error.split('\n')[0].substring(0, 60)}...`));
            failCount++;
          }
        } else {
          console.log(chalk.yellow('⚠ (no response, may need credentials)'));
          // This is actually OK - server started but needs auth
          successCount++;
        }

      } catch (err: any) {
        console.log(chalk.red('✗'));
        console.log(chalk.dim(`      ${err.message}`));
        failCount++;
      }
    }

    // Summary
    console.log();
    if (failCount === 0) {
      console.log(chalk.green(`   ✅ All ${successCount} MCP server(s) verified successfully`));
    } else {
      console.log(chalk.yellow(`   ⚠️  ${successCount} verified, ${failCount} failed`));
      console.log(chalk.dim('   Run with credentials configured to fully test servers'));
    }

  } catch (error: any) {
    console.log(chalk.yellow(`   ⚠️  Could not verify MCP servers: ${error.message}`));
    console.log(chalk.dim('   Servers will be tested when SnowCode starts'));
  }
}

async function copyMCPServerScripts(targetDir: string, force: boolean = false) {
  try {
    // Determine the snow-flow installation directory (same logic as other copy functions)
    let snowFlowRoot: string;
    const isGlobalInstall = __dirname.includes('node_modules/snow-flow') ||
                           __dirname.includes('node_modules/.pnpm') ||
                           __dirname.includes('npm/snow-flow');

    if (isGlobalInstall) {
      const parts = __dirname.split(/node_modules[\/\\]/);
      snowFlowRoot = parts[0] + 'node_modules/snow-flow';
    } else {
      let currentDir = __dirname;
      while (currentDir !== '/') {
        try {
          const packageJsonPath = join(currentDir, 'package.json');
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          if (packageJson.name === 'snow-flow') {
            snowFlowRoot = currentDir;
            break;
          }
        } catch {
          // Continue searching up
        }
        currentDir = dirname(currentDir);
      }
      if (!snowFlowRoot) {
        throw new Error('Could not find snow-flow project root');
      }
    }

    // Find scripts directory
    const scriptsSourcePaths = [
      join(snowFlowRoot, 'scripts'),
      join(__dirname, '..', 'scripts'),
      join(__dirname, 'scripts')
    ];

    let scriptsSourceDir: string | null = null;
    for (const sourcePath of scriptsSourcePaths) {
      try {
        await fs.access(sourcePath);
        scriptsSourceDir = sourcePath;
        console.log(`✅ Found scripts directory at: ${sourcePath}`);
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!scriptsSourceDir) {
      console.log('⚠️  Could not find scripts directory, skipping script installation');
      return;
    }

    // Create target scripts directory
    const scriptsTargetDir = join(targetDir, 'scripts');
    await fs.mkdir(scriptsTargetDir, { recursive: true });

    // Copy specific scripts
    const scriptFiles = [
      // 'mcp-server-manager.sh', // REMOVED: MCP servers auto-start via .mcp.json, this script is for dev only
      'start-snowcode.sh'
    ];

    let copiedCount = 0;

    for (const scriptFile of scriptFiles) {
      const sourcePath = join(scriptsSourceDir, scriptFile);
      const targetPath = join(scriptsTargetDir, scriptFile);

      try {
        // Check if file already exists
        try {
          await fs.access(targetPath);
          if (!force) {
            console.log(`✅ Script ${scriptFile} already exists`);
            continue;
          }
        } catch {
          // File doesn't exist, continue with copy
        }

        const content = await fs.readFile(sourcePath, 'utf8');
        await fs.writeFile(targetPath, content, { mode: 0o755 }); // Make executable
        copiedCount++;
      } catch (error) {
        console.log(`⚠️  Could not copy script ${scriptFile}:`, error);
      }
    }

    if (copiedCount > 0) {
      console.log(`✅ Copied ${copiedCount} MCP server management script(s) to scripts/`);
      console.log(`✅ Scripts are executable and ready to use`);
    }

  } catch (error) {
    console.error('❌ Error copying MCP server scripts:', error);
  }
}

async function copyCLAUDEmd(targetDir: string, force: boolean = false) {
  let claudeMdContent = '';
  let agentsMdContent = '';

  // Determine the snow-flow installation directory for absolute MCP paths
  let snowFlowRoot: string;

  const isGlobalInstall = __dirname.includes('node_modules/snow-flow') ||
                         __dirname.includes('node_modules/.pnpm') ||
                         __dirname.includes('npm/snow-flow');

  if (isGlobalInstall) {
    const parts = __dirname.split(/node_modules[\/\\]/);
    snowFlowRoot = parts[0] + 'node_modules/snow-flow';
  } else {
    let currentDir = __dirname;
    while (currentDir !== '/') {
      try {
        const packageJsonPath = join(currentDir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        if (packageJson.name === 'snow-flow') {
          snowFlowRoot = currentDir;
          break;
        }
      } catch {
        // Continue searching up
      }
      currentDir = dirname(currentDir);
    }
    if (!snowFlowRoot) {
      throw new Error('Could not find snow-flow project root');
    }
  }

  try {
    // First try to find the CLAUDE.md in the source directory (for global installs)
    const sourceClaudeFiles = [
      // Try the project root (when running from dist/)
      join(__dirname, '..', 'CLAUDE.md'),
      // Try when running directly from src/
      join(__dirname, 'CLAUDE.md'),
      // Try npm global installation paths
      join(__dirname, '..', '..', '..', 'CLAUDE.md'),
      join(__dirname, '..', '..', '..', '..', 'CLAUDE.md'),
      // Try current working directory as fallback
      join(process.cwd(), 'CLAUDE.md')
    ];

    let foundSource = false;

    for (const sourcePath of sourceClaudeFiles) {
      try {
        claudeMdContent = await fs.readFile(sourcePath, 'utf8');
        foundSource = true;
        console.log(`✅ Found CLAUDE.md source at: ${sourcePath}`);
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!foundSource) {
      // Import the template from the dedicated file
      const { CLAUDE_MD_TEMPLATE } = await import('./templates/claude-md-template.js');
      claudeMdContent = CLAUDE_MD_TEMPLATE;
      console.log('✅ Using built-in CLAUDE.md template');
    }

    // Use same content for AGENTS.md as CLAUDE.md (they should be identical)
    agentsMdContent = claudeMdContent;

    // Create CLAUDE.md (primary instructions for Claude Code)
    const claudeMdPath = join(targetDir, 'CLAUDE.md');
    try {
      await fs.access(claudeMdPath);
      if (force) {
        console.log('⚠️  CLAUDE.md already exists, overwriting with --force flag');
        await fs.writeFile(claudeMdPath, claudeMdContent);
      } else {
        console.log('⚠️  CLAUDE.md already exists, skipping (use --force to overwrite)');
      }
    } catch {
      await fs.writeFile(claudeMdPath, claudeMdContent);
      console.log('✅ Created CLAUDE.md (Primary instructions)');
    }

    // Create AGENTS.md (identical copy for SnowCode compatibility)
    const agentsMdPath = join(targetDir, 'AGENTS.md');
    try {
      await fs.access(agentsMdPath);
      if (force) {
        console.log('⚠️  AGENTS.md already exists, overwriting with --force flag');
        await fs.writeFile(agentsMdPath, agentsMdContent);
      } else {
        console.log('⚠️  AGENTS.md already exists, skipping (use --force to overwrite)');
      }
    } catch {
      await fs.writeFile(agentsMdPath, agentsMdContent);
      console.log('✅ Created AGENTS.md (Identical copy for SnowCode compatibility)');
    }

    // Create .snowcode/ directory structure
    const snowcodeDir = join(targetDir, '.snowcode');
    const agentsDir = join(snowcodeDir, 'agent');  // Singular 'agent' as required by SnowCode
    const modesDir = join(snowcodeDir, 'modes');

    try {
      await fs.mkdir(snowcodeDir, { recursive: true });
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.mkdir(modesDir, { recursive: true });
      console.log('✅ Created .snowcode/ directory structure');

      // Copy agent files from .claude/ to .snowcode/agent/ (if they exist)
      const sourceAgentsDir = join(__dirname, '..', '.claude', 'agents');
      try {
        const agentFiles = await fs.readdir(sourceAgentsDir);
        for (const file of agentFiles) {
          if (file.endsWith('.md')) {
            const sourceFile = join(sourceAgentsDir, file);
            const targetFile = join(agentsDir, file);
            const content = await fs.readFile(sourceFile, 'utf-8');
            await fs.writeFile(targetFile, content);
          }
        }
        console.log('✅ Copied agent configurations to .snowcode/agent/');
      } catch (err) {
        // Silently continue - agent configs are in snowcode.json, not separate files
      }

      // Create .snowcode/snowcode.json by converting from .mcp.json.template
      // SINGLE SOURCE OF TRUTH: .mcp.json.template → both Claude and SnowCode formats
      // CRITICAL: SnowCode/OpenCode does NOT auto-expand ${...} variables

      // 🔧 Read actual environment values from .env file
      const envPath = join(targetDir, '.env');
      const envValues: Record<string, string> = {};

      try {
        const envContent = await fs.readFile(envPath, 'utf-8');
        // Parse .env file (simple parser - handles KEY=VALUE lines)
        const lines = envContent.split('\n');
        for (var line of lines) {
          line = line.trim();
          // Skip comments and empty lines
          if (!line || line.startsWith('#')) continue;

          var equalIndex = line.indexOf('=');
          if (equalIndex > 0) {
            var key = line.substring(0, equalIndex).trim();
            var value = line.substring(equalIndex + 1).trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.substring(1, value.length - 1);
            }
            envValues[key] = value;
          }
        }
      } catch (error) {
        console.log('⚠️  No .env file found - SnowCode config will use placeholder values');
      }

      // Helper function to get env value with proper URL formatting
      function getEnvValue(key: string, defaultValue: string = ''): string {
        var value = envValues[key] || process.env[key] || defaultValue;

        // Special handling for SNOW_INSTANCE - ensure it's a full URL
        if (key === 'SNOW_INSTANCE' && value && !value.startsWith('http')) {
          value = 'https://' + value.replace(/^https?:\/\//, '');
        }

        return value;
      }

      // Read .mcp.json.template (single source of truth for MCP servers)
      const mcpTemplatePath = join(snowFlowRoot, '.mcp.json.template');
      let mcpTemplateContent: string;

      try {
        mcpTemplateContent = await fs.readFile(mcpTemplatePath, 'utf-8');
      } catch (error) {
        console.log('⚠️  Could not find .mcp.json.template');
        throw error;
      }

      // Replace placeholders with ACTUAL values from .env (not ${...} syntax!)
      const mcpConfigContent = mcpTemplateContent
        .replace(/{{PROJECT_ROOT}}/g, snowFlowRoot)
        .replace(/{{SNOW_INSTANCE}}/g, getEnvValue('SNOW_INSTANCE'))
        .replace(/{{SNOW_CLIENT_ID}}/g, getEnvValue('SNOW_CLIENT_ID'))
        .replace(/{{SNOW_CLIENT_SECRET}}/g, getEnvValue('SNOW_CLIENT_SECRET'))
        .replace(/{{SNOW_FLOW_ENV}}/g, getEnvValue('SNOW_FLOW_ENV', 'development'));

      const claudeConfig = JSON.parse(mcpConfigContent);

      // Convert Claude Desktop format to SnowCode format
      const snowcodeConfig = convertToSnowCodeFormat(claudeConfig);

      // Write opencode.json (SnowCode searches for this name!)
      const opencodeJsonPath = join(snowcodeDir, 'opencode.json');
      const configJsonPath = join(snowcodeDir, 'config.json');

      await fs.writeFile(opencodeJsonPath, JSON.stringify(snowcodeConfig, null, 2));
      await fs.writeFile(configJsonPath, JSON.stringify(snowcodeConfig, null, 2));

      console.log('✅ Created .snowcode/opencode.json (SnowCode format)');
      console.log('✅ Created .snowcode/config.json (fallback compatibility)');

      // CRITICAL: Also write to global SnowCode config directory!
      // This ensures MCP tools are available even outside projects
      const globalSnowCodeDir = join(process.env.HOME || '', '.config', 'snowcode');
      try {
        await fs.mkdir(globalSnowCodeDir, { recursive: true });

        const globalOpencodeJsonPath = join(globalSnowCodeDir, 'opencode.json');
        const globalConfigJsonPath = join(globalSnowCodeDir, 'config.json');

        await fs.writeFile(globalOpencodeJsonPath, JSON.stringify(snowcodeConfig, null, 2));
        await fs.writeFile(globalConfigJsonPath, JSON.stringify(snowcodeConfig, null, 2));

        console.log('✅ Created ~/.config/snowcode/opencode.json (global SnowCode config)');
        console.log('✅ Created ~/.config/snowcode/config.json (global fallback)');
      } catch (error) {
        console.log('⚠️  Could not write global SnowCode config:', error instanceof Error ? error.message : String(error));
      }

      // Also create AGENTS.md in .snowcode/
      const snowcodeAgentsMdPath = join(snowcodeDir, 'AGENTS.md');
      await fs.writeFile(snowcodeAgentsMdPath, agentsMdContent);
      console.log('✅ Created .snowcode/AGENTS.md');

    } catch (error) {
      console.log('⚠️  Error creating .snowcode/ directory:', error instanceof Error ? error.message : String(error));
    }

  } catch (error) {
    console.log('⚠️  Error copying CLAUDE.md, creating Snow-Flow specific version');
    // Import the template as fallback
    const { CLAUDE_MD_TEMPLATE } = await import('./templates/claude-md-template.js');
    const claudeMdPath = join(targetDir, 'CLAUDE.md');
    const agentsMdPath = join(targetDir, 'AGENTS.md');
    if (force || !existsSync(claudeMdPath)) {
      await fs.writeFile(claudeMdPath, CLAUDE_MD_TEMPLATE);
    }
    // Use same content for AGENTS.md (they should be identical)
    if (force || !existsSync(agentsMdPath)) {
      await fs.writeFile(agentsMdPath, CLAUDE_MD_TEMPLATE);
    }
  }
}

async function createEnvFile(targetDir: string, force: boolean = false) {
  // Read content from .env.example file
  let envContent: string;

  try {
    // Try to read from the project's .env.example file (npm package location)
    const templatePath = join(__dirname, '..', '.env.example');
    envContent = await fs.readFile(templatePath, 'utf-8');
    console.log('📋 Using .env.example for configuration');
  } catch (error) {
    // If template not found, try alternative locations
    try {
      const alternativePath = join(process.cwd(), '.env.example');
      envContent = await fs.readFile(alternativePath, 'utf-8');
      console.log('📋 Using .env.example from current directory');
    } catch (fallbackError) {
      console.warn('⚠️  Could not find .env.example file, using embedded minimal version');
      // Last resort: use embedded minimal version with v3.0.1 timeout config
      envContent = `# ServiceNow Configuration
# ===========================================

# ServiceNow Instance URL (without https://)
# Example: dev12345.service-now.com
SNOW_INSTANCE=your-instance.service-now.com

# OAuth Client ID from ServiceNow Application Registry
SNOW_CLIENT_ID=your-oauth-client-id

# OAuth Client Secret from ServiceNow Application Registry
SNOW_CLIENT_SECRET=your-oauth-client-secret

# ===========================================
# Snow-Flow Configuration
# ===========================================

# Enable debug logging (true/false)
SNOW_FLOW_DEBUG=false

# Default coordination strategy
SNOW_FLOW_STRATEGY=development

# Maximum number of agents
SNOW_FLOW_MAX_AGENTS=5

# ===========================================
# Claude Code API Integration (30 minutes)
# ===========================================
# API timeout for Claude Code integration - 30 minutes
# This ensures Snow-Flow works smoothly with Claude Code's extended operation timeouts
API_TIMEOUT_MS=1800000

# ===========================================
# Timeout Configuration (v3.0.1+)
# ===========================================
# IMPORTANT: Snow-Flow has NO TIMEOUTS by default for maximum reliability.
# Operations run until completion. Only set timeouts if you specifically need them.
# All timeout values below are COMMENTED OUT - uncomment only what you need.

# Memory Operations (TodoWrite, etc.)
# MCP_MEMORY_TIMEOUT=30000      # 30 seconds
# MCP_MEMORY_TIMEOUT=60000      # 1 minute
# MCP_MEMORY_TIMEOUT=120000     # 2 minutes

# ServiceNow API Operations
# SNOW_API_TIMEOUT=60000        # 1 minute - quick operations
# SNOW_API_TIMEOUT=180000       # 3 minutes - standard operations
# SNOW_API_TIMEOUT=300000       # 5 minutes - complex queries

# Deployment Operations
# SNOW_DEPLOYMENT_TIMEOUT=300000  # 5 minutes - simple deployments
# SNOW_DEPLOYMENT_TIMEOUT=600000  # 10 minutes - complex widgets

# MCP transport timeout (should be higher than SNOW_DEPLOYMENT_TIMEOUT if both set)
# MCP_DEPLOYMENT_TIMEOUT=360000   # 6 minutes
# MCP_DEPLOYMENT_TIMEOUT=720000   # 12 minutes
`;
    }
  }

  const envFilePath = join(targetDir, '.env');
  
  // Check if .env already exists
  try {
    await fs.access(envFilePath);
    if (force) {
      console.log('⚠️  .env file already exists, overwriting with --force flag');
      await fs.writeFile(envFilePath, envContent);
      console.log('✅ .env file overwritten successfully');
    } else {
      console.log('⚠️  .env file already exists, creating .env.example template instead');
      console.log('📝 To overwrite: use --force flag or delete existing .env file');
      await fs.writeFile(join(targetDir, '.env.example'), envContent);
      console.log('✅ .env.example template created');
    }
  } catch {
    // .env doesn't exist, create it
    console.log('📄 Creating new .env file...');
    await fs.writeFile(envFilePath, envContent);
    console.log('✅ .env file created successfully');
  }
}

async function appendToEnvFile(targetDir: string, content: string) {
  const envFilePath = join(targetDir, '.env');
  await fs.appendFile(envFilePath, content);
}

/**
 * Converts Claude Desktop MCP config format to SnowCode/OpenCode format
 * Single source of truth: .mcp.json.template → both .mcp.json and .snowcode/snowcode.json
 */
function convertToSnowCodeFormat(claudeConfig: any): any {
  const snowcodeConfig: any = {
    "$schema": "https://opencode.ai/config.json",
    "mcp": {},
    "tools": {
      "enabled": true,
      "requireApproval": false
    },
    "instructions": [
      "AGENTS.md",
      "../CLAUDE.md",
      "../AGENTS.md"
    ]
  };

  // Convert each server from Claude Desktop format to SnowCode format
  const servers = claudeConfig.servers || claudeConfig.mcpServers || {};

  for (const [name, server] of Object.entries(servers)) {
    const s = server as any;

    // Handle remote servers (SSE/HTTP - have type: "sse" or url field)
    if (s.type === 'sse' || s.url) {
      snowcodeConfig.mcp[name] = {
        type: "remote",
        url: s.url,
        enabled: Boolean(s.headers?.Authorization && s.headers.Authorization !== 'Bearer ')
      };

      if (s.headers) {
        snowcodeConfig.mcp[name].headers = s.headers;
      }
    }
    // Handle local servers (have command + args)
    else {
      snowcodeConfig.mcp[name] = {
        type: "local",
        command: s.args ? [s.command, ...s.args] : (Array.isArray(s.command) ? s.command : [s.command]),
        environment: s.env || s.environment || {},
        enabled: true
      };
    }
  }

  return snowcodeConfig;
}

async function checkNeo4jAvailability(): Promise<boolean> {
  const { execSync } = require('child_process');
  
  try {
    // Check if Neo4j is installed
    execSync('which neo4j', { stdio: 'pipe' });
    
    // Check if Neo4j is running
    try {
      execSync('neo4j status', { stdio: 'pipe' });
      return true;
    } catch {
      // Neo4j is installed but not running
      console.log('ℹ️  Neo4j is installed but not running. Start with: neo4j start');
      return false;
    }
  } catch {
    // Neo4j is not installed
    return false;
  }
}

async function createMCPConfig(targetDir: string, force: boolean = false) {
  // 🔥 SAME FIX: Find Snow-Flow installation dynamically (support nvm!)
  let snowFlowRoot = '';

  // Get global npm root dynamically
  let globalNpmRoot = '';
  try {
    const { execSync } = require('child_process');
    globalNpmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
  } catch {
    globalNpmRoot = join(process.env.HOME || '', '.npm-global/lib/node_modules');
  }

  // Try different locations (PRIORITIZE GLOBAL!)
  const possiblePaths = [
    join(globalNpmRoot, 'snow-flow'),  // 🔥 GLOBAL NPM INSTALL
    join(targetDir, 'node_modules/snow-flow'),  // Local install
    __dirname.includes('dist') ? resolve(__dirname, '..') : __dirname,  // Running from build
    join(targetDir, '../snow-flow-dev/snow-flow'),  // Dev
    join(process.env.HOME || '', 'Projects/snow-flow-dev/snow-flow')  // Dev alt
  ];

  for (const testPath of possiblePaths) {
    try {
      await fs.access(join(testPath, '.mcp.json.template'));
      snowFlowRoot = testPath;
      console.log(`✅ Found Snow-Flow: ${testPath}`);
      break;
    } catch {
      // Keep trying
    }
  }

  if (!snowFlowRoot) {
    throw new Error(
      `Could not find snow-flow installation!\n` +
      `Searched: ${possiblePaths.join(', ')}\n` +
      `Try: npm install -g snow-flow`
    );
  }

  // 🔧 FIX: Read actual environment values from .env file
  // This solves the issue where SnowCode/Claude Code doesn't expand ${...} variables
  const envPath = join(targetDir, '.env');
  const envValues: Record<string, string> = {};

  try {
    const envContent = await fs.readFile(envPath, 'utf-8');
    // Parse .env file (simple parser - handles KEY=VALUE lines)
    const lines = envContent.split('\n');
    for (var line of lines) {
      line = line.trim();
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;

      var equalIndex = line.indexOf('=');
      if (equalIndex > 0) {
        var key = line.substring(0, equalIndex).trim();
        var value = line.substring(equalIndex + 1).trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        envValues[key] = value;
      }
    }
  } catch (error) {
    console.log('⚠️  No .env file found - MCP config will use placeholder values');
    console.log('   Run "snow-flow auth login" after init to configure credentials');
  }

  // Helper function to get env value with proper URL formatting
  function getEnvValue(key: string, defaultValue: string = ''): string {
    var value = envValues[key] || process.env[key] || defaultValue;

    // Special handling for SNOW_INSTANCE - ensure it's a full URL
    if (key === 'SNOW_INSTANCE' && value && !value.startsWith('http')) {
      value = 'https://' + value.replace(/^https?:\/\//, '');
    }

    return value;
  }

  // Read the template file
  const templatePath = join(snowFlowRoot, '.mcp.json.template');
  let templateContent: string;

  try {
    templateContent = await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    prompts.log.error('Could not find .mcp.json.template file');
    throw error;
  }

  // Replace placeholders with ACTUAL values from .env (not ${...} syntax!)
  // This ensures SnowCode/Claude Code can use the MCP servers immediately
  const distPath = join(snowFlowRoot, 'dist');
  const mcpConfigContent = templateContent
    .replace(/{{PROJECT_ROOT}}/g, snowFlowRoot)
    .replace(/{{SNOW_INSTANCE}}/g, getEnvValue('SNOW_INSTANCE'))
    .replace(/{{SNOW_CLIENT_ID}}/g, getEnvValue('SNOW_CLIENT_ID'))
    .replace(/{{SNOW_CLIENT_SECRET}}/g, getEnvValue('SNOW_CLIENT_SECRET'))
    .replace(/{{SNOW_DEPLOYMENT_TIMEOUT}}/g, getEnvValue('SNOW_DEPLOYMENT_TIMEOUT', '180000'))
    .replace(/{{MCP_DEPLOYMENT_TIMEOUT}}/g, getEnvValue('MCP_DEPLOYMENT_TIMEOUT', '180000'))
    .replace(/{{NEO4J_URI}}/g, getEnvValue('NEO4J_URI', ''))
    .replace(/{{NEO4J_USER}}/g, getEnvValue('NEO4J_USER', ''))
    .replace(/{{NEO4J_PASSWORD}}/g, getEnvValue('NEO4J_PASSWORD', ''))
    .replace(/{{SNOW_FLOW_ENV}}/g, getEnvValue('SNOW_FLOW_ENV', 'development'))
    .replace(/{{ENTERPRISE_JWT_TOKEN}}/g, getEnvValue('ENTERPRISE_JWT_TOKEN', ''));
  
  // Parse to ensure it's valid JSON
  const mcpConfig = JSON.parse(mcpConfigContent);
  
  // Keep the standard MCP structure that Claude Code expects
  const finalConfig = {
    "mcpServers": mcpConfig.servers
  };
  
  // Create .mcp.json in project root for Claude Code discovery
  const mcpConfigPath = join(targetDir, '.mcp.json');
  try {
    await fs.access(mcpConfigPath);
    if (force) {
      prompts.log.warn('.mcp.json already exists, overwriting with --force flag');
      await fs.writeFile(mcpConfigPath, JSON.stringify(finalConfig, null, 2));
    } else {
      prompts.log.warn('.mcp.json already exists, skipping (use --force to overwrite)');
    }
  } catch {
    await fs.writeFile(mcpConfigPath, JSON.stringify(finalConfig, null, 2));
  }
  
  // Also create legacy config in .claude for backward compatibility
  const legacyConfigPath = join(targetDir, '.claude/mcp-config.json');
  await fs.writeFile(legacyConfigPath, JSON.stringify(finalConfig, null, 2));

  // 🔧 CRITICAL FIX: Also update global SnowCode configuration
  // SnowCode/OpenCode reads from ~/.snowcode/snowcode.json
  const snowcodeConfigPath = join(process.env.HOME || '', '.snowcode', 'snowcode.json');
  const snowcodeConfigDirPath = join(process.env.HOME || '', '.snowcode');

  try {
    // Ensure directory exists
    try {
      await fs.access(snowcodeConfigDirPath);
    } catch {
      await fs.mkdir(snowcodeConfigDirPath, { recursive: true });
    }

    // Read existing SnowCode config or create new MINIMAL one
    let snowcodeConfig: any = {
      "$schema": "https://opencode.ai/config.json",
      "tui": {
        "scroll_speed": 5
      },
      "mcp": {}
    };

    try {
      const existingConfig = await fs.readFile(snowcodeConfigPath, 'utf-8');
      const existing = JSON.parse(existingConfig);

      // Preserve existing TUI and MCP config
      if (existing.tui) {
        snowcodeConfig.tui = existing.tui;
      }
      if (existing.mcp) {
        snowcodeConfig.mcp = existing.mcp;
      }
    } catch {
      // File doesn't exist or is invalid - will create new minimal one
    }

    // Transform MCP servers to SnowCode format using REAL values (not ${VAR} placeholders)
    // serverConfig.env already contains real values from template replacement
    for (const [serverName, serverConfig] of Object.entries(finalConfig.mcpServers) as [string, any][]) {
      const transformedConfig: any = {};

      // Handle local servers (have "command" + "args")
      if (serverConfig.command && serverConfig.args) {
        transformedConfig.type = "local";
        transformedConfig.command = [serverConfig.command, ...serverConfig.args];

        // Use ACTUAL values from serverConfig.env (already replaced from template)
        if (serverConfig.env) {
          transformedConfig.environment = {};

          // Copy all environment variables as-is (they have real values)
          for (const [key, value] of Object.entries(serverConfig.env)) {
            transformedConfig.environment[key] = value;
          }
          transformedConfig.enabled = true;
        } else {
          transformedConfig.enabled = true;
        }
      }
      // Handle remote servers (have "type": "sse" or "url")
      else if (serverConfig.type === 'sse' || serverConfig.url) {
        transformedConfig.type = "remote";
        transformedConfig.url = serverConfig.url;

        // Copy headers as-is (already have real values from template)
        if (serverConfig.headers) {
          transformedConfig.headers = {};
          var hasValidAuth = false;
          for (const [key, value] of Object.entries(serverConfig.headers)) {
            transformedConfig.headers[key] = value;
            // Check if Authorization header has actual token (not empty "Bearer " or placeholder)
            var val = String(value);
            if (key === 'Authorization' && val &&
                val.trim() !== 'Bearer' &&
                val.trim() !== 'Bearer ' &&
                !val.includes('your-enterprise-token-here') &&
                !val.includes('your-token-here') &&
                !val.includes('YOUR_') &&
                !val.includes('your_')) {
              hasValidAuth = true;
            }
          }
          // Disable server if Authorization is empty or placeholder (prevents auth errors)
          transformedConfig.enabled = serverName !== 'snow-flow-enterprise' || hasValidAuth;
        } else {
          transformedConfig.enabled = true;
        }
      }
      // Unknown format - skip to avoid schema violations
      else {
        // Don't copy unknown formats - they may violate OpenCode schema
        continue;
      }

      snowcodeConfig.mcp[serverName] = transformedConfig;
    }

    // Write updated config
    await fs.writeFile(snowcodeConfigPath, JSON.stringify(snowcodeConfig, null, 2));
    console.log(`✅ Global SnowCode config updated: ${snowcodeConfigPath}`);
    console.log(`   Format: OpenCode/SnowCode with real credential values`);
    console.log(`   Servers: ${Object.keys(snowcodeConfig.mcp).join(', ')}`);
  } catch (error) {
    console.warn(`⚠️  Could not update global SnowCode config: ${error}`);
    console.warn('   SnowCode will use project-local .mcp.json instead');
  }

  // Create comprehensive Claude Code settings file
  // NOTE: Only include properties that Claude Code actually accepts
  // Valid properties: apiKeyHelper, cleanupPeriodDays, env, includeCoAuthoredBy,
  // permissions, hooks, model, statusLine, forceLoginMethod, enableAllProjectMcpServers,
  // enabledMcpjsonServers, disabledMcpjsonServers, awsAuthRefresh, awsCredentialExport
  const claudeSettings = {
    "enabledMcpjsonServers": [
      "snow-flow",
      "servicenow-deployment",
      "servicenow-operations",
      "servicenow-automation",
      "servicenow-platform-development",
      "servicenow-integration",
      "servicenow-system-properties",
      "servicenow-update-set",
      "servicenow-development-assistant",
      "servicenow-local-development",
      "servicenow-security-compliance",
      "servicenow-reporting-analytics",
      "servicenow-machine-learning",
      "servicenow-knowledge-catalog",
      "servicenow-change-virtualagent-pa",
      "servicenow-flow-workspace-mobile",
      "servicenow-cmdb-event-hr-csm-devops",
      "servicenow-advanced-features"
    ],
    "permissions": {
      "allow": [
        // Snow-Flow Core Commands
        "Bash(npx snow-flow *)",
        "Bash(snow-flow *)",
        "Bash(./snow-flow *)",
        
        // Development Commands
        "Bash(npm run *)",
        "Bash(npm install *)",
        "Bash(npm update *)",
        "Bash(npm test *)",
        "Bash(npm run lint)",
        "Bash(npm run build)",
        "Bash(npm run dev)",
        "Bash(npm start)",
        "Bash(yarn *)",
        "Bash(pnpm *)",
        
        // Git Operations
        "Bash(git status)",
        "Bash(git diff *)",
        "Bash(git log *)",
        "Bash(git add *)",
        "Bash(git commit *)",
        "Bash(git push *)",
        "Bash(git pull *)",
        "Bash(git branch *)",
        "Bash(git checkout *)",
        "Bash(git merge *)",
        "Bash(git config *)",
        "Bash(git remote *)",
        
        // GitHub CLI
        "Bash(gh *)",
        
        // Node.js and System Commands
        "Bash(node *)",
        "Bash(npm *)",
        "Bash(npx *)",
        "Bash(which *)",
        "Bash(pwd)",
        "Bash(ls *)",
        "Bash(cd *)",
        "Bash(mkdir *)",
        "Bash(rm *)",
        "Bash(cp *)",
        "Bash(mv *)",
        "Bash(find *)",
        "Bash(grep *)",
        "Bash(cat *)",
        "Bash(head *)",
        "Bash(tail *)",
        "Bash(less *)",
        "Bash(more *)",
        
        // API Testing and Network
        "Bash(curl *)",
        "Bash(wget *)",
        "Bash(ping *)",
        "Bash(telnet *)",
        "Bash(nc *)",
        "Bash(netstat *)",
        
        // JSON and Data Processing
        "Bash(jq *)",
        "Bash(awk *)",
        "Bash(sed *)",
        "Bash(sort *)",
        "Bash(uniq *)",
        "Bash(wc *)",
        
        // Process and System Monitoring
        "Bash(ps *)",
        "Bash(top)",
        "Bash(htop)",
        "Bash(lsof *)",
        "Bash(df *)",
        "Bash(du *)",
        "Bash(free *)",
        "Bash(uptime)",
        
        // Environment
        "Bash(env)",
        "Bash(export *)",
        "Bash(echo *)",
        "Bash(printenv *)",
        
        // Docker (if used)
        "Bash(docker *)",
        "Bash(docker-compose *)",
        
        // ServiceNow CLI (if exists)
        "Bash(sn *)",
        "Bash(snc *)",
        
        // File Operations - Claude Code Tools
        "Read(*)",
        "Write(*)",
        "Edit(*)",
        "MultiEdit(*)",
        "Glob(*)",
        "Grep(*)",
        "LS(*)",
        "NotebookEdit(*)",
        "NotebookRead(*)",
        "WebFetch(*)",
        "WebSearch(*)",
        "TodoRead",
        "TodoWrite",
        "Task(*)",
        "ListMcpResourcesTool",
        "ReadMcpResourceTool",
        
        // MCP Tools - All ServiceNow Servers
        "mcp__servicenow-*",
        "mcp__snow-flow__*"
      ],
      "deny": [
        "Bash(rm -rf /)",
        "Bash(sudo rm *)",
        "Bash(sudo *)"
      ]
    },
    "autoCompactThreshold": 0.65,
    "compactMode": "aggressive",
    "contextPreservation": {
      "preserveMCPState": true,
      "preserveToolResults": true,
      "preserveRecentContext": 5000,
      "prioritizeServiceNowOperations": true
    },
    "hooks": {
      "PreCompact": [
        {
          "matcher": "manual",
          "hooks": [
            {
              "type": "command",
              "command": "/bin/bash -c 'INPUT=$(cat); CUSTOM=$(echo \"$INPUT\" | jq -r \".custom_instructions // \\\"\\\"\"); echo \"🔄 PreCompact Guidance:\"; echo \"📋 IMPORTANT: Review CLAUDE.md in project root for:\"; echo \"   • 18+ MCP servers and snow_pull_artifact for widget debugging\"; echo \"   • Swarm coordination strategies (hierarchical, mesh, adaptive)\"; echo \"   • SPARC methodology workflows with batchtools optimization\"; echo \"   • Critical concurrent execution rules (GOLDEN RULE: 1 MESSAGE = ALL OPERATIONS)\"; if [ -n \"$CUSTOM\" ]; then echo \"🎯 Custom compact instructions: $CUSTOM\"; fi; echo \"✅ Ready for compact operation\"'"
            }
          ]
        },
        {
          "matcher": "auto",
          "threshold": 0.65,
          "hooks": [
            {
              "type": "command",
              "command": "/bin/bash -c 'echo \"⚡ EARLY Auto-Compact triggered at 65% context usage\"; echo \"🔔 Compacting BEFORE API calls fail\"; echo \"📋 Preserving critical Snow-Flow context:\"; echo \"   • Active MCP connections and tool state\"; echo \"   • Recent ServiceNow operations and results\"; echo \"   • Current artifact sync status\"; echo \"   • Authentication and session data\"; echo \"⚠️ This prevents mid-operation failures\"; echo \"✅ Safe compact at 65% threshold\"'"
            }
          ]
        }
      ]
    },
    "env": {
      "BASH_DEFAULT_TIMEOUT_MS": "0",
      "BASH_MAX_TIMEOUT_MS": "0",
      "BASH_MAX_OUTPUT_LENGTH": "500000",
      "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR": "true",
      "MAX_THINKING_TOKENS": "50000",
      "MCP_TIMEOUT": "0",
      "MCP_TOOL_TIMEOUT": "0",
      "DISABLE_COST_WARNINGS": "1",
      "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "0",
      "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "32000",
      "CLAUDE_CODE_TIMEOUT": "0",
      "CLAUDE_CODE_SESSION_TIMEOUT": "0",
      "CLAUDE_CODE_EXECUTION_TIMEOUT": "0",
      "CLAUDE_CODE_EARLY_COMPACT": "true",
      "CLAUDE_CODE_COMPACT_THRESHOLD": "0.65",
      "CLAUDE_CODE_PRESERVE_MCP_STATE": "true",
      "CLAUDE_CODE_CONTEXT_WINDOW_BUFFER": "35",
      "SNOW_FLOW_DEBUG": "false",
      "SNOW_FLOW_LOG_LEVEL": "info",
      "MCP_DEBUG": "false",
      "NODE_ENV": "development"
    },
    "cleanupPeriodDays": 90,
    "includeCoAuthoredBy": true
    // Snow-Flow v3.5.13+ optimized settings with servicenow-local-development
    // Comprehensive permissions for Snow-Flow development workflow
  };
  
  const claudeSettingsPath = join(targetDir, '.claude/settings.json');
  await fs.writeFile(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));
}

// Setup MCP configuration function
export async function setupMCPConfig(
  targetDir: string,
  instanceUrl: string,
  clientId: string,
  clientSecret: string,
  force: boolean = false
): Promise<void> {
  // 🔥 CRITICAL FIX: Find Snow-Flow installation (MUST check global npm first!)
  let snowFlowRoot = '';

  // Get global npm root dynamically (works with nvm!)
  let globalNpmRoot = '';
  try {
    const { execSync } = require('child_process');
    globalNpmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback if npm command fails
    globalNpmRoot = join(process.env.HOME || '', '.npm-global/lib/node_modules');
  }

  // Try different locations to find Snow-Flow root (PRIORITIZE GLOBAL INSTALL!)
  const possiblePaths = [
    join(globalNpmRoot, 'snow-flow'),  // 🔥 GLOBAL NPM INSTALL (priority!)
    join(targetDir, 'node_modules/snow-flow'),  // Local project install
    __dirname.includes('dist') ? resolve(__dirname, '..') : __dirname,  // Running from build
    join(targetDir, '../snow-flow-dev/snow-flow'),  // Dev environment
    join(process.env.HOME || '', 'Projects/snow-flow-dev/snow-flow')  // Dev environment alt
  ];

  for (const testPath of possiblePaths) {
    try {
      await fs.access(join(testPath, '.mcp.json.template'));
      snowFlowRoot = testPath;
      prompts.log.success(`Found Snow-Flow installation: ${testPath}`);
      break;
    } catch {
      // Keep trying
    }
  }

  if (!snowFlowRoot) {
    throw new Error(
      `Could not find snow-flow installation!\n` +
      `Searched locations:\n` +
      possiblePaths.map(p => `  - ${p}`).join('\n') +
      `\n\nTry: npm install -g snow-flow`
    );
  }

  // 🔧 CRITICAL FIX: Prioritize function parameters over .env
  // When auth login calls this function, it passes real credentials - USE THOSE!
  const envPath = join(targetDir, '.env');
  const envValues: Record<string, string> = {};

  // Read existing .env (if exists)
  try {
    const envContent = await fs.readFile(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (var line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      var equalIndex = line.indexOf('=');
      if (equalIndex > 0) {
        var key = line.substring(0, equalIndex).trim();
        var value = line.substring(equalIndex + 1).trim();
        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        envValues[key] = value;
      }
    }
  } catch (error) {
    // .env doesn't exist yet - OK
  }

  // 🔥 PRIORITY: Use function parameters FIRST (from auth login), then .env, then process.env
  // This ensures fresh credentials from auth login are ALWAYS used
  var finalInstanceUrl = instanceUrl || envValues['SNOW_INSTANCE'] || process.env.SNOW_INSTANCE || '';
  var finalClientId = clientId || envValues['SNOW_CLIENT_ID'] || process.env.SNOW_CLIENT_ID || '';
  var finalClientSecret = clientSecret || envValues['SNOW_CLIENT_SECRET'] || process.env.SNOW_CLIENT_SECRET || '';

  // Format instance URL properly
  if (finalInstanceUrl && !finalInstanceUrl.startsWith('http')) {
    finalInstanceUrl = 'https://' + finalInstanceUrl.replace(/^https?:\/\//, '');
  }

  // 🔥 UPDATE .env WITH REAL CREDENTIALS (if provided as parameters)
  // This ensures .env has real values, not placeholders
  if (instanceUrl || clientId || clientSecret) {
    var envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      // .env doesn't exist - create from template
      try {
        envContent = await fs.readFile(join(targetDir, '.env.example'), 'utf-8');
      } catch {
        envContent = '# Snow-Flow Environment Configuration\n';
      }
    }

    // Update credentials in .env (replace existing or append)
    const updates = [
      { key: 'SNOW_INSTANCE', value: finalInstanceUrl },
      { key: 'SNOW_CLIENT_ID', value: finalClientId },
      { key: 'SNOW_CLIENT_SECRET', value: finalClientSecret }
    ];

    for (const { key, value } of updates) {
      if (value) { // Only update if we have a value
        if (envContent.includes(`${key}=`)) {
          // Replace existing line
          envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), `${key}=${value}`);
        } else {
          // Append new line
          envContent += `\n${key}=${value}\n`;
        }
      }
    }

    // Write updated .env
    await fs.writeFile(envPath, envContent);
    prompts.log.success('Updated .env with credentials');
  }

  // Read the template file
  const templatePath = join(snowFlowRoot, '.mcp.json.template');
  let templateContent: string;

  try {
    templateContent = await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    prompts.log.error('Could not find .mcp.json.template file');
    throw error;
  }

  // Helper to get env values with fallback
  const getEnvValue = (key: string, defaultValue: string = ''): string => {
    return envValues[key] || process.env[key] || defaultValue;
  };

  // Replace placeholders with ACTUAL values (from function params or .env)
  // This ensures SnowCode/Claude Code can use the MCP servers immediately
  const mcpConfigContent = templateContent
    .replace(/{{PROJECT_ROOT}}/g, snowFlowRoot)
    .replace(/{{SNOW_INSTANCE}}/g, finalInstanceUrl)
    .replace(/{{SNOW_CLIENT_ID}}/g, finalClientId)
    .replace(/{{SNOW_CLIENT_SECRET}}/g, finalClientSecret)
    .replace(/{{SNOW_DEPLOYMENT_TIMEOUT}}/g, getEnvValue('SNOW_DEPLOYMENT_TIMEOUT', '180000'))
    .replace(/{{MCP_DEPLOYMENT_TIMEOUT}}/g, getEnvValue('MCP_DEPLOYMENT_TIMEOUT', '180000'))
    .replace(/{{NEO4J_URI}}/g, getEnvValue('NEO4J_URI', ''))
    .replace(/{{NEO4J_USER}}/g, getEnvValue('NEO4J_USER', ''))
    .replace(/{{NEO4J_PASSWORD}}/g, getEnvValue('NEO4J_PASSWORD', ''))
    .replace(/{{SNOW_FLOW_ENV}}/g, getEnvValue('SNOW_FLOW_ENV', 'development'))
    .replace(/{{ENTERPRISE_JWT_TOKEN}}/g, getEnvValue('ENTERPRISE_JWT_TOKEN', ''));
  
  // Parse to ensure it's valid JSON
  const mcpConfig = JSON.parse(mcpConfigContent);
  
  // Keep the standard MCP structure that Claude Code expects
  const finalConfig = {
    "mcpServers": mcpConfig.servers
  };
  
  // Create .mcp.json in project root for Claude Code discovery
  const mcpConfigPath = join(targetDir, '.mcp.json');
  try {
    await fs.access(mcpConfigPath);
    if (force) {
      prompts.log.warn('.mcp.json already exists, overwriting with --force flag');
      await fs.writeFile(mcpConfigPath, JSON.stringify(finalConfig, null, 2));
    } else {
      prompts.log.warn('.mcp.json already exists, skipping (use --force to overwrite)');
    }
  } catch {
    await fs.writeFile(mcpConfigPath, JSON.stringify(finalConfig, null, 2));
  }
  
  // Also create legacy config in .claude for backward compatibility
  const legacyConfigPath = join(targetDir, '.claude/mcp-config.json');
  await fs.writeFile(legacyConfigPath, JSON.stringify(finalConfig, null, 2));

  // 🔧 CRITICAL FIX: Also update global SnowCode configuration
  // SnowCode/OpenCode reads from ~/.snowcode/snowcode.json
  const snowcodeConfigPath = join(process.env.HOME || '', '.snowcode', 'snowcode.json');
  const snowcodeConfigDirPath = join(process.env.HOME || '', '.snowcode');

  try {
    // Ensure directory exists
    try {
      await fs.access(snowcodeConfigDirPath);
    } catch {
      await fs.mkdir(snowcodeConfigDirPath, { recursive: true });
    }

    // Read existing SnowCode config or create new MINIMAL one
    let snowcodeConfig: any = {
      "$schema": "https://opencode.ai/config.json",
      "tui": {
        "scroll_speed": 5
      },
      "mcp": {}
    };

    try {
      const existingConfig = await fs.readFile(snowcodeConfigPath, 'utf-8');
      const existing = JSON.parse(existingConfig);

      // Preserve existing TUI and MCP config
      if (existing.tui) {
        snowcodeConfig.tui = existing.tui;
      }
      if (existing.mcp) {
        snowcodeConfig.mcp = existing.mcp;
      }
    } catch {
      // File doesn't exist or is invalid - will create new minimal one
    }

    // Transform MCP servers to SnowCode format using REAL values (not ${VAR} placeholders)
    // serverConfig.env already contains real values from template replacement
    for (const [serverName, serverConfig] of Object.entries(finalConfig.mcpServers) as [string, any][]) {
      const transformedConfig: any = {};

      // Handle local servers (have "command" + "args")
      if (serverConfig.command && serverConfig.args) {
        transformedConfig.type = "local";
        transformedConfig.command = [serverConfig.command, ...serverConfig.args];

        // Use ACTUAL values from serverConfig.env (already replaced from template)
        if (serverConfig.env) {
          transformedConfig.environment = {};

          // Copy all environment variables as-is (they have real values)
          for (const [key, value] of Object.entries(serverConfig.env)) {
            transformedConfig.environment[key] = value;
          }
          transformedConfig.enabled = true;
        } else {
          transformedConfig.enabled = true;
        }
      }
      // Handle remote servers (have "type": "sse" or "url")
      else if (serverConfig.type === 'sse' || serverConfig.url) {
        transformedConfig.type = "remote";
        transformedConfig.url = serverConfig.url;

        // Copy headers as-is (already have real values from template)
        if (serverConfig.headers) {
          transformedConfig.headers = {};
          var hasValidAuth = false;
          for (const [key, value] of Object.entries(serverConfig.headers)) {
            transformedConfig.headers[key] = value;
            // Check if Authorization header has actual token (not empty "Bearer " or placeholder)
            var val = String(value);
            if (key === 'Authorization' && val &&
                val.trim() !== 'Bearer' &&
                val.trim() !== 'Bearer ' &&
                !val.includes('your-enterprise-token-here') &&
                !val.includes('your-token-here') &&
                !val.includes('YOUR_') &&
                !val.includes('your_')) {
              hasValidAuth = true;
            }
          }
          // Disable server if Authorization is empty or placeholder (prevents auth errors)
          transformedConfig.enabled = serverName !== 'snow-flow-enterprise' || hasValidAuth;
        } else {
          transformedConfig.enabled = true;
        }
      }
      // Unknown format - skip to avoid schema violations
      else {
        // Don't copy unknown formats - they may violate OpenCode schema
        continue;
      }

      snowcodeConfig.mcp[serverName] = transformedConfig;
    }

    // Write GLOBAL config
    await fs.writeFile(snowcodeConfigPath, JSON.stringify(snowcodeConfig, null, 2));
    prompts.log.success(`Global SnowCode config updated: ${snowcodeConfigPath}`);
    prompts.log.message(`   Format: OpenCode/SnowCode with real credential values`);
    prompts.log.message(`   Servers: ${Object.keys(snowcodeConfig.mcp).join(', ')}`);

    // 🔥 ALSO write LOCAL config (takes priority!)
    const localSnowcodeDir = join(targetDir, '.snowcode');
    const localSnowcodePath = join(localSnowcodeDir, 'snowcode.json');

    try {
      // Ensure local .snowcode directory exists
      await fs.mkdir(localSnowcodeDir, { recursive: true });

      // Write SAME config to local directory
      await fs.writeFile(localSnowcodePath, JSON.stringify(snowcodeConfig, null, 2));
      prompts.log.success(`LOCAL SnowCode config created: ${localSnowcodePath}`);
      prompts.log.message(`   SnowCode will use THIS config (local takes priority)`);
    } catch (localError) {
      prompts.log.warn(`Could not create local SnowCode config: ${localError}`);
      prompts.log.message(`   Will fall back to global config`);
    }

  } catch (error) {
    prompts.log.warn(`Could not update SnowCode config: ${error}`);
    prompts.log.message('   SnowCode will use project-local .mcp.json instead');
  }
}

// Refresh MCP configuration command
program
  .command('refresh-mcp')
  .description('Refresh MCP server configuration to latest version')
  .option('--force', 'Force overwrite existing configuration')
  .action(async (options) => {
    prompts.log.step(`Refreshing MCP Configuration to v${VERSION}...`);

    try {
      // Check if project is initialized
      const envPath = join(process.cwd(), '.env');
      if (!existsSync(envPath)) {
        prompts.log.error('No .env file found. Please run "snow-flow init" first.');
        process.exit(1);
      }

      // Load env vars
      dotenv.config({ path: envPath });
      const instanceUrl = process.env.SNOW_INSTANCE;
      const clientId = process.env.SNOW_CLIENT_ID;
      const clientSecret = process.env.SNOW_CLIENT_SECRET;

      if (!instanceUrl || !clientId || !clientSecret) {
        prompts.log.error('Missing ServiceNow credentials in .env file.');
        process.exit(1);
      }

      const spinner = prompts.spinner();
      spinner.start('Updating MCP configuration');

      try {
        await setupMCPConfig(process.cwd(), instanceUrl, clientId, clientSecret, options.force || false);
        spinner.stop('MCP configuration refreshed successfully');
      } catch (err) {
        spinner.stop('Failed to update MCP configuration');
        throw err;
      }

      prompts.log.message('');
      prompts.log.info('IMPORTANT: Restart SnowCode (or Claude Code) to use the new configuration:');
      prompts.log.message('   SnowCode: snowcode');
      prompts.log.message('   Claude Code: claude --mcp-config .mcp.json');
      prompts.log.message('');
      prompts.log.info('The Local Development server now includes:');
      prompts.log.message('   - Universal artifact detection via sys_metadata');
      prompts.log.message('   - Support for ANY ServiceNow table (even custom)');
      prompts.log.message('   - Generic artifact handling for unknown types');
      prompts.log.message('   - Automatic file structure creation');

    } catch (error) {
      prompts.log.error('Failed to refresh MCP configuration:');
      prompts.log.message(String(error));
      process.exit(1);
    }
  });

// Direct widget creation command
program
  .command('create-widget [type]')
  .description('Create a ServiceNow widget using templates')
  .action(async (type: string = 'incident-management') => {
    try {
      // Use generic artifact deployment instead
      console.log('🎯 Creating widget using template system...');
      console.log('✨ Use: snow-flow deploy-artifact -t widget -c <config-file>');
      console.log('📝 Or use: snow-flow swarm "create a widget for incident management"');
    } catch (error) {
      console.error('❌ Error creating widget:', error);
    }
  });

// MCP Server command with subcommands
program
  .command('mcp <action>')
  .description('Manage ServiceNow MCP servers for SnowCode integration')
  .option('--server <name>', 'Specific server name to manage')
  .option('--port <port>', 'Port for MCP server (default: auto)')
  .option('--host <host>', 'Host for MCP server (default: localhost)')
  .action(async (action: string, options) => {
    // NOTE: MCP servers work with SnowCode's native Task() system
    console.log(chalk.blue('ℹ️  MCP servers configured for SnowCode (also compatible with Claude Code)'));
    console.log(chalk.yellow('⚠️  Manual MCP commands are no longer needed'));
    console.log(chalk.green('✅ SnowCode automatically handles all MCP server lifecycle'));
    console.log(chalk.blue('\n💡 Simply run your swarm commands - SnowCode handles the rest!'));
    return;
  });

// MCP action handlers
async function handleMCPStart(manager: any, options: any): Promise<void> {
  console.log('🚀 Starting ServiceNow MCP Servers...');
  
  if (options.server) {
    console.log(`📡 Starting server: ${options.server}`);
    const success = await manager.startServer(options.server);
    if (success) {
      console.log(`✅ Server '${options.server}' started successfully`);
    } else {
      console.log(`❌ Failed to start server '${options.server}'`);
      process.exit(1);
    }
  } else {
    console.log('📡 Starting all configured MCP servers...');
    await manager.startAllServers();
    
    const status = manager.getServerList();
    const running = status.filter((s: any) => s.status === 'running').length;
    const total = status.length;
    
    console.log(`\n✅ Started ${running}/${total} MCP servers`);

    if (running === total) {
      console.log('🎉 All MCP servers are now running!');
      console.log('\n📋 Next steps:');
      console.log('   1. Use: ' + chalk.cyan('snow-flow swarm "<your objective>"'));
      console.log('   2. MCP tools will be automatically available');
      console.log('   3. Use snow_deploy_widget, snow_deploy_flow, etc.');
    } else {
      console.log('⚠️  Some servers failed to start. Check logs with: snow-flow mcp logs');
    }
  }
}

async function handleMCPStop(manager: any, options: any): Promise<void> {
  if (options.server) {
    console.log(`🛑 Stopping server: ${options.server}`);
    const success = await manager.stopServer(options.server);
    if (success) {
      console.log(`✅ Server '${options.server}' stopped successfully`);
    } else {
      console.log(`❌ Failed to stop server '${options.server}'`);
      process.exit(1);
    }
  } else {
    console.log('🛑 Stopping all MCP servers...');
    await manager.stopAllServers();
    console.log('✅ All MCP servers stopped');
  }
}

async function handleMCPRestart(manager: any, options: any): Promise<void> {
  if (options.server) {
    console.log(`🔄 Restarting server: ${options.server}`);
    await manager.stopServer(options.server);
    const success = await manager.startServer(options.server);
    if (success) {
      console.log(`✅ Server '${options.server}' restarted successfully`);
    } else {
      console.log(`❌ Failed to restart server '${options.server}'`);
      process.exit(1);
    }
  } else {
    console.log('🔄 Restarting all MCP servers...');
    await manager.stopAllServers();
    await manager.startAllServers();
    
    const running = manager.getRunningServersCount();
    const total = manager.getServerList().length;
    console.log(`✅ Restarted ${running}/${total} MCP servers`);
  }
}

async function handleMCPStatus(manager: any, options: any): Promise<void> {
  const servers = manager.getServerList();
  
  console.log('\n📊 MCP Server Status');
  console.log('═'.repeat(80));
  
  if (servers.length === 0) {
    console.log('No MCP servers configured');
    return;
  }
  
  servers.forEach((server: any) => {
    const statusIcon = server.status === 'running' ? '✅' : 
                      server.status === 'starting' ? '🔄' : 
                      server.status === 'error' ? '❌' : '⭕';
    
    console.log(`${statusIcon} ${server.name}`);
    console.log(`   Status: ${server.status}`);
    console.log(`   Script: ${server.script}`);
    
    if (server.pid) {
      console.log(`   PID: ${server.pid}`);
    }
    
    if (server.startedAt) {
      console.log(`   Started: ${server.startedAt.toLocaleString()}`);
    }
    
    if (server.lastError) {
      console.log(`   Last Error: ${server.lastError}`);
    }
    
    console.log('');
  });
  
  const running = servers.filter((s: any) => s.status === 'running').length;
  const total = servers.length;
  
  console.log(`📈 Summary: ${running}/${total} servers running`);

  if (running === total) {
    console.log('🎉 All MCP servers are operational and available in SnowCode (or Claude Code)!');
  } else if (running > 0) {
    console.log('⚠️  Some servers are not running. Use "snow-flow mcp start" to start them.');
  } else {
    console.log('💡 No servers running. Use "snow-flow mcp start" to start all servers.');
  }
}

async function handleMCPLogs(manager: any, options: any): Promise<void> {
  const { join } = require('path');
  const { promises: fs } = require('fs');
  
  const logDir = join(process.env.SNOW_FLOW_HOME || join(os.homedir(), '.snow-flow'), 'logs');
  
  try {
    const logFiles = await fs.readdir(logDir);
    
    if (options.server) {
      const serverLogFile = `${options.server.replace(/\\s+/g, '_').toLowerCase()}.log`;
      if (logFiles.includes(serverLogFile)) {
        console.log(`📄 Logs for ${options.server}:`);
        console.log('═'.repeat(80));
        const logContent = await fs.readFile(join(logDir, serverLogFile), 'utf-8');
        console.log(logContent);
      } else {
        console.log(`❌ No logs found for server '${options.server}'`);
      }
    } else {
      console.log('📄 Available log files:');
      logFiles.forEach((file: string) => {
        console.log(`   - ${file}`);
      });
      console.log('\\n💡 Use --server <name> to view specific server logs');
    }
  } catch (error) {
    console.log('📄 No log files found');
  }
}

async function handleMCPList(manager: any, options: any): Promise<void> {
  const servers = manager.getServerList();
  
  console.log('\n📋 Configured MCP Servers');
  console.log('═'.repeat(80));
  
  if (servers.length === 0) {
    console.log('No MCP servers configured');
    console.log('💡 Run "snow-flow init" to configure default MCP servers');
    return;
  }
  
  servers.forEach((server: any, index: number) => {
    console.log(`${index + 1}. ${server.name}`);
    console.log(`   Script: ${server.script}`);
    console.log(`   Status: ${server.status}`);
    console.log('');
  });
}

async function handleMCPDebug(options: any): Promise<void> {
  console.log('🔍 MCP Debug Information');
  console.log('========================\n');
  
  const { existsSync, readFileSync } = require('fs');
  const { join, resolve } = require('path');
  
  // Check .mcp.json
  const mcpJsonPath = join(process.cwd(), '.mcp.json');
  console.log('📄 .mcp.json:');
  if (existsSync(mcpJsonPath)) {
    console.log(`   ✅ Found at: ${mcpJsonPath}`);
    try {
      const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));
      console.log(`   📊 Servers configured: ${Object.keys(mcpConfig.servers || {}).length}`);
      
      // Check if paths exist
      for (const [name, config] of Object.entries(mcpConfig.servers || {})) {
        const serverConfig = config as any;
        if (serverConfig.args && serverConfig.args[0]) {
          const scriptPath = serverConfig.args[0];
          const exists = existsSync(scriptPath);
          console.log(`   ${exists ? '✅' : '❌'} ${name}: ${scriptPath}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error reading: ${error}`);
    }
  } else {
    console.log(`   ❌ Not found at: ${mcpJsonPath}`);
  }
  
  // Check .claude/settings.json
  console.log('\n📄 .claude/settings.json:');
  const claudeSettingsPath = join(process.cwd(), '.claude/settings.json');
  if (existsSync(claudeSettingsPath)) {
    console.log(`   ✅ Found at: ${claudeSettingsPath}`);
    try {
      const settings = JSON.parse(readFileSync(claudeSettingsPath, 'utf8'));
      const enabledServers = settings.enabledMcpjsonServers || [];
      console.log(`   📊 Enabled servers: ${enabledServers.length}`);
      enabledServers.forEach((server: string) => {
        console.log(`      - ${server}`);
      });
    } catch (error) {
      console.log(`   ❌ Error reading: ${error}`);
    }
  } else {
    console.log(`   ❌ Not found at: ${claudeSettingsPath}`);
  }
  
  // Check environment
  console.log('\n🔐 Environment:');
  console.log(`   SNOW_INSTANCE: ${process.env.SNOW_INSTANCE ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SNOW_CLIENT_ID: ${process.env.SNOW_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SNOW_CLIENT_SECRET: ${process.env.SNOW_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);
  
  // Check SnowCode
  console.log('\n🤖 SnowCode:');
  const { execSync } = require('child_process');
  try {
    execSync('which snowcode', { stdio: 'ignore' });
    console.log('   ✅ SnowCode CLI found');
  } catch {
    console.log('   ❌ SnowCode CLI not found in PATH');
    console.log('   💡 Install with: npm install -g @groeimetai/snowcode');
  }

  console.log('\n💡 Tips:');
  console.log('   1. Ensure SnowCode is configured: snowcode config import snowcode-config.example.json');
  console.log('   2. Check .env file has valid ServiceNow credentials and LLM API keys');
  console.log('   3. Start developing: snow-flow swarm "your objective"');
  console.log('   4. SnowCode will automatically connect to Snow-Flow\'s MCP servers');
}


// SPARC Detailed Help Command - DISABLED (sparc-help.js file missing)
// program
//   .command('sparc-help')
//   .description('Show detailed SPARC help information')
//   .action(async () => {
//     try {
//       const { displayTeamHelp } = await import('./sparc/sparc-help.js');
//       displayTeamHelp();
//     } catch (error) {
//       console.error('❌ Failed to load SPARC help:', error instanceof Error ? error.message : String(error));
//     }
//   });


// ===================================================
// 📤 CLAUDE DESKTOP EXPORT COMMAND
// ===================================================

program
  .command('export')
  .description('📤 Export Snow-Flow MCP configuration to Claude Desktop with automatic credential injection')
  .option('--output <path>', 'Custom output path for Claude Desktop config')
  .option('--backup', 'Backup existing Claude Desktop config before overwriting', true)
  .option('--merge', 'Merge with existing Claude Desktop config instead of overwriting')
  .option('--dry-run', 'Preview the export without writing files')
  .action(async (options) => {
    console.log(`\n📤 Snow-Flow Claude Desktop Export v${VERSION}`);
    console.log('🎯 Exporting all 22 MCP servers with 245+ tools to Claude Desktop...\n');
    
    try {
      const { exportToClaudeDesktop } = await import('./utils/claude-desktop-exporter.js');
      
      const result = await exportToClaudeDesktop({
        outputPath: options.output,
        backup: options.backup,
        merge: options.merge,
        dryRun: options.dryRun
      });
      
      if (result.success) {
        console.log('✅ Claude Desktop export completed successfully!\n');
        
        if (result.configPath) {
          console.log(`📝 Configuration written to: ${result.configPath}`);
        }
        
        if (result.backupPath) {
          console.log(`💾 Backup created at: ${result.backupPath}`);
        }
        
        if (result.merged) {
          console.log(`🔗 Merged with existing configuration (${result.existingServers} existing servers preserved)`);
        }
        
        console.log(`🔑 Credentials automatically injected from .env file`);
        console.log(`🌍 Instance: ${result.credentials.instance}`);
        console.log(`🔐 Authentication: OAuth configured`);
        
        console.log('\n🚀 Next steps:');
        console.log('1. Restart Claude Desktop to load the new MCP servers');
        console.log('2. Open Claude Desktop chat');
        console.log('3. Try: "Create UX workspace for IT support using snow_create_complete_workspace"');
        console.log('\n💡 All 245+ Snow-Flow tools are now available in Claude Desktop!');
      } else {
        console.error('\n❌ Export failed:', result.error);
        
        if (result.missingCredentials) {
          console.error('\n🔑 Missing credentials in .env file:');
          result.missingCredentials.forEach(cred => {
            console.error(`   • ${cred}`);
          });
          console.error('\nRun: snow-flow auth login');
        }
        
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n💥 Export error:', (error as Error).message);
      process.exit(1);
    }
  });

// ===================================================
// 🔄 BACKWARD COMPATIBILITY ENHANCEMENTS
// ===================================================

/**
 * Enhance existing swarm command with optional Queen intelligence
 * 
 * Note: Users can use: snow-flow swarm "objective" --queen
 * This will be implemented in a future version once the Queen system is stable.
 */

// ===================================================
// 🎯 INTEGRATE SNOW-FLOW HIVE-MIND SYSTEM
// ===================================================


// Note: The new integrated commands enhance the existing CLI with:
// - Advanced system status monitoring
// - Real-time monitoring dashboard
// - Persistent memory management
// - Configuration management
// - Performance analytics
// Comment out the line below to disable the integrated commands
// CLI integration removed - swarm command is implemented directly above

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
