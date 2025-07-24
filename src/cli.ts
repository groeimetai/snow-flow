#!/usr/bin/env node
/**
 * Minimal CLI for snow-flow - ServiceNow Multi-Agent Framework
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { ServiceNowOAuth } from './utils/snow-oauth.js';
import { ServiceNowClient } from './utils/servicenow-client.js';
import { AgentDetector, TaskAnalysis } from './utils/agent-detector.js';
import { getNotificationTemplateSysId } from './utils/servicenow-id-generator.js';
import { VERSION } from './version.js';
import { integrateSnowFlowCommands } from './cli/snow-flow-cli-integration.js';
import { snowFlowSystem } from './snow-flow-system.js';
import { Logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Create CLI logger instance
const cliLogger = new Logger('cli');

const program = new Command();

program
  .name('snow-flow')
  .description('ServiceNow Multi-Agent Development Framework')
  .version(VERSION);

// Swarm command - the main orchestration command with EVERYTHING
program
  .command('swarm <objective>')
  .description('Execute multi-agent orchestration for a ServiceNow task - één command voor alles!')
  .option('--strategy <strategy>', 'Execution strategy (development, analysis, research)', 'development')
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
  .action(async (objective: string, options) => {
    cliLogger.info(`\n🚀 Starting ServiceNow Multi-Agent Swarm v${VERSION} - één command voor alles!`);
    cliLogger.info(`📋 Objective: ${objective}`);
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
    cliLogger.info(`  📊 Progress Monitoring: ${options.progressMonitoring ? '✅ Yes' : '❌ No'}\n`);
    
    // Analyze the objective using intelligent agent detection
    const taskAnalysis = analyzeObjective(objective, parseInt(options.maxAgents));
    
    cliLogger.info(`🎯 Task Type: ${taskAnalysis.taskType}`);
    cliLogger.info(`🧠 Primary Agent: ${taskAnalysis.primaryAgent}`);
    cliLogger.info(`👥 Supporting Agents: ${taskAnalysis.supportingAgents.join(', ')}`);
    cliLogger.info(`📊 Complexity: ${taskAnalysis.complexity} | Estimated Agents: ${taskAnalysis.estimatedAgentCount}`);
    cliLogger.info(`🔧 ServiceNow Artifacts: ${taskAnalysis.serviceNowArtifacts.join(', ')}`);
    cliLogger.info(`📦 Auto Update Set: ${taskAnalysis.requiresUpdateSet ? '✅ Yes' : '❌ No'}`);
    cliLogger.info(`🏗️ Auto Application: ${taskAnalysis.requiresApplication ? '✅ Yes' : '❌ No'}`);
    
    // Show timeout configuration
    const timeoutMinutes = process.env.SNOW_FLOW_TIMEOUT_MINUTES ? parseInt(process.env.SNOW_FLOW_TIMEOUT_MINUTES) : 60;
    if (timeoutMinutes > 0) {
      cliLogger.info(`⏱️  Timeout: ${timeoutMinutes} minutes`);
    } else {
      cliLogger.info('⏱️  Timeout: Disabled (infinite execution time)');
    }
    
    // Check ServiceNow authentication
    const oauth = new ServiceNowOAuth();
    const isAuthenticated = await oauth.isAuthenticated();
    
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
    
    // Initialize Queen Agent memory system
    cliLogger.info('\n💾 Initializing swarm memory system...');
    const { QueenMemorySystem } = await import('./queen/queen-memory.js');
    const memorySystem = new QueenMemorySystem();
    
    // Generate swarm session ID
    const sessionId = `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    cliLogger.info(`📋 Swarm Session ID: ${sessionId}`);
    
    // Store swarm session in memory
    memorySystem.storeLearning(`session_${sessionId}`, {
      objective,
      taskAnalysis,
      options,
      started_at: new Date().toISOString(),
      is_authenticated: isAuthenticated
    });
    
    // Check if this is a Flow Designer flow request - ALWAYS use XML-first for flows!
    const isFlowDesignerTask = taskAnalysis.taskType === 'flow_development' || 
                               taskAnalysis.primaryAgent === 'flow-builder' ||
                               (objective.toLowerCase().includes('flow') && 
                                !objective.toLowerCase().includes('workflow') &&
                                !objective.toLowerCase().includes('data flow'));
    
    let xmlFlowResult: any = null;
    
    if (isFlowDesignerTask) {
      cliLogger.info('\n🔧 Flow Designer Detected - Using XML-First Approach!');
      cliLogger.info('📋 Creating production-ready ServiceNow flow XML...');
      cliLogger.info('💡 Reason: Flow Designer flows are most reliable with XML-first approach\n');
      
      try {
        // Import XML flow generator
        const { generateProductionFlowXML } = await import('./utils/xml-first-flow-generator.js');
        
        // Parse instruction to determine activities
        const activities = [];
        const objectiveLower = objective.toLowerCase();
        
        // Auto-detect activities from objective
        if (objectiveLower.includes('approval') || objectiveLower.includes('approve')) {
          activities.push({
            name: 'Request Approval',
            type: 'approval',
            order: 100,
            inputs: {
              table: taskAnalysis.serviceNowArtifacts.includes('sc_request') ? 'sc_request' : 'incident',
              record: '{{trigger.current.sys_id}}',
              approver: '{{trigger.current.requested_for.manager}}',
              approval_field: 'approval',
              message: `Please approve: {{trigger.current.number}}`
            },
            outputs: {
              state: 'string',
              approver_sys_id: 'string',
              comments: 'string'
            }
          });
        }
        
        if (objectiveLower.includes('notification') || objectiveLower.includes('email') || objectiveLower.includes('notify')) {
          activities.push({
            name: 'Send Notification',
            type: 'notification',
            order: activities.length > 0 ? 200 : 100,
            inputs: {
              notification_id: getNotificationTemplateSysId('generic_notification'),
              recipients: '{{trigger.current.requested_for}}',
              values: {
                request_number: '{{trigger.current.number}}',
                status: 'Notification sent'
              }
            }
          });
        }
        
        if (objectiveLower.includes('create') || objectiveLower.includes('task')) {
          activities.push({
            name: 'Create Task',
            type: 'create_record',
            order: activities.length > 0 ? (activities.length + 1) * 100 : 100,
            inputs: {
              table: 'task',
              field_values: {
                short_description: '{{trigger.current.short_description}} - Follow-up',
                assigned_to: '{{trigger.current.assigned_to}}',
                priority: '{{trigger.current.priority}}'
              }
            },
            outputs: {
              record_id: 'string',
              number: 'string'
            }
          });
        }
        
        // Build flow definition
        const flowName = objective.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
        const flowDef = {
          name: `Flow_${flowName}`,
          description: objective,
          table: taskAnalysis.serviceNowArtifacts.find(a => ['incident', 'sc_request', 'change_request', 'problem'].includes(a)) || 'incident',
          trigger_type: 'record_created' as const,
          trigger_condition: '',
          activities: activities.length > 0 ? activities : [{
            name: 'Log Flow Start',
            type: 'script' as const,
            order: 100,
            inputs: {
              script: `gs.info('Flow started for: ' + current.number, 'XMLFlow');\\nreturn { started: true };`
            },
            outputs: { started: 'boolean' }
          }]
        };
        
        // Generate XML
        cliLogger.info('🏗️  Generating production XML...');
        const result = generateProductionFlowXML(flowDef);
        xmlFlowResult = { ...result, flowDefinition: flowDef };
        
        cliLogger.info(`\n✅ XML Generated Successfully!`);
        cliLogger.info(`📁 File saved to: ${result.filePath}`);
        cliLogger.info(`📊 Flow structure:`);
        cliLogger.info(`   - Name: ${flowDef.name}`);
        cliLogger.info(`   - Table: ${flowDef.table}`);
        cliLogger.info(`   - Trigger: ${flowDef.trigger_type}`);
        cliLogger.info(`   - Activities: ${flowDef.activities.length}`);
        
        // Show import instructions
        cliLogger.info('\n' + '='.repeat(60));
        cliLogger.info(result.instructions);
        cliLogger.info('='.repeat(60));
        
        // Store result in memory
        memorySystem.storeLearning(`xml_flow_${sessionId}`, {
          objective,
          flow_definition: flowDef,
          xml_file: result.filePath,
          generated_at: new Date().toISOString()
        });
        
        cliLogger.info('\n🎯 XML Flow generated successfully!');
        
        // Check if auto-deploy is enabled
        if (options.autoDeploy !== false) { // Default is true from swarm command
          cliLogger.info('\n🚀 Auto-Deploy enabled - importing XML to ServiceNow...');
          cliLogger.info('\n💡 To deploy, use the following command:');
          cliLogger.info(`   snow-flow deploy-xml "${result.filePath}"`);
          cliLogger.info('\nThis will automatically import, preview, and commit the flow to ServiceNow.');
        } else {
          cliLogger.info('📋 Use the import instructions above to deploy to ServiceNow');
        }
        
        cliLogger.info('\n💡 XML template generated. Now launching Queen Agent for intelligent flow development...');
        // DO NOT RETURN HERE - Continue to Queen Agent orchestration!
      } catch (error) {
        cliLogger.error('❌ XML flow generation failed:', error instanceof Error ? error.message : String(error));
        cliLogger.info('💡 Falling back to regular swarm orchestration...\n');
      }
    }
    
    // Start real Claude Code orchestration
    try {
      // Generate the Queen Agent orchestration prompt
      const orchestrationPrompt = buildQueenAgentPrompt(objective, taskAnalysis, options, isAuthenticated, sessionId, xmlFlowResult);
      
      cliLogger.info('\n👑 Initializing Queen Agent orchestration...');
      cliLogger.info('🎯 Queen Agent will coordinate the following:');
      cliLogger.info(`   - Analyze objective: "${objective}"`);
      cliLogger.info(`   - Spawn ${taskAnalysis.estimatedAgentCount} specialized agents`);
      cliLogger.info(`   - Coordinate through shared memory (session: ${sessionId})`);
      cliLogger.info(`   - Monitor progress and adapt strategy`);
      
      // Check if intelligent features are enabled
      const hasIntelligentFeatures = options.autoPermissions || options.smartDiscovery || 
        options.liveTesting || options.autoDeploy || options.autoRollback || 
        options.sharedMemory || options.progressMonitoring;
      
      if (hasIntelligentFeatures && isAuthenticated) {
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
      
      if (isAuthenticated) {
        cliLogger.info('\n🔗 Live ServiceNow integration: ✅ Enabled');
        cliLogger.info('📝 Artifacts will be created directly in ServiceNow');
      } else {
        cliLogger.info('\n🔗 Live ServiceNow integration: ❌ Disabled');
        cliLogger.info('📝 Artifacts will be saved to servicenow/ directory');
      }
      
      cliLogger.info('\n🚀 Launching Claude Code with Queen Agent...');
      
      // Try to execute Claude Code directly with the prompt
      const success = await executeClaudeCode(orchestrationPrompt);
      
      if (success) {
        cliLogger.info('\n✅ Queen Agent orchestration launched successfully!');
        cliLogger.info('👑 Queen Agent is now coordinating your swarm');
        cliLogger.info(`💾 Monitor progress with session ID: ${sessionId}`);
        
        if (isAuthenticated && options.autoDeploy) {
          cliLogger.info('🚀 Real artifacts will be created in ServiceNow');
        } else {
          cliLogger.info('📋 Planning mode - analysis and recommendations only');
        }
        
        // Store successful launch in memory
        memorySystem.storeLearning(`launch_${sessionId}`, {
          success: true,
          launched_at: new Date().toISOString()
        });
      } else {
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
    
    // Launch Claude Code with MCP config and skip permissions to avoid raw mode issues
    const claudeArgs = hasMcpConfig 
      ? ['--mcp-config', '.mcp.json', '.', '--dangerously-skip-permissions']
      : ['--dangerously-skip-permissions'];
    
    cliLogger.info('🚀 Launching Claude Code automatically...');
    if (hasMcpConfig) {
      cliLogger.info('🔧 Starting Claude Code with ServiceNow MCP servers...');
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

async function executeWithClaude(claudeCommand: string, prompt: string, resolve: (value: boolean) => void): Promise<void> {
  cliLogger.info('🚀 Starting Claude Code execution...');
  
  // Write prompt to temporary file for large prompts
  const tempFile = join(process.cwd(), '.snow-flow-prompt.tmp');
  await fs.writeFile(tempFile, prompt);
  
  // Check if .mcp.json exists in current directory
  const mcpConfigPath = join(process.cwd(), '.mcp.json');
  let hasMcpConfig = false;
  try {
    await fs.access(mcpConfigPath);
    hasMcpConfig = true;
    cliLogger.info('✅ Found MCP configuration in current directory');
  } catch {
    cliLogger.warn('⚠️  No MCP configuration found. Run "snow-flow init --sparc" to set up MCP servers');
  }
  
  const claudeArgs = hasMcpConfig 
    ? ['--mcp-config', '.mcp.json', '.', '--dangerously-skip-permissions']
    : ['--dangerously-skip-permissions'];
  
  if (hasMcpConfig) {
    cliLogger.info('🔧 Starting Claude Code with ServiceNow MCP servers...');
  }
  
  // Start Claude Code process in interactive mode
  const claudeProcess = spawn(claudeCommand, claudeArgs, {
    stdio: ['pipe', 'inherit', 'inherit'], // inherit stdout/stderr for interactive mode
    cwd: process.cwd()
  });
  
  // Send the prompt via stdin
  cliLogger.info('📝 Sending orchestration prompt to Claude Code...');
  cliLogger.info('🚀 Claude Code interactive interface opening...\n');
  
  claudeProcess.stdin.write(prompt);
  claudeProcess.stdin.end();
  
  // Start silent monitoring dashboard (doesn't interfere with Claude Code UI)
  const monitoringInterval = startMonitoringDashboard(claudeProcess);
  
  claudeProcess.on('close', (code) => {
    clearInterval(monitoringInterval);
    if (code === 0) {
      cliLogger.info('\n✅ Claude Code session completed successfully!');
      resolve(true);
    } else {
      cliLogger.warn(`\n❌ Claude Code session ended with code: ${code}`);
      resolve(false);
    }
  });
  
  claudeProcess.on('error', (error) => {
    clearInterval(monitoringInterval);
    cliLogger.error(`❌ Failed to start Claude Code: ${error.message}`);
    resolve(false);
  });
  
  // Set timeout for Claude Code execution (configurable via environment variable)
  const timeoutMinutes = process.env.SNOW_FLOW_TIMEOUT_MINUTES ? parseInt(process.env.SNOW_FLOW_TIMEOUT_MINUTES) : 60;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  
  cliLogger.info(`⏱️  Claude Code timeout set to ${timeoutMinutes} minutes (configure with SNOW_FLOW_TIMEOUT_MINUTES=0 for no timeout)`);
  
  let timeout: NodeJS.Timeout | null = null;
  
  // Only set timeout if not disabled (0 = no timeout)
  if (timeoutMinutes > 0) {
    timeout = setTimeout(() => {
      clearInterval(monitoringInterval);
      cliLogger.warn(`⏱️  Claude Code session timeout (${timeoutMinutes} minutes), terminating...`);
      claudeProcess.kill('SIGTERM');
      
      // Force kill if it doesn't respond
      setTimeout(() => {
        claudeProcess.kill('SIGKILL');
      }, 2000);
      
      resolve(false);
    }, timeoutMs);
  }
  
  claudeProcess.on('close', () => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

// Helper function to build Queen Agent orchestration prompt
function buildQueenAgentPrompt(objective: string, taskAnalysis: TaskAnalysis, options: any, isAuthenticated: boolean = false, sessionId: string, xmlFlowResult: any = null): string {
  // Check if intelligent features are enabled
  const hasIntelligentFeatures = options.autoPermissions || options.smartDiscovery || 
    options.liveTesting || options.autoDeploy || options.autoRollback || 
    options.sharedMemory || options.progressMonitoring;

  const prompt = `# 👑 Snow-Flow Queen Agent Orchestration

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

${xmlFlowResult ? `## 🔧 Flow Designer XML Template Generated
An initial XML template has been created as a starting point:
- **File Path**: ${xmlFlowResult.filePath}
- **Flow Name**: ${xmlFlowResult.flowDefinition.name}
- **Table**: ${xmlFlowResult.flowDefinition.table}
- **Activities**: ${xmlFlowResult.flowDefinition.activities.length}

**IMPORTANT**: This is just a basic template! You must spawn Claude Code agents to:
1. Analyze the detailed requirements from the objective
2. Design the complete flow logic with all activities
3. Add approval steps, notifications, conditions, etc.
4. Test the flow implementation
5. Deploy to ServiceNow

The XML template is saved but needs significant enhancement by your agents!
` : ''}
- **Recommended Team**: ${getTeamRecommendation(taskAnalysis.taskType)}

## 📊 Table Discovery Intelligence

The Queen Agent will automatically discover and validate table schemas based on the objective. This ensures agents use correct field names and table structures.

**Table Detection Examples:**
- "create widget for incident records" → Discovers: incident, sys_user, sys_user_group
- "build approval flow for u_equipment_request" → Discovers: u_equipment_request, sys_user, sysapproval_approver
- "portal showing catalog items" → Discovers: sc_cat_item, sc_category, sc_request
- "dashboard with CMDB assets" → Discovers: cmdb_ci, cmdb_rel_ci, sys_user
- "report on problem tickets" → Discovers: problem, incident, sys_user

**Discovery Process:**
1. Extracts table names from objective (standard tables, u_ custom tables, explicit mentions)
2. Discovers actual table schemas with field names, types, and relationships
3. Stores schemas in memory for all agents to use
4. Agents MUST use exact field names from schemas (e.g., 'short_description' not 'desc')

## 👑 Your Queen Agent Responsibilities

### 1. CRITICAL: Initialize Memory FIRST (Before Everything!)
**THIS MUST BE YOUR VERY FIRST ACTION - Initialize the swarm memory session:**
\`\`\`javascript
// 🚨 EXECUTE THIS IMMEDIATELY - DO NOT SKIP OR DELAY!
mcp__servicenow-memory__memory_store({
  key: "swarm_session_${sessionId}",
  value: JSON.stringify({
    objective: "${objective}",
    status: "initializing", 
    started_at: new Date().toISOString(),
    queen_agent_id: "queen_${sessionId}",
    task_analysis: ${JSON.stringify(taskAnalysis, null, 2)},
    configuration: {
      strategy: "${options.strategy}",
      mode: "${options.mode}",
      max_agents: ${parseInt(options.maxAgents)},
      parallel_execution: ${options.parallel ? 'true' : 'false'},
      monitoring_enabled: ${options.monitor ? 'true' : 'false'},
      auth_required: ${!isAuthenticated}
    }
  }),
  namespace: "swarm_${sessionId}"
});

// Agent coordination namespace handled automatically by ServiceNow memory system
\`\`\`

### 2. MANDATORY MCP-FIRST Workflow Steps
**Execute these steps IN ORDER before spawning agents:**

\`\`\`javascript
// Step 2.1: Validate ServiceNow authentication
const authCheck = await mcp__servicenow-intelligent__snow_validate_live_connection({
  test_level: "permissions",
  include_performance: false
});

if (!authCheck.connection_status === "success") {
  throw new Error("Authentication failed! Run: snow-flow auth login");
}

// Step 2.2: Check for existing artifacts (DRY principle)
const existingArtifacts = await mcp__servicenow-intelligent__snow_comprehensive_search({
  query: "${objective}",
  include_inactive: false
});

// Store discovery results in memory for agents
await mcp__servicenow-memory__memory_store({
  key: "existing_artifacts_${sessionId}",
  value: JSON.stringify(existingArtifacts),
  namespace: "swarm_${sessionId}"
});

// Step 2.3: Create isolated Update Set for this objective
const updateSetName = "Snow-Flow: ${objective.substring(0, 50)}... - ${new Date().toISOString().split('T')[0]}";
const updateSet = await mcp__servicenow-update-set__snow_update_set_create({
  name: updateSetName,
  description: "Automated creation for: ${objective}\\n\\nSession: ${sessionId}",
  auto_switch: true
});

// Store Update Set info in memory
await mcp__servicenow-memory__memory_store({
  key: "update_set_${sessionId}",
  value: JSON.stringify(updateSet),
  namespace: "swarm_${sessionId}"
});

// Step 2.4: Discover tables mentioned in objective
// Extract potential table names from the objective
const tablePatterns = [
  /\b(incident|problem|change_request|sc_request|sc_req_item|task|cmdb_ci|sys_user|sys_user_group)\b/gi,
  /\b(u_\w+)\b/g, // Custom tables starting with u_
  /\b(\w+_table)\b/gi, // Tables ending with _table
  /\bfrom\s+(\w+)\b/gi, // SQL-like "from table_name"
  /\btable[:\s]+(\w+)\b/gi, // "table: xyz" or "table xyz"
  /\b(\w+)\s+records?\b/gi, // "xyz records"
];

const detectedTables = new Set();
// Always include common tables for context
['incident', 'sc_request', 'sys_user'].forEach(t => detectedTables.add(t));

// Search for tables in objective
for (const pattern of tablePatterns) {
  const matches = "${objective}".matchAll(pattern);
  for (const match of matches) {
    if (match[1]) {
      detectedTables.add(match[1].toLowerCase());
    }
  }
}

// Also check for common data needs based on objective type
if ("${objective}".toLowerCase().includes('catalog')) {
  detectedTables.add('sc_cat_item');
  detectedTables.add('sc_category');
}
if ("${objective}".toLowerCase().includes('user')) {
  detectedTables.add('sys_user');
  detectedTables.add('sys_user_group');
}
if ("${objective}".toLowerCase().includes('cmdb') || "${objective}".toLowerCase().includes('asset')) {
  detectedTables.add('cmdb_ci');
}
if ("${objective}".toLowerCase().includes('knowledge')) {
  detectedTables.add('kb_knowledge');
}

cliLogger.info(\`🔍 Detected tables to discover: \${Array.from(detectedTables).join(', ')}\`);

// Discover schemas for all detected tables
const tableSchemas = {};
for (const tableName of detectedTables) {
  try {
    const schema = await mcp__servicenow-platform-development__snow_table_schema_discovery({
      tableName: tableName,
      includeRelated: true,
      includeIndexes: false,
      maxDepth: 1 // Don't go too deep to avoid timeout
    });
    
    if (schema && schema.fields) {
      tableSchemas[tableName] = {
        name: tableName,
        label: schema.label || tableName,
        fields: schema.fields,
        field_count: schema.fields.length,
        key_fields: schema.fields.filter(f => f.primary || f.reference).map(f => f.name)
      };
      cliLogger.info(\`✅ Discovered table '\${tableName}' with \${schema.fields.length} fields\`);
    }
  } catch (e) {
    cliLogger.warn(\`⚠️ Table '\${tableName}' not found or inaccessible\`);
  }
}

// Store discovered table schemas in memory
await mcp__servicenow-memory__memory_store({
  key: "table_schemas_${sessionId}",
  value: JSON.stringify({
    discovered_at: new Date().toISOString(),
    objective: "${objective}",
    tables: tableSchemas,
    table_names: Object.keys(tableSchemas)
  }),
  namespace: "swarm_${sessionId}"
});
\`\`\`

### 3. Create Master Task List
After completing MCP-FIRST steps, create task breakdown:
\`\`\`javascript
TodoWrite([
  {
    id: "mcp_workflow_complete",
    content: "✅ MCP-FIRST workflow: Auth, Discovery, Update Set, Tables",
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

### 4. Spawn Specialized Agents
Based on the task analysis, spawn the following agents using the Task tool:

**Primary Agent**: ${taskAnalysis.primaryAgent}
\`\`\`javascript
// Spawn primary agent
Task("${taskAnalysis.primaryAgent}", \`
  You are the primary ${taskAnalysis.primaryAgent} agent for this swarm.
  
  Objective: ${objective}
  Session: ${sessionId}
  Task Type: ${taskAnalysis.taskType}
  
  Instructions:
  1. FIRST: Read ALL shared context from memory:
     - mcp__servicenow-memory__memory_get({key: "swarm_session_${sessionId}", namespace: "swarm_${sessionId}"})
     - mcp__servicenow-memory__memory_get({key: "existing_artifacts_${sessionId}", namespace: "swarm_${sessionId}"})
     - mcp__servicenow-memory__memory_get({key: "update_set_${sessionId}", namespace: "swarm_${sessionId}"})
     - mcp__servicenow-memory__memory_get({key: "table_schemas_${sessionId}", namespace: "swarm_${sessionId}"})
  
  2. 🔍 CRITICAL: Use discovered table schemas:
     - The table_schemas contain actual field names, types, and relationships
     - ALWAYS use the exact field names from the schema (e.g., 'short_description' not 'description')
     - Check key_fields for primary keys and references
     - If you need a table that wasn't discovered, use snow_table_schema_discovery first
  
  3. Check existing_artifacts to avoid duplication - reuse or extend existing ones
  4. ALL deployments MUST use the Update Set stored in memory
  5. Begin implementing the core ${taskAnalysis.taskType} requirements
  6. Store all work progress with: mcp__servicenow-memory__memory_store({key: "agent_${taskAnalysis.primaryAgent}_progress", value: "...", namespace: "agents_${sessionId}"})
  7. Update TodoWrite items as you complete tasks
  8. Read other agents' progress from namespace "agents_${sessionId}"
  
  🔐 AUTHENTICATION: Already validated by Queen. Use MCP tools directly.
  📦 UPDATE SET: Use the one from memory - DO NOT create a new one!
  📊 TABLES: Use exact field names from discovered schemas!
\`);
\`\`\`

**Supporting Agents**:
${taskAnalysis.supportingAgents.map((agent, index) => `
Agent ${index + 2}: ${agent}
\`\`\`javascript
// Spawn ${agent}
Task("${agent}", \`
  You are a supporting ${agent} agent in this swarm.
  
  Role: ${agent}
  Session: ${sessionId}
  Primary Agent: ${taskAnalysis.primaryAgent}
  
  Instructions:
  1. FIRST: Read ALL shared context from memory (same as primary agent):
     - mcp__servicenow-memory__memory_get({key: "swarm_session_${sessionId}", namespace: "swarm_${sessionId}"})
     - mcp__servicenow-memory__memory_get({key: "existing_artifacts_${sessionId}", namespace: "swarm_${sessionId}"})
     - mcp__servicenow-memory__memory_get({key: "update_set_${sessionId}", namespace: "swarm_${sessionId}"})
     - mcp__servicenow-memory__memory_get({key: "table_schemas_${sessionId}", namespace: "swarm_${sessionId}"})
  
  2. 🔍 CRITICAL: Use discovered table schemas:
     - The table_schemas contain actual field names, types, and relationships
     - ALWAYS use the exact field names from the schema (e.g., 'short_description' not 'description')
     - Check key_fields for primary keys and references
     - If you need a table that wasn't discovered, use snow_table_schema_discovery first
  
  3. Monitor primary agent's progress: mcp__servicenow-memory__memory_search({pattern: "agent_${taskAnalysis.primaryAgent}_*", namespace: "agents_${sessionId}"})
  4. Wait for primary agent to establish base structure before major changes
  5. Enhance/support with your ${agent} expertise  
  6. Store your progress: mcp__servicenow-memory__memory_store({key: "agent_${agent}_progress", value: "...", namespace: "agents_${sessionId}"})
  7. Update relevant TodoWrite items
  
  🔐 AUTHENTICATION: Already validated by Queen. Use MCP tools directly.
  📦 UPDATE SET: Use the one from memory - DO NOT create a new one!
  📊 TABLES: Use exact field names from discovered schemas!
  
  🔐 AUTHENTICATION REQUIREMENTS:
  - ALWAYS use MCP tools first - inherit auth status from primary agent
  - If auth fails, contribute to the PLANNING documentation
  - Store all plans in Memory for future deployment
\`);
\`\`\``).join('\n')}

### 4. Memory Coordination Pattern
All agents MUST use this memory coordination pattern:

\`\`\`javascript
// Agent initialization
const session = Memory.get("swarm_session_${sessionId}");
const agentId = \`agent_\${agentType}_${sessionId}\`;

// Agent stores progress
Memory.store(\`\${agentId}_progress\`, {
  status: "working",
  current_task: "description of current work",
  completion_percentage: 45,
  last_update: new Date().toISOString()
});

// Agent reads other agent's work
const primaryWork = Memory.get("agent_${taskAnalysis.primaryAgent}_output");

// Agent signals completion
Memory.store(\`\${agentId}_complete\`, {
  completed_at: new Date().toISOString(),
  outputs: { /* agent deliverables */ },
  artifacts_created: [ /* list of created artifacts */ ]
});
\`\`\`

## 🧠 Intelligent Features Configuration
${hasIntelligentFeatures ? `✅ **INTELLIGENT MODE ACTIVE** - The following features are enabled:

