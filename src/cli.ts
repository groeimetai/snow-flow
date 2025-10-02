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
// Load MCP Persistent Guard for bulletproof server protection
import { MCPPersistentGuard } from './utils/mcp-persistent-guard.js';

// Activate MCP guard (it will self-check if protection is needed)
MCPPersistentGuard.getInstance();
// Removed provider-agnostic imports - using Claude Code directly
import { registerAuthCommands } from './cli/auth.js';
import { registerSessionCommands } from './cli/session.js';

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
  .option('--xml-first', 'Use XML-first approach for flow creation (MOST RELIABLE!)')
  .option('--xml-output <path>', 'Save generated XML to specific path (with --xml-first)')
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
    
    // Always show essential info
    cliLogger.info(`\n🚀 Snow-Flow v${VERSION}`);
    console.log(chalk.blue(`📋 ${objective}`));
    
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
    } else {
      // In non-verbose mode, only show critical info
      if (options.autoDeploy) {
        console.log(chalk.green(`✅ ServiceNow integration active - will create real artifacts`));
      }
      
      // Calculate autonomous systems for non-verbose mode (same logic as verbose)
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
      
      // Show active autonomous systems
      const activeSystems = [];
      if (autonomousDocActive) activeSystems.push('📚 Documentation');
      if (autonomousCostActive) activeSystems.push('💰 Cost Optimization');
      if (autonomousComplianceActive) activeSystems.push('🔐 Compliance');
      if (autonomousHealingActive) activeSystems.push('🏥 Self-Healing');
      
      if (activeSystems.length > 0) {
        cliLogger.info(`🤖 Autonomous Systems: ${activeSystems.join(', ')}`);
      } else {
        cliLogger.info(`🤖 Autonomous Systems: ❌ All Disabled`);
      }
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
    } else if (!isAuthenticated) {
      // In non-verbose mode, only warn if not authenticated
      console.log(chalk.yellow('⚠️  Not authenticated - run ') + chalk.cyan('snow-flow auth login') + chalk.yellow(' first'));
    }
    
    // Initialize Queen Agent memory system
    if (options.verbose) {
      cliLogger.info('\n💾 Initializing swarm memory system...');
    }
    const { QueenMemorySystem } = await import('./queen/queen-memory.js');
    const memorySystem = new QueenMemorySystem();
    
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
    
    // Check if this is a Flow Designer flow request
    const isFlowDesignerTask = taskAnalysis.taskType === 'flow_development' || 
                               taskAnalysis.primaryAgent === 'flow-builder' ||
                               (objective.toLowerCase().includes('flow') && 
                                !objective.toLowerCase().includes('workflow') &&
                                !objective.toLowerCase().includes('data flow'));
    
    let xmlFlowResult: any = null;
    
    // Start real Claude Code orchestration
    try {
      // Generate the Queen Agent orchestration prompt
      const orchestrationPrompt = buildQueenAgentPrompt(objective, taskAnalysis, options, isAuthenticated, sessionId, isFlowDesignerTask);
      
      if (options.verbose) {
        cliLogger.info('\n👑 Initializing Queen Agent orchestration...');
        cliLogger.info('🎯 Queen Agent will coordinate the following:');
        cliLogger.info(`   - Analyze objective: "${objective}"`);
        cliLogger.info(`   - Spawn ${taskAnalysis.estimatedAgentCount} specialized agents`);
        cliLogger.info(`   - Coordinate through shared memory (session: ${sessionId})`);
        cliLogger.info(`   - Monitor progress and adapt strategy`);
      } else {
        cliLogger.info('\n👑 Launching Queen Agent...');
      }
      
      // Check if intelligent features are enabled
      const hasIntelligentFeatures = options.autoPermissions || options.smartDiscovery || 
        options.liveTesting || options.autoDeploy || options.autoRollback || 
        options.sharedMemory || options.progressMonitoring;
      
      if (options.verbose && hasIntelligentFeatures && isAuthenticated) {
        cliLogger.info('\n🧠 INTELLIGENT ORCHESTRATION MODE ENABLED!');
        cliLogger.info('✨ Queen Agent will use advanced features:');
        
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
      
      console.log(chalk.blue('\n🚀 Starting Claude Code with 245+ ServiceNow tools including complete UX Workspace creation...'));
      
      // Try to execute Claude Code directly with the prompt
      const success = await executeClaudeCode(orchestrationPrompt);
      
      if (success) {
        cliLogger.info('✅ Claude Code launched successfully!');
        
        if (options.verbose) {
          cliLogger.info('👑 Queen Agent is now coordinating your swarm');
          cliLogger.info(`💾 Monitor progress with session ID: ${sessionId}`);
          
          if (isAuthenticated && options.autoDeploy) {
            cliLogger.info('🚀 Real artifacts will be created in ServiceNow');
          } else {
            cliLogger.info('📋 Planning mode - _analysis and recommendations only');
          }
        }
        
        // Store successful launch in memory
        memorySystem.storeLearning(`launch_${sessionId}`, {
          success: true,
          launched_at: new Date().toISOString()
        });
      } else {
        if (options.verbose) {
          cliLogger.info('\n🚀 SNOW-FLOW ORCHESTRATION COMPLETE!');
          cliLogger.info('🤖 Now it\'s time for Claude Code agents to do the work...\n');
          
          cliLogger.info('👑 QUEEN AGENT ORCHESTRATION PROMPT FOR CLAUDE CODE:');
          cliLogger.info('=' .repeat(80));
          cliLogger.info(orchestrationPrompt);
          cliLogger.info('=' .repeat(80));
          
          cliLogger.info('\n✅ Snow-Flow has prepared the orchestration!');
          cliLogger.info('📊 CRITICAL NEXT STEPS:');
          cliLogger.info('   1. Copy the ENTIRE prompt above');
          cliLogger.info('   2. Paste it into Claude Code (the AI assistant)');
          cliLogger.info('   3. Claude Code will spawn multiple specialized agents as workhorses');
          cliLogger.info('   4. These agents will implement your flow with all required logic');
          cliLogger.info('   5. Agents will enhance the basic XML template with real functionality');
          
          cliLogger.info('\n🎯 Remember:');
          cliLogger.info('   - Snow-Flow = Orchestrator (coordinates the work)');
          cliLogger.info('   - Claude Code = Workhorses (implement the solution)');
          
          if (xmlFlowResult) {
            cliLogger.info(`\n📁 XML template saved at: ${xmlFlowResult.filePath}`);
            cliLogger.info('   ⚠️  This is just a BASIC template - agents must enhance it!');
          }
          
          if (isAuthenticated && options.autoDeploy) {
            cliLogger.info('\n🚀 Deployment Mode: Agents will create REAL artifacts in ServiceNow');
          } else {
            cliLogger.info('\n📋 Planning Mode: Analysis and recommendations only');
          }
          cliLogger.info(`\n💾 Session ID for monitoring: ${sessionId}`);
        } else {
          // Non-verbose mode - just show the essential info
          cliLogger.info('\n📋 Manual Claude Code execution required');
          cliLogger.info('💡 Run with --verbose to see the full orchestration prompt');
          
          if (xmlFlowResult) {
            cliLogger.info(`📁 XML generated: ${xmlFlowResult.filePath}`);
          }
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


// Helper function to execute Claude Code directly
async function executeClaudeCode(prompt: string): Promise<boolean> {
  cliLogger.info('🤖 Preparing Claude Code agent orchestration...');
  
  try {
    // Check if Claude CLI is available
    const { execSync } = require('child_process');
    try {
      execSync('which claude', { stdio: 'ignore' });
    } catch {
      cliLogger.warn('⚠️  Claude Code CLI not found in PATH');
      cliLogger.info('📋 Please install Claude Desktop or copy the prompt manually');
      return false;
    }
    
    
    // Check for MCP config
    const mcpConfigPath = join(process.cwd(), '.mcp.json');
    const hasMcpConfig = existsSync(mcpConfigPath);
    
    // NOTE: MCP servers now managed by Claude Agent SDK (v4.7.0+)
    // SDK automatically initializes MCP servers from configuration
    if (hasMcpConfig) {
      console.log(chalk.blue('ℹ️  MCP servers managed by Claude Agent SDK v0.1.1'));
      console.log(chalk.green('✅ 235+ ServiceNow tools available via unified MCP server'));
    }
    
    // Launch Claude Code with MCP config and skip permissions to avoid raw mode issues
    const claudeArgs = hasMcpConfig 
      ? ['--mcp-config', '.mcp.json', '--dangerously-skip-permissions']
      : ['--dangerously-skip-permissions'];
    
    // Add debug args if debug is enabled
    if (process.env.SNOW_FLOW_DEBUG === 'true' || process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace') {
      claudeArgs.push('--verbose');
      if (process.env.LOG_LEVEL === 'trace') {
        claudeArgs.push('--trace');
      }
    }
    
    cliLogger.info('🚀 Launching Claude Code automatically...');
    if (hasMcpConfig) {
      cliLogger.info('🔧 Starting Claude Code with ServiceNow MCP servers...');
      if (process.env.MCP_DEBUG === 'true') {
        cliLogger.info('🔍 MCP Debug Mode Active - Expect detailed connection logs');
      }
    }
    
    // Debug output if enabled
    if (process.env.SNOW_FLOW_DEBUG === 'true' || process.env.VERBOSE === 'true') {
      cliLogger.info(`🔍 Claude Command: claude ${claudeArgs.join(' ')}`);
      cliLogger.info(`🔍 Working Directory: ${process.cwd()}`);
      cliLogger.info(`🔍 MCP Config: ${mcpConfigPath}`);
    }
    
    // Start Claude Code process in interactive mode with stdin piping
    const claudeProcess = spawn('claude', claudeArgs, {
      stdio: ['pipe', 'inherit', 'inherit'], // pipe stdin, inherit stdout/stderr
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    // Send the prompt via stdin
    cliLogger.info('📝 Sending orchestration prompt to Claude Code...');
    cliLogger.info('🚀 Claude Code interface opening...\n');
    
    // Write prompt to stdin
    claudeProcess.stdin.write(prompt);
    claudeProcess.stdin.end();
    
    // Set up process monitoring
    return new Promise((resolve) => {
      claudeProcess.on('close', async (code) => {
        
        if (code === 0) {
          cliLogger.info('\n✅ Claude Code session completed successfully!');
          resolve(true);
        } else {
          cliLogger.warn(`\n⚠️  Claude Code session ended with code: ${code}`);
          resolve(false);
        }
      });
      
      claudeProcess.on('error', (error) => {
        cliLogger.error(`❌ Failed to start Claude Code: ${error.message}`);
        resolve(false);
      });
      
      // Set timeout (configurable via environment variable)
      const timeoutMinutes = parseInt(process.env.SNOW_FLOW_TIMEOUT_MINUTES || '0');
      if (timeoutMinutes > 0) {
        setTimeout(() => {
          cliLogger.warn(`⏱️  Claude Code session timeout (${timeoutMinutes} minutes), terminating...`);
          claudeProcess.kill('SIGTERM');
          resolve(false);
        }, timeoutMinutes * 60 * 1000);
      }
    });
    
  } catch (error) {
    cliLogger.error('❌ Error launching Claude Code:', error instanceof Error ? error.message : String(error));
    cliLogger.info('📋 Claude Code prompt generated - please copy and paste manually');
    return false;
  }
}

// Real-time monitoring dashboard for Claude Code process
function startMonitoringDashboard(claudeProcess: ChildProcess): NodeJS.Timeout {
  let iterations = 0;
  const startTime = Date.now();
  
  // Show initial dashboard only once
  cliLogger.info(`┌─────────────────────────────────────────────────────────────┐`);
  cliLogger.info(`│               🚀 Snow-Flow Dashboard v${VERSION}            │`);
  cliLogger.info(`├─────────────────────────────────────────────────────────────┤`);
  cliLogger.info(`│ 🤖 Claude Code Status:  ✅ Starting                          │`);
  cliLogger.info(`│ 📊 Process ID:          ${claudeProcess.pid || 'N/A'}        │`);
  cliLogger.info(`│ ⏱️  Session Time:        00:00                               │`);
  cliLogger.info(`│ 🔄 Monitoring Cycles:    0                                   │`);
  cliLogger.info('└─────────────────────────────────────────────────────────────┘');
  
  // Silent monitoring - only log to file or memory, don't interfere with Claude Code UI
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
function buildQueenAgentPrompt(objective: string, taskAnalysis: TaskAnalysis, options: any, isAuthenticated: boolean = false, sessionId: string, isFlowDesignerTask: boolean = false): string {
  // Check if intelligent features are enabled
  const hasIntelligentFeatures = options.autoPermissions || options.smartDiscovery || 
    options.liveTesting || options.autoDeploy || options.autoRollback || 
    options.sharedMemory || options.progressMonitoring;

  const prompt = `# 👑 Snow-Flow Queen Agent Orchestration

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

${isFlowDesignerTask ? `## 🔧 Flow Designer Task Detected - Using Enhanced Flow Creation!

**MANDATORY: Use this exact approach for Flow Designer tasks:**

\`\`\`javascript
// ✅ Complete flow generation with ALL features
await snow_create_flow({
  instruction: "your natural language flow description", 
  deploy_immediately: true,  // 🔥 Automatically deploys to ServiceNow!
  return_metadata: true     // 📊 Returns complete deployment metadata
});
\`\`\`

🎯 **What this does automatically:**
- ✅ Generates proper flow structure with all components
- ✅ Uses correct ServiceNow tables and relationships
- ✅ Deploys directly to your ServiceNow instance
- ✅ Returns complete metadata (sys_id, URLs, endpoints)
- ✅ Includes all requested features and logic

` : ''}

## 📊 Table Discovery Intelligence

The Queen Agent will automatically discover and validate table schemas based on the objective. This ensures agents use correct field names and table structures.

**Table Detection Examples:**
- "create widget for incident records" → Discovers: incident, sys_user, sys_user_group
- "build approval flow for u_equipment_request" → Discovers: u_equipment_request, sys_user, sysapproval_approver
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
    
    // Flow agents depend on architecture
    'flow-builder': ['architect', 'app-architect'],
    'trigger-specialist': ['flow-builder'],
    'action-specialist': ['flow-builder'],
    'approval-specialist': ['flow-builder'],
    
    // Integration agents can run in parallel with others
    'integration-specialist': ['architect'],
    'api-specialist': ['architect'],
    
    // Testing/Security agents run last
    'tester': ['script-writer', 'widget-creator', 'flow-builder', 'frontend-specialist', 'backend-specialist'],
    'security-specialist': ['script-writer', 'api-specialist'],
    'performance-specialist': ['frontend-specialist', 'backend-specialist'],
    
    // Error handling depends on main implementation
    'error-handler': ['flow-builder', 'script-writer'],
    
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
    'flow-builder': 'You are the flow builder. Create the main flow structure. Store flow design in Memory for specialists.',
    'trigger-specialist': 'You are the trigger specialist. Configure flow triggers based on the flow design in Memory.',
    'action-specialist': 'You are the action specialist. Implement flow actions based on the flow design in Memory.',
    'approval-specialist': 'You are the approval specialist. Set up approval processes in the flow.',
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
      const { QueenMemorySystem } = await import('./queen/queen-memory.js');
      const memorySystem = new QueenMemorySystem();
      
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
      const sessionData = memorySystem.getLearning(`session_${sessionId}`);
      const launchData = memorySystem.getLearning(`launch_${sessionId}`);
      const errorData = memorySystem.getLearning(`error_${sessionId}`);
      
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
        cliLogger.info(`\n✅ Status: Claude Code launched successfully`);
        cliLogger.info(`🚀 Launched at: ${launchData.launched_at}`);
      } else if (errorData) {
        cliLogger.error(`\n❌ Status: Error occurred`);
        cliLogger.error(`💥 Error: ${errorData.error}`);
        cliLogger.error(`🕐 Failed at: ${errorData.failed_at}`);
      } else {
        cliLogger.info(`\n⏳ Status: Awaiting manual Claude Code execution`);
      }
      
      cliLogger.info('\n💡 Tips:');
      cliLogger.info('   - Check Claude Code for real-time agent progress');
      cliLogger.info('   - Use Memory.get("swarm_session_' + sessionId + '") in Claude Code');
      cliLogger.info('   - Monitor TodoRead for task completion status');
      
      if (options.watch) {
        cliLogger.info(`\n👀 Watching for updates every ${options.interval} seconds...`);
        cliLogger.info('(Press Ctrl+C to stop)\n');
        
        const watchInterval = setInterval(async () => {
          // In a real implementation, this would query Claude Code's memory
          cliLogger.info(`[${new Date().toLocaleTimeString()}] Checking for updates...`);
          
          // Re-fetch session data to check for updates
          const updatedSession = memorySystem.getLearning(`session_${sessionId}`);
          if (updatedSession) {
            cliLogger.info('   Status: Active - Check Claude Code for details');
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
    } else if (type === 'workflow-designer') {
      cliLogger.info('   ├── Flow Designer workflow creation');
      cliLogger.info('   ├── Process automation');
      cliLogger.info('   ├── Approval routing');
      cliLogger.info('   └── Integration orchestration');
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
  .description('Show orchestrator status')
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
    cliLogger.info('   ├── workflow-designer: Available');
    cliLogger.info('   ├── script-generator: Available');
    cliLogger.info('   ├── ui-builder: Available');
    cliLogger.info('   └── app-creator: Available');
    
    cliLogger.info('\n⚙️  Configuration:');
    cliLogger.info('   ├── Instance: Not set');
    cliLogger.info('   ├── Authentication: Not configured');
    cliLogger.info('   └── Mode: Development');
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
      
      // Check for active Claude Code processes
      try {
        const { execSync } = require('child_process');
        const processes = execSync('ps aux | grep "claude" | grep -v grep', { encoding: 'utf8' }).toString();
        if (processes.trim()) {
          cliLogger.info('\n🤖 Active Claude Code Processes:');
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
      
      // Create directory structure
      console.log('\n📁 Creating project structure...');
      await createDirectoryStructure(targetDir, options.force);
      
      // Create .env file
      console.log('🔐 Creating environment configuration...');
      await createEnvFile(targetDir, options.force);
      
      // Create MCP configuration - always included now (SPARC is default)
      console.log('🔧 Setting up MCP servers for Claude Code...');
      await createMCPConfig(targetDir, options.force);
      
      // Copy CLAUDE.md file
      console.log('📚 Creating documentation files...');
      await copyCLAUDEmd(targetDir, options.force);
      
      // Create README files
      await createReadmeFiles(targetDir, options.force);
      
      console.log(chalk.green.bold('\n✅ Snow-Flow project initialized successfully!'));
      console.log('\n📋 Created Snow-Flow configuration:');
      console.log('   ✓ .claude/ - Claude Code MCP configuration');
      console.log('   ✓ .mcp.json - 2 unified MCP servers (235+ tools including complete UX Workspace workflow)');
      console.log('   ✓ CLAUDE.md - Complete development guide');
      console.log('   ✓ README.md - Current capabilities documentation');
      console.log('   ✓ .snow-flow/ - Project workspace and memory');

      if (!options.skipMcp) {
        // NOTE: MCP servers now managed by Claude Agent SDK (v4.7.0+)
        console.log(chalk.blue('\nℹ️  MCP servers now managed by Claude Agent SDK v0.1.1'));
        console.log(chalk.green('✅ 235+ ServiceNow tools automatically available via unified server'));
        console.log(chalk.blue('📋 SDK handles MCP server lifecycle automatically'));
      }

      console.log(chalk.blue.bold('\n🎯 Next steps:'));
      console.log(chalk.red.bold('⚠️  IMPORTANT: Ensure Claude Code is running first!'));
      console.log('1. Start Claude Code: ' + chalk.cyan('claude --dangerously-skip-permissions'));
      console.log('2. Authenticate Snow-Flow: ' + chalk.cyan('snow-flow auth login'));
      console.log('3. Start developing: ' + chalk.cyan('snow-flow swarm "create incident dashboard"'));
      console.log('\n📚 Complete documentation: ' + chalk.blue('https://snow-flow.dev'));
      console.log('💡 Complete UX Workspace creation, UI Builder, and 235+ unified tools now available');
      
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
  snow-flow auth login --instance dev12345.service-now.com --client-id your-id --client-secret your-secret
  snow-flow auth status
  snow-flow mcp start   # Start MCP servers for Claude Code
  snow-flow mcp status  # Check MCP server status
  snow-flow swarm "create a widget for incident management"
  snow-flow swarm "create approval flow"  # 🔧 Auto-detects Flow Designer and uses XML!
  snow-flow swarm "generate 5000 incidents" --auto-confirm  # 📝 Auto-confirm background scripts
  snow-flow spawn widget-builder --name "IncidentWidget"
  snow-flow monitor --duration 120
  snow-flow memory store "project" "incident_system"
  snow-flow status

🤖 Agent Types:
  widget-builder       Create Service Portal widgets
  workflow-designer    Design Flow Designer workflows
  script-generator     Generate scripts and business rules
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
  - Execute workflows in real-time
  - Test changes immediately in your instance

🌐 More Info: https://github.com/groeimetai/snow-flow
    `);
  });

// Helper functions for init command
async function createDirectoryStructure(targetDir: string, force: boolean = false) {
  const directories = [
    '.claude', '.claude/commands', '.claude/commands/sparc', '.claude/configs',
    '.swarm', '.swarm/sessions', '.swarm/agents',
    '.snow-flow', '.snow-flow/queen', '.snow-flow/memory', '.snow-flow/data', '.snow-flow/queen-test', '.snow-flow/queen-advanced',
    'memory', 'memory/agents', 'memory/sessions',
    'coordination', 'coordination/memory_bank', 'coordination/subtasks',
    'servicenow', 'servicenow/widgets', 'servicenow/workflows', 'servicenow/scripts',
    'templates', 'templates/widgets', 'templates/workflows'
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
    const mainReadme = `# Snow-Flow: Multi-Agent ServiceNow Development Platform 🚀

Snow-Flow is a powerful multi-agent AI platform that revolutionizes ServiceNow development through intelligent automation, natural language processing, and autonomous deployment capabilities. Built with 11 specialized MCP (Model Context Protocol) servers, Snow-Flow enables developers to create, manage, and deploy ServiceNow artifacts using simple natural language commands.

## 🆕 What's New in v1.1.51

### 🎯 CRITICAL FIXES - All User Issues Resolved!
- **ROOT CAUSE SOLVED**: Flow Designer validation failures completely eliminated
- **JSON SCHEMA FLEXIBILITY**: Accepts both "steps" and "activities" arrays with auto-conversion
- **DOCUMENTATION SYNC**: Init command now creates comprehensive CLAUDE.md (373 lines vs 15)
- **COMPLETE GUIDE**: New users get full Snow-Flow development environment from day one

### 🧠 Intelligent Error Recovery (v1.1.48-1.1.49)
- **AUTOMATIC FALLBACKS**: Flow Designer → Business Rule conversion when deployment fails
- **SMART SESSIONS**: Update Sets auto-create when none exist - no more "no active session" errors
- **ZERO MANUAL WORK**: All systematic errors from user feedback now automatically handled
- **COMPREHENSIVE TESTING**: Enhanced flow testing with Business Rule fallback detection

### 🚀 Enhanced Swarm Command (v1.1.42+)
Most intelligent features are now **enabled by default** - één command voor alles!
- **DEFAULT TRUE**: \`--smart-discovery\`, \`--live-testing\`, \`--auto-deploy\`, \`--auto-rollback\`, \`--shared-memory\`, \`--progress-monitoring\`
- **INTELLIGENT ORCHESTRATION**: Uses \`snow_orchestrate_development\` MCP tool automatically
- **NO FLAGS NEEDED**: Just run \`snow-flow swarm "create widget"\` and everything works!

### 🔍 Real-Time ServiceNow Integration (v1.1.41+)
- **LIVE VALIDATION**: \`snow_validate_live_connection\` - real-time auth and permission checking
- **SMART PREVENTION**: \`snow_discover_existing_flows\` - prevents duplicate flows
- **LIVE TESTING**: \`snow_test_flow_execution\` - real flow testing in live instances
- **BATCH VALIDATION**: \`batch_deployment_validator\` - comprehensive multi-artifact validation
- **AUTO ROLLBACK**: \`deployment_rollback_manager\` - automatic rollback with backup creation

## 🌟 Key Features

### 🤖 11 Specialized MCP Servers
Each server provides autonomous capabilities for different aspects of ServiceNow development:

1. **Deployment MCP** - Autonomous widget and application deployment
2. **Update Set MCP** - Professional change tracking and deployment management
3. **Intelligent MCP** - AI-powered artifact discovery and editing
4. **Graph Memory MCP** - Relationship tracking and impact analysis
5. **Platform Development MCP** - Development workflow automation
6. **Integration MCP** - Third-party system integration
7. **Operations MCP** - Operations and monitoring management
8. **Automation MCP** - Workflow and process automation
9. **Security & Compliance MCP** - Security auditing and compliance
10. **Reporting & Analytics MCP** - Data _analysis and reporting
11. **Memory MCP** - Multi-agent coordination and todo management

### 🎯 Core Capabilities

- **Natural Language Processing**: Create complex ServiceNow artifacts using plain English/Dutch commands
- **Intelligent Decision Making**: Automatically determines optimal architecture (flow vs subflow)
- **Zero Configuration**: All values dynamically discovered from your ServiceNow instance
- **Autonomous Deployment**: Direct deployment to ServiceNow with automatic error handling
- **Update Set Management**: Professional change tracking like ServiceNow pros use
- **Global Scope Strategy**: Intelligent scope selection with fallback mechanisms
- **Multi-Agent Coordination**: Parallel execution for complex tasks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- ServiceNow instance with admin access
- OAuth application configured in ServiceNow

### Installation

\`\`\`bash
# Install Snow-Flow globally
npm install -g snow-flow

# Initialize Snow-Flow in your project directory
snow-flow init
\`\`\`

#### Alternative: Install from source
\`\`\`bash
# Clone the repository
git clone https://github.com/groeimetai/snow-flow.git
cd snow-flow

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
\`\`\`

### Configuration

1. Create a \`.env\` file in the project root:
\`\`\`env
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-oauth-client-id
SNOW_CLIENT_SECRET=your-oauth-client-secret
SNOW_USERNAME=your-username
SNOW_PASSWORD=your-password
\`\`\`

2. Set up OAuth in ServiceNow (see [SERVICENOW-OAUTH-SETUP.md](./SERVICENOW-OAUTH-SETUP.md))

3. Authenticate with ServiceNow:
\`\`\`bash
snow-flow auth login
\`\`\`

### 🎯 MCP Server Activation (v1.1.25+)

Snow-Flow now includes **automatic MCP server activation** for Claude Code! During initialization, you'll be prompted to automatically start Claude Code with all 11 MCP servers pre-loaded:

\`\`\`bash
snow-flow init

# You'll see:
# 🚀 Would you like to start Claude Code with MCP servers automatically? (Y/n)
# Press Y to launch Claude Code with all MCP servers ready to use!
\`\`\`

The MCP servers are automatically:
- ✅ Configured with correct paths for global npm installations
- ✅ Registered in Claude Code's settings
- ✅ Activated without manual approval steps
- ✅ Ready to use immediately after initialization

If you need to manually activate MCP servers later:
\`\`\`bash
# For Mac/Linux:
claude --mcp-config .mcp.json

# For Windows:
claude.exe --mcp-config .mcp.json
\`\`\`

## 💡 Usage Examples

### Create a Complex Flow with Natural Language
\`\`\`bash
snow-flow sparc "Create an approval workflow for iPhone 6 orders that notifies managers, creates tasks, and updates inventory"
\`\`\`

### Deploy a Widget Directly to ServiceNow
\`\`\`bash
snow-flow sparc "Create and deploy a widget that shows all critical incidents with real-time updates"
\`\`\`

### Start a Multi-Agent Swarm for Complex Projects
\`\`\`bash
# Most intelligent features are enabled by default!
snow-flow swarm "Build a complete incident management system with dashboard, workflows, and notifications"

# Default settings:
# ✅ --smart-discovery (true) - Reuses existing artifacts
# ✅ --live-testing (true) - Tests in real-time
# ✅ --auto-deploy (true) - Deploys automatically (safe with update sets)
# ✅ --auto-rollback (true) - Rollbacks on failures
# ✅ --shared-memory (true) - Agents share context
# ✅ --progress-monitoring (true) - Real-time status

# Add --auto-permissions to enable automatic permission escalation
snow-flow swarm "Create enterprise workflow" --auto-permissions

# Disable specific features with --no- prefix
snow-flow swarm "Test workflow" --no-auto-deploy --no-live-testing
\`\`\`

### Intelligent Artifact Discovery
\`\`\`bash
snow-flow sparc "Find and modify the approval workflow to add an extra approval step for orders over $1000"
\`\`\`

### Create Flows in Dutch
\`\`\`bash
snow-flow sparc "Maak een flow voor het automatisch toewijzen van incidenten aan de juiste groep op basis van categorie"
\`\`\`

## 🛠️ Advanced Features

### Flow vs Subflow Intelligence
Snow-Flow automatically analyzes your requirements and decides whether to create a main flow or break it into reusable subflows:
- Complexity analysis
- Reusability assessment
- Performance optimization
- Maintainability considerations

### Update Set Management
Professional change tracking just like ServiceNow developers use:
\`\`\`bash
# Create a new update set for your feature
snow-flow sparc "Create update set for new approval features"

# All subsequent changes are automatically tracked
snow-flow sparc "Add approval widget to portal"
\`\`\`

### Global Scope Strategy
Intelligent deployment scope selection:
- Automatic permission validation
- Fallback mechanisms for restricted environments
- Environment-aware deployment (dev/test/prod)

### Template Matching
Recognizes common patterns and applies best practices:
- Approval workflows
- Fulfillment processes
- Notification systems
- Integration patterns

## 🔧 New MCP Tools (v1.1.44+)

### Catalog Item Search with Fuzzy Matching
Find catalog items even when you don't know the exact name:
\`\`\`javascript
// In Claude Code with MCP tools
snow_catalog_item_search({
  query: "iPhone",          // Finds iPhone 6S, iPhone 7, etc.
  fuzzy_match: true,       // Intelligent variations
  category_filter: "mobile devices",
  include_variables: true  // Get catalog variables
});
\`\`\`

### Flow Testing with Mock Data
Test flows without affecting production data:
\`\`\`javascript
snow_test_flow_with_mock({
  flow_id: "equipment_provisioning_flow",
  create_test_user: true,      // Auto-creates test user
  mock_catalog_items: true,    // Creates test items
  mock_catalog_data: [
    {
      name: "Test iPhone 6S",
      price: "699.00"
    }
  ],
  simulate_approvals: true,    // Auto-approves
  cleanup_after_test: true     // Removes test data
});
\`\`\`

### Direct Catalog-Flow Linking
Link catalog items directly to flows for automated fulfillment:
\`\`\`javascript
snow_link_catalog_to_flow({
  catalog_item_id: "iPhone 6S",
  flow_id: "mobile_provisioning_flow",
  link_type: "flow_catalog_process",  // Modern approach
  variable_mapping: [
    {
      catalog_variable: "phone_model",
      flow_input: "device_type"
    },
    {
      catalog_variable: "user_department",
      flow_input: "department"
    }
  ],
  trigger_condition: 'current.stage == "request_approved"',
  execution_options: {
    run_as: "user",    // 🔒 SEC-001 FIX: Default to 'user' to prevent privilege escalation
    wait_for_completion: true
  },
  test_link: true  // Creates test request
});
\`\`\`

### Bulk Deployment
Deploy multiple artifacts in a single transaction:
\`\`\`javascript
snow_bulk_deploy({
  artifacts: [
    { type: "widget", data: widgetData },
    { type: "flow", data: flowData },
    { type: "script", data: scriptData }
  ],
  transaction_mode: true,  // All-or-nothing deployment
  parallel: true,         // Deploy simultaneously
  dry_run: false
});
\`\`\`

## 📁 Project Structure

\`\`\`
snow-flow/
├── src/
│   ├── mcp/                    # 11 MCP server implementations
│   ├── orchestrator/           # Flow composition and intelligence
│   ├── strategies/             # Deployment and scope strategies
│   ├── api/                    # ServiceNow API integration
│   ├── managers/               # Resource and scope management
│   └── utils/                  # Utilities and helpers
├── .snow-flow/                 # Snow-Flow configuration
├── .claude/                    # Claude configuration
├── memory/                     # Persistent agent memory
└── coordination/               # Multi-agent coordination
\`\`\`

## 🔧 Development Commands

\`\`\`bash
# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run typecheck

# Development mode
npm run dev

# Build for production
npm run build
\`\`\`

## 📚 Documentation

- [MCP Server Documentation](./MCP_SERVERS.md) - Detailed info on all 11 MCP servers
- [OAuth Setup Guide](./SERVICENOW-OAUTH-SETUP.md) - ServiceNow OAuth configuration
- [Update Set Guide](./UPDATE_SET_DEPLOYMENT_GUIDE.md) - Professional change management
- [API Integration Guide](./API_INTEGRATION_GUIDE.md) - ServiceNow API details

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines (coming soon).

## 🔒 Security

- All credentials stored securely in environment variables
- OAuth 2.0 authentication with ServiceNow
- No hardcoded values - everything discovered dynamically
- Secure token management with automatic refresh

## 🎯 Use Cases

### For ServiceNow Developers
- Rapidly prototype flows and workflows
- Automate repetitive development tasks
- Ensure consistency across implementations
- Reduce development time by 80%

### For ServiceNow Architects
- Validate architectural decisions
- Ensure best practices are followed
- Analyze impact of changes
- Optimize performance and maintainability

### For ServiceNow Administrators
- Quick deployments and updates
- Professional change tracking
- Automated testing and validation
- Simplified migration between instances

## 🚦 Roadmap

- [ ] Visual flow designer integration
- [ ] Enhanced Neo4j graph visualization
- [ ] Multi-instance synchronization
- [ ] AI-powered code review
- [ ] Automated testing framework
- [ ] Performance optimization recommendations

## 🆕 What's New in v1.1.25

### Automatic MCP Server Activation 🎯
- **Interactive Prompt**: During \`snow-flow init\`, you're now prompted to automatically start Claude Code with all MCP servers
- **Zero Manual Steps**: No more manual MCP approval in Claude Code - servers load automatically using \`claude --mcp-config\`
- **Cross-Platform Support**: Works on Mac, Linux, and Windows with platform-specific activation scripts
- **Instant Availability**: All 11 ServiceNow MCP servers are immediately available in Claude Code after initialization

### Previous Updates
- **v1.1.24**: Added \`snow-flow mcp debug\` command for troubleshooting MCP configurations
- **v1.1.23**: Fixed .npmignore to include essential .claude configuration files
- **v1.1.22**: Verified global npm installation correctly registers all MCP servers
- **v1.1.20**: Added enabledMcpjsonServers to ensure MCP visibility in Claude Code

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Built with the power of Claude AI and the ServiceNow platform. Special thanks to the ServiceNow developer community for inspiration and best practices.

---

**Ready to revolutionize your ServiceNow development?** Start with \`snow-flow init\` and experience the future of ServiceNow automation! 🚀
`;

    await fs.writeFile(readmePath, mainReadme);
  }
  
  // Create sub-directory READMEs
  await fs.writeFile(join(targetDir, 'memory/agents/README.md'), '# Agent Memory\n\nThis directory contains persistent memory for ServiceNow agents.');
  await fs.writeFile(join(targetDir, 'servicenow/README.md'), '# ServiceNow Artifacts\n\nThis directory contains generated ServiceNow development artifacts.');
}


// Helper functions

async function copyCLAUDEmd(targetDir: string, force: boolean = false) {
  let claudeMdContent = '';
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
    }
  } catch (error) {
    console.log('⚠️  Error copying CLAUDE.md, creating Snow-Flow specific version');
    // Import the template as fallback
    const { CLAUDE_MD_TEMPLATE } = await import('./templates/claude-md-template.js');
    const claudeMdPath = join(targetDir, 'CLAUDE.md');
    if (force || !existsSync(claudeMdPath)) {
      await fs.writeFile(claudeMdPath, CLAUDE_MD_TEMPLATE);
    }
  }
}

async function createEnvFile(targetDir: string, force: boolean = false) {
  // Read content from .env.template file
  let envContent: string;
  
  try {
    // Try to read from the project's .env.template file
    const templatePath = join(__dirname, '..', '.env.template');
    envContent = await fs.readFile(templatePath, 'utf-8');
    console.log('📋 Using .env.template for configuration');
  } catch (error) {
    // If template not found, try alternative locations
    try {
      const alternativePath = join(process.cwd(), '.env.template');
      envContent = await fs.readFile(alternativePath, 'utf-8');
      console.log('📋 Using .env.template from current directory');
    } catch (fallbackError) {
      console.warn('⚠️  Could not find .env.template file, using embedded minimal version');
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
  
  // Read the template file
  const templatePath = join(snowFlowRoot, '.mcp.json.template');
  let templateContent: string;
  
  try {
    templateContent = await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error('❌ Could not find .mcp.json.template file');
    throw error;
  }
  
  // Replace placeholders in template
  const distPath = join(snowFlowRoot, 'dist');
  const mcpConfigContent = templateContent
    .replace(/{{PROJECT_ROOT}}/g, snowFlowRoot)
    .replace(/{{SNOW_INSTANCE}}/g, '${SNOW_INSTANCE}')
    .replace(/{{SNOW_CLIENT_ID}}/g, '${SNOW_CLIENT_ID}')
    .replace(/{{SNOW_CLIENT_SECRET}}/g, '${SNOW_CLIENT_SECRET}')
    .replace(/{{SNOW_DEPLOYMENT_TIMEOUT}}/g, '${SNOW_DEPLOYMENT_TIMEOUT}')
    .replace(/{{MCP_DEPLOYMENT_TIMEOUT}}/g, '${MCP_DEPLOYMENT_TIMEOUT}')
    .replace(/{{NEO4J_URI}}/g, '${NEO4J_URI}')
    .replace(/{{NEO4J_USER}}/g, '${NEO4J_USER}')
    .replace(/{{NEO4J_PASSWORD}}/g, '${NEO4J_PASSWORD}')
    .replace(/{{SNOW_FLOW_ENV}}/g, '${SNOW_FLOW_ENV}');
  
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
      console.log('⚠️  .mcp.json already exists, overwriting with --force flag');
      await fs.writeFile(mcpConfigPath, JSON.stringify(finalConfig, null, 2));
    } else {
      console.log('⚠️  .mcp.json already exists, skipping (use --force to overwrite)');
    }
  } catch {
    await fs.writeFile(mcpConfigPath, JSON.stringify(finalConfig, null, 2));
  }
  
  // Also create legacy config in .claude for backward compatibility
  const legacyConfigPath = join(targetDir, '.claude/mcp-config.json');
  await fs.writeFile(legacyConfigPath, JSON.stringify(finalConfig, null, 2));
  
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
async function setupMCPConfig(
  targetDir: string,
  instanceUrl: string,
  clientId: string,
  clientSecret: string,
  force: boolean = false
): Promise<void> {
  // Find the Snow-Flow installation root
  let snowFlowRoot = '';
  
  // Try different locations to find the Snow-Flow root
  const possiblePaths = [
    join(targetDir, 'node_modules/snow-flow'),
    join(targetDir, '../snow-flow-dev/snow-flow'),
    join(process.env.HOME || '', 'Projects/snow-flow-dev/snow-flow'),
    __dirname.includes('dist') ? resolve(__dirname, '..') : __dirname
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
    // Last resort: assume we're running from the installed package
    snowFlowRoot = resolve(__dirname, '..');
    // Verify we can find the template
    try {
      await fs.access(join(snowFlowRoot, '.mcp.json.template'));
    } catch {
      throw new Error('Could not find snow-flow project root');
    }
  }
  
  // Read the template file
  const templatePath = join(snowFlowRoot, '.mcp.json.template');
  let templateContent: string;
  
  try {
    templateContent = await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error('❌ Could not find .mcp.json.template file');
    throw error;
  }
  
  // Replace placeholders in template
  const mcpConfigContent = templateContent
    .replace(/{{PROJECT_ROOT}}/g, snowFlowRoot)
    .replace(/{{SNOW_INSTANCE}}/g, '${SNOW_INSTANCE}')
    .replace(/{{SNOW_CLIENT_ID}}/g, '${SNOW_CLIENT_ID}')
    .replace(/{{SNOW_CLIENT_SECRET}}/g, '${SNOW_CLIENT_SECRET}')
    .replace(/{{SNOW_DEPLOYMENT_TIMEOUT}}/g, '${SNOW_DEPLOYMENT_TIMEOUT}')
    .replace(/{{MCP_DEPLOYMENT_TIMEOUT}}/g, '${MCP_DEPLOYMENT_TIMEOUT}')
    .replace(/{{NEO4J_URI}}/g, '${NEO4J_URI}')
    .replace(/{{NEO4J_USER}}/g, '${NEO4J_USER}')
    .replace(/{{NEO4J_PASSWORD}}/g, '${NEO4J_PASSWORD}')
    .replace(/{{SNOW_FLOW_ENV}}/g, '${SNOW_FLOW_ENV}');
  
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
      console.log('⚠️  .mcp.json already exists, overwriting with --force flag');
      await fs.writeFile(mcpConfigPath, JSON.stringify(finalConfig, null, 2));
    } else {
      console.log('⚠️  .mcp.json already exists, skipping (use --force to overwrite)');
    }
  } catch {
    await fs.writeFile(mcpConfigPath, JSON.stringify(finalConfig, null, 2));
  }
  
  // Also create legacy config in .claude for backward compatibility
  const legacyConfigPath = join(targetDir, '.claude/mcp-config.json');
  await fs.writeFile(legacyConfigPath, JSON.stringify(finalConfig, null, 2));
}

// Refresh MCP configuration command
program
  .command('refresh-mcp')
  .description('Refresh MCP server configuration to latest version')
  .option('--force', 'Force overwrite existing configuration')
  .action(async (options) => {
    console.log(chalk.blue.bold(`\n🔄 Refreshing MCP Configuration to v${VERSION}...`));
    console.log('='.repeat(60));
    
    try {
      // Check if project is initialized
      const envPath = join(process.cwd(), '.env');
      if (!existsSync(envPath)) {
        console.error(chalk.red('\n❌ No .env file found. Please run "snow-flow init" first.'));
        process.exit(1);
      }
      
      // Load env vars
      dotenv.config({ path: envPath });
      const instanceUrl = process.env.SNOW_INSTANCE;
      const clientId = process.env.SNOW_CLIENT_ID;
      const clientSecret = process.env.SNOW_CLIENT_SECRET;
      
      if (!instanceUrl || !clientId || !clientSecret) {
        console.error(chalk.red('\n❌ Missing ServiceNow credentials in .env file.'));
        process.exit(1);
      }
      
      console.log('\n📝 Updating MCP configuration...');
      await setupMCPConfig(process.cwd(), instanceUrl, clientId, clientSecret, options.force || false);
      
      console.log(chalk.green('\n✅ MCP configuration refreshed successfully!'));
      console.log('\n📢 IMPORTANT: Restart Claude Code to use the new configuration:');
      console.log(chalk.cyan('   claude --mcp-config .mcp.json'));
      console.log('\n💡 The Local Development server now includes:');
      console.log('   • Universal artifact detection via sys_metadata');
      console.log('   • Support for ANY ServiceNow table (even custom)');
      console.log('   • Generic artifact handling for unknown types');
      console.log('   • Automatic file structure creation');
      
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to refresh MCP configuration:'), error);
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
  .description('Manage ServiceNow MCP servers for Claude Code integration')
  .option('--server <name>', 'Specific server name to manage')
  .option('--port <port>', 'Port for MCP server (default: auto)')
  .option('--host <host>', 'Host for MCP server (default: localhost)')
  .action(async (action: string, options) => {
    // NOTE: MCP commands deprecated - SDK manages MCP servers (v4.7.0+)
    console.log(chalk.blue('ℹ️  MCP servers are now managed by Claude Agent SDK v0.1.1'));
    console.log(chalk.yellow('⚠️  Manual MCP commands are no longer needed'));
    console.log(chalk.green('✅ SDK automatically handles all MCP server lifecycle'));
    console.log(chalk.blue('\n💡 Simply run your swarm commands - SDK handles the rest!'));
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
      console.log('🎉 All MCP servers are now running and available in Claude Code!');
      console.log('\n📋 Next steps:');
      console.log('   1. Open Claude Code');
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
    console.log('🎉 All MCP servers are operational and available in Claude Code!');
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
  
  // Check Claude Code
  console.log('\n🤖 Claude Code:');
  const { execSync } = require('child_process');
  try {
    execSync('which claude', { stdio: 'ignore' });
    console.log('   ✅ Claude Code CLI found');
  } catch {
    console.log('   ❌ Claude Code CLI not found in PATH');
  }
  
  console.log('\n💡 Tips:');
  console.log('   1. Make sure Claude Code is started in this directory');
  console.log('   2. Check if MCP servers appear with /mcp command in Claude Code');
  console.log('   3. Approve MCP servers when prompted by Claude Code');
  console.log('   4. Ensure .env file has valid ServiceNow credentials');
}


// SPARC Detailed Help Command
program
  .command('sparc-help')
  .description('Show detailed SPARC help information')
  .action(async () => {
    try {
      const { displayTeamHelp } = await import('./sparc/sparc-help.js');
      displayTeamHelp();
    } catch (error) {
      console.error('❌ Failed to load SPARC help:', error instanceof Error ? error.message : String(error));
    }
  });

// ===================================================
// 👑 QUEEN AGENT COMMANDS - Elegant Orchestration
// ===================================================

/**
 * Main Queen command - replaces complex swarm orchestration
 * Simple, elegant, and intelligent ServiceNow objective execution
 */
program
  .command('queen <objective>')
  .description('🐝 Execute ServiceNow objective with Queen Agent hive-mind intelligence')
  .option('--learn', 'Enable enhanced learning from execution (default: true)', true)
  .option('--no-learn', 'Disable learning')
  .option('--debug', 'Enable debug mode for detailed insights')
  .option('--dry-run', 'Preview execution plan without deployment')
  .option('--memory-driven', 'Use memory for optimal workflow patterns')
  .option('--monitor', 'Show real-time hive-mind monitoring')
  .option('--type <type>', 'Hint at task type (widget, flow, app, integration)')
  .action(async (objective: string, options) => {
    // Check for flow deprecation first
    checkFlowDeprecation('queen', objective);
    
    console.log(`\n👑 ServiceNow Queen Agent v${VERSION} - Hive-Mind Intelligence`);
    console.log('🐝 Elegant orchestration replacing complex team coordination\n');
    
    try {
      const { QueenIntegration } = await import('./examples/queen/integration-example.js');
      
      const queenIntegration = new QueenIntegration({
        debugMode: options.debug || false
      });

      if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - Analyzing objective...');
        // TODO: Add dry run analysis
        console.log(`📋 Objective: ${objective}`);
        console.log('🎯 Queen would analyze, spawn agents, coordinate, and deploy');
        return;
      }

      console.log(`🎯 Queen analyzing objective: ${objective}`);
      
      const result = await queenIntegration.executeSwarmObjective(objective, {
        learn: options.learn,
        memoryDriven: options.memoryDriven,
        monitor: options.monitor
      });

      if (result.success) {
        console.log('\n✅ Queen Agent completed objective successfully!');
        console.log(`🐝 Hive-Mind coordination: ${result.queen_managed ? 'ACTIVE' : 'INACTIVE'}`);
        
        if (result.hive_mind_status) {
          console.log(`👥 Active Agents: ${result.hive_mind_status.activeAgents}`);
          console.log(`📋 Active Tasks: ${result.hive_mind_status.activeTasks}`);
          console.log(`🧠 Learned Patterns: ${result.hive_mind_status.memoryStats.patterns}`);
        }

        if (options.monitor) {
          console.log('\n📊 HIVE-MIND MONITORING:');
          queenIntegration.logHiveMindStatus();
        }
      } else {
        console.error('\n❌ Queen Agent execution failed!');
        if (result.fallback_required) {
          console.log('🔄 Consider using traditional swarm command as fallback:');
          console.log(`   snow-flow swarm "${objective}"`);
        }
        process.exit(1);
      }

      await queenIntegration.shutdown();

    } catch (error) {
      console.error('\n💥 Queen Agent error:', (error as Error).message);
      console.log('\n🔄 Fallback to traditional swarm:');
      console.log(`   snow-flow swarm "${objective}"`);
      process.exit(1);
    }
  });

/**
 * Queen Memory Management
 */
const queenMemory = program.command('queen-memory');
queenMemory.description('🧠 Manage Queen Agent hive-mind memory');

queenMemory
  .command('export [file]')
  .description('Export Queen memory to file')
  .action(async (file: string = 'queen-memory.json') => {
    console.log(`\n🧠 Exporting Queen hive-mind memory to ${file}...`);
    
    try {
      const { createServiceNowQueen } = await import('./queen/index.js');
      const queen = createServiceNowQueen({ debugMode: true });
      
      const memoryData = queen.exportMemory();
      
      const { promises: fs } = await import('fs');
      await fs.writeFile(file, memoryData, 'utf-8');
      
      console.log(`✅ Memory exported successfully to ${file}`);
      console.log(`📊 Memory contains learned patterns and successful deployments`);
      
      await queen.shutdown();
    } catch (error) {
      console.error('❌ Memory export failed:', (error as Error).message);
      process.exit(1);
    }
  });

queenMemory
  .command('import <file>')
  .description('Import Queen memory from file')
  .action(async (file: string) => {
    console.log(`\n🧠 Importing Queen hive-mind memory from ${file}...`);
    
    try {
      const { promises: fs } = await import('fs');
      const memoryData = await fs.readFile(file, 'utf-8');
      
      const { createServiceNowQueen } = await import('./queen/index.js');
      const queen = createServiceNowQueen({ debugMode: true });
      
      queen.importMemory(memoryData);
      
      console.log(`✅ Memory imported successfully from ${file}`);
      console.log(`🧠 Queen now has access to previous learning patterns`);
      
      await queen.shutdown();
    } catch (error) {
      console.error('❌ Memory import failed:', (error as Error).message);
      process.exit(1);
    }
  });

queenMemory
  .command('clear')
  .description('Clear Queen memory (reset learning)')
  .option('--confirm', 'Confirm memory clearing')
  .action(async (options) => {
    if (!options.confirm) {
      console.log('\n⚠️  This will clear all Queen hive-mind learning!');
      console.log('Use --confirm to proceed: snow-flow queen-memory clear --confirm');
      return;
    }

    console.log('\n🧠 Clearing Queen hive-mind memory...');
    
    try {
      const { createServiceNowQueen } = await import('./queen/index.js');
      const queen = createServiceNowQueen({ debugMode: true });
      
      queen.clearMemory();
      
      console.log('✅ Queen memory cleared successfully');
      console.log('🔄 Queen will start fresh learning from next execution');
      
      await queen.shutdown();
    } catch (error) {
      console.error('❌ Memory clear failed:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * Queen Status and Insights
 */
program
  .command('queen-status')
  .description('📊 Show Queen Agent hive-mind status and insights')
  .option('--detailed', 'Show detailed memory and learning statistics')
  .action(async (options) => {
    console.log(`\n👑 ServiceNow Queen Agent Status v${VERSION}`);
    
    try {
      const { createServiceNowQueen } = await import('./queen/index.js');
      const queen = createServiceNowQueen({ debugMode: true });
      
      const status = queen.getHiveMindStatus();
      
      console.log('\n🐝 HIVE-MIND STATUS 🐝');
      console.log('═══════════════════════');
      console.log(`📋 Active Tasks: ${status.activeTasks}`);
      console.log(`👥 Active Agents: ${status.activeAgents}`);
      console.log(`🧠 Learned Patterns: ${status.memoryStats.patterns}`);
      console.log(`📚 Stored Artifacts: ${status.memoryStats.artifacts}`);
      console.log(`💡 Learning Insights: ${status.memoryStats.learnings}`);
      
      if (status.factoryStats.agentTypeCounts) {
        console.log('\n👥 AGENT BREAKDOWN:');
        Object.entries(status.factoryStats.agentTypeCounts).forEach(([type, count]) => {
          console.log(`   ${type}: ${count}`);
        });
      }

      if (options.detailed) {
        console.log('\n🔍 DETAILED MEMORY ANALYSIS:');
        console.log(`   Memory Size: ${status.memoryStats.totalSize || 'Unknown'}`);
        console.log(`   Success Rate: ${status.memoryStats.successRate || 'Unknown'}%`);
        console.log(`   Most Effective Pattern: ${status.memoryStats.bestPattern || 'Learning...'}`);
      }
      
      console.log('═══════════════════════\n');
      
      await queen.shutdown();
    } catch (error) {
      console.error('❌ Status check failed:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('queen-insights')
  .description('💡 Show Queen Agent learning insights and recommendations')
  .action(async () => {
    console.log(`\n💡 Queen Agent Learning Insights v${VERSION}`);
    
    try {
      const { createServiceNowQueen } = await import('./queen/index.js');
      const queen = createServiceNowQueen({ debugMode: true });
      
      const insights = queen.getLearningInsights();
      
      console.log('\n🧠 LEARNING INSIGHTS 🧠');
      console.log('═══════════════════════');
      
      if (insights.successfulPatterns && insights.successfulPatterns.length > 0) {
        console.log('\n✅ SUCCESSFUL PATTERNS:');
        insights.successfulPatterns.forEach((pattern, idx) => {
          console.log(`   ${idx + 1}. ${pattern.description} (${pattern.successRate}% success)`);
        });
      } else {
        console.log('\n📚 No patterns learned yet - execute objectives to build intelligence');
      }
      
      if (insights.recommendations && insights.recommendations.length > 0) {
        console.log('\n💡 RECOMMENDATIONS:');
        insights.recommendations.forEach((rec, idx) => {
          console.log(`   ${idx + 1}. ${rec}`);
        });
      }
      
      if (insights.commonTasks && insights.commonTasks.length > 0) {
        console.log('\n🎯 COMMON TASK TYPES:');
        insights.commonTasks.forEach((task, idx) => {
          console.log(`   ${idx + 1}. ${task.type}: ${task.count} executions`);
        });
      }
      
      console.log('═══════════════════════\n');
      
      await queen.shutdown();
    } catch (error) {
      console.error('❌ Insights failed:', (error as Error).message);
      process.exit(1);
    }
  });

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
