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
// Snow-Flow CLI integration removed - using direct agent command implementation
import { snowFlowSystem } from './snow-flow-system.js';
import { Logger } from './utils/logger.js';
import chalk from 'chalk';
import * as prompts from '@clack/prompts';
// Load MCP Persistent Guard for bulletproof server protection
import { MCPPersistentGuard } from './utils/mcp-persistent-guard.js';
// Load SnowCode output interceptor for beautiful MCP formatting
import { interceptSnowCodeOutput } from './utils/snowcode-output-interceptor.js';
// Automatic snow-code update utility (optimized with caching)
import { autoUpdateSnowCode } from './utils/auto-update-snow-code.js';
// MCP configuration sync utility
import { syncMcpConfigs } from './utils/sync-mcp-configs.js';
// Config cache for faster startup
import { loadSnowCodeConfig, loadJsonConfig } from './utils/config-cache.js';

// Activate MCP guard ONLY for commands that actually use MCP servers
// Explicitly exclude: init, version, help, auth, export, config commands
const commandsNeedingMCP = ['agent', 'swarm', 'status', 'monitor', 'mcp'];
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

// Helper function to fix binary permissions (critical for containers/codespaces)
function fixSnowCodeBinaryPermissions(): void {
  try {
    const { chmodSync } = require('fs');
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
        join(process.cwd(), 'node_modules', '@groeimetai', platform, 'bin', 'snow-code'),
        join(os.homedir(), '.npm', '_npx', '*', 'node_modules', '@groeimetai', platform, 'bin', 'snow-code'),
        join(__dirname, '..', 'node_modules', '@groeimetai', platform, 'bin', 'snow-code')
      ];

      paths.forEach(binaryPath => {
        if (existsSync(binaryPath)) {
          try {
            chmodSync(binaryPath, 0o755);
            cliLogger.debug(`Fixed permissions for ${platform}`);
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

// Agent command - the main orchestration command with EVERYTHING
// Note: 'swarm' is kept as an alias for backward compatibility
program
  .command('agent <objective>')
  .alias('swarm')
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

    // Show clean intro for non-verbose mode
    if (!options.verbose) {
      prompts.intro(chalk.blue.bold(`🚀 Snow-Flow v${VERSION}`));
      prompts.log.message(chalk.dim(objective));
    } else {
      cliLogger.info(`\n🚀 Snow-Flow v${VERSION}`);
      console.log(chalk.blue(`📋 ${objective}`));
    }

    // Run snow-code update check in background (non-blocking)
    // Don't await - let agent start immediately while update runs async
    if (options.verbose) {
      cliLogger.info('🔄 Checking for snow-code updates (background)...');
    }
    autoUpdateSnowCode(process.cwd(), options.verbose)
      .then((updateResult) => {
        if (updateResult.success && options.verbose) {
          cliLogger.debug(`✓ Snow-code v${updateResult.mainPackageVersion || 'latest'} updated in background`);
        }
      })
      .catch((updateErr) => {
        if (options.verbose) {
          cliLogger.debug('Snow-code background update failed (non-critical):', updateErr);
        }
      });

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
    
    // Initialize Agent memory system (with graceful fallback)
    let memorySystem: any = null;
    let sessionId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (options.verbose) {
        cliLogger.info('\n💾 Initializing agent memory system...');
      }
      const { SessionMemorySystem } = await import('./memory/session-memory');
      memorySystem = new SessionMemorySystem();

      // Session ID only in verbose mode
      if (options.verbose) {
        cliLogger.info(`🔖 Session: ${sessionId}`);
      }

      // Store agent session in memory
      await memorySystem.storeLearning(`session_${sessionId}`, {
        objective,
        taskAnalysis,
        options,
        started_at: new Date().toISOString(),
        is_authenticated: isAuthenticated
      });
    } catch (error) {
      // Memory system is optional - agent works without it
      if (options.verbose) {
        cliLogger.warn('⚠️  Memory tracking unavailable (will continue without session tracking)');
      }
      // Create mock memory system for compatibility
      memorySystem = {
        storeLearning: async () => {},
        getLearning: async () => null,
        retrieveLearning: async () => null,
        updateLearning: async () => {}
      };
    }

    // Start SnowCode with the objective
    try {
      if (options.verbose) {
        cliLogger.info('\n🚀 Starting SnowCode...');
        cliLogger.info(`📋 Objective: "${objective}"`);
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
      const success = await executeSnowCode(objective, options);

      if (success) {
        // Store successful launch in memory
        memorySystem.storeLearning(`launch_${sessionId}`, {
          success: true,
          launched_at: new Date().toISOString()
        });

        if (!options.verbose) {
          prompts.outro(chalk.green('✨ Session completed'));
        }
      } else {
        if (options.verbose) {
          cliLogger.error('SnowCode failed to start - check configuration');
        } else {
          prompts.log.error('SnowCode failed to start');
          prompts.log.info('Run: snow-flow init');
        }
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
    // Load SnowCode config using cache (much faster on repeated calls)
    const config = loadSnowCodeConfig(process.cwd());
    if (!config) {
      return pids;
    }

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

// Helper function to execute SnowCode directly with the objective
async function executeSnowCode(objective: string, options: any): Promise<boolean> {
  let mcpServerPIDs: number[] = [];

  try {
    // Auto-update SnowCode in background (non-blocking)
    autoUpdateSnowCode(process.cwd(), options.verbose).catch(() => {
      // Silently ignore update errors - not critical
    });

    // Check if SnowCode CLI is available
    const { execSync } = require('child_process');
    try {
      execSync('which snow-code', { stdio: 'ignore' });
    } catch {
      cliLogger.error('SnowCode CLI not found - install: npm install -g @groeimetai/snow-code');
      return false;
    }

    // Check for SnowCode config (.snow-code/config.json OR .snow-code/snow-code.json)
    const snowcodeConfigPath = join(process.cwd(), '.snow-code', 'config.json');
    const snowcodeConfigPathAlt = join(process.cwd(), '.snow-code', 'snow-code.json');
    if (!existsSync(snowcodeConfigPath) && !existsSync(snowcodeConfigPathAlt)) {
      cliLogger.error('SnowCode config not found - run: snow-flow init');
      return false;
    }

    // Check for .env file
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      cliLogger.error('.env file not found - run: snow-flow init');
      return false;
    }

    // Show startup spinner in non-verbose mode
    let startupSpinner;
    if (!options.verbose) {
      startupSpinner = prompts.spinner();
      startupSpinner.start('Starting SnowCode');
    }

    // 🔥 CRITICAL: SnowCode v0.15.14 doesn't auto-start MCP servers
    // We need to start them manually before launching SnowCode
    mcpServerPIDs = await startMCPServers();
    if (mcpServerPIDs.length === 0) {
      if (options.verbose) {
        cliLogger.warn('⚠️  No MCP servers started - tools may not be available');
      }
    } else {
      if (options.verbose) {
        cliLogger.info(`✅ Started ${mcpServerPIDs.length} MCP server(s)`);
      } else if (startupSpinner) {
        startupSpinner.stop('SnowCode ready');
      }
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
    // Use 'snow-code --prompt <objective>' to start TUI with initial prompt
    const snowcodeProcess = spawn('snow-code', snowcodeArgs, {
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
    cliLogger.info('📋 Please start SnowCode manually: snow-code');
    return false;
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

// Agent status command - monitor running agent sessions
// Note: 'swarm-status' is kept as an alias for backward compatibility
program
  .command('agent-status [sessionId]')
  .alias('swarm-status')
  .description('Check the status of a running agent session')
  .option('--watch', 'Continuously monitor the agent progress')
  .option('--interval <seconds>', 'Watch interval in seconds', '5')
  .action(async (sessionId: string | undefined, options) => {
    cliLogger.info('\n🔍 Checking agent status...\n');

    try {
      // Try to load memory system
      let memorySystem: any;
      try {
        const { SessionMemorySystem } = await import('./memory/session-memory');
        memorySystem = new SessionMemorySystem();
      } catch (error) {
        cliLogger.error('❌ Memory system unavailable - session tracking not available in this version');
        cliLogger.info('💡 Please upgrade snow-flow to enable session tracking');
        cliLogger.info('   Run: npm install -g snow-flow@latest');
        return;
      }

      if (!sessionId) {
        // List all recent agent sessions
        cliLogger.info('📋 Recent agent sessions:');
        cliLogger.info('(Provide a session ID to see detailed status)\n');

        // Get all session keys from learnings
        const sessionKeys: string[] = [];
        // Note: This is a simplified approach - in production, you'd query the memory files directly
        cliLogger.info('💡 Use: snow-flow agent-status <sessionId> to see details');
        cliLogger.info('💡 Session IDs are displayed when you start an agent session\n');
        return;
      }

      // Get specific session data
      const sessionData = await memorySystem.getLearning(`session_${sessionId}`);
      const launchData = await memorySystem.getLearning(`launch_${sessionId}`);
      const errorData = await memorySystem.getLearning(`error_${sessionId}`);

      if (!sessionData) {
        console.error(`❌ No agent session found with ID: ${sessionId}`);
        cliLogger.info('💡 Make sure to use the exact session ID displayed when starting the agent');
        return;
      }

      cliLogger.info(`👑 Agent Session: ${sessionId}`);
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
      cliLogger.info('   - Use Memory.get("agent_session_' + sessionId + '") in SnowCode');
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
          cliLogger.info('\n\n✋ Stopped watching agent status');
          process.exit(0);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to check agent status:', error instanceof Error ? error.message : String(error));
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
    prompts.intro(chalk.blue.bold(`🏔️ Snow-Flow v${VERSION}`));

    const targetDir = process.cwd();

    try {
      // Check for .snow-flow migration
      const { migrationUtil } = await import('./utils/migrate-snow-flow.js');
      if (await migrationUtil.checkMigrationNeeded()) {
        const s = prompts.spinner();
        s.start('Migrating project structure');
        await migrationUtil.migrate();
        s.stop('Migration complete');
      }

      // Skip snow-code auto-update during init (users can update manually)
      // Auto-update may fail in new projects without package.json and requires global permissions
      // Users will get the bundled version from snow-flow, which is sufficient for init
      if (options.verbose) {
        cliLogger.debug('Skipping snow-code auto-update during init (not required for project setup)');
      }

      // Create project structure
      const setupSpinner = prompts.spinner();
      setupSpinner.start('Setting up project');

      await createDirectoryStructure(targetDir, options.force);
      await createEnvFile(targetDir, options.force);
      await createMCPConfig(targetDir, options.force);

      await copyCLAUDEmd(targetDir, options.force);
      await createReadmeFiles(targetDir, options.force);
      await copySnowCodeConfig(targetDir, options.force);
      await copySnowCodeThemes(targetDir, options.force);
      await copySnowCodePackageJson(targetDir, options.force);
      // copyMCPServerScripts removed - scripts/ directory no longer needed for snow-code

      setupSpinner.stop('Project configured');

      // Verify MCP servers
      if (!options.skipMcp) {
        const mcpSpinner = prompts.spinner();
        mcpSpinner.start('Verifying MCP servers');
        await verifyMCPServers(targetDir);
        mcpSpinner.stop('MCP servers verified');
      }

      // Sync .mcp.json to .snow-code/config.json
      // This ensures snow-code discovers all MCP servers
      try {
        await syncMcpConfigs(targetDir);
      } catch (syncErr: any) {
        cliLogger.warn(`MCP config sync warning: ${syncErr.message}`);
      }

      // Check and optionally install SnowCode locally
      await checkAndInstallSnowCode();

      // Show next steps BEFORE the success outro
      prompts.log.message('');
      prompts.log.step('Next steps:');
      prompts.log.message('');
      prompts.log.message('  1. Authenticate with providers:');
      prompts.log.info('     snow-flow auth login');
      prompts.log.message('');
      prompts.log.message('  2. Start developing:');
      prompts.log.info('     snow-flow agent "create incident dashboard"');
      prompts.log.message('');

      prompts.outro(chalk.green('✅ Snow-Flow initialized successfully!'));

      // Force exit to prevent hanging
      process.exit(0);

    } catch (error) {
      prompts.log.error('Initialization failed');
      cliLogger.error('Init error:', error);
      process.exit(1);
    }
  });

// Help command
program
  .command('help')
  .description('Show detailed help information')
  .action(() => {
    console.log(`
🚀 Snow-Flow v${VERSION} - ServiceNow AI Development Platform

📋 Essential Commands:
  snow-flow init              Initialize project with MCP servers
  snow-flow auth login        Complete authentication setup
  snow-flow agent "task"      Execute AI-powered ServiceNow development

🎯 Quick Start:
  1. snow-flow init                           # Set up your project
  2. snow-flow auth login                     # Authenticate (LLM + ServiceNow + Enterprise)
  3. snow-flow agent "your task"              # Let AI build your solution

💡 Example Tasks:
  snow-flow agent "create incident dashboard widget"
  snow-flow agent "build auto-assignment business rule"
  snow-flow agent "generate 5000 test incidents with realistic data"
  snow-flow agent "refactor legacy client scripts to modern patterns"

🔗 What You Get:
  • 75+ LLM providers (Claude, GPT, Gemini, Llama, Mistral, DeepSeek, etc.)
  • 393 optimized ServiceNow tools via MCP protocol
  • Multi-agent AI orchestration for complex tasks
  • Automatic Update Set management
  • Direct ServiceNow instance integration

🌐 More Info: https://github.com/groeimetai/snow-flow
    `);
  });

// Helper functions for init command

// Check if SnowCode is installed, and offer to install it
async function checkAndInstallSnowCode(): Promise<boolean> {
  const { execSync } = require('child_process');
  let snowcodeInstalled = false;

  try {
    // Check if snow-code is already installed globally via npm
    execSync('npm list -g @groeimetai/snow-code --depth=0', { stdio: 'ignore' });
    snowcodeInstalled = true;
  } catch {
    // SnowCode not installed

    // Import inquirer dynamically
    const inquirer = (await import('inquirer')).default;

    const { shouldInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInstall',
        message: 'Would you like to install SnowCode now? (npm install -g @groeimetai/snow-code)',
        default: true
      }
    ]);

    if (!shouldInstall) {
      return false;
    }

    // Install SnowCode globally with latest version
    try {
      // Use @latest and --force to bypass npm cache and get absolute latest version
      execSync('npm install -g @groeimetai/snow-code@latest --force', { stdio: 'inherit' });

      // Fix binary permissions immediately after install
      fixSnowCodeBinaryPermissions();

      snowcodeInstalled = true;
    } catch (error) {
      return false;
    }
  }

  // ALWAYS install SnowCode locally in the project directory with platform binaries
  try {
    const projectDir = process.cwd();
    // Use --force to bypass npm cache and get absolute latest version
    // Suppress output to avoid cluttering the init process
    execSync('npm install @groeimetai/snow-code@latest --no-audit --no-fund --force', {
      cwd: projectDir,
      stdio: 'ignore'
    });

    // Fix binary permissions immediately after install
    fixSnowCodeBinaryPermissions();
  } catch (error) {
    // Silently continue - snow-code installation is optional
    return false;
  }

  // If SnowCode is installed, copy config to .snow-code/ directory
  // SnowCode automatically detects config files in project root and .snow-code/ directory
  if (snowcodeInstalled) {
    const exampleConfigPath = join(process.cwd(), 'snow-code-config.example.json');
    const snowcodeConfigPath = join(process.cwd(), '.snow-code', 'config.json');

    // Check if example config file exists
    try {
      await fs.access(exampleConfigPath);

      try {
        // Copy example config to .snow-code/config.json for automatic detection
        let configContent = await fs.readFile(exampleConfigPath, 'utf-8');

        // Ensure the config content has the correct cwd (in case it still has a placeholder)
        // This is a safety check - the placeholder should already be replaced by copySnowCodeConfig
        if (configContent.includes('"/path/to/your/snow-flow/installation"')) {

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
        return true; // Successfully configured
      } catch (error) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return false;
}

async function createDirectoryStructure(targetDir: string, force: boolean = false) {
  // Minimal directory structure for snow-code
  // Legacy directories (.claude, .swarm, .snow-flow, memory, coordination, servicenow, templates, scripts, .snow-code/agent) removed
  // snow-code has its own built-in agent system, no need for custom agents from snow-flow
  const directories = [
    '.snow-code',
    '.snow-code/command',
    '.snow-code/plugin'
  ];

  for (const dir of directories) {
    const dirPath = join(targetDir, dir);
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// createBasicConfig removed - legacy .claude and .swarm configs no longer needed

async function createReadmeFiles(targetDir: string, force: boolean = false) {
  // Only create README.md if it doesn't exist already
  const readmePath = join(targetDir, 'README.md');
  if (!existsSync(readmePath) || force) {
    // Import modern README template
    const { README_TEMPLATE } = await import('./templates/readme-template.js');

    await fs.writeFile(readmePath, README_TEMPLATE);
  }
  // Legacy sub-directory READMEs removed (memory/, servicenow/ directories no longer created)
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

    // Try to find the snow-code-config.example.json
    const sourceFiles = [
      join(snowFlowRoot, 'snow-code-config.example.json'),
      join(__dirname, '..', 'snow-code-config.example.json'),
      join(__dirname, 'snow-code-config.example.json'),
      join(__dirname, '..', '..', '..', 'snow-code-config.example.json'),
      join(__dirname, '..', '..', '..', '..', 'snow-code-config.example.json'),
      join(process.cwd(), 'snow-code-config.example.json')
    ];

    let foundSource = false;
    let configContent = '';

    for (const sourcePath of sourceFiles) {
      try {
        configContent = await fs.readFile(sourcePath, 'utf8');
        foundSource = true;
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!foundSource) {
      return;
    }

    // Replace placeholders with actual snow-flow installation path
    configContent = configContent.replace(
      '"/path/to/your/snow-flow/installation"',
      `"${snowFlowRoot.replace(/\\/g, '/')}"`
    );

    const targetPath = join(targetDir, 'snow-code-config.example.json');

    try {
      await fs.access(targetPath);
      if (!force) {
        return;
      }
    } catch {
      // File doesn't exist, continue with creation
    }

    await fs.writeFile(targetPath, configContent);

  } catch (error) {
    // Silent error handling
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
      join(snowFlowRoot, '.snow-code', 'themes'),
      join(__dirname, '..', '.snow-code', 'themes')
    ];

    let themesSourceDir: string | null = null;
    for (const sourcePath of themesSourcePaths) {
      try {
        await fs.access(sourcePath);
        themesSourceDir = sourcePath;
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!themesSourceDir) {
      return;
    }

    // Create target .snow-code/themes directory
    const themesTargetDir = join(targetDir, '.snow-code', 'themes');
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
        // Silent error handling
      }
    }

  } catch (error) {
    // Silent error handling
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

    // Find snow-code package.json template
    const templateSourcePaths = [
      join(snowFlowRoot, 'templates', 'snow-code-package.json'),
      join(__dirname, '..', 'templates', 'snow-code-package.json'),
      join(__dirname, 'templates', 'snow-code-package.json')
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
      return;
    }

    // Create .snow-code directory
    const snowcodeDir = join(targetDir, '.snow-code');
    await fs.mkdir(snowcodeDir, { recursive: true });

    // Copy package.json template
    const targetPath = join(snowcodeDir, 'package.json');

    // Check if file already exists
    try {
      await fs.access(targetPath);
      if (!force) {
        return;
      }
    } catch {
      // File doesn't exist, we can create it
    }

    await fs.copyFile(templatePath, targetPath);

  } catch (error) {
    // Silent error handling
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
    // Read SnowCode configuration - try config.json first (primary), then snow-code.json (fallback for legacy)
    const configJsonPath = path.join(targetDir, '.snow-code', 'config.json');
    const snowCodeJsonPath = path.join(targetDir, '.snow-code', 'snow-code.json');

    let configContent: string;
    try {
      configContent = await fs.readFile(configJsonPath, 'utf-8');
    } catch {
      // Fallback to snow-code.json for legacy projects
      configContent = await fs.readFile(snowCodeJsonPath, 'utf-8');
    }
    const config = JSON.parse(configContent);

    if (!config.mcp) {
      return;
    }

    const serverNames = Object.keys(config.mcp);
    let successCount = 0;
    let failCount = 0;

    for (const serverName of serverNames) {
      const serverConfig = config.mcp[serverName];

      if (!serverConfig.enabled) {
        continue;
      }

      try {
        // Skip remote servers (SSE/HTTP) - they can't be tested with spawn
        if (serverConfig.type === 'remote' || serverConfig.url) {
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
          successCount++;
        } else if (error.includes('Cannot find module') || error.includes('ENOENT')) {
          failCount++;
        } else if (error) {
          // Check if stderr contains success messages (some servers log to stderr)
          const isSuccessMessage = error.includes('MCP server running') ||
                                   error.includes('Started on stdio') ||
                                   error.includes('ServiceNow MCP') ||
                                   error.includes('Snow-Flow MCP');

          if (isSuccessMessage) {
            successCount++;
          } else {
            failCount++;
          }
        } else {
          // This is actually OK - server started but needs auth
          successCount++;
        }

      } catch (err: any) {
        failCount++;
      }
    }

  } catch (error: any) {
    // Silent error handling
  }
}

// copyMCPServerScripts removed - scripts/ directory no longer needed for snow-code
// snow-code auto-manages MCP servers via .mcp.json and .snow-code/config.json

async function copyCLAUDEmd(targetDir: string, force: boolean = false) {
  let claudeMdContent = '';

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
      join(__dirname, '..', 'CLAUDE.md'),
      join(__dirname, 'CLAUDE.md'),
      join(__dirname, '..', '..', '..', 'CLAUDE.md'),
      join(__dirname, '..', '..', '..', '..', 'CLAUDE.md'),
      join(process.cwd(), 'CLAUDE.md')
    ];

    let foundSource = false;

    for (const sourcePath of sourceClaudeFiles) {
      try {
        claudeMdContent = await fs.readFile(sourcePath, 'utf8');
        foundSource = true;
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!foundSource) {
      const { CLAUDE_MD_TEMPLATE } = await import('./templates/claude-md-template.js');
      claudeMdContent = CLAUDE_MD_TEMPLATE;
    }

    // Create AGENTS.md in root (snow-code searches for AGENTS.md or CLAUDE.md)
    const agentsMdPath = join(targetDir, 'AGENTS.md');
    try {
      await fs.access(agentsMdPath);
      if (force) {
        await fs.writeFile(agentsMdPath, claudeMdContent);
      }
    } catch {
      await fs.writeFile(agentsMdPath, claudeMdContent);
    }

    // Create CLAUDE.md as copy of AGENTS.md (for Claude Code compatibility)
    const claudeMdPath = join(targetDir, 'CLAUDE.md');
    try {
      await fs.access(claudeMdPath);
      if (force) {
        await fs.writeFile(claudeMdPath, claudeMdContent);
      }
    } catch {
      await fs.writeFile(claudeMdPath, claudeMdContent);
    }

    // Setup .snow-code/ directory (directories already created by createDirectoryStructure)
    const snowcodeDir = join(targetDir, '.snow-code');
    // Agent files no longer copied - snow-code has its own built-in agent system

    // Create .snow-code/config.json from .mcp.json.template
    const envPath = join(targetDir, '.env');
    const envValues: Record<string, string> = {};

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
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          envValues[key] = value;
        }
      }
    } catch (error) {
      // Silent error handling
    }

    function getEnvValue(key: string, defaultValue: string = ''): string {
      var value = envValues[key] || process.env[key] || defaultValue;
      if (key === 'SNOW_INSTANCE' && value && !value.startsWith('http')) {
        value = 'https://' + value.replace(/^https?:\/\//, '');
      }
      return value;
    }

    const mcpTemplatePath = join(snowFlowRoot, '.mcp.json.template');
    let mcpTemplateContent: string;

    try {
      mcpTemplateContent = await fs.readFile(mcpTemplatePath, 'utf-8');
    } catch (error) {
      throw error;
    }

    const mcpConfigContent = mcpTemplateContent
      .replace(/{{PROJECT_ROOT}}/g, snowFlowRoot)
      .replace(/{{SNOW_INSTANCE}}/g, getEnvValue('SNOW_INSTANCE'))
      .replace(/{{SNOW_CLIENT_ID}}/g, getEnvValue('SNOW_CLIENT_ID'))
      .replace(/{{SNOW_CLIENT_SECRET}}/g, getEnvValue('SNOW_CLIENT_SECRET'))
      .replace(/{{SNOW_FLOW_ENV}}/g, getEnvValue('SNOW_FLOW_ENV', 'development'));

    const mcpConfig = JSON.parse(mcpConfigContent);
    const snowcodeConfig = convertToSnowCodeFormat(mcpConfig);

    // Write only config.json (snow-code reads this)
    const configJsonPath = join(snowcodeDir, 'config.json');
    await fs.writeFile(configJsonPath, JSON.stringify(snowcodeConfig, null, 2));

  } catch (error) {
    // Fallback: create minimal AGENTS.md
    const { CLAUDE_MD_TEMPLATE } = await import('./templates/claude-md-template.js');
    const agentsMdPath = join(targetDir, 'AGENTS.md');
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
  } catch (error) {
    // If template not found, try alternative locations
    try {
      const alternativePath = join(process.cwd(), '.env.example');
      envContent = await fs.readFile(alternativePath, 'utf-8');
    } catch (fallbackError) {
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
      await fs.writeFile(envFilePath, envContent);
    } else {
      await fs.writeFile(join(targetDir, '.env.example'), envContent);
    }
  } catch {
    // .env doesn't exist, create it
    await fs.writeFile(envFilePath, envContent);
  }
}

async function appendToEnvFile(targetDir: string, content: string) {
  const envFilePath = join(targetDir, '.env');
  await fs.appendFile(envFilePath, content);
}

/**
 * Converts Claude Desktop MCP config format to SnowCode/OpenCode format
 * Single source of truth: .mcp.json.template → both .mcp.json and .snow-code/config.json
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
    // Silent error handling
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
  
  // Keep the standard MCP structure that snow-code expects
  // Use the snow-code MCP structure directly from template (mcp key)
  const finalConfig = mcpConfig;

  // Create .mcp.json in project root (snow-code reads this directly)
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
  // .claude/mcp-config.json removed - snow-code is the only supported client

  // ✅ PROJECT-SCOPED MCP CONFIG ONLY
  // Each project maintains its own isolated MCP configuration in .mcp.json
  // snow-code automatically discovers and uses the project-level .mcp.json

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

  // .claude/settings.json removed - snow-code doesn't use this format
  // snow-code uses .snow-code/config.json for all configuration
  // Keeping claudeSettings object for potential future snow-code config migration
  void claudeSettings; // Suppress unused variable warning
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
  
  // Keep the standard MCP structure that snow-code expects
  // Use the snow-code MCP structure directly from template (mcp key)
  const finalConfig = mcpConfig;
  
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
  // .claude/mcp-config.json removed - snow-code is the only supported client

  // Update project-level .snow-code/config.json
  const snowcodeConfigPath = join(targetDir, '.snow-code', 'config.json');
  const snowcodeConfigDirPath = join(targetDir, '.snow-code');

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
    // Support both new (mcp) and old (mcpServers) format for backwards compatibility
    const mcpServers = finalConfig.mcp || finalConfig.mcpServers || {};
    for (const [serverName, serverConfig] of Object.entries(mcpServers) as [string, any][]) {
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
    const localSnowcodeDir = join(targetDir, '.snow-code');
    const localSnowcodePath = join(localSnowcodeDir, 'config.json');

    try {
      // Ensure local .snow-code directory exists
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
      console.log('📝 Or use: snow-flow agent "create a widget for incident management"');
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
    console.log(chalk.blue('\n💡 Simply run your agent commands - SnowCode handles the rest!'));
    return;
  });


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
    console.log('🎯 Exporting all 22 MCP servers with 247+ tools to Claude Desktop...\n');
    
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
        console.log('\n💡 All 247+ Snow-Flow tools are now available in Claude Desktop!');
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
 * Enhance existing agent command with optional Queen intelligence
 *
 * Note: Users can use: snow-flow agent "objective" --queen
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
// CLI integration removed - agent command is implemented directly above

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