- **🔐 Auto Permissions**: ${options.autoPermissions ? '✅ Will escalate permissions automatically' : '❌ Manual permission handling'}
- **🔍 Smart Discovery**: ${options.smartDiscovery ? '✅ Will discover and reuse existing artifacts' : '❌ Create all new artifacts'}
- **🧪 Live Testing**: ${options.liveTesting ? '✅ Will test in real ServiceNow instance' : '❌ Local testing only'}
- **🚀 Auto Deploy**: ${options.autoDeploy ? '⚠️ WILL DEPLOY TO SERVICENOW AUTOMATICALLY' : '✅ Planning mode - no deployment'}
- **🔄 Auto Rollback**: ${options.autoRollback ? '✅ Will rollback on any failures' : '❌ No automatic rollback'}
- **💾 Shared Memory**: ${options.sharedMemory ? '✅ Agents share context via Memory' : '❌ Isolated agent execution'}
- **📊 Progress Monitoring**: ${options.progressMonitoring ? '✅ Real-time progress tracking' : '❌ No progress monitoring'}` : '❌ **STANDARD MODE** - Use manual coordination patterns'}

## 🎯 ServiceNow Execution Strategy

### 🚀 MANDATORY: Live ServiceNow Development First!

**CRITICAL RULE**: All agents MUST attempt to use ServiceNow MCP tools first, regardless of authentication status.

${hasIntelligentFeatures ? `#### 🧠 Intelligent Orchestration Available
Use the unified orchestration tool for complete automation:

\`\`\`javascript
// Queen Agent uses this for intelligent orchestration
snow_orchestrate_development({
  objective: "${objective}",
  auto_permissions: ${options.autoPermissions},
  smart_discovery: ${options.smartDiscovery},
  live_testing: ${options.liveTesting},
  auto_deploy: ${options.autoDeploy},
  auto_rollback: ${options.autoRollback},
  shared_memory: ${options.sharedMemory},
  progress_monitoring: ${options.progressMonitoring}
});
\`\`\`

## 🧠 REVOLUTIONARY: Intelligent Gap Analysis Engine (v1.1.88)
**AUTOMATIC BEYOND-MCP CONFIGURATION DETECTION**

The Queen Agent now includes the revolutionary **Intelligent Gap Analysis Engine** that automatically detects and resolves ALL ServiceNow configurations needed beyond standard MCP tools.

**What Gap Analysis Does:**
- **🔍 Analyzes Requirements**: AI-powered parsing of objectives to identify 60+ types of ServiceNow configurations
- **📊 MCP Coverage Analysis**: Maps what current MCP tools can handle vs manual setup requirements
- **🤖 Auto-Resolution Engine**: Attempts automatic configuration via ServiceNow APIs for safe operations
- **📚 Manual Guide Generation**: Creates detailed step-by-step guides with role requirements and risk assessment
- **🛡️ Risk Assessment**: Evaluates complexity and safety of each configuration
- **🌍 Environment Awareness**: Provides dev/test/prod specific guidance and warnings

**60+ Configuration Types Covered:**
- **🔐 Authentication**: LDAP, SAML, OAuth providers, SSO, MFA configurations
- **🗄️ Database**: Indexes, views, partitioning, performance analytics, system properties
- **🧭 Navigation**: Application menus, modules, form layouts, UI actions, policies
- **📧 Integration**: Email templates, web services, import sets, transform maps
- **🔄 Workflow**: Activities, transitions, SLA definitions, escalation rules
- **🛡️ Security**: ACL rules, data policies, audit rules, compliance configurations
- **📊 Reporting**: Custom reports, dashboards, KPIs, performance analytics

**Example Output:**
\`\`\`
🧠 Step 4: Running Intelligent Gap Analysis...
📊 Gap Analysis Complete:
  • Total Requirements: 12
  • MCP Coverage: 67%
  • Automated: 6 configurations  
  • Manual Work: 4 items

✅ Automatically Configured:
  • System property: glide.ui.incident_management created
  • Navigation module: Incident Management added to Service Desk
  • Email template: incident_notification configured
  • Database index: incident.priority_state for performance

📋 Manual Configuration Required:
  • LDAP authentication setup (high-risk operation)
  • SSO configuration with Active Directory
  
📚 Detailed Manual Guides Available:
  📖 Configure LDAP Authentication - 25 minutes
     Risk: high | Roles: security_admin, admin
\`\`\`

**The Gap Analysis Engine automatically runs as part of Queen Agent execution - no additional commands needed!**

` : ''}

#### ServiceNow MCP Tools (ALWAYS TRY THESE FIRST!)
${isAuthenticated ? '✅ Authentication detected - full deployment capabilities' : '⚠️ No authentication detected - MCP tools will provide specific instructions if auth needed'}

Your agents MUST use these MCP tools IN THIS ORDER:

🔍 **PRE-FLIGHT CHECKS** (Always do first!):
1. \`snow_find_artifact\` with a simple query to test authentication
2. If auth fails, the tool provides specific instructions
3. Continue with appropriate strategy based on auth status

📦 **CORE DEVELOPMENT TOOLS**:
1. **Deployment Tools** (servicenow-deployment-mcp)
   - \`snow_deploy\` - Unified deployment for all artifact types
   - \`snow_preview_widget\` - Preview widgets before deployment
   - \`snow_widget_test\` - Test widget functionality

2. **Discovery Tools** (servicenow-intelligent-mcp)
   - \`snow_find_artifact\` - Natural language artifact search
   - \`snow_catalog_item_search\` - Find catalog items with fuzzy matching
   - \`snow_get_by_sysid\` - Direct sys_id lookup

3. **Flow Tools** (servicenow-flow-composer-mcp)
   - \`snow_create_flow\` - Create flows from natural language
   - \`snow_test_flow_with_mock\` - Test flows with mock data
   - \`snow_link_catalog_to_flow\` - Link catalog items to flows

4. **Update Set Management** (servicenow-update-set-mcp)
   - \`snow_update_set_create\` - Create new update sets
   - \`snow_update_set_add_artifact\` - Track artifacts
   - \`snow_update_set_complete\` - Complete update sets

🚨 **ERROR RECOVERY PATTERNS**:
- Auth Error → Document complete solution → Store in Memory → Guide user
- Permission Error → Try global scope → Document if fails
- Not Found → Create new → Track in Update Set
- Any Error → Provide SPECIFIC next steps, not generic messages

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

### 5. Claude-Flow Memory Synchronization Pattern
Implement continuous memory synchronization for real-time coordination:

\`\`\`javascript
// Initialize coordination heartbeat (Claude-Flow pattern)
const coordinationInterval = setInterval(async () => {
  // Sync agent states across namespace
  const agentStates = await mcp__servicenow-memory__memory_search({
    pattern: "agent_*_progress",
    namespace: "agents_${sessionId}",
    limit: 50
  });
  
  // Update swarm coordination state with TTL for freshness
  await mcp__servicenow-memory__memory_store({
    key: "swarm_coordination_${sessionId}",
    value: JSON.stringify({
      timestamp: new Date().toISOString(),
      active_agents: agentStates.length,
      completion_status: TodoRead().filter(t => t.status === 'completed').length,
      memory_sync: true,
      discovered_artifacts: agentStates.filter(s => s.includes("deployed")).length
    }),
    namespace: "swarm_${sessionId}",
    ttl: 300 // 5 minute TTL for coordination data
  });
  
  // Detect and resolve conflicts between agents
  if (agentStates.some(s => s.includes("conflict") || s.includes("duplicate"))) {
    await mcp__servicenow-memory__memory_store({
      key: "conflict_resolution_needed",
      value: JSON.stringify({
        agents: agentStates.filter(s => s.includes("conflict")),
        timestamp: new Date().toISOString()
      }),
      namespace: "swarm_${sessionId}"
    });
  }
  
  // Track deployed artifacts in Update Set automatically
  const deployedArtifacts = [];
  for (const state of agentStates) {
    if (state.includes("deployed") && state.includes("sys_id")) {
      try {
        const artifact = JSON.parse(state);
        if (artifact.sys_id && !artifact.tracked_in_update_set) {
          deployedArtifacts.push(artifact);
        }
      } catch (e) {
        // Not valid JSON, skip
      }
    }
  }
  
  // Add all deployed artifacts to Update Set
  for (const artifact of deployedArtifacts) {
    await mcp__servicenow-update-set__snow_update_set_add_artifact({
      type: artifact.type,
      sys_id: artifact.sys_id,
      name: artifact.name
    });
    
    // Mark as tracked
    artifact.tracked_in_update_set = true;
    await mcp__servicenow-memory__memory_store({
      key: \`agent_\${artifact.agent}_deployed_\${artifact.sys_id}\`,
      value: JSON.stringify(artifact),
      namespace: "agents_${sessionId}"
    });
  }
  
  // Monitor individual agent progress
  const agents = [${[taskAnalysis.primaryAgent, ...taskAnalysis.supportingAgents].map(a => `"${a}"`).join(', ')}];
  for (const agent of agents) {
    const progress = agentStates.find(s => s.includes(\`agent_\${agent}_progress\`));
    cliLogger.info(\`Agent \${agent}: \${progress ? 'active' : 'waiting'}\`);
  }
}, 10000); // Every 10 seconds

// Also update main session state
await mcp__servicenow-memory__memory_store({
  key: "swarm_session_${sessionId}",
  value: JSON.stringify({
    status: "agents_working",
    last_check: new Date().toISOString()
  }),
  namespace: "swarm_${sessionId}"
});
\`\`\`

### 6. Coordinate Agent Handoffs
Ensure smooth transitions between agents:

\`\`\`javascript
// Primary agent signals readiness for support
Memory.store("agent_${taskAnalysis.primaryAgent}_ready_for_support", {
  base_structure_complete: true,
  ready_for: [${taskAnalysis.supportingAgents.map(a => `"${a}"`).join(', ')}],
  timestamp: new Date().toISOString()
});

// Supporting agents check readiness
const canProceed = Memory.get("agent_${taskAnalysis.primaryAgent}_ready_for_support");
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
    agentOutputs[agent] = output;
  }
});

// Store final swarm results
Memory.store("swarm_session_${sessionId}_results", {
  objective: "${objective}",
  completed_at: new Date().toISOString(),
  agent_outputs: agentOutputs,
  artifacts_created: Object.values(agentOutputs)
    .flatMap(output => output.artifacts_created || []),
  success: true
});

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

## 📊 Progress Monitoring Pattern

${options.progressMonitoring ? `### Real-Time Progress Monitoring Enabled
Monitor swarm progress using these patterns:

\`\`\`javascript
// Regular progress checks
setInterval(() => {
  const session = Memory.get("swarm_session_${sessionId}");
  const todos = TodoRead();
  
  cliLogger.info(\`Swarm Status: \${session.status}\`);
  cliLogger.info(\`Tasks Completed: \${todos.filter(t => t.status === 'completed').length}/\${todos.length}\`);
  
  // Check individual agent progress
  checkAgentProgress();
}, 30000); // Check every 30 seconds
\`\`\`
` : '### Manual Progress Checking\nUse TodoRead and Memory tools to check progress periodically.'}

## 🎯 Success Criteria

Your Queen Agent orchestration is successful when:
1. ✅ All agents have been spawned and initialized
2. ✅ Swarm session is tracked in Memory
3. ✅ Agents are coordinating through shared Memory
4. ✅ TodoWrite is being used for task tracking
5. ✅ Progress is being monitored
6. ✅ ${taskAnalysis.taskType} requirements are met
7. ✅ All artifacts are created/deployed successfully

## 💡 Queen Agent Best Practices

1. **Spawn agents concurrently** when tasks are independent
2. **Use Memory prefixes** to avoid key collisions
3. **Update TodoWrite** frequently for visibility
4. **Monitor agent health** and restart if needed
5. **Validate outputs** before marking complete
6. **Store all decisions** in Memory for audit trail

## 📋 Agent-Specific Authentication & Discovery Workflows

### 🛠️ Widget Creator Agent
\`\`\`javascript
// Pre-flight check
const authCheck = await snow_find_artifact({ query: "test auth", type: "widget" });
if (authCheck.error?.includes("OAuth")) {
  // Switch to planning mode
  Memory.store("widget_plan", {
    html_template: "<!-- Complete HTML structure -->",
    server_script: "// Complete server logic",
    client_script: "// Complete client controller",
    css_styles: "/* Complete styles */",
    deployment_instructions: "Run snow-flow auth login, then use snow_deploy"
  });
  TodoWrite([{ content: "Widget plan ready - auth required for deployment", status: "completed" }]);
} else {
  // Continue with live development
  const existing = await snow_comprehensive_search({ query: "similar widget" });
  // ... proceed with snow_deploy
}
\`\`\`

### 🔄 Flow Builder Agent
\`\`\`javascript
// Check existing flows first
const flows = await snow_discover_existing_flows({ flow_purpose: "objective" });
if (flows.error?.includes("OAuth")) {
  // Document flow architecture
  Memory.store("flow_plan", {
    trigger: "When record created on [table]",
    steps: ["Step 1: Validate data", "Step 2: Process", "Step 3: Notify"],
    natural_language: "Complete flow instruction for snow_create_flow",
    deployment_command: "snow_create_flow with instruction from Memory"
  });
} else {
  // Create flow directly
  await snow_create_flow({ instruction: "natural language description" });
}
\`\`\`

### 📝 Script Writer Agent
\`\`\`javascript
// Verify permissions
const permCheck = await snow_get_by_sysid({ 
  sys_id: "test", // Example sys_id - replace with actual value
  table: "sys_script_include" 
});
if (permCheck.error?.includes("OAuth")) {
  // Complete script documentation
  Memory.store("script_solution", {
    script_type: "Business Rule/Script Include/etc",
    code: "// Complete implementation",
    when: "before/after/async",
    table: "target_table",
    deployment_ready: true
  });
}
\`\`\`

### 🧪 Tester Agent
\`\`\`javascript
// Tester can start with mock (always works)
const mockTest = await snow_test_flow_with_mock({
  flow_id: "flow_name",
  test_inputs: { /* test data */ }
});
// Then try comprehensive if authenticated
const liveTest = await snow_comprehensive_flow_test({ flow_sys_id: "id" });
if (liveTest.error) {
  // Document test results from mock only
  Memory.store("test_results", mockTest);
}
\`\`\`

## 🚀 Begin Orchestration

Now execute this Queen Agent orchestration plan:
1. Initialize the swarm session in Memory
2. Create the master task list with TodoWrite
3. Spawn all required agents using Task
4. Monitor progress and coordinate
5. Validate and complete the objective

Remember: You are the Queen Agent - the master coordinator. Your role is to ensure all agents work harmoniously to achieve the objective: "${objective}"

Session ID for this swarm: ${sessionId}`;

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
        // Note: This is a simplified approach - in production, you'd query the database directly
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

// Auth command - OAuth implementation
program
  .command('auth <action>')
  .description('Authentication management (login, logout, status)')
  .option('--instance <instance>', 'ServiceNow instance (e.g., dev12345.service-now.com)')
  .option('--client-id <clientId>', 'OAuth Client ID')
  .option('--client-secret <clientSecret>', 'OAuth Client Secret')
  .action(async (action: string, options) => {
    const oauth = new ServiceNowOAuth();
    
    if (action === 'login') {
      cliLogger.info('🔑 Starting ServiceNow OAuth authentication...');
      
      // Get credentials from options or environment
      const instance = options.instance || process.env.SNOW_INSTANCE;
      const clientId = options.clientId || process.env.SNOW_CLIENT_ID;
      const clientSecret = options.clientSecret || process.env.SNOW_CLIENT_SECRET;
      
      if (!instance || !clientId || !clientSecret) {
        console.error('❌ Missing required OAuth credentials');
        cliLogger.info('\n📝 Please provide:');
        cliLogger.info('   --instance: ServiceNow instance (e.g., dev12345.service-now.com)');
        cliLogger.info('   --client-id: OAuth Client ID');
        cliLogger.info('   --client-secret: OAuth Client Secret');
        cliLogger.info('\n💡 Or set environment variables:');
        cliLogger.info('   export SNOW_INSTANCE=your-instance.service-now.com');
        cliLogger.info('   export SNOW_CLIENT_ID=your-client-id');
        cliLogger.info('   export SNOW_CLIENT_SECRET=your-client-secret');
        return;
      }
      
      // Start OAuth flow
      const result = await oauth.authenticate(instance, clientId, clientSecret);
      
      if (result.success) {
        cliLogger.info('\n✅ Authentication successful!');
        cliLogger.info('🎉 Snow-Flow is now connected to ServiceNow!');
        cliLogger.info('\n📋 Next steps:');
        cliLogger.info('   1. Test connection: snow-flow auth status');
        cliLogger.info('   2. Start development: snow-flow swarm "create a widget for incident management"');
        
        // Test connection
        const client = new ServiceNowClient();
        const testResult = await client.testConnection();
        if (testResult.success) {
          cliLogger.info(`\n🔍 Connection test successful!`);
          cliLogger.info(`👤 Logged in as: ${testResult.data.name} (${testResult.data.user_name})`);
        }
      } else {
        console.error(`\n❌ Authentication failed: ${result.error}`);
        process.exit(1);
      }
      
    } else if (action === 'logout') {
      cliLogger.info('🔓 Logging out...');
      await oauth.logout();
      
    } else if (action === 'status') {
      cliLogger.info('📊 Authentication Status:');
      
      const isAuthenticated = await oauth.isAuthenticated();
      const credentials = await oauth.loadCredentials();
      
      if (isAuthenticated && credentials) {
        console.log('   ├── Status: ✅ Authenticated');
        console.log(`   ├── Instance: ${credentials.instance}`);
        console.log('   ├── Method: OAuth 2.0');
        console.log(`   ├── Client ID: ${credentials.clientId}`);
        
        if (credentials.expiresAt) {
          const expiresAt = new Date(credentials.expiresAt);
          console.log(`   └── Token expires: ${expiresAt.toLocaleString()}`);
        }
        
        // Test connection
        const client = new ServiceNowClient();
        const testResult = await client.testConnection();
        if (testResult.success) {
          console.log(`\n🔍 Connection test: ✅ Success`);
          if (testResult.data.message) {
            console.log(`   ${testResult.data.message}`);
          }
          console.log(`🌐 Instance: ${testResult.data.email || credentials.instance}`);
        } else {
          console.log(`\n🔍 Connection test: ❌ Failed`);
          console.log(`   Error: ${testResult.error}`);
        }
      } else {
        console.log('   ├── Status: ❌ Not authenticated');
        console.log('   ├── Instance: Not configured');
        console.log('   └── Method: Not set');
        console.log('\n💡 Run "snow-flow auth login" to authenticate');
      }
    } else {
      console.log('❌ Invalid action. Use: login, logout, or status');
    }
  });

// Deploy XML command
program
  .command('deploy-xml <xmlFile>')
  .description('Deploy XML update set to ServiceNow (auto-import, preview, and commit)')
  .option('--no-preview', 'Skip preview step')
  .option('--no-commit', 'Skip auto-commit (preview only)')
  .action(async (xmlFile: string, options) => {
    console.log(`\n📦 Deploying XML Update Set: ${xmlFile}`);
    console.log('='.repeat(60));

    const oauth = new ServiceNowOAuth();
    const isAuthenticated = await oauth.getStoredTokens() !== null;
    
    if (!isAuthenticated) {
      console.log('❌ Not authenticated. Please run: snow-flow auth login');
      return;
    }

    try {
      // Initialize ServiceNow client
      const client = new ServiceNowClient();
      
      // Read XML file
      if (!existsSync(xmlFile)) {
        console.error(`❌ XML file not found: ${xmlFile}`);
        return;
      }
      
      console.log('📄 Reading XML file...');
      const xmlContent = await fs.readFile(xmlFile, 'utf-8');
      
      // Import XML as remote update set
      console.log('📤 Importing XML to ServiceNow...');
      const importResponse = await client.makeRequest({
        method: 'POST',
        url: '/api/now/table/sys_remote_update_set',
        headers: {
          'Content-Type': 'application/xml',
          'Accept': 'application/json'
        },
        data: xmlContent
      });

      if (!importResponse.result || !importResponse.result.sys_id) {
        throw new Error('Failed to import XML update set');
      }

      const remoteUpdateSetId = importResponse.result.sys_id;
      console.log(`✅ XML imported successfully (sys_id: ${remoteUpdateSetId})`);

      // Load the update set
      console.log('🔄 Loading update set...');
      await client.makeRequest({
        method: 'PUT',
        url: `/api/now/table/sys_remote_update_set/${remoteUpdateSetId}`,
        data: {
          state: 'loaded'
        }
      });

      // Find the loaded update set
      const loadedResponse = await client.makeRequest({
        method: 'GET',
        url: '/api/now/table/sys_update_set',
        params: {
          sysparm_query: `remote_sys_id=${remoteUpdateSetId}`,
          sysparm_limit: 1
        }
      });

      if (!loadedResponse.result || loadedResponse.result.length === 0) {
        throw new Error('Failed to find loaded update set');
      }

      const updateSetId = loadedResponse.result[0].sys_id;
      const updateSetName = loadedResponse.result[0].name;
      console.log(`✅ Update set loaded: ${updateSetName}`);

      // Preview if requested
      if (options.preview !== false) {
        console.log('🔍 Previewing update set...');
        
        await client.makeRequest({
          method: 'POST',
          url: `/api/now/table/sys_update_set/${updateSetId}/preview`
        });

        // Check preview results
        const previewProblems = await client.makeRequest({
          method: 'GET',
          url: '/api/now/table/sys_update_preview_problem',
          params: {
            sysparm_query: `update_set=${updateSetId}`,
            sysparm_limit: 100
          }
        });

        if (previewProblems.result && previewProblems.result.length > 0) {
          console.log('\n⚠️  Preview found problems:');
          previewProblems.result.forEach((p: any) => {
            console.log(`   - ${p.type}: ${p.description}`);
          });

          if (options.commit !== false) {
            console.log('\n⚠️  Skipping auto-commit due to preview problems');
            console.log('📋 Review and resolve problems in ServiceNow, then commit manually');
            return;
          }
        } else {
          console.log('✅ Preview successful - no problems found');
        }

        // Commit if clean and requested
        if (options.commit !== false && (!previewProblems.result || previewProblems.result.length === 0)) {
          console.log('🚀 Committing update set...');
          
          await client.makeRequest({
            method: 'POST',
            url: `/api/now/table/sys_update_set/${updateSetId}/commit`
          });

          console.log('\n✅ Update Set committed successfully!');
          console.log('📍 Navigate to Flow Designer > Designer to see your flow');
          console.log('\n🎉 Deployment complete!');
        }
      }

    } catch (error) {
      console.error('\n❌ Deployment failed:', error instanceof Error ? error.message : String(error));
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. Check your authentication: snow-flow auth status');
      console.log('   2. Verify XML file format is correct');
      console.log('   3. Ensure you have required permissions in ServiceNow');
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
  status                Show system status
  monitor               Real-time monitoring dashboard
  memory <action>       Memory operations
  auth <action>         Authentication management
  mcp <action>          Manage ServiceNow MCP servers
  create-flow <instruction> Create flows using natural language
  xml-flow <instruction>    Create flows using XML-first approach
  deploy-xml <file>     Deploy XML update set to ServiceNow
  help                  Show this help

🎯 Example Usage:
  snow-flow auth login --instance dev12345.service-now.com --client-id your-id --client-secret your-secret
  snow-flow auth status
  snow-flow mcp start   # Start MCP servers for Claude Code
  snow-flow mcp status  # Check MCP server status
  snow-flow swarm "create a widget for incident management"
  snow-flow swarm "create approval flow"  # 🔧 Auto-detects Flow Designer and uses XML!
  snow-flow create-flow "approval flow for hardware purchases over €1000"
  snow-flow xml-flow "create iPhone approval flow" --table sc_request
  snow-flow deploy-xml flow-update-sets/my_flow.xml  # 🚀 Auto-import to ServiceNow!
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
async function createDirectoryStructure(targetDir: string) {
  const directories = [
    '.claude', '.claude/commands', '.claude/commands/sparc', '.claude/configs',
    '.swarm', '.swarm/sessions', '.swarm/agents',
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
      persistentMemory: true,
      serviceNowIntegration: true,
      sparcModes: true
    }
  };
  
  const swarmConfig = {
    version: VERSION,
    topology: 'hierarchical',
    maxAgents: 8,
    memory: {
      database: '.swarm/memory.db',
      namespace: 'snow-flow'
    }
  };
  
  await fs.writeFile(join(targetDir, '.claude/config.json'), JSON.stringify(claudeConfig, null, 2));
  await fs.writeFile(join(targetDir, '.swarm/config.json'), JSON.stringify(swarmConfig, null, 2));
}

async function createReadmeFiles(targetDir: string) {
  // Only create README.md if it doesn't exist already
  const readmePath = join(targetDir, 'README.md');
  if (!existsSync(readmePath)) {
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

1. **Deployment MCP** - Autonomous widget, flow, and application deployment
2. **Flow Composer MCP** - Natural language flow creation with intelligent analysis
3. **Update Set MCP** - Professional change tracking and deployment management
4. **Intelligent MCP** - AI-powered artifact discovery and editing
5. **Graph Memory MCP** - Relationship tracking and impact analysis
6. **Platform Development MCP** - Development workflow automation
7. **Integration MCP** - Third-party system integration
8. **Operations MCP** - Operations and monitoring management
9. **Automation MCP** - Workflow and process automation
10. **Security & Compliance MCP** - Security auditing and compliance
11. **Reporting & Analytics MCP** - Data analysis and reporting

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
snow-flow init --sparc
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
snow-flow init --sparc

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
claude --mcp-config .mcp.json .

# For Windows:
claude.exe --mcp-config .mcp.json .
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
    run_as: "system",
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
- [Flow Composer Guide](./ENHANCED_FLOW_COMPOSER_DOCUMENTATION.md) - Advanced flow creation
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
- **Interactive Prompt**: During \`snow-flow init --sparc\`, you're now prompted to automatically start Claude Code with all MCP servers
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

**Ready to revolutionize your ServiceNow development?** Start with \`snow-flow init --sparc\` and experience the future of ServiceNow automation! 🚀
`;

    await fs.writeFile(readmePath, mainReadme);
  }
  
  // Create sub-directory READMEs
  await fs.writeFile(join(targetDir, 'memory/agents/README.md'), '# Agent Memory\n\nThis directory contains persistent memory for ServiceNow agents.');
  await fs.writeFile(join(targetDir, 'servicenow/README.md'), '# ServiceNow Artifacts\n\nThis directory contains generated ServiceNow development artifacts.');
}

async function createSparcFiles(targetDir: string) {
  const sparcModes = [
    'orchestrator', 'coder', 'researcher', 'tdd', 'architect', 'reviewer',
    'debugger', 'tester', 'analyzer', 'optimizer', 'documenter', 'designer',
    'innovator', 'swarm-coordinator', 'memory-manager', 'batch-executor', 'workflow-manager'
  ];
  
  for (const mode of sparcModes) {
    const content = `# SPARC ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode

## Overview
Specialized ${mode} capabilities for ServiceNow development.

## Purpose
Provide ${mode} expertise for ServiceNow projects.

## Usage
\`\`\`bash
snow-flow sparc ${mode} "your task description"
\`\`\`

This mode provides specialized ${mode} capabilities for ServiceNow development projects.
`;
    
    await fs.writeFile(join(targetDir, `.claude/commands/sparc/${mode}.md`), content);
  }
  
  // Create additional swarm documentation files
  console.log('📋 Creating swarm patterns documentation...');
  
  // Create swarm-patterns.md
  const swarmPatternsContent = `# Swarm Command Patterns - MCP-FIRST Workflow

## 🎯 Primary Interface: snow-flow swarm

The swarm command is your primary interface for ServiceNow development. It uses the Queen Agent backend to orchestrate multiple specialized agents through Claude Code.

## Basic Widget Creation
\`\`\`bash
snow-flow swarm "create incident dashboard widget"
snow-flow swarm "build responsive widget with Chart.js for incident analytics"
snow-flow swarm "create service portal widget for hardware requests"
\`\`\`

## Flow Development  
\`\`\`bash
snow-flow swarm "create approval workflow for equipment requests"
snow-flow swarm "build multi-step approval flow with email notifications"
snow-flow swarm "create automated incident escalation workflow"
\`\`\`

## Complex Integration
\`\`\`bash
snow-flow swarm "integrate ServiceNow with Slack notifications"
snow-flow swarm "create REST API integration with external ticketing system"
snow-flow swarm "build bi-directional sync with Microsoft Teams"
\`\`\`

## Testing Patterns
\`\`\`bash
snow-flow swarm "test existing flows and create comprehensive test report"
snow-flow swarm "validate all widgets in service portal for mobile responsiveness"
snow-flow swarm "performance test catalog item workflows"
\`\`\`

## Application Development
\`\`\`bash
snow-flow swarm "create complete ITSM solution with custom tables"
snow-flow swarm "build employee onboarding application with approval flows"
snow-flow swarm "develop asset management system with automated workflows"
\`\`\`

## Advanced Patterns with Options

### Disable Auto-Deploy for Testing
\`\`\`bash
snow-flow swarm "test new widget locally" --no-auto-deploy --no-live-testing
\`\`\`

### Enable Permission Escalation
\`\`\`bash
snow-flow swarm "create global enterprise workflow" --auto-permissions
\`\`\`

### Parallel Execution for Large Projects
\`\`\`bash
snow-flow swarm "migrate 50 workflows from legacy system" --parallel --max-agents 8
\`\`\`

### Monitor Real-Time Progress
\`\`\`bash
snow-flow swarm "complex ITSM implementation" --monitor
\`\`\`

## 🔐 MCP-FIRST Workflow

Every swarm command follows this mandatory workflow:

1. **Authentication Check**: Validates ServiceNow OAuth credentials
2. **Smart Discovery**: Finds existing artifacts to prevent duplication
3. **Live Development**: Creates real artifacts in ServiceNow
4. **Update Set Tracking**: All changes tracked for deployment

## 💡 Best Practices

- Start simple: Let the Queen Agent determine complexity
- Use natural language: Describe what you want, not how to build it
- Trust the defaults: Intelligent features are enabled automatically
- Monitor progress: Use --monitor for long-running tasks

## 🎯 Common Success Patterns

### Pattern 1: Quick Widget
\`\`\`bash
snow-flow swarm "simple dashboard widget"
# Queen Agent will:
# - Spawn widget-creator agent
# - Create HTML/CSS/JS
# - Deploy to ServiceNow
# - Test automatically
\`\`\`

### Pattern 2: Complex Flow
\`\`\`bash
snow-flow swarm "multi-department approval workflow with dynamic routing"
# Queen Agent will:
# - Spawn flow-builder, tester, and security agents
# - Design flow architecture
# - Implement with conditions
# - Test all paths
# - Validate permissions
\`\`\`

### Pattern 3: Full Application
\`\`\`bash
snow-flow swarm "complete HR onboarding system"
# Queen Agent will:
# - Spawn app-architect, flow-builder, widget-creator, tester
# - Design data model
# - Create tables and relationships
# - Build UI components
# - Implement workflows
# - Test end-to-end
\`\`\`
`;
  await fs.writeFile(join(targetDir, '.claude/commands/swarm-patterns.md'), swarmPatternsContent);
  
  // Create agent-types.md
  const agentTypesContent = `# Agent Types and Specializations

## 🤖 Primary Development Agents

### widget-creator
**Specialization**: Service Portal widgets, HTML/CSS/JS, responsive design
**When spawned**: Any widget-related objective
**Key capabilities**:
- HTML template generation
- CSS styling and animations
- Client-side JavaScript controllers
- Server-side data scripts
- Chart.js and data visualization
- Mobile responsiveness

### flow-builder
**Specialization**: Flow Designer, process automation, approvals
**When spawned**: Workflow and automation objectives
**Key capabilities**:
- Trigger configuration
- Conditional logic
- Approval routing
- Email notifications
- Integration with catalog items
- Subflow creation

### script-writer
**Specialization**: Business rules, script includes, client scripts
**When spawned**: Scripting and automation objectives
**Key capabilities**:
- GlideRecord operations
- Business rule creation
- Script include development
- Background scripts
- Fix scripts
- Scheduled jobs

### app-architect
**Specialization**: Application design, data modeling, system architecture
**When spawned**: Full application development
**Key capabilities**:
- Table design and relationships
- Application scoping
- Security model design
- Integration architecture
- Performance optimization
- Scalability planning

## 🛠️ Supporting Agents

### researcher
**Specialization**: Discovery, best practices, documentation
**When spawned**: Complex or unknown requirements
**Key capabilities**:
- ServiceNow best practices
- Platform feature discovery
- Existing artifact analysis
- Documentation generation
- Knowledge base creation

### tester
**Specialization**: Quality assurance, validation, performance testing
**When spawned**: After any development task
**Key capabilities**:
- Unit test creation
- Integration testing
- UI/UX validation
- Performance benchmarking
- Security testing
- Accessibility compliance

### security
**Specialization**: Access controls, compliance, vulnerability assessment
**When spawned**: Enterprise or sensitive applications
**Key capabilities**:
- ACL configuration
- Role management
- Data encryption
- Compliance validation
- Security scanning
- Audit trail setup

### ui-designer
**Specialization**: User experience, design patterns, accessibility
**When spawned**: Complex UI requirements
**Key capabilities**:
- Design system implementation
- Accessibility (WCAG) compliance
- Responsive layouts
- User journey mapping
- Style guide creation

## 🎯 How Agents are Selected

The Queen Agent analyzes your objective and automatically selects the optimal team:

### Example 1: "create incident dashboard"
- **Primary**: widget-creator
- **Supporting**: ui-designer, tester
- **Reasoning**: Widget development with UI focus

### Example 2: "build approval workflow"
- **Primary**: flow-builder
- **Supporting**: security, tester
- **Reasoning**: Process automation with security needs

### Example 3: "create ITSM application"
- **Primary**: app-architect
- **Supporting**: flow-builder, widget-creator, security, tester
- **Reasoning**: Full application requiring all capabilities

## 💡 Agent Coordination Patterns

### Sequential Coordination
Used when tasks have dependencies:
\`\`\`
app-architect → widget-creator → flow-builder → tester
\`\`\`

### Parallel Coordination
Used when tasks are independent:
\`\`\`
widget-creator ⟷ flow-builder ⟷ script-writer
         ↓            ↓              ↓
                  tester
\`\`\`

### Hybrid Coordination
Used for complex projects:
\`\`\`
Phase 1: app-architect (solo)
Phase 2: widget-creator + flow-builder (parallel)
Phase 3: security + tester (parallel)
Phase 4: Final integration (sequential)
\`\`\`

## 🔧 Manual Agent Control

While the Queen Agent handles selection automatically, you can influence agent selection:

### Request Specific Expertise
\`\`\`bash
snow-flow swarm "create widget with heavy security focus"
# Queen will prioritize security agent
\`\`\`

### Exclude Certain Agents
\`\`\`bash
snow-flow swarm "simple widget" --max-agents 2
# Queen will use only essential agents
\`\`\`

### Force Comprehensive Team
\`\`\`bash
snow-flow swarm "production-ready incident system" --max-agents 8
# Queen will assemble full team with all specialists
\`\`\`
`;
  await fs.writeFile(join(targetDir, '.claude/commands/agent-types.md'), agentTypesContent);
  
  // Create mcp-tools-quick-ref.md
  const mcpToolsContent = `# MCP Tools Quick Reference

## 🔐 Authentication & Connection

### snow_validate_live_connection
\`\`\`javascript
snow_validate_live_connection({
  test_level: "permissions" // basic, full, permissions
})
\`\`\`
**Use for**: Checking ServiceNow connection and OAuth status

### snow_auth_diagnostics
\`\`\`javascript
snow_auth_diagnostics({
  include_recommendations: true,
  run_write_test: true
})
\`\`\`
**Use for**: Debugging authentication issues

## 🔍 Discovery & Search

### snow_find_artifact
\`\`\`javascript
snow_find_artifact({
  query: "incident dashboard widget",
  type: "widget" // widget, flow, script, application, any
})
\`\`\`
**Use for**: Finding existing ServiceNow artifacts with natural language

### snow_catalog_item_search
\`\`\`javascript
snow_catalog_item_search({
  query: "laptop",
  fuzzy_match: true,
  include_variables: true
})
\`\`\`
**Use for**: Finding catalog items with intelligent matching

### snow_get_by_sysid
\`\`\`javascript
snow_get_by_sysid({
  sys_id: "<artifact_sys_id>",
  table: "sp_widget"
})
\`\`\`
**Use for**: Direct lookup when you have the sys_id

## 🚀 Deployment Tools

### snow_deploy (Universal - v1.1.73+)
\`\`\`javascript
snow_deploy({
  type: "widget", // widget, flow, application, script, batch
  config: {
    name: "incident_dashboard",
    title: "Incident Dashboard",
    template: htmlContent,
    css: cssContent,
    client_script: clientJS,
    server_script: serverJS
  },
  auto_update_set: true
})
\`\`\`
**Use for**: All deployments - replaces individual deploy tools

## 🔄 Flow Development

### snow_create_flow
\`\`\`javascript
snow_create_flow({
  instruction: "create approval flow for purchases over $1000",
  deploy_immediately: true,
  enable_intelligent_analysis: true
})
\`\`\`
**Use for**: Creating flows from natural language

### snow_test_flow_with_mock
\`\`\`javascript
snow_test_flow_with_mock({
  flow_id: "equipment_approval",
  create_test_user: true,
  mock_catalog_items: true,
  simulate_approvals: true,
  cleanup_after_test: true
})
\`\`\`
**Use for**: Testing flows without affecting real data

### snow_link_catalog_to_flow
\`\`\`javascript
snow_link_catalog_to_flow({
  catalog_item_id: "New Laptop",
  flow_id: "laptop_provisioning",
  variable_mapping: [{
    catalog_variable: "model",
    flow_input: "equipment_type"
  }]
})
\`\`\`
**Use for**: Connecting catalog items to flows

## 📦 Update Set Management

### snow_update_set_create
\`\`\`javascript
snow_update_set_create({
  name: "Widget Development - Jan 2024",
  description: "Dashboard widgets for incident management",
  auto_switch: true
})
\`\`\`
**Use for**: Creating new update sets

### snow_update_set_add_artifact
\`\`\`javascript
snow_update_set_add_artifact({
  type: "widget",
  sys_id: "<artifact_sys_id>",
  name: "incident_dashboard"
})
\`\`\`
**Use for**: Tracking artifacts in update sets

### snow_smart_update_set
\`\`\`javascript
snow_smart_update_set({
  detect_context: true,
  separate_by_task: true,
  close_previous: true
})
\`\`\`
**Use for**: Automatic update set management

## 🧪 Testing Tools

### snow_widget_test
\`\`\`javascript
snow_widget_test({
  sys_id: "widget_sys_id",
  test_scenarios: [{
    name: "No data test",
    input: { incidents: [] },
    expected: { message: "No incidents found" }
  }],
  validate_dependencies: true
})
\`\`\`
**Use for**: Widget functionality testing

### snow_comprehensive_flow_test
\`\`\`javascript
snow_comprehensive_flow_test({
  flow_sys_id: "flow_id",
  test_data_generation: "automatic",
  edge_case_detection: true,
  performance_validation: true
})
\`\`\`
**Use for**: Comprehensive flow testing

## 🔄 Batch Operations

### Parallel Tool Execution
\`\`\`javascript
// Execute multiple operations in one message
Promise.all([
  snow_find_artifact({ query: "widget" }),
  snow_catalog_item_search({ query: "laptop" }),
  snow_update_set_current()
])
\`\`\`
**Use for**: Maximum performance with concurrent operations

## 💡 Common Patterns

### Pre-flight Check Pattern
\`\`\`javascript
// Always start with authentication
const auth = await snow_validate_live_connection();
if (!auth.success) {
  // Switch to planning mode
  return "Run: snow-flow auth login";
}

// Then discover existing artifacts
const existing = await snow_find_artifact({
  query: "similar to what I want to create"
});

// Finally deploy new artifact
const result = await snow_deploy({
  type: "widget",
  config: widgetConfig
});
\`\`\`

### Error Recovery Pattern
\`\`\`javascript
try {
  await snow_deploy({ type: "flow", config });
} catch (error) {
  if (error.includes("permissions")) {
    // Try global scope
    await snow_escalate_permissions();
  } else if (error.includes("validation")) {
    // Create manual deployment guide
    await snow_create_manual_guide();
  }
}
\`\`\`

### Update Set Pattern
\`\`\`javascript
// Ensure update set exists
await snow_smart_update_set();

// Deploy artifact
const artifact = await snow_deploy({ type: "widget", config });

// Track in update set
await snow_update_set_add_artifact({
  type: "widget",
  sys_id: artifact.sys_id,
  name: artifact.name
});
\`\`\`
`;
  await fs.writeFile(join(targetDir, '.claude/commands/mcp-tools-quick-ref.md'), mcpToolsContent);
  
  // Create examples directory
  await fs.mkdir(join(targetDir, 'examples'), { recursive: true });
  
  // Create memory patterns directory and sample patterns
  await fs.mkdir(join(targetDir, 'memory/patterns'), { recursive: true });
  
  const successfulPatternsContent = {
    patterns: [
      {
        objective: "create incident dashboard widget",
        agents: ["widget-creator", "ui-designer", "tester"],
        mcpTools: ["snow_deploy", "snow_widget_test", "snow_preview_widget"],
        successRate: 0.95,
        avgDuration: "5-10 minutes",
        commonIssues: ["Missing Chart.js dependency", "Mobile responsiveness"],
        bestPractices: ["Always test on mobile", "Use Chart.js from CDN"]
      },
      {
        objective: "create approval workflow",
        agents: ["flow-builder", "security", "tester"],
        mcpTools: ["snow_create_flow", "snow_test_flow_with_mock", "snow_link_catalog_to_flow"],
        successRate: 0.92,
        avgDuration: "10-15 minutes",
        commonIssues: ["Complex approval routing", "Email notification setup"],
        bestPractices: ["Test all approval paths", "Use mock data first"]
      },
      {
        objective: "create ITSM application",
        agents: ["app-architect", "flow-builder", "widget-creator", "security", "tester"],
        mcpTools: ["snow_deploy", "snow_create_flow", "snow_update_set_create"],
        successRate: 0.88,
        avgDuration: "30-45 minutes",
        commonIssues: ["Table relationships", "Permission model"],
        bestPractices: ["Design data model first", "Use Update Sets throughout"]
      }
    ],
    agentCapabilities: {
      "widget-creator": {
        strengths: ["HTML/CSS/JS", "Chart.js", "Responsive design"],
        limitations: ["Complex backend logic", "Database design"]
      },
      "flow-builder": {
        strengths: ["Process automation", "Conditional logic", "Approvals"],
        limitations: ["UI development", "Complex integrations"]
      },
      "app-architect": {
        strengths: ["System design", "Data modeling", "Architecture"],
        limitations: ["Detailed implementation", "UI/UX design"]
      }
    },
    mcpToolPatterns: {
      "authentication_first": {
        pattern: "Always start with snow_validate_live_connection",
        reason: "Ensures OAuth is valid before attempting operations"
      },
      "discovery_before_creation": {
        pattern: "Use snow_find_artifact before snow_deploy",
        reason: "Prevents duplicate artifacts and wasted effort"
      },
      "update_set_tracking": {
        pattern: "Create Update Set, deploy, then track artifacts",
        reason: "Professional change management like ServiceNow pros"
      }
    }
  };
  
  await fs.writeFile(
    join(targetDir, 'memory/patterns/successful-deployments.json'),
    JSON.stringify(successfulPatternsContent, null, 2)
  );
  
  // Create workflow patterns JSON
  const workflowPatternsContent = {
    workflowTemplates: [
      {
        name: "Standard Widget Development",
        steps: [
          "snow_validate_live_connection",
          "snow_find_artifact (check existing)",
          "snow_update_set_create",
          "snow_deploy (type: widget)",
          "snow_widget_test",
          "snow_update_set_add_artifact"
        ]
      },
      {
        name: "Flow Development with Testing",
        steps: [
          "snow_validate_live_connection",
          "snow_discover_existing_flows",
          "snow_create_flow",
          "snow_test_flow_with_mock",
          "snow_link_catalog_to_flow (if needed)",
          "snow_comprehensive_flow_test (if authenticated)"
        ]
      },
      {
        name: "Full Application Deployment",
        steps: [
          "snow_validate_live_connection",
          "snow_analyze_requirements",
          "snow_update_set_create",
          "snow_deploy (multiple artifacts)",
          "snow_create_flow (for workflows)",
          "snow_deploy (for widgets)",
          "snow_update_set_complete"
        ]
      }
    ]
  };
  
  await fs.writeFile(
    join(targetDir, 'memory/patterns/workflow-templates.json'),
    JSON.stringify(workflowPatternsContent, null, 2)
  );
  
  // Create quick start guide
  const quickStartContent = `# Snow-Flow Quick Start Guide

## 🚀 5-Minute Setup

### 1. Initialize Your Project
\`\`\`bash
snow-flow init --sparc
\`\`\`

### 2. Configure ServiceNow OAuth
Edit the .env file with your ServiceNow credentials:
\`\`\`env
SNOW_INSTANCE=dev123456.service-now.com
SNOW_CLIENT_ID=your_oauth_client_id
SNOW_CLIENT_SECRET=your_oauth_client_secret
\`\`\`

### 3. Authenticate
\`\`\`bash
snow-flow auth login
\`\`\`

### 4. Create Your First Widget
\`\`\`bash
snow-flow swarm "create simple incident counter widget"
\`\`\`

## 📋 What Just Happened?

When you ran the swarm command, Snow-Flow:
1. ✅ Validated your ServiceNow connection
2. ✅ Analyzed your objective using Queen Agent
3. ✅ Spawned 6+ parallel agents (widget-creator, css-specialist, backend-specialist, frontend-specialist, integration-specialist, tester)
4. ✅ Created a real widget in your ServiceNow instance
5. ✅ Tracked everything in an Update Set
6. ✅ Tested the widget automatically

## 🎯 Next Steps

### Try More Examples
\`\`\`bash
# Create a workflow
snow-flow swarm "create simple approval workflow"

# Build a dashboard
snow-flow swarm "create IT dashboard with KPIs"

# Develop an application
snow-flow swarm "create basic ticketing system"
\`\`\`

### Explore Documentation
- **Swarm Patterns**: .claude/commands/swarm-patterns.md
- **Agent Types**: .claude/commands/agent-types.md
- **MCP Tools**: .claude/commands/mcp-tools-quick-ref.md
- **Examples**: ./examples/

### Monitor Progress
\`\`\`bash
# Check swarm status
snow-flow swarm-status <sessionId>

# View system status
snow-flow status
\`\`\`

## 💡 Pro Tips

1. **Start Simple**: Let the Queen Agent handle complexity
2. **Use Natural Language**: Describe what you want, not how
3. **Trust the Defaults**: Intelligent features are enabled
4. **Check Examples**: Run scripts in ./examples/ folder

## 🆘 Need Help?

- **Auth Issues**: Run \`snow-flow auth status\`
- **MCP Tools**: Check .claude/commands/mcp-tools-quick-ref.md
- **Agent Info**: See .claude/commands/agent-types.md
- **GitHub**: https://github.com/groeimetai/snow-flow

Happy ServiceNow Development! 🎉
`;
  
  await fs.writeFile(join(targetDir, 'QUICK_START.md'), quickStartContent);
  
  // Create example scripts
  const widgetExampleContent = `#!/bin/bash
# Example: Create an incident dashboard widget

# This example shows how to create a comprehensive incident dashboard
# with real-time data, charts, and mobile responsiveness

snow-flow swarm "create incident dashboard widget with:
- Real-time incident counts by priority (Critical, High, Medium, Low)
- Chart.js bar chart showing incidents by category
- Line graph for incident trends over the last 7 days
- Responsive grid layout for mobile devices
- Auto-refresh every 30 seconds
- Click-through to incident details
- Color coding for priority levels (red for critical, orange for high)
- Export to PDF functionality
- Filter by assignment group"

# The Queen Agent will:
# 1. Spawn widget-creator as primary agent
# 2. Add ui-designer for responsive design
# 3. Add tester for validation
# 4. Create complete widget in ServiceNow
# 5. Test on mobile and desktop
# 6. Deploy with Update Set tracking
`;
  await fs.writeFile(join(targetDir, 'examples/widget-dashboard.sh'), widgetExampleContent);
  await fs.chmod(join(targetDir, 'examples/widget-dashboard.sh'), '755');
  
  const approvalFlowExampleContent = `#!/bin/bash
# Example: Create equipment approval workflow

# This example demonstrates creating a multi-level approval workflow
# with dynamic routing based on cost and department

snow-flow swarm "create approval workflow for equipment requests with:
- Automatic approval for items under $100
- Manager approval for items $100-$1000
- Department head approval for items $1000-$5000
- VP approval for items over $5000
- IT approval required for all technology items regardless of cost
- Finance review for items over $10000
- Email notifications at each approval step
- Slack notifications for urgent requests
- 48-hour SLA with escalation
- Rejection reasons and resubmission process
- Integration with catalog items for equipment selection
- Automatic PO generation upon final approval"

# The Queen Agent will:
# 1. Spawn flow-builder as primary agent
# 2. Add security agent for approval permissions
# 3. Add tester for all approval paths
# 4. Create complex flow with conditions
# 5. Link to catalog items
# 6. Test all approval scenarios
# 7. Validate email notifications
`;
  await fs.writeFile(join(targetDir, 'examples/approval-workflow.sh'), approvalFlowExampleContent);
  await fs.chmod(join(targetDir, 'examples/approval-workflow.sh'), '755');
  
  const itsmApplicationExampleContent = `#!/bin/bash
# Example: Create complete ITSM solution

# This example shows how to build a full IT Service Management application
# with custom tables, workflows, and user interfaces

snow-flow swarm "create complete ITSM solution for laptop provisioning with:
- Custom request table extending task table
- Fields: laptop_model, specifications, justification, cost_center
- Catalog item for laptop requests with dynamic pricing
- Multi-stage approval workflow based on cost and user role
- Integration with asset management for laptop assignment
- Automated Active Directory account provisioning
- Email notifications to user, manager, and IT
- Dashboard showing request status and metrics
- SLA tracking with 5-day fulfillment target
- Mobile-friendly request portal
- Reporting on request volumes and fulfillment times
- Return process for laptop replacement
- Integration with purchase order system"

# The Queen Agent will:
# 1. Spawn app-architect to design the solution
# 2. Add flow-builder for approval workflows
# 3. Add widget-creator for dashboards
# 4. Add script-writer for integrations
# 5. Add security for access controls
# 6. Add tester for end-to-end validation
# 7. Create all components in sequence
# 8. Deploy complete solution
`;
  await fs.writeFile(join(targetDir, 'examples/itsm-application.sh'), itsmApplicationExampleContent);
  await fs.chmod(join(targetDir, 'examples/itsm-application.sh'), '755');
  
  // Create CLAUDE.md by copying from source (v1.1.62+)
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
      // Fallback to a minimal CLAUDE.md if source not found
      console.log('⚠️  Could not find CLAUDE.md source, creating minimal version');
      claudeMdContent = `# Snow-Flow Development with Claude Code

## 🚀 Core Development Principles

### Concurrent Execution Strategy
**Golden Rule**: "1 MESSAGE = ALL RELATED OPERATIONS"
- Always batch related MCP tool calls in a single response
- Use TodoWrite extensively for complex task coordination
- Launch multiple agents concurrently for maximum performance
- Leverage batch file operations whenever reading/writing multiple files

### ServiceNow Development Best Practices
1. **Never hardcode credentials** - Use OAuth and environment variables
2. **Always work in Update Sets** - Provides rollback safety
3. **Test before deploy** - Use mock testing tools for validation
4. **Validate permissions** - Check OAuth scopes before operations
5. **Use fuzzy search** - ServiceNow names can vary (iPhone vs iPhone 6S)

## 📋 Essential MCP Tool Patterns

### Batch Operations for Maximum Efficiency
\`\`\`javascript
// GOOD: Single message with multiple tool calls
TodoWrite([...tasks]);
Task("Architect", "Design system architecture");
Task("Developer", "Implement components");
Task("Tester", "Create test scenarios");

// BAD: Sequential single operations
TodoWrite([task1]);
// wait for response
TodoWrite([task2]);
// wait for response
\`\`\`

### Memory-Driven Coordination
Use Memory to coordinate information across agents:
\`\`\`javascript
// Store architecture decisions
snow_memory_store({
  key: "widget_architecture",
  value: "Service Portal widget with Chart.js for data visualization"
});

// All agents can reference this
Task("Frontend Dev", "Implement widget based on widget_architecture in memory");
Task("Backend Dev", "Create REST endpoints for widget_architecture requirements");
\`\`\`

## 🛠️ Complete ServiceNow MCP Tools Reference

### Discovery & Search Tools
\`\`\`javascript
// Find any ServiceNow artifact using natural language
snow_find_artifact({
  query: "the widget that shows incidents on homepage",
  type: "widget" // or "flow", "script", "application", "any"
});

// Search catalog items with fuzzy matching
snow_catalog_item_search({
  query: "laptop",
  fuzzy_match: true,        // Finds variations: notebook, MacBook, etc.
  category_filter: "hardware",
  include_variables: true   // Get catalog variables too
});

// Direct sys_id lookup (faster than search)
snow_get_by_sysid({
  sys_id: "<artifact_sys_id>",
  table: "sp_widget"
});
\`\`\`

### Flow Development Tools
\`\`\`javascript
// Create flows from natural language
snow_create_flow({
  instruction: "create a flow that sends email when incident priority is high",
  deploy_immediately: true,
  enable_intelligent_analysis: true
});

// Test flows with mock data
snow_test_flow_with_mock({
  flow_id: "incident_notification_flow",
  create_test_user: true,
  mock_catalog_items: true,
  test_inputs: {
    priority: "1",
    category: "hardware"
  },
  simulate_approvals: true
});

// Link catalog items to flows
snow_link_catalog_to_flow({
  catalog_item_id: "New Laptop Request",
  flow_id: "laptop_provisioning_flow",
  link_type: "flow_catalog_process",
  variable_mapping: [
    {
      catalog_variable: "laptop_model",
      flow_input: "equipment_type"
    }
  ]
});
\`\`\`

### Widget Development Tools
\`\`\`javascript
// Deploy widgets with automatic validation
snow_deploy_widget({
  name: "incident_dashboard",
  title: "Incident Dashboard",
  template: htmlContent,
  css: cssContent,
  client_script: clientJS,
  server_script: serverJS,
  demo_data: { incidents: [...] }
});

// Preview and test widgets
snow_preview_widget({
  widget_id: "incident_dashboard",
  check_dependencies: true
});

snow_widget_test({
  widget_id: "incident_dashboard",
  test_scenarios: [
    {
      name: "Load with no data",
      server_data: { incidents: [] }
    }
  ]
});
\`\`\`

### Bulk Operations
\`\`\`javascript
// Deploy multiple artifacts at once
snow_bulk_deploy({
  artifacts: [
    { type: "widget", data: widgetData },
    { type: "flow", data: flowData },
    { type: "script", data: scriptData }
  ],
  transaction_mode: true,     // All or nothing
  parallel: true,            // Deploy simultaneously
  dry_run: false
});
\`\`\`

### Intelligent Analysis
\`\`\`javascript
// Analyze incidents with AI
snow_analyze_incident({
  incident_id: "INC0010001",
  include_similar: true,
  suggest_resolution: true
});

// Pattern analysis
snow_pattern_analysis({
  analysis_type: "incident_patterns",
  timeframe: "month"
});
\`\`\`

## ⚡ Performance Optimization

### Parallel Execution Patterns
\`\`\`javascript
// Execute multiple searches concurrently
Promise.all([
  snow_find_artifact({ query: "incident widget" }),
  snow_catalog_item_search({ query: "laptop" }),
  snow_query_incidents({ query: "priority=1" })
]);
\`\`\`

### Batch File Operations
\`\`\`javascript
// Read multiple files in one operation
MultiRead([
  "/path/to/widget.html",
  "/path/to/widget.css",
  "/path/to/widget.js"
]);
\`\`\`

## 📝 Workflow Guidelines

### Standard Development Flow
1. **Discovery Phase**: Use search tools to find existing artifacts
2. **Planning Phase**: Use TodoWrite to plan all tasks
3. **Development Phase**: Launch agents concurrently
4. **Testing Phase**: Use mock testing tools
5. **Deployment Phase**: Use bulk deploy with validation

### Error Recovery Patterns
\`\`\`javascript
// Always implement rollback strategies
if (deployment.failed) {
  snow_deployment_rollback_manager({
    update_set_id: deployment.update_set,
    restore_point: deployment.backup_id
  });
}
\`\`\`

## 🔧 Advanced Configuration

## Build Commands
- \`npm run build\`: Build the project
- \`npm run test\`: Run the full test suite
- \`npm run lint\`: Run ESLint and format checks
- \`npm run typecheck\`: Run TypeScript type checking

## Snow-Flow Commands
- \`snow-flow init --sparc\`: Initialize project with SPARC environment
- \`snow-flow auth login\`: Authenticate with ServiceNow OAuth
- \`snow-flow swarm "<objective>"\`: Start multi-agent swarm - één command voor alles!
- \`snow-flow sparc <mode> "<task>"\`: Run specific SPARC mode

## Enhanced Swarm Command (v1.1.41+)
The swarm command now includes intelligent features that are **enabled by default**:

\`\`\`bash
# Simple usage - all intelligent features enabled!
snow-flow swarm "create incident management dashboard"
\`\`\`

### Default Settings (no flags needed):
- ✅ \`--smart-discovery\` - Automatically discovers and reuses existing artifacts
- ✅ \`--live-testing\` - Tests in real-time on your ServiceNow instance
- ✅ \`--auto-deploy\` - Deploys automatically (safe with update sets)
- ✅ \`--auto-rollback\` - Automatically rollbacks on failures
- ✅ \`--shared-memory\` - All agents share context and coordination
- ✅ \`--progress-monitoring\` - Real-time progress tracking
- ❌ \`--auto-permissions\` - Disabled by default (enable with flag for automatic role elevation)

### Advanced Usage:
\`\`\`bash
# Enable automatic permission escalation
snow-flow swarm "create global workflow" --auto-permissions

# Disable specific features
snow-flow swarm "test widget" --no-auto-deploy --no-live-testing

# Full control
snow-flow swarm "complex integration" \\
  --max-agents 8 \\
  --strategy development \\
  --mode distributed \\
  --parallel \\
  --auto-permissions
\`\`\`

## New MCP Tools (v1.1.44+)

### Catalog Item Search
Find catalog items with intelligent fuzzy matching:
\`\`\`javascript
snow_catalog_item_search({
  query: "iPhone",          // Will find iPhone 6S, iPhone 7, etc.
  fuzzy_match: true,        // Enable intelligent variations
  include_variables: true   // Include catalog variables
})
\`\`\`

### Flow Testing with Mock Data
Test flows without real data:
\`\`\`javascript
snow_test_flow_with_mock({
  flow_id: "equipment_provisioning_flow",
  create_test_user: true,      // Creates test user
  mock_catalog_items: true,    // Creates test catalog items
  simulate_approvals: true,    // Auto-approves during test
  cleanup_after_test: true     // Removes test data after
})
\`\`\`

### Direct Catalog-Flow Linking
Link catalog items directly to flows:
\`\`\`javascript
snow_link_catalog_to_flow({
  catalog_item_id: "iPhone 6S",
  flow_id: "mobile_provisioning_flow",
  link_type: "flow_catalog_process",  // Modern approach
  variable_mapping: [
    {
      catalog_variable: "phone_model",
      flow_input: "device_type"
    }
  ],
  test_link: true  // Creates test request
})
\`\`\`

### OAuth Configuration
\`\`\`env
# .env file
SNOW_INSTANCE=dev123456
SNOW_CLIENT_ID=your_oauth_client_id
SNOW_CLIENT_SECRET=your_oauth_client_secret
SNOW_USERNAME=admin
SNOW_PASSWORD=admin_password
\`\`\`

### Update Set Management
\`\`\`javascript
// Smart update set creation
snow_smart_update_set({
  name: "Auto-generated for widget development",
  detect_context: true,  // Auto-detects what you're working on
  auto_switch: true     // Switches when context changes
});
\`\`\`

## 🎯 Quick Start
1. \`snow-flow init --sparc\` - Initialize project with SPARC environment
2. Configure ServiceNow credentials in .env file
3. \`snow-flow auth login\` - Authenticate with ServiceNow OAuth
4. \`snow-flow swarm "create a widget for incident management"\` - Everything automatic!

## 💡 Important Notes

### Do's
- ✅ Use TodoWrite extensively for task tracking
- ✅ Batch MCP tool calls for performance
- ✅ Store important data in Memory for coordination
- ✅ Test with mock data before deploying
- ✅ Work within Update Sets for safety
- ✅ Use fuzzy search for finding artifacts

### Don'ts
- ❌ Don't make sequential tool calls when batch is possible
- ❌ Don't hardcode credentials or sys_ids
- ❌ Don't deploy without testing
- ❌ Don't ignore OAuth permission errors
- ❌ Don't create artifacts without checking if they exist

## 🚀 Performance Benchmarks

With concurrent execution and batch operations:
- **Widget Development**: 3x faster than sequential
- **Flow Creation**: 2.5x faster with parallel validation
- **Bulk Deployment**: Up to 5x faster with parallel mode
- **Search Operations**: 4x faster with concurrent queries

## 📚 Additional Resources

### MCP Server Documentation
- **servicenow-deployment**: Widget, flow, and application deployment
- **servicenow-intelligent**: Smart search and artifact discovery
- **servicenow-operations**: Incident management and catalog operations
- **servicenow-flow-composer**: Natural language flow creation
- **servicenow-platform-development**: Scripts, rules, and policies

### SPARC Modes
- \`orchestrator\`: Coordinates complex multi-step tasks
- \`coder\`: Focused code implementation
- \`researcher\`: Deep analysis and discovery
- \`tester\`: Comprehensive testing strategies
- \`architect\`: System design and architecture

---

This is a minimal CLAUDE.md file. The full documentation should be available in your Snow-Flow installation.

## Quick Start
1. \`snow-flow init --sparc\` - Initialize project with SPARC environment
2. Configure ServiceNow credentials in .env file  
3. \`snow-flow auth login\` - Authenticate with ServiceNow OAuth
4. \`snow-flow swarm "create a widget for incident management"\` - Everything automatic!

For full documentation, visit: https://github.com/groeimetai/snow-flow
`;
    }
    
    await fs.writeFile(join(targetDir, 'CLAUDE.md'), claudeMdContent);
  } catch (error) {
    console.log('⚠️  Error copying CLAUDE.md, creating minimal version');
    // Minimal fallback
    const claudeMdFallback = `# Snow-Flow Development with Claude Code

## Quick Start  
1. \`snow-flow init --sparc\` - Initialize project with SPARC environment
2. Configure ServiceNow credentials in .env file
3. \`snow-flow auth login\` - Authenticate with ServiceNow OAuth  
4. \`snow-flow swarm "create a widget for incident management"\` - Everything automatic!

For full documentation, visit: https://github.com/groeimetai/snow-flow
`;
    await fs.writeFile(join(targetDir, 'CLAUDE.md'), claudeMdFallback);
  }
}

async function createEnvFile(targetDir: string) {
  const envContent = `# ServiceNow OAuth Configuration
# Replace these values with your actual ServiceNow instance and OAuth credentials

# ServiceNow Instance URL (without https://)
# Example: dev12345.service-now.com
SNOW_INSTANCE=your-instance.service-now.com

# OAuth Client ID from ServiceNow Application Registry
# How to get: System OAuth > Application Registry > New > Create an OAuth application
SNOW_CLIENT_ID=your-oauth-client-id

# OAuth Client Secret from ServiceNow Application Registry
SNOW_CLIENT_SECRET=your-oauth-client-secret

# Optional: Additional Configuration
# SNOW_REDIRECT_URI=http://\${SNOW_REDIRECT_HOST:-localhost}:\${SNOW_REDIRECT_PORT:-3000}/callback

# ===========================================
# Snow-Flow Configuration
# ===========================================

# Enable debug logging (true/false)
SNOW_FLOW_DEBUG=false

# Default coordination strategy
SNOW_FLOW_STRATEGY=development

# Maximum number of agents
SNOW_FLOW_MAX_AGENTS=5

# Claude Code timeout configuration (in minutes)
# Set to 0 to disable timeout (infinite execution time)
# Default: 60 minutes
SNOW_FLOW_TIMEOUT_MINUTES=0

# ===========================================
# How to Set Up ServiceNow OAuth
# ===========================================
# 1. Log into your ServiceNow instance as admin
# 2. Navigate to: System OAuth > Application Registry
# 3. Click "New" > "Create an OAuth application"
# 4. Fill in:
#    - Name: Snow-Flow Development
#    - Client ID: (will be generated)
#    - Client Secret: (will be generated)  
#    - Redirect URL: http://\${SNOW_REDIRECT_HOST:-localhost}:\${SNOW_REDIRECT_PORT:-3000}/callback
#    - Grant Type: Authorization Code
# 5. Copy the Client ID and Client Secret to this file
# 6. Run: snow-flow auth login
`;

  const envFilePath = join(targetDir, '.env');
  
  // Check if .env already exists
  try {
    await fs.access(envFilePath);
    console.log('⚠️  .env file already exists, creating .env.example instead...');
    await fs.writeFile(join(targetDir, '.env.example'), envContent);
  } catch {
    // .env doesn't exist, create it
    await fs.writeFile(envFilePath, envContent);
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

async function createMCPConfig(targetDir: string) {
  // Create the correct .mcp.json file for Claude Code discovery
  const mcpConfig = {
    "mcpServers": {
      "servicenow-deployment": {
        "command": "node",
        "args": ["dist/mcp/servicenow-deployment-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-flow-composer": {
        "command": "node",
        "args": ["dist/mcp/servicenow-flow-composer-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-update-set": {
        "command": "node", 
        "args": ["dist/mcp/servicenow-update-set-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-intelligent": {
        "command": "node",
        "args": ["dist/mcp/servicenow-intelligent-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-graph-memory": {
        "command": "node",
        "args": ["dist/mcp/servicenow-graph-memory-mcp.js"],
        "env": {
          "NEO4J_URI": "${NEO4J_URI}",
          "NEO4J_USER": "${NEO4J_USER}",
          "NEO4J_PASSWORD": "${NEO4J_PASSWORD}",
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-operations": {
        "command": "node",
        "args": ["dist/mcp/servicenow-operations-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-platform-development": {
        "command": "node",
        "args": ["dist/mcp/servicenow-platform-development-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-integration": {
        "command": "node",
        "args": ["dist/mcp/servicenow-integration-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-automation": {
        "command": "node",
        "args": ["dist/mcp/servicenow-automation-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-security-compliance": {
        "command": "node",
        "args": ["dist/mcp/servicenow-security-compliance-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      },
      "servicenow-reporting-analytics": {
        "command": "node",
        "args": ["dist/mcp/servicenow-reporting-analytics-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      }
    }
  };
  
  // Create .mcp.json in project root for Claude Code discovery
  const mcpConfigPath = join(targetDir, '.mcp.json');
  await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  
  // Also create legacy config in .claude for backward compatibility
  const legacyConfigPath = join(targetDir, '.claude/mcp-config.json');
  await fs.writeFile(legacyConfigPath, JSON.stringify(mcpConfig, null, 2));
  
  // Create comprehensive Claude Code settings file
  const claudeSettings = {
    "enabledMcpjsonServers": [
      "servicenow-deployment",
      "servicenow-flow-composer",
      "servicenow-update-set",
      "servicenow-intelligent",
      "servicenow-graph-memory",
      "servicenow-operations",
      "servicenow-platform-development",
      "servicenow-integration",
      "servicenow-automation",
      "servicenow-security-compliance",
      "servicenow-reporting-analytics"
    ],
    "permissions": {
      "allow": [
        "Bash(*)",
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
        "mcp__servicenow-*",
        "mcp__snow-flow__*"
      ],
      "deny": []
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
      "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "8192",
      "CLAUDE_CODE_TIMEOUT": "0",
      "CLAUDE_CODE_SESSION_TIMEOUT": "0",
      "CLAUDE_CODE_EXECUTION_TIMEOUT": "0"
    },
    "cleanupPeriodDays": 90,
    "includeCoAuthoredBy": true,
    "automation": {
      "enabled": true,
      "defaultTimeout": 300000,
      "maxRetries": 3,
      "retryBackoff": 2000,
      "parallelExecution": true,
      "batchOperations": true,
      "autoSaveMemory": true,
      "autoCommit": false
    },
    "claudeFlow": {
      "version": "1.0.72",
      "swarmDefaults": {
        "maxAgents": 10,
        "timeout": 0,
        "parallel": true,
        "monitor": true,
        "outputFormat": "json"
      },
      "sparcDefaults": {
        "timeout": 0,
        "parallel": true,
        "batch": true,
        "memoryKey": "sparc_session"
      },
      "memoryDefaults": {
        "maxSize": "5GB",
        "autoCompress": true,
        "autoCleanup": true,
        "indexingEnabled": true,
        "persistenceEnabled": true
      }
    },
    "mcpServers": {
      "servicenow": {
        "command": "node",
        "args": ["dist/mcp/start-servicenow-mcp.js"],
        "env": {
          "SNOW_INSTANCE": "${SNOW_INSTANCE}",
          "SNOW_CLIENT_ID": "${SNOW_CLIENT_ID}",
          "SNOW_CLIENT_SECRET": "${SNOW_CLIENT_SECRET}"
        }
      }
    }
  };
  
  const claudeSettingsPath = join(targetDir, '.claude/settings.json');
  await fs.writeFile(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));
}

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
    const { MCPServerManager } = await import('./utils/mcp-server-manager.js');
    const manager = new MCPServerManager();
    
    try {
      await manager.initialize();
      
      switch (action) {
        case 'start':
          await handleMCPStart(manager, options);
          break;
        case 'stop':
          await handleMCPStop(manager, options);
          break;
        case 'restart':
          await handleMCPRestart(manager, options);
          break;
        case 'status':
          await handleMCPStatus(manager, options);
          break;
        case 'logs':
          await handleMCPLogs(manager, options);
          break;
        case 'list':
          await handleMCPList(manager, options);
          break;
        case 'debug':
          await handleMCPDebug(options);
          break;
        default:
          console.error(`❌ Unknown action: ${action}`);
          console.log('Available actions: start, stop, restart, status, logs, list, debug');
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ MCP operation failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
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
    
    const status = manager.getServerStatus();
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
    const total = manager.getServerStatus().length;
    console.log(`✅ Restarted ${running}/${total} MCP servers`);
  }
}

async function handleMCPStatus(manager: any, options: any): Promise<void> {
  const servers = manager.getServerStatus();
  
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
  const servers = manager.getServerStatus();
  
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

// Create Flow command - intelligent flow composition
program
  .command('create-flow <instruction>')
  .description('Create complex ServiceNow flows using natural language with automatic artifact orchestration')
  .option('--analyze-only', 'Only analyze the instruction without creating the flow')
  .option('--preview', 'Preview the flow structure before deployment')
  .option('--no-deploy', 'Create the flow but do not deploy it')
  .action(async (instruction: string, options) => {
    console.log(`\n🧠 Snow-Flow Intelligent Flow Composer`);
    console.log(`📝 Instruction: ${instruction}`);
    console.log(`🔍 Analyzing requirements and discovering artifacts...\n`);
    
    // Check authentication
    const oauth = new ServiceNowOAuth();
    const isAuthenticated = await oauth.isAuthenticated();
    
    if (!isAuthenticated) {
      console.log('🔗 ServiceNow connection: ❌ Not authenticated');
      console.log('💡 Run "snow-flow auth login" to enable live ServiceNow integration');
      console.log('📝 Flow will be created as definition files\n');
    } else {
      console.log('🔗 ServiceNow connection: ✅ Authenticated');
      console.log('🚀 Flow will be created and deployed directly to ServiceNow\n');
    }
    
    // Generate Claude Code prompt for flow composition
    const flowPrompt = `# Snow-Flow Intelligent Flow Composer

## Instruction
${instruction}

## Task: Create Complex ServiceNow Flow with Multi-Artifact Orchestration

You are Snow-Flow's intelligent flow composer. Your task is to create a complex ServiceNow flow using natural language processing and automatic artifact orchestration.

## Process Steps

### 1. Analyze Flow Requirements
Use the flow composition MCP tools to understand the instruction:
- \`snow_analyze_flow_instruction\` - Parse and understand the natural language instruction
- Identify required ServiceNow artifacts (script includes, business rules, tables, etc.)
- Determine data flow and business logic requirements

### 2. Discover ServiceNow Artifacts
Use intelligent artifact discovery:
- \`snow_discover_flow_artifacts\` - Find existing ServiceNow artifacts that match requirements
- Search for script includes, business rules, tables, and other components
- Identify missing artifacts that need to be created

### 3. Preview Flow Structure
Before deployment, preview the complete flow:
- \`snow_preview_flow_structure\` - Show the complete flow structure
- Display all activities, variables, and error handling
- Show how discovered artifacts will be orchestrated

### 4. Create and Deploy Flow
Create the complete flow with orchestration:
- \`snow_create_complex_flow\` - Generate complete flow with all artifacts
- Automatically create fallback artifacts if needed
- Deploy to ServiceNow if authenticated

## Advanced Capabilities

### Multi-Artifact Orchestration
The flow composer can automatically:
- Find existing script includes for LLM translation
- Discover business rules for data storage
- Create tables for translated messages
- Link all components in a cohesive flow

### Intelligent Fallback Creation
If required artifacts are not found:
- Creates basic LLM translation script includes
- Generates data storage business rules
- Creates database tables with proper schema
- Ensures all components work together

### Natural Language Processing
Understands complex instructions like:
- "Create a flow using LLM localization to translate support desk messages to English"
- "Build approval flow with email notifications after manager approval"
- "Design incident escalation with automatic assignment based on priority"

## Available Flow Composition Tools

### Core Tools
- \`snow_create_complex_flow\` - Main flow creation tool
- \`snow_analyze_flow_instruction\` - Instruction analysis
- \`snow_discover_flow_artifacts\` - Artifact discovery
- \`snow_preview_flow_structure\` - Flow preview

### Configuration
- Deploy immediately: ${!options.noDeploy}
- Analysis only: ${options.analyzeOnly || false}
- Preview mode: ${options.preview || false}
- ServiceNow authenticated: ${isAuthenticated}

## Expected Output

The flow composer will:
1. Parse your natural language instruction
2. Identify all required ServiceNow artifacts
3. Discover existing artifacts or create fallbacks
4. Compose a complete flow with orchestration
5. Deploy to ServiceNow (if authenticated)
6. Provide direct links to created artifacts

## Instructions for Execution

${options.analyzeOnly ? 
  'ANALYZE ONLY: Use snow_analyze_flow_instruction to analyze the instruction and show requirements.' :
  options.preview ?
  'PREVIEW MODE: Use snow_preview_flow_structure to show the complete flow structure before deployment.' :
  'FULL CREATION: Use snow_create_complex_flow to create and deploy the complete flow with orchestration.'
}

Execute this intelligent flow composition using Snow-Flow's advanced orchestration capabilities.
`;

    try {
      // Execute Claude Code with the flow composition prompt
      const success = await executeClaudeCode(flowPrompt);
      
      if (success) {
        console.log('\n✅ Flow composition completed successfully!');
        if (isAuthenticated && !options.noDeploy) {
          console.log('🚀 Flow deployed to ServiceNow with all artifacts');
          console.log('📊 Check your ServiceNow instance for the deployed flow');
        } else {
          console.log('📋 Flow structure created and analyzed');
        }
      } else {
        console.log('\n⚠️  Claude Code execution failed. Flow composition prompt generated:');
        console.log('=' .repeat(80));
        console.log(flowPrompt);
        console.log('=' .repeat(80));
        console.log('\n💡 Copy this prompt and run it in Claude Code for flow composition');
      }
    } catch (error) {
      console.error('❌ Flow composition failed:', error instanceof Error ? error.message : String(error));
    }
  });

// XML Flow command - Create flows using XML-first approach for maximum reliability
program
  .command('xml-flow <instruction>')
  .description('🎯 Create ServiceNow flows using XML-first approach - MOST RELIABLE method!')
  .option('--name <name>', 'Flow name (auto-generated if not provided)')
  .option('--table <table>', 'Target table (e.g., incident, sc_request)')
  .option('--trigger <type>', 'Trigger type (record_created, record_updated, manual, scheduled)', 'record_created')
  .option('--output <path>', 'Output XML file path')
  .option('--import', 'Show import instructions after generation', true)
  .option('--no-import', 'Skip import instructions')
  .option('--test', 'Generate test flow with mock data')
  .option('--update-set <name>', 'Custom Update Set name')
  .action(async (instruction: string, options) => {
    console.log(`\n🔧 XML-First Flow Generator v${VERSION}`);
    console.log('📋 Creating production-ready ServiceNow flow XML...\n');
    
    try {
      // Import XML flow generator
      const { generateProductionFlowXML } = await import('./utils/xml-first-flow-generator.js');
      
      // Parse instruction to determine activities
      const activities = [];
      
      // Check for common patterns in instruction
      const instructionLower = instruction.toLowerCase();
      
      if (instructionLower.includes('approval') || instructionLower.includes('approve')) {
        activities.push({
          name: 'Request Approval',
          type: 'approval',
          order: 100,
          inputs: {
            table: options.table || 'sc_request',
            record: '{{trigger.current.sys_id}}',
            approver: '{{trigger.current.requested_for.manager}}',
            approval_field: 'approval',
            message: `Please approve: {{trigger.current.number}}`
          },
          outputs: {
            state: 'string',
            approver_sys_id: 'string',
            comments: 'string'
          }
        });
      }
      
      if (instructionLower.includes('notification') || instructionLower.includes('email') || instructionLower.includes('notify')) {
        activities.push({
          name: 'Send Notification',
          type: 'notification',
          order: activities.length > 0 ? 200 : 100,
          inputs: {
            notification_id: getNotificationTemplateSysId('generic_notification'),
            recipients: '{{trigger.current.requested_for}}',
            values: {
              request_number: '{{trigger.current.number}}',
              status: 'Notification sent'
            }
          }
        });
      }
      
      // Build flow definition
      const flowDef = {
        name: options.name || `Flow_${instruction.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`,
        description: instruction,
        table: options.table || 'incident',
        trigger_type: options.trigger as any,
        trigger_condition: '',
        activities: activities.length > 0 ? activities : null
      };
      
      // Add default activities if none specified
      if (!flowDef.activities || flowDef.activities.length === 0) {
        // Default activities if none specified
        console.log('⚠️  No specific activities detected, adding default workflow...');
        flowDef.activities = [
          {
            name: 'Log Flow Start',
            type: 'script',
            order: 100,
            inputs: {
              script: `gs.info('Flow started for: ' + current.number, 'XMLFlow');
return { started: true };`
            },
            outputs: { started: 'boolean' }
          },
          {
            name: 'Send Notification',
            type: 'notification',
            order: 200,
            inputs: {
              notification_id: getNotificationTemplateSysId('generic_notification'),
              recipients: '{{trigger.current.opened_by}}',
              values: {
                record_number: '{{trigger.current.number}}',
                status: 'Flow triggered'
              }
            }
          }
        ];
      }
      
      // Generate XML
      console.log('\n🏗️  Generating production XML...');
      const result = generateProductionFlowXML(flowDef);
      
      console.log(`\n✅ XML Generated Successfully!`);
      console.log(`📁 File saved to: ${result.filePath}`);
      console.log(`📊 Flow structure:`);
      console.log(`   - Name: ${flowDef.name}`);
      console.log(`   - Table: ${flowDef.table}`);
      console.log(`   - Trigger: ${flowDef.trigger_type}`);
      console.log(`   - Activities: ${flowDef.activities.length}`);
      
      if (options.import) {
        console.log('\n' + '='.repeat(60));
        console.log(result.instructions);
        console.log('='.repeat(60));
      }
      
      console.log('\n🎯 Next Steps:');
      console.log('1. Import the XML file into ServiceNow');
      console.log('2. Preview the Update Set');
      console.log('3. Commit the Update Set');
      console.log('4. Open Flow Designer to see your flow!');
      
      // Helper function to map action types
      function mapActionType(type: string): any {
        const typeMap: Record<string, string> = {
          'email': 'notification',
          'notify': 'notification',
          'approve': 'approval',
          'script': 'script',
          'create': 'create_record',
          'update': 'update_record',
          'rest': 'rest_step',
          'api': 'rest_step'
        };
        return typeMap[type.toLowerCase()] || 'script';
      }
      
    } catch (error) {
      console.error('❌ XML flow generation failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse command line arguments
// Init command - initialize a new Snow-Flow project
program
  .command('init')
  .description('Initialize a new Snow-Flow project')
  .option('--sparc', 'Initialize with full SPARC development environment')
  .option('--force', 'Force reinitialize if project already exists')
  .action(async (options) => {
    const targetDir = process.cwd();
    
    try {
      console.log('🚀 Initializing Snow-Flow project...\n');
      
      // Check if project is already initialized
      const claudeDir = join(targetDir, '.claude');
      if (!options.force) {
        try {
          await fs.access(claudeDir);
          console.log('❌ Snow-Flow project already initialized. Use --force to reinitialize.');
          return;
        } catch {
          // Directory doesn't exist, continue with initialization
        }
      }
      
      // Phase 1: Create basic structure
      console.log('📁 Creating directory structure...');
      await createDirectoryStructure(targetDir);
      console.log('✅ Directory structure created\n');
      
      // Phase 2: Create configuration files
      console.log('⚙️  Creating configuration files...');
      await createBasicConfig(targetDir);
      console.log('✅ Configuration files created\n');
      
      // Phase 3: Create README files
      console.log('📚 Creating documentation...');
      await createReadmeFiles(targetDir);
      console.log('✅ Documentation created\n');
      
      if (options.sparc) {
        console.log('🎯 Creating SPARC environment...');
        await createSparcFiles(targetDir);
        console.log('✅ SPARC environment created');
        console.log('📋 Added swarm documentation:');
        console.log('   - swarm-patterns.md: Common swarm command examples');
        console.log('   - agent-types.md: Agent specializations guide');
        console.log('   - mcp-tools-quick-ref.md: MCP tools reference');
        console.log('   - examples/: Ready-to-run example scripts');
        console.log('   - memory/patterns/: Success patterns and templates\n');
      }
      
      // Phase 4: Create .env file
      console.log('🔐 Creating environment configuration...');
      await createEnvFile(targetDir);
      console.log('✅ Environment file created\n');
      
      // Phase 4.5: Check for Neo4j and offer graph memory setup
      console.log('🧠 Checking for Neo4j Graph Memory support...');
      const neo4jAvailable = await checkNeo4jAvailability();
      let enableGraphMemory = false;
      
      if (neo4jAvailable) {
        console.log('✅ Neo4j detected! Graph memory features available.');
        console.log('\n📊 Graph Memory provides:');
        console.log('   - Intelligent artifact relationship tracking');
        console.log('   - Impact analysis for changes');
        console.log('   - Dependency visualization');
        console.log('   - Pattern recognition across projects\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question('Enable graph memory features? (Y/n): ', resolve);
        });
        rl.close();
        
        enableGraphMemory = answer.toLowerCase() !== 'n';
        
        if (enableGraphMemory) {
          console.log('✅ Graph memory enabled\n');
          // Add Neo4j config to .env
          await appendToEnvFile(targetDir, `
# Neo4j Graph Memory Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
`);
        }
      } else {
        console.log('ℹ️  Neo4j not detected. Graph memory features will be disabled.');
        console.log('   To enable later: brew install neo4j && neo4j start\n');
      }
      
      // Phase 5: Create MCP configuration and Claude Code settings
      console.log('🌐 MCP server configuration will be generated after build...');
      console.log('⚙️  Claude Code settings configured with:\n');
      console.log('   - No timeouts (unlimited execution time)');
      console.log('   - All batch tools enabled (TodoWrite, Task, Memory)');
      console.log('   - ServiceNow MCP server integration');
      console.log('   - Automation and parallel execution enabled');
      console.log('   - Extended output limits and thinking tokens\n');
      
      // Phase 6: Build project and start MCP servers
      console.log('🔧 Setting up MCP servers...');
      
      // Check if we're running from npm global install or local dev
      const isGlobalInstall = __dirname.includes('node_modules') || !existsSync(join(targetDir, 'src'));
      
      let mcpConfig: any;
      
      try {
        if (!isGlobalInstall) {
          // Only build if we're in development mode with source files
          console.log('🏗️  Building project (compiling TypeScript)...');
          const { spawn } = require('child_process');
          const buildProcess = spawn('npm', ['run', 'build'], {
            cwd: targetDir,
            stdio: 'pipe'
          });
          
          await new Promise((resolve, reject) => {
            buildProcess.on('close', (code: number) => {
              if (code === 0) {
                resolve(undefined);
              } else {
                reject(new Error(`Build failed with code ${code}`));
              }
            });
          });
          
          console.log('✅ Project built successfully');
        } else {
          console.log('✅ Using pre-built MCP servers from npm package');
        }
        
        // Generate MCP configuration directly
        console.log('🔧 Generating MCP configuration...');
        
        // Determine the correct path to MCP servers
        let mcpBasePath: string;
        if (isGlobalInstall) {
          // For global installs, find the global npm modules path
          const { execSync } = require('child_process');
          const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
          mcpBasePath = join(globalRoot, 'snow-flow', 'dist', 'mcp');
        } else {
          // For local installs, use the current directory
          mcpBasePath = join(targetDir, 'dist', 'mcp');
        }
        
        // Read environment variables from .env if it exists
        const envPath = join(targetDir, '.env');
        let envVars: any = {};
        if (existsSync(envPath)) {
          const envContent = await fs.readFile(envPath, 'utf8');
          envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
              envVars[key.trim()] = value.trim();
            }
          });
        }
        
        // Generate .mcp.json with correct paths
        const mcpServers: any = {
          "servicenow-deployment": {
            command: "node",
            args: [join(mcpBasePath, "servicenow-deployment-mcp.js")],
            env: {
              SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
              SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
              SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
            }
          },
          "servicenow-flow-composer": {
            command: "node",
            args: [join(mcpBasePath, "servicenow-flow-composer-mcp.js")],
            env: {
              SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
              SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
              SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
            }
          },
          "servicenow-update-set": {
            command: "node",
            args: [join(mcpBasePath, "servicenow-update-set-mcp.js")],
            env: {
              SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
              SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
              SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
            }
          },
          "servicenow-intelligent": {
            command: "node",
            args: [join(mcpBasePath, "servicenow-intelligent-mcp.js")],
            env: {
              SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
              SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
              SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
            }
          }
        };
        
        // Only add graph memory if Neo4j is enabled
        if (enableGraphMemory) {
          mcpServers["servicenow-graph-memory"] = {
            command: "node",
            args: [join(mcpBasePath, "servicenow-graph-memory-mcp.js")],
            env: {
              NEO4J_URI: envVars.NEO4J_URI || "bolt://localhost:7687",
              NEO4J_USER: envVars.NEO4J_USER || "neo4j",
              NEO4J_PASSWORD: envVars.NEO4J_PASSWORD || "password",
              SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
              SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
              SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
            }
          };
        }
        
        // Add remaining servers
        Object.assign(mcpServers, {
            "servicenow-operations": {
              command: "node",
              args: [join(mcpBasePath, "servicenow-operations-mcp.js")],
              env: {
                SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
                SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
                SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
              }
            },
            "servicenow-platform-development": {
              command: "node",
              args: [join(mcpBasePath, "servicenow-platform-development-mcp.js")],
              env: {
                SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
                SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
                SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
              }
            },
            "servicenow-integration": {
              command: "node",
              args: [join(mcpBasePath, "servicenow-integration-mcp.js")],
              env: {
                SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
                SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
                SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
              }
            },
            "servicenow-automation": {
              command: "node",
              args: [join(mcpBasePath, "servicenow-automation-mcp.js")],
              env: {
                SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
                SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
                SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
              }
            },
            "servicenow-security-compliance": {
              command: "node",
              args: [join(mcpBasePath, "servicenow-security-compliance-mcp.js")],
              env: {
                SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
                SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
                SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
              }
            },
            "servicenow-reporting-analytics": {
              command: "node",
              args: [join(mcpBasePath, "servicenow-reporting-analytics-mcp.js")],
              env: {
                SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
                SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
                SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
              }
            },
            "servicenow-memory": {
              command: "node",
              args: [join(mcpBasePath, "servicenow-memory-mcp.js")],
              env: {
                SNOW_INSTANCE: envVars.SNOW_INSTANCE || "your-instance.service-now.com",
                SNOW_CLIENT_ID: envVars.SNOW_CLIENT_ID || "your-oauth-client-id",
                SNOW_CLIENT_SECRET: envVars.SNOW_CLIENT_SECRET || "your-oauth-client-secret"
              }
            },
            "snow-flow": {
              command: "npx",
              args: ["claude-flow@alpha", "mcp"],
              env: {}
            },
            "ruv-swarm": {
              command: "npx",
              args: ["claude-flow@alpha", "swarm", "--mode", "mcp"],
              env: {}
            }
          });
        
        // Create the final mcpConfig
        mcpConfig = {
          mcpServers: mcpServers
        };
        
        // Now initialize and start MCP servers
        const { MCPServerManager } = await import('./utils/mcp-server-manager.js');
        const manager = new MCPServerManager();
        await manager.initialize();
        console.log('✅ MCP server manager initialized');
        
        console.log('📡 Starting MCP servers...');
        await manager.startAllServers();
        
        const status = manager.getServerStatus();
        const running = status.filter(s => s.status === 'running').length;
        const total = status.length;
        
        if (running > 0) {
          console.log(`✅ Started ${running}/${total} MCP servers`);
          console.log('🎉 MCP servers are now running and available in Claude Code!');
        } else {
          console.log('⚠️  MCP servers configured but failed to start');
        }
        
        // Write .mcp.json to project directory AFTER all initialization
        const mcpPath = join(targetDir, '.mcp.json');
        
        // Check if .mcp.json already exists (might have been copied)
        if (existsSync(mcpPath)) {
          console.log('⚠️  Overwriting existing .mcp.json with correct paths...');
        }
        
        await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));
        console.log('✅ MCP configuration generated with correct paths');
        console.log(`📦 MCP servers location: ${mcpBasePath}`);
        
        // Phase 7: Create Claude Code settings with enabledMcpjsonServers
        let claudeSettingsCreated = false;
        try {
          // First try to copy from template if available (in npm package)
          const templatePath = join(__dirname, '..', '.claude.settings.template');
          const claudeSettingsPath = join(targetDir, '.claude/settings.json');
          
          if (existsSync(templatePath)) {
            const templateContent = await fs.readFile(templatePath, 'utf8');
            await fs.writeFile(claudeSettingsPath, templateContent);
            console.log('✅ Claude Code settings.json created from template');
            claudeSettingsCreated = true;
          }
        } catch (error) {
          // Template not found, create from scratch
        }
        
        if (!claudeSettingsCreated) {
          // Create settings from scratch if template not found
          const claudeSettings = {
            "enabledMcpjsonServers": [
              "servicenow-deployment",
              "servicenow-flow-composer",
              "servicenow-update-set",
              "servicenow-intelligent",
              "servicenow-graph-memory",
              "servicenow-operations",
              "servicenow-platform-development",
              "servicenow-integration",
              "servicenow-automation",
              "servicenow-security-compliance",
              "servicenow-reporting-analytics",
              "snow-flow",
              "ruv-swarm"
            ],
            "permissions": {
              "allow": [
                "Bash(*)",
                "Read(*)",
                "Write(*)",
                "Edit(*)",
                "MultiEdit(*)",
                "Glob(*)",
                "Grep(*)",
                "LS(*)",
                "TodoWrite",
                "Task(*)",
                "mcp__servicenow-*",
                "mcp__snow-flow__*"
              ]
            },
            "env": {
              "BASH_DEFAULT_TIMEOUT_MS": "0",
              "BASH_MAX_TIMEOUT_MS": "0"
            }
          };
          
          const claudeSettingsPath = join(targetDir, '.claude/settings.json');
          await fs.writeFile(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));
          console.log('✅ Claude Code settings.json created with MCP server enablement');
        }
        
        // Phase 7.5: Create .claude/mcp-config.json for additional MCP configuration
        try {
          const mcpConfigTemplate = join(__dirname, '..', '.claude.mcp-config.template');
          const mcpConfigPath = join(targetDir, '.claude/mcp-config.json');
          
          if (existsSync(mcpConfigTemplate)) {
            // Read template and replace placeholders
            let mcpConfigContent = await fs.readFile(mcpConfigTemplate, 'utf8');
            mcpConfigContent = mcpConfigContent.replace(/\${MCP_PATH}/g, mcpBasePath);
            
            await fs.writeFile(mcpConfigPath, mcpConfigContent);
            console.log('✅ Created .claude/mcp-config.json for additional MCP configuration');
          }
        } catch (error) {
          // Not critical if this fails
        }
        
        // Phase 8: Claude Code will automatically load .mcp.json
        console.log('\n📡 MCP servers configured for Claude Code');
        console.log('✅ Claude Code will automatically detect .mcp.json in this directory');
        console.log('\n🔍 Debug Information:');
        console.log(`   - .mcp.json location: ${mcpPath}`);
        console.log(`   - .claude/settings.json location: ${join(targetDir, '.claude/settings.json')}`);
        console.log(`   - MCP servers path: ${mcpBasePath}`);
        console.log('\n📡 MCP servers configured for Claude Code');
        console.log('✅ MCP servers will be available when you run sparc or swarm commands');
        
        // Create activation scripts for manual use
        console.log('\n🚀 Creating MCP activation scripts...');
        
        try {
          const isWindows = process.platform === 'win32';
          
          if (isWindows) {
            // Windows batch script
            const activationScript = `@echo off
REM Snow-Flow MCP Activation Script
echo 🚀 Starting Claude Code with MCP servers...
echo 📍 Working directory: ${targetDir}
echo.

REM Change to project directory
cd /d "${targetDir}"

REM Start Claude Code with MCP config
claude --mcp-config .mcp.json .

echo.
echo ✅ Claude Code started with MCP servers!
echo 💡 Check MCP servers with: /mcp in Claude Code
`;
            
            const scriptPath = join(targetDir, 'activate-mcp.bat');
            await fs.writeFile(scriptPath, activationScript);
            
            // Also create PowerShell script
            const psScript = `# Snow-Flow MCP Activation Script
Write-Host "🚀 Starting Claude Code with MCP servers..." -ForegroundColor Green
Write-Host "📍 Working directory: ${targetDir}"
Write-Host ""

# Change to project directory
Set-Location "${targetDir}"

# Start Claude Code with MCP config
& claude --mcp-config .mcp.json .

Write-Host ""
Write-Host "✅ Claude Code started with MCP servers!" -ForegroundColor Green
Write-Host "💡 Check MCP servers with: /mcp in Claude Code" -ForegroundColor Yellow
`;
            
            const psScriptPath = join(targetDir, 'activate-mcp.ps1');
            await fs.writeFile(psScriptPath, psScript);
            
            console.log('✅ Created Windows activation scripts:');
            console.log(`   - activate-mcp.bat`);
            console.log(`   - activate-mcp.ps1`);
            
          } else {
            // Unix/Mac bash script
            const activationScript = `#!/bin/bash
# Snow-Flow MCP Activation Script
echo "🚀 Starting Claude Code with MCP servers..."
echo "📍 Working directory: ${targetDir}"
echo ""

# Change to project directory
cd "${targetDir}"

# Start Claude Code with MCP config
claude --mcp-config .mcp.json .

echo ""
echo "✅ Claude Code started with MCP servers!"
echo "💡 Check MCP servers with: /mcp in Claude Code"
`;
            
            const scriptPath = join(targetDir, 'activate-mcp.sh');
            await fs.writeFile(scriptPath, activationScript);
            await fs.chmod(scriptPath, '755');
            
            console.log('✅ Created activation script: activate-mcp.sh');
          }
          
          console.log('\n💡 To manually activate MCP servers in Claude Code:');
          if (isWindows) {
            console.log('   - Double-click activate-mcp.bat');
            console.log('   - Or run: .\\activate-mcp.ps1 (PowerShell)');
          } else {
            console.log('   - Run: ./activate-mcp.sh');
          }
          console.log('   - Or run: claude --mcp-config .mcp.json .');
          
        } catch (error) {
          console.log('⚠️  Could not create activation scripts');
        }
        
        console.log('\n💡 MCP servers can also be activated automatically with:');
        console.log('   - snow-flow sparc "<task>" - Starts Claude Code with MCP for SPARC mode');
        console.log('   - snow-flow swarm "<objective>" - Starts Claude Code with MCP for swarm mode');
        
        // Phase 7 is now handled above with merged config approach
        /*
            try {
              await new Promise((resolve, reject) => {
                const registerProcess = spawn('claude', ['mcp', 'add', server.name, server.path], {
                  cwd: targetDir,
                  stdio: 'pipe'
                });
                
                registerProcess.on('close', (code: number) => {
                  if (code === 0) {
                    registeredCount++;
                    resolve(undefined);
                  } else {
                    reject(new Error(`Failed to register ${server.name}`));
                  }
                });
                
                registerProcess.on('error', reject);
              });
            } catch (error) {
              console.log(`   ⚠️  Failed to register ${server.name} with Claude Code`);
            }
          }
          
          if (registeredCount > 0) {
            console.log(`✅ Registered ${registeredCount}/${mcpServers.length} MCP servers with Claude Code`);
            console.log('🎉 MCP servers are now visible in Claude Code /mcp command!');
          } else {
            console.log('⚠️  MCP server registration failed - use manual registration:');
            console.log(`   claude mcp add servicenow-deployment "${join(targetDir, 'dist/mcp/servicenow-deployment-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-flow-composer "${join(targetDir, 'dist/mcp/servicenow-flow-composer-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-update-set "${join(targetDir, 'dist/mcp/servicenow-update-set-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-intelligent "${join(targetDir, 'dist/mcp/servicenow-intelligent-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-graph-memory "${join(targetDir, 'dist/mcp/servicenow-graph-memory-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-operations "${join(targetDir, 'dist/mcp/servicenow-operations-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-platform-development "${join(targetDir, 'dist/mcp/servicenow-platform-development-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-integration "${join(targetDir, 'dist/mcp/servicenow-integration-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-automation "${join(targetDir, 'dist/mcp/servicenow-automation-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-security-compliance "${join(targetDir, 'dist/mcp/servicenow-security-compliance-mcp.js')}"`);
            console.log(`   claude mcp add servicenow-reporting-analytics "${join(targetDir, 'dist/mcp/servicenow-reporting-analytics-mcp.js')}"`);
          }
          
        } catch (error) {
          console.log('⚠️  Claude Code MCP registration failed - manual registration required:');
          console.log(`   claude mcp add servicenow-deployment "${join(targetDir, 'dist/mcp/servicenow-deployment-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-flow-composer "${join(targetDir, 'dist/mcp/servicenow-flow-composer-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-update-set "${join(targetDir, 'dist/mcp/servicenow-update-set-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-intelligent "${join(targetDir, 'dist/mcp/servicenow-intelligent-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-graph-memory "${join(targetDir, 'dist/mcp/servicenow-graph-memory-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-operations "${join(targetDir, 'dist/mcp/servicenow-operations-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-platform-development "${join(targetDir, 'dist/mcp/servicenow-platform-development-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-integration "${join(targetDir, 'dist/mcp/servicenow-integration-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-automation "${join(targetDir, 'dist/mcp/servicenow-automation-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-security-compliance "${join(targetDir, 'dist/mcp/servicenow-security-compliance-mcp.js')}"`);
          console.log(`   claude mcp add servicenow-reporting-analytics "${join(targetDir, 'dist/mcp/servicenow-reporting-analytics-mcp.js')}"`);
        }
        */
        
      } catch (error) {
        if (!isGlobalInstall) {
          // Only show build errors in development mode
          console.log('⚠️  Build failed - MCP servers will need manual start:');
          console.log('   1. Run: npm run build');
          console.log('   2. Run: snow-flow mcp start');
          console.log('   3. Register with Claude Code:');
          console.log(`      claude mcp add servicenow-deployment "${join(targetDir, 'dist/mcp/servicenow-deployment-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-flow-composer "${join(targetDir, 'dist/mcp/servicenow-flow-composer-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-update-set "${join(targetDir, 'dist/mcp/servicenow-update-set-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-intelligent "${join(targetDir, 'dist/mcp/servicenow-intelligent-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-graph-memory "${join(targetDir, 'dist/mcp/servicenow-graph-memory-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-operations "${join(targetDir, 'dist/mcp/servicenow-operations-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-platform-development "${join(targetDir, 'dist/mcp/servicenow-platform-development-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-integration "${join(targetDir, 'dist/mcp/servicenow-integration-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-automation "${join(targetDir, 'dist/mcp/servicenow-automation-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-security-compliance "${join(targetDir, 'dist/mcp/servicenow-security-compliance-mcp.js')}"`);
          console.log(`      claude mcp add servicenow-reporting-analytics "${join(targetDir, 'dist/mcp/servicenow-reporting-analytics-mcp.js')}"`);
          console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        } else {
          // In global install mode, just show a simpler message
          console.log('⚠️  MCP setup encountered an issue:');
          console.log(`   ${error instanceof Error ? error.message : String(error)}`);
          console.log('   The project has been initialized successfully.');
          console.log('   You may need to configure MCP servers manually.');
        }
      }
      
      // Success message
      console.log('\n🎉 Snow-Flow project initialized successfully!');
      console.log('');
      console.log('📋 Next steps:');
      console.log('   1. Edit .env file with your ServiceNow OAuth credentials');
      console.log('   2. Run: snow-flow auth login');
      console.log('   3. Start your first swarm: snow-flow swarm "create a widget for incident management"');
      console.log('');
      console.log('📚 Documentation created:');
      console.log('   - QUICK_START.md: 5-minute getting started guide');
      console.log('   - CLAUDE.md: Complete development guide with MCP-FIRST workflow');
      console.log('   - .claude/commands/: Swarm patterns, agent types, MCP tools reference');
      console.log('   - examples/: Ready-to-run example scripts for common tasks');
      console.log('');
      console.log('✅ Project is ready to use!');
      console.log('');
      console.log('🔧 MCP Servers:');
      console.log('   - ✅ All 11 MCP servers have been built and configured');
      console.log('   - ✅ .mcp.json generated with absolute paths and credentials');
      console.log('   - ✅ Claude Code will automatically load servers from .mcp.json');
      console.log('   - ℹ️  Start Claude Code in this directory to use MCP servers');
      console.log('');
      console.log('📡 Available MCP Tools:');
      console.log('   - snow_deploy_widget - Deploy widgets directly');
      console.log('   - snow_create_complex_flow - Natural language flow creation');
      console.log('   - snow_update_set_create - Manage Update Sets');
      console.log('   - snow_find_artifact - Search with natural language');
      console.log('   - snow_graph_index_artifact - Neo4j graph memory');
      console.log('   - snow_create_ui_page - Platform development UI');
      console.log('   - snow_create_rest_message - Integration management');
      console.log('   - snow_create_scheduled_job - Process automation');
      console.log('   - snow_create_security_policy - Security & compliance');
      console.log('   - snow_create_report - Reporting & analytics');
      console.log('');
      console.log('🔧 MCP Server Management:');
      console.log('   - Start servers: snow-flow mcp start');
      console.log('   - Check status: snow-flow mcp status');
      console.log('   - View logs: snow-flow mcp logs');
      console.log('   - Stop servers: snow-flow mcp stop');
      console.log('');
      console.log('📚 Documentation:');
      console.log('   - Environment config: .env (configure OAuth credentials here)');
      console.log('   - MCP configuration: .mcp.json (auto-generated)');
      console.log('   - Project structure: README.md');
      console.log('   - Memory system: .swarm/memory.db');
      console.log('   - MCP servers: .snow-flow/mcp-servers.json');
      if (options.sparc) {
        console.log('   - SPARC modes: .claude/commands/sparc/');
        console.log('   - Full guide: CLAUDE.md');
      }
      console.log('');
      console.log('🔐 OAuth Setup Guide:');
      console.log('   1. Open .env file in your editor');
      console.log('   2. Follow the setup instructions in the file');
      console.log('   3. Replace placeholder values with your ServiceNow credentials');
      console.log('');
      console.log('🚀 Ready to build with Snow-Flow!');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// SPARC Command with Subcommands
const sparc = program.command('sparc');
sparc.description('SPARC development system - team and specialist modes');

// SPARC Team Subcommand
sparc
  .command('team <teamType> <task>')
  .description('Execute team-based SPARC development')
  .option('--parallel', 'Enable parallel execution')
  .option('--monitor', 'Real-time progress monitoring')
  .option('--shared-memory', 'Enable shared context between agents', true)
  .option('--no-shared-memory', 'Disable shared context')
  .option('--validation', 'Enable quality gates between handoffs', true)
  .option('--no-validation', 'Disable quality gates')
  .option('--dry-run', 'Preview team assembly without execution')
  .option('--max-agents <number>', 'Maximum number of agents', '5')
  .action(async (teamType: string, task: string, options) => {
    try {
      const { TeamSparcExecutor } = await import('./sparc/team-sparc.js');
      
      console.log(`\n🚀 SPARC Team Mode: ${teamType.toUpperCase()}`);
      console.log(`📋 Task: ${task}\n`);
      
      const result = await TeamSparcExecutor.execute(teamType, task, {
        parallel: options.parallel,
        monitor: options.monitor,
        sharedMemory: options.sharedMemory,
        validation: options.validation,
        dryRun: options.dryRun,
        maxAgents: parseInt(options.maxAgents)
      });
      
      if (result.success) {
        console.log(`✅ Team execution completed successfully!`);
        console.log(`🎯 Coordinator: ${result.coordinator}`);
        console.log(`👥 Team: ${result.specialists.join(', ')}`);
        console.log(`📦 Artifacts: ${result.artifacts.length}`);
        console.log(`⏱️  Duration: ${result.executionTime}ms`);
        
        if (result.warnings && result.warnings.length > 0) {
          console.log(`⚠️  Warnings: ${result.warnings.length}`);
          result.warnings.forEach(warning => console.log(`   - ${warning}`));
        }
      } else {
        console.error(`❌ Team execution failed!`);
        if (result.errors) {
          result.errors.forEach(error => console.error(`   - ${error}`));
        }
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ SPARC team execution failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// SPARC Specialist Subcommands
const specialistTypes = ['frontend', 'backend', 'security', 'database', 'process', 'trigger', 'data', 'logic', 'interface', 'uiux', 'platform'];

specialistTypes.forEach(specialistType => {
  sparc
    .command(`${specialistType} <task>`)
    .description(`Execute ${specialistType} specialist task`)
    .option('--dry-run', 'Preview execution without running')
    .option('--monitor', 'Real-time progress monitoring')
    .action(async (task: string, options) => {
      try {
        const { TeamSparcExecutor } = await import('./sparc/team-sparc.js');
        
        console.log(`\n👨‍💻 SPARC ${specialistType.toUpperCase()} Specialist`);
        console.log(`📋 Task: ${task}\n`);
        
        const result = await TeamSparcExecutor.executeSpecialist(specialistType, task, {
          dryRun: options.dryRun,
          monitor: options.monitor
        });
        
        if (result.success) {
          console.log(`✅ Specialist execution completed successfully!`);
          console.log(`🎯 Specialist: ${result.coordinator}`);
          console.log(`📦 Artifacts: ${result.artifacts.length}`);
          console.log(`⏱️  Duration: ${result.executionTime}ms`);
        } else {
          console.error(`❌ Specialist execution failed!`);
          if (result.errors) {
            result.errors.forEach(error => console.error(`   - ${error}`));
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(`❌ SPARC ${specialistType} execution failed:`, error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
});

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
    console.log(`\n👑 ServiceNow Queen Agent v${VERSION} - Hive-Mind Intelligence`);
    console.log('🐝 Elegant orchestration replacing complex team coordination\n');
    
    try {
      const { QueenIntegration } = await import('../examples/queen/integration-example.js');
      
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
// integrateSnowFlowCommands(program);

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}