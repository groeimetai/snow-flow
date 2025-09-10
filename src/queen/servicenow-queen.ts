/**
 * ServiceNow Queen Agent
 * Central coordination point for the ServiceNow hive-mind
 */

import { ServiceNowTask, TaskAnalysis, Agent, AgentType } from './types';
import { QueenMemorySystem } from './queen-memory';
import { NeuralLearning } from './neural-learning';
import { AgentFactory } from './agent-factory';
import { MCPExecutionBridge, AgentRecommendation } from './mcp-execution-bridge';
import { QUEEN_KNOWLEDGE_BASE, determineOptimalApproach } from './queen-knowledge-base';
import { ServicePortalThemeManager } from '../utils/theme-manager';
import { DependencyDetector } from '../utils/dependency-detector';
// Gap Analysis Engine removed - using direct MCP approach
import { Logger } from '../utils/logger';
import * as crypto from 'crypto';

export interface QueenConfig {
  memoryPath?: string;
  maxConcurrentAgents?: number;
  learningRate?: number;
  debugMode?: boolean;
  autoPermissions?: boolean;
}

export class ServiceNowQueen {
  private memory: QueenMemorySystem;
  private neuralLearning: NeuralLearning;
  private agentFactory: AgentFactory;
  private mcpBridge: MCPExecutionBridge;
  // Gap analysis integrated directly into MCP execution
  private activeTasks: Map<string, ServiceNowTask>;
  private config: Required<QueenConfig>;
  private logger: Logger;

  constructor(config: QueenConfig = {}) {
    this.config = {
      memoryPath: config.memoryPath,
      maxConcurrentAgents: config.maxConcurrentAgents || 5,
      learningRate: config.learningRate || 0.1,
      debugMode: config.debugMode || false,
      autoPermissions: config.autoPermissions || false
    };

    // Initialize logger
    this.logger = new Logger('ServiceNowQueen');

    // Initialize hive-mind components
    this.memory = new QueenMemorySystem(this.config.memoryPath);
    this.neuralLearning = new NeuralLearning(this.memory);
    this.agentFactory = new AgentFactory(this.memory);
    this.mcpBridge = new MCPExecutionBridge(this.memory);
    // Gap analysis integrated directly into MCP workflow
    this.activeTasks = new Map();

    if (this.config.debugMode) {
      this.logger.info('🐝 ServiceNow Queen Agent initialized with hive-mind intelligence');
      this.logger.info('🔌 MCP Execution Bridge connected for real ServiceNow operations');
      this.logger.info('🧠 ServiceNow integration engine ready for MCP operations');
    }
  }

  /**
   * Main entry point: Execute ServiceNow objective with STRATEGIC ORCHESTRATION
   * 
   * This is where the Queen Agent demonstrates true helicopter-view thinking:
   * - Deep problem analysis beyond surface requirements
   * - Strategic risk assessment and mitigation planning  
   * - Holistic solution architecture considering all stakeholders
   * - Proactive bottleneck identification and resolution
   * - Comprehensive orchestration of specialized agents
   */
  async executeObjective(objective: string): Promise<any> {
    const taskId = this.generateTaskId();
    const startTime = Date.now();

    try {
      // 🧠 STRATEGIC PHASE 1: DEEP PROBLEM ANALYSIS
      this.logger.info(`👑 QUEEN STRATEGIC ANALYSIS INITIATED`);
      this.logger.info(`🎯 Objective: ${objective}`);
      this.logger.info(`🧠 Analyzing: What is the REAL problem we're solving here?`);
      
      // Analyze what the user ACTUALLY needs vs what they asked for
      const problemAnalysis = await this.performDeepProblemAnalysis(objective);
      this.logger.info(`📊 Problem Complexity: ${problemAnalysis.complexity} | Business Impact: ${problemAnalysis.businessImpact}`);
      this.logger.info(`🎯 Core Problem: ${problemAnalysis.coreProblem}`);
      this.logger.info(`👥 Stakeholders: ${problemAnalysis.stakeholders.join(', ')}`);
      
      // 🧠 STRATEGIC PHASE 2: RISK & CONSTRAINT ASSESSMENT  
      this.logger.info(`🔍 STRATEGIC RISK ASSESSMENT`);
      const riskAssessment = await this.performRiskAssessment(objective, problemAnalysis);
      this.logger.info(`⚠️ Risk Level: ${riskAssessment.overallRisk} | Critical Risks: ${riskAssessment.criticalRisks.length}`);
      
      if (riskAssessment.criticalRisks.length > 0) {
        this.logger.info(`🚨 CRITICAL RISKS IDENTIFIED:`);
        riskAssessment.criticalRisks.forEach(risk => {
          this.logger.info(`  • ${risk.description} (Impact: ${risk.impact}, Likelihood: ${risk.likelihood})`);
        });
      }

      if (this.config.debugMode) {
        this.logger.info(`🎯 Queen analyzing objective: ${objective}`);
        this.logger.info(`🚨 ENFORCING MCP-FIRST WORKFLOW`);
      }

      // 🚨 PHASE 1: MANDATORY MCP PRE-FLIGHT AUTHENTICATION CHECK
      this.logger.info('🔐 Step 1: Validating ServiceNow connection...');
      const authCheck = await this.mcpBridge.executeAgentRecommendation(
        { id: 'queen-agent', type: 'queen' },
        {
          agentId: 'queen-agent',
          agentType: 'queen',
          action: 'validate-connection',
          tool: 'snow_validate_live_connection',
          server: 'operations',
          params: { test_level: 'permissions' },
          reasoning: 'MANDATORY: Pre-flight authentication check before any ServiceNow operations',
          confidence: 0.95
        }
      );

      if (!authCheck.success) {
        const authError = `
🚨 ServiceNow Authentication Failed: ${authCheck.error}

🔧 Fix this now:
1. Run: snow-flow auth login
2. Check .env: SNOW_INSTANCE, SNOW_CLIENT_ID, SNOW_CLIENT_SECRET  
3. Test: snow_auth_diagnostics()

❌ Cannot proceed with Queen Agent operations until authentication works!
        `;
        this.logger.error('Authentication failed:', authError);
        throw new Error(authError);
      }

      this.logger.info('✅ ServiceNow authentication validated');

      // 🚨 PHASE 2: MANDATORY SMART DISCOVERY (Prevent Duplication)
      this.logger.info('🔍 Step 2: Discovering existing artifacts...');
      const discovery = await this.mcpBridge.executeAgentRecommendation(
        { id: 'queen-agent', type: 'queen' },
        {
          agentId: 'queen-agent',
          agentType: 'queen',
          action: 'discover-artifacts',
          tool: 'snow_comprehensive_search',
          server: 'intelligent',
          params: { 
            query: objective,
            include_inactive: false 
          },
          reasoning: 'MANDATORY: Check for existing artifacts before creating new ones',
          confidence: 0.90
        }
      );

      if (discovery.success && discovery.toolResult?.found?.length > 0) {
        this.logger.info(`🔍 Found ${discovery.toolResult.found.length} existing artifacts that might be relevant:`);
        discovery.toolResult.found.forEach((artifact: any) => {
          this.logger.info(`💡 Consider reusing: ${artifact.name} (${artifact.sys_id})`);
        });
      }

      // Phase 3: Initial Neural Analysis (informed by MCP discovery)
      const _analysis = this.neuralLearning.analyzeTask(objective);
      
      // Phase 4: Create and register task
      const task: ServiceNowTask = {
        id: taskId,
        objective,
        type: _analysis.type,
        artifacts: [],
        status: 'analyzing'
      };
      this.activeTasks.set(taskId, task);

      // 🧠 PHASE 5: STRATEGIC SOLUTION ARCHITECTURE
      this.logger.info(`🧠 Strategic Solution Architecture based on analysis...`);
      this.logger.info(`🎯 Mitigation Strategies: ${riskAssessment.mitigationStrategies.join(', ')}`);
      
      // Strategic solution design based on deep analysis
      const solutionArchitecture = await this.designSolutionArchitecture(problemAnalysis, riskAssessment);
      this.logger.info(`🏗️ Solution Architecture: ${solutionArchitecture.approach}`);
      this.logger.info(`👥 Recommended Team: ${solutionArchitecture.recommendedAgents.join(', ')}`);
      
      // Store strategic analysis in task
      (task as any).strategicAnalysis = {
        problemAnalysis,
        riskAssessment,
        solutionArchitecture
      };

      // Phase 6: Spawn optimal agent swarm
      const agents = this.spawnOptimalSwarm(task, _analysis);
      
      // Phase 7: Execute coordinated deployment
      task.status = 'executing';
      const result = await this.coordinateExecution(task, agents, _analysis);
      
      // Phase 8: Learn from execution
      const duration = Date.now() - startTime;
      this.learnFromExecution(task, agents, result, duration, null);
      
      task.status = 'completed';
      task.result = result;

      if (this.config.debugMode) {
        this.logger.info(`✅ Queen completed objective in ${duration}ms`);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.handleExecutionFailure(taskId, objective, error as Error, duration);
      throw error;
    } finally {
      this.cleanupTask(taskId);
    }
  }

  private spawnOptimalSwarm(task: ServiceNowTask, _analysis: TaskAnalysis): Agent[] {
    if (this.config.debugMode) {
      this.logger.info(`🐛 Spawning swarm for ${task.type} task (complexity: ${_analysis.estimatedComplexity})`);
    }

    // Use learned patterns or optimal sequence
    const agentTypes = _analysis.suggestedPattern?.agentSequence || 
                      this.agentFactory.getOptimalAgentSequence(task.type, _analysis.estimatedComplexity);
    
    // Spawn agent swarm
    const agents = this.agentFactory.spawnAgentSwarm(agentTypes, task.id);
    
    if (this.config.debugMode) {
      this.logger.info(`👥 Spawned ${agents.length} agents: ${agents.map(a => a.type).join(', ')}`);
    }

    return agents;
  }

  private async coordinateExecution(task: ServiceNowTask, agents: Agent[], _analysis: TaskAnalysis): Promise<any> {
    const results: any[] = [];
    
    try {
      // Execute agents in optimal sequence
      if (this.shouldExecuteInParallel(agents)) {
        results.push(...await this.executeAgentsInParallel(agents, task.objective));
      } else {
        results.push(...await this.executeAgentsSequentially(agents, task.objective));
      }

      // Coordinate final deployment using MCP tools
      const deploymentResult = await this.executeFinalDeployment(task, results, _analysis);
      
      return {
        taskId: task.id,
        objective: task.objective,
        agentResults: results,
        deploymentResult,
        artifacts: task.artifacts
      };

    } catch (error) {
      // Attempt recovery or fallback
      return await this.attemptRecovery(task, agents, error as Error);
    }
  }

  private shouldExecuteInParallel(agents: Agent[]): boolean {
    // Parallel execution for independent agents
    const independentAgents = ['researcher', 'tester', 'script-writer'];
    return agents.some(agent => independentAgents.includes(agent.type));
  }

  private async executeAgentsInParallel(agents: Agent[], objective: string): Promise<any[]> {
    if (this.config.debugMode) {
      this.logger.info('⚡ Executing agents in parallel');
    }

    const promises = agents.map(agent => 
      this.agentFactory.executeAgentTask(agent.id, objective)
    );
    
    return await Promise.all(promises);
  }

  private async executeAgentsSequentially(agents: Agent[], objective: string): Promise<any[]> {
    if (this.config.debugMode) {
      this.logger.info('🔄 Executing agents sequentially');
    }

    const results: any[] = [];
    
    for (const agent of agents) {
      const result = await this.agentFactory.executeAgentTask(agent.id, objective);
      results.push(result);
      
      // Allow agents to coordinate between executions
      this.facilitateAgentCoordination(agent, results);
    }
    
    return results;
  }

  private facilitateAgentCoordination(currentAgent: Agent, previousResults: any[]): void {
    // Send relevant results to collaborative agents
    const activeAgents = this.agentFactory.getActiveAgents();
    
    for (const agent of activeAgents) {
      if (agent.id !== currentAgent.id) {
        this.agentFactory.sendAgentMessage(
          currentAgent.id,
          agent.id,
          'result',
          { 
            results: previousResults.slice(-1)[0], // Latest result
            fromAgent: currentAgent.type 
          }
        );
      }
    }
  }

  private async executeFinalDeployment(task: ServiceNowTask, agentResults: any[], _analysis: TaskAnalysis): Promise<any> {
    if (this.config.debugMode) {
      this.logger.info('🚀 Executing final deployment with MCP tools');
    }

    // The Queen coordinates the actual MCP tool calls based on agent recommendations
    const deploymentPlan = this.createDeploymentPlan(task, agentResults, _analysis);
    
    try {
      // Execute deployment using the unified deployment API
      const deploymentResult = await this.executeDeploymentPlan(deploymentPlan);
      
      // Track artifacts created
      if (deploymentResult.sys_id) {
        task.artifacts.push(deploymentResult.sys_id);
        
        // Store artifact in memory for future reference
        this.memory.storeArtifact({
          type: task.type as any,
          name: deploymentResult.name || task.objective,
          sys_id: deploymentResult.sys_id,
          config: deploymentResult.config || {},
          dependencies: _analysis.dependencies
        });
      }

      return deploymentResult;

    } catch (error) {
      if (this.config.debugMode) {
        console.error('❌ Deployment failed:', error);
      }
      throw error;
    }
  }

  private createDeploymentPlan(task: ServiceNowTask, agentResults: any[], _analysis: TaskAnalysis): any {
    // Determine optimal approach based on knowledge base
    const hasExistingArtifact = task.objective.toLowerCase().includes('update') || 
                               task.objective.toLowerCase().includes('edit') ||
                               task.objective.toLowerCase().includes('modify') ||
                               task.objective.toLowerCase().includes('change');
    
    const requiresRefactoring = task.objective.toLowerCase().includes('refactor') ||
                               task.objective.toLowerCase().includes('rename') ||
                               task.objective.toLowerCase().includes('reorganize');
    
    const userMentionedModifications = task.objective.toLowerCase().includes('i modified') ||
                                      task.objective.toLowerCase().includes('i changed') ||
                                      task.objective.toLowerCase().includes('i updated') ||
                                      task.objective.toLowerCase().includes('aangepast') ||
                                      task.objective.toLowerCase().includes('zelf');
    
    const approach = determineOptimalApproach(
      task.objective,
      task.type,
      {
        hasExistingArtifact,
        complexity: _analysis.estimatedComplexity > 7 ? 'high' : 
                   _analysis.estimatedComplexity > 4 ? 'medium' : 'low',
        requiresRefactoring,
        userMentionedModifications
      }
    );
    
    if (this.config.debugMode) {
      this.logger.info(`🎨 Optimal approach: ${approach}`);
      this.logger.info(`🔍 Artifact sync available: ${QUEEN_KNOWLEDGE_BASE.artifactCapabilities[this.getTableForType(task.type)]?.localSync}`);
    }
    
    // If local sync is optimal and available
    if (approach === 'Local Sync Development' && hasExistingArtifact) {
      const table = this.getTableForType(task.type);
      if (QUEEN_KNOWLEDGE_BASE.artifactCapabilities[table]?.localSync) {
        return {
          type: 'local-sync',
          approach: approach,
          mcpTool: 'snow_pull_artifact',
          workflow: QUEEN_KNOWLEDGE_BASE.developmentPatterns.widgetDevelopment.approaches[0].workflow,
          config: {
            table: table,
            sys_id: this.extractSysIdFromObjective(task.objective)
          }
        };
      }
    }
    
    // Extract deployment instructions from agent results
    const widgetCreator = agentResults.find(r => r.agentType === 'widget-creator');
    const flowBuilder = agentResults.find(r => r.agentType === 'flow-builder');
    const scriptWriter = agentResults.find(r => r.agentType === 'script-writer');
    const catalogManager = agentResults.find(r => r.agentType === 'catalog-manager');

    if (task.type === 'widget' && widgetCreator) {
      return {
        type: 'widget',
        mcpTool: 'snow_deploy',
        config: this.extractWidgetConfig(task.objective, agentResults),
        autoPermissions: this.config.autoPermissions // Pass auto-permissions flag for dependency handling
      };
    }

    // Flow creation is no longer supported - use ServiceNow Flow Designer directly
    if (task.type === 'flow') {
      throw new Error('Flow creation is no longer supported in Snow-Flow. Please use ServiceNow Flow Designer directly.');
    }

    if (task.type === 'script' && scriptWriter) {
      return {
        type: 'script',
        mcpTool: 'snow_create_script_include',
        config: this.extractScriptConfig(task.objective, agentResults)
      };
    }

    // Default deployment plan
    return {
      type: task.type,
      mcpTool: 'snow_deploy',
      instruction: task.objective
    };
  }

  private extractWidgetConfig(objective: string, agentResults: any[]): any {
    // Extract widget configuration from agent results
    const widgetResult = agentResults.find(r => r.agentType === 'widget-creator');
    
    return {
      name: this.generateArtifactName(objective, 'widget'),
      title: this.generateArtifactTitle(objective),
      template: this.generateWidgetTemplate(objective),
      css: this.generateWidgetCss(objective),
      client_script: this.generateClientScript(objective),
      script: this.generateServerScript(objective), // ServiceNow uses 'script' field, not 'server_script'
      demo_data: this.generateDemoData(objective)
    };
  }

  private extractScriptConfig(objective: string, agentResults: any[]): any {
    return {
      name: this.generateArtifactName(objective, 'script'),
      description: `Auto-generated script for: ${objective}`,
      script: this.generateScriptCode(objective)
    };
  }

  // Simple artifact generation based on objective analysis
  private generateArtifactName(objective: string, type: string): string {
    const words = objective.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const key_words = words.slice(0, 3).join('_');
    return `${key_words}_${type}`;
  }

  private generateArtifactTitle(objective: string): string {
    return objective.charAt(0).toUpperCase() + objective.slice(1);
  }

  private generateWidgetTemplate(objective: string): string {
    const isChart = objective.toLowerCase().includes('chart') || objective.toLowerCase().includes('graph');
    const isDashboard = objective.toLowerCase().includes('dashboard');
    
    if (isChart) {
      return `
<div class="panel panel-default">
  <div class="panel-heading">
    <h3 class="panel-title">{{data.title || '${this.generateArtifactTitle(objective)}'}}</h3>
  </div>
  <div class="panel-body">
    <canvas id="chart-{{::data.widget_id}}" width="400" height="200"></canvas>
  </div>
</div>`;
    }
    
    if (isDashboard) {
      return `
<div class="row">
  <div class="col-md-12">
    <div class="panel panel-default">
      <div class="panel-heading">
        <h3 class="panel-title">{{data.title || '${this.generateArtifactTitle(objective)}'}}</h3>
      </div>
      <div class="panel-body">
        <div class="row">
          <div class="col-md-4" ng-repeat="item in data.items">
            <div class="well text-center">
              <h4>{{item.label}}</h4>
              <h2 class="text-primary">{{item.value}}</h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
    }

    return `
<div class="panel panel-default">
  <div class="panel-heading">
    <h3 class="panel-title">{{data.title || '${this.generateArtifactTitle(objective)}'}}</h3>
  </div>
  <div class="panel-body">
    <div ng-if="data.items.length > 0">
      <div class="list-group">
        <div class="list-group-item" ng-repeat="item in data.items">
          <h4 class="list-group-item-heading">{{item.title}}</h4>
          <p class="list-group-item-text">{{item.description}}</p>
        </div>
      </div>
    </div>
    <div ng-if="data.items.length === 0" class="text-center">
      <p>No items to display</p>
    </div>
  </div>
</div>`;
  }

  private generateWidgetCss(objective: string): string {
    return `
.panel {
  margin-bottom: 20px;
  border-radius: 6px;
}

.panel-heading {
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.panel-body {
  padding: 15px;
}

.well {
  background-color: #f9f9f9;
  border: 1px solid #e3e3e3;
  border-radius: 4px;
  padding: 19px;
  margin-bottom: 20px;
}

.text-primary {
  color: #337ab7;
}

@media (max-width: 768px) {
  .col-md-4 {
    margin-bottom: 15px;
  }
}`;
  }

  private generateClientScript(objective: string): string {
    const isChart = objective.toLowerCase().includes('chart') || objective.toLowerCase().includes('graph');
    
    if (isChart) {
      return `
function($scope) {
  var c = this;
  
  c.$onInit = function() {
    if (c.data.chartData) {
      c.renderChart();
    }
  };
  
  c.renderChart = function() {
    var ctx = document.getElementById('chart-' + c.data.widget_id);
    if (ctx && c.data.chartData) {
      new Chart(ctx, {
        type: c.data.chartType || 'bar',
        data: c.data.chartData,
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: c.data.title || 'Chart'
            }
          }
        }
      });
    }
  };
}`;
    }

    return `
function($scope) {
  var c = this;
  
  c.$onInit = function() {
    // Initialize widget
    if (c.data.items) {
      c.processItems();
    }
  };
  
  c.processItems = function() {
    // Process and format items for display
    c.data.items = c.data.items || [];
  };
  
  c.refreshData = function() {
    c.server.refresh();
  };
}`;
  }

  private generateServerScript(objective: string): string {
    const lowerObjective = objective.toLowerCase();
    
    if (lowerObjective.includes('incident')) {
      return `
(function() {
  data.title = options.title || 'Incidents Dashboard';
  data.widget_id = gs.generateGUID();
  
  // Query incidents
  var gr = new GlideRecord('incident');
  gr.addActiveQuery();
  gr.orderByDesc('sys_created_on');
  gr.setLimit(10);
  gr.query();
  
  data.items = [];
  while (gr.next()) {
    data.items.push({
      title: gr.getValue('short_description'),
      description: 'Priority: ' + gr.getDisplayValue('priority') + ' | State: ' + gr.getDisplayValue('state'),
      sys_id: gr.getValue('sys_id'),
      priority: gr.getValue('priority'),
      state: gr.getValue('state')
    });
  }
  
  // Chart data for incidents by priority
  if (data.items.length > 0) {
    var priorityCounts = {};
    data.items.forEach(function(item) {
      priorityCounts[item.priority] = (priorityCounts[item.priority] || 0) + 1;
    });
    
    data.chartData = {
      labels: Object.keys(priorityCounts),
      datasets: [{
        label: 'Incidents by Priority',
        data: Object.values(priorityCounts),
        backgroundColor: ['#ff6384', '#ff9f40', '#ffcd56', '#4bc0c0']
      }]
    };
    data.chartType = 'doughnut';
  }
})();`;
    }

    return `
(function() {
  data.title = options.title || '${this.generateArtifactTitle(objective)}';
  data.widget_id = gs.generateGUID();
  data.items = [];
  
  // Add your data processing logic here
  // Example: Query relevant records and populate data.items
  
  // Default demo data
  data.items = [
    {
      title: 'Sample Item 1',
      description: 'This is a sample item for demonstration'
    },
    {
      title: 'Sample Item 2', 
      description: 'This is another sample item'
    }
  ];
})();`;
  }

  private generateDemoData(objective: string): any {
    return {
      title: this.generateArtifactTitle(objective),
      items: [
        {
          title: 'Demo Item 1',
          description: 'Sample data for testing the widget'
        }
      ]
    };
  }

  private generateScriptCode(objective: string): string {
    return `
// Auto-generated script for: ${objective}
// Generated by ServiceNow Queen Agent

(function() {
  // Add your script logic here
  gs.info('${objective} script executed');
  
  return {
    success: true,
    message: 'Script executed successfully'
  };
})();`;
  }

  private async executeDeploymentPlan(plan: any): Promise<any> {
    // Handle local sync workflow for artifact editing
    if (plan.type === 'local-sync') {
      if (this.config.debugMode) {
        this.logger.info('🔄 Executing Local Sync Development workflow');
        this.logger.info('📁 Artifact will be synced to local files for editing');
      }
      
      // Create recommendation for local sync
      const recommendation: AgentRecommendation = {
        agentId: 'queen-agent',
        agentType: 'queen',
        action: 'local-sync',
        tool: 'snow_pull_artifact',
        server: 'servicenow-local-development',
        params: plan.config,
        reasoning: 'Syncing artifact to local files for advanced editing with Claude Code',
        confidence: 0.95
      };
      
      // Execute pull through MCP bridge
      const result = await this.mcpBridge.executeAgentRecommendation(
        { id: 'queen-agent', type: 'queen' },
        recommendation
      );
      
      if (result.success) {
        return {
          success: true,
          type: 'local-sync',
          approach: plan.approach,
          message: 'Artifact synced to local files. Edit with Claude Code, then use snow_push_artifact to sync back.',
          localPath: result.toolResult?.localPath,
          files: result.toolResult?.files
        };
      }
    }
    
    // Execute real MCP tools through the bridge
    if (this.config.debugMode) {
      this.logger.info('🚀 Executing deployment plan with MCP Bridge');
    }

    // Create agent recommendation from plan
    const recommendation: AgentRecommendation = {
      agentId: 'queen-agent',
      agentType: 'queen',
      action: `deploy-${plan.type}`,
      tool: plan.mcpTool,
      server: this.getServerForTool(plan.mcpTool),
      params: plan.config || {},
      reasoning: `Deploying ${plan.type} artifact as requested`,
      confidence: 0.95
    };

    // Execute through MCP bridge
    const result = await this.mcpBridge.executeAgentRecommendation(
      { id: 'queen-agent', type: 'queen' },
      recommendation
    );

    if (result.success && result.toolResult) {
      const deploymentResult = {
        success: true,
        type: plan.type,
        name: plan.config?.name || result.toolResult.name,
        sys_id: result.toolResult.sys_id, // Real sys_id from ServiceNow!
        config: plan.config,
        mcpTool: plan.mcpTool,
        executionTime: result.executionTime
      };

      // Handle dependency injection for widgets
      if (plan.type === 'widget' && plan.config) {
        await this.handleWidgetDependencies(plan.config, plan.autoPermissions);
      }

      return deploymentResult;
    } else {
      throw new Error(`MCP execution failed: ${result.error || 'Unknown error'}`);
    }
  }

  private getServerForTool(tool: string): string {
    // Map tools to their servers
    const toolServerMap: Record<string, string> = {
      'snow_deploy': 'deployment',
      'snow_deploy_widget': 'deployment',
      'snow_deploy_flow': 'deployment',
      'snow_find_artifact': 'intelligent',
      'snow_update_set_create': 'update-set',
      'snow_get_by_sysid': 'intelligent',
      'snow_edit_by_sysid': 'intelligent'
    };
    return toolServerMap[tool] || 'deployment';
  }

  private async handleWidgetDependencies(widgetConfig: any, autoPermissions?: boolean): Promise<void> {
    try {
      // Detect dependencies in widget code
      const dependencies = DependencyDetector.analyzeWidget(widgetConfig);

      if (dependencies.length === 0) {
        return; // No dependencies needed
      }

      this.logger.info(`\n📦 Detected ${dependencies.length} external dependencies in widget:`);
      dependencies.forEach(dep => {
        this.logger.info(`  • ${dep.name} - ${dep.description}`);
      });

      // Create MCP tools wrapper for theme manager
      const mcpTools = {
        snow_find_artifact: async (params: any) => {
          const recommendation: AgentRecommendation = {
            agentId: 'queen-agent',
            agentType: 'queen',
            action: 'find-theme',
            tool: 'snow_find_artifact',
            server: 'intelligent',
            params,
            reasoning: 'Finding Service Portal theme for dependency injection',
            confidence: 0.95
          };
          const result = await this.mcpBridge.executeAgentRecommendation(
            { id: 'queen-agent', type: 'queen' },
            recommendation
          );
          return result.toolResult;
        },
        snow_comprehensive_search: async (params: any) => {
          const recommendation: AgentRecommendation = {
            agentId: 'queen-agent',
            agentType: 'queen',
            action: 'search-themes',
            tool: 'snow_comprehensive_search',
            server: 'intelligent',
            params,
            reasoning: 'Searching for Service Portal themes',
            confidence: 0.95
          };
          const result = await this.mcpBridge.executeAgentRecommendation(
            { id: 'queen-agent', type: 'queen' },
            recommendation
          );
          return result.toolResult;
        },
        snow_get_by_sysid: async (params: any) => {
          const recommendation: AgentRecommendation = {
            agentId: 'queen-agent',
            agentType: 'queen',
            action: 'get-theme',
            tool: 'snow_get_by_sysid',
            server: 'intelligent',
            params,
            reasoning: 'Getting Service Portal theme details',
            confidence: 0.95
          };
          const result = await this.mcpBridge.executeAgentRecommendation(
            { id: 'queen-agent', type: 'queen' },
            recommendation
          );
          return result.toolResult;
        },
        snow_edit_by_sysid: async (params: any) => {
          const recommendation: AgentRecommendation = {
            agentId: 'queen-agent',
            agentType: 'queen',
            action: 'update-theme',
            tool: 'snow_edit_by_sysid',
            server: 'intelligent',
            params,
            reasoning: 'Updating Service Portal theme with dependencies',
            confidence: 0.95
          };
          const result = await this.mcpBridge.executeAgentRecommendation(
            { id: 'queen-agent', type: 'queen' },
            recommendation
          );
          return result.toolResult;
        }
      };

      // Update theme with dependencies
      const result = await ServicePortalThemeManager.updateThemeWithDependencies(
        dependencies,
        mcpTools,
        {
          autoPermissions,
          skipPrompt: autoPermissions, // Skip prompt if auto-permissions enabled
          useMinified: true
        }
      );

      if (result.success) {
        this.logger.info(`✅ ${result.message}`);
      } else {
        this.logger.warn(`⚠️ Dependencies not installed: ${result.message}`);
        this.logger.info('💡 You may need to manually add these dependencies to your Service Portal theme');
      }

    } catch (error: any) {
      console.error('❌ Error handling widget dependencies:', error.message);
      // Don't fail the deployment, just warn
      this.logger.warn('⚠️ Widget deployed successfully but dependencies may need manual installation');
    }
  }

  private async attemptRecovery(task: ServiceNowTask, agents: Agent[], error: Error): Promise<any> {
    if (this.config.debugMode) {
      this.logger.info(`🔄 Attempting recovery for task ${task.id}`);
    }

    // Try with reduced complexity or different agent sequence
    const fallbackResult = {
      taskId: task.id,
      objective: task.objective,
      status: 'recovered',
      error: error.message,
      fallbackApplied: true
    };

    return fallbackResult;
  }

  private learnFromExecution(task: ServiceNowTask, agents: Agent[], result: any, duration: number, error: Error | null): void {
    const agentTypes = agents.map(a => a.type);
    
    if (error) {
      // Learn from failure
      this.neuralLearning.learnFromFailure(task, error.message, agentTypes);
      this.memory.recordTaskCompletion(task.id, task.objective, task.type, agentTypes, false, duration);
    } else {
      // Learn from success
      this.neuralLearning.learnFromSuccess(task, duration, agentTypes);
      this.memory.recordTaskCompletion(task.id, task.objective, task.type, agentTypes, true, duration);
    }

    if (this.config.debugMode) {
      this.logger.info(`📚 Queen learned from ${error ? 'failure' : 'success'}: ${task.objective}`);
    }
  }

  private async handleExecutionFailure(taskId: string, objective: string, error: Error, duration: number): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error.message;
      
      // Learn from failure
      this.memory.storeLearning(
        `failure_${task.type}`,
        `Failed: ${objective} - Error: ${error.message}`,
        0.8
      );
    }

    if (this.config.debugMode) {
      console.error(`❌ Task ${taskId} failed after ${duration}ms:`, error.message);
    }
  }

  private cleanupTask(taskId: string): void {
    this.activeTasks.delete(taskId);
    this.agentFactory.cleanupCompletedAgents();
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  // Public API methods

  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  getTaskStatus(taskId: string): ServiceNowTask | null {
    return this.activeTasks.get(taskId) || null;
  }

  /**
   * Get gap _analysis results for a task
   */
  getGapAnalysisResults(taskId: string): any | null {
    const task = this.activeTasks.get(taskId);
    return (task as any)?.gapAnalysis || null;
  }

  /**
   * Get all manual guides from gap _analysis for a task
   */
  getManualConfigurationGuides(taskId: string): any {
    // Get strategic analysis from task
    const task = this.activeTasks.get(taskId);
    const strategicAnalysis = (task as any)?.strategicAnalysis;
    return strategicAnalysis?.problemAnalysis?.hiddenRequirements || null;
  }

  getHiveMindStatus(): any {
    return {
      activeTasks: this.activeTasks.size,
      activeAgents: this.agentFactory.getActiveAgents().length,
      memoryStats: {
        patterns: this.memory['memory'].patterns.length,
        artifacts: this.memory['memory'].artifacts.size,
        learnings: this.memory['memory'].learnings.size
      },
      factoryStats: this.agentFactory.getStatistics(),
      learningInsights: this.neuralLearning.getLearningInsights()
    };
  }

  exportMemory(): string {
    return this.memory.exportMemory();
  }

  importMemory(memoryData: string): void {
    this.memory.importMemory(memoryData);
    if (this.config.debugMode) {
      this.logger.info('🧠 Queen hive-mind memory imported successfully');
    }
  }

  clearMemory(): void {
    this.memory.clearMemory();
    // Also reset neural learning weights
    this.neuralLearning = new NeuralLearning(this.memory);
    if (this.config.debugMode) {
      this.logger.info('🧠 Queen hive-mind memory cleared - starting fresh');
    }
  }

  getLearningInsights(): any {
    const neuralInsights = this.neuralLearning.getLearningInsights();
    
    return {
      successfulPatterns: this.memory['memory'].patterns.slice(0, 5).map(pattern => ({
        description: `${pattern.taskType} deployment using ${pattern.agentSequence.join(' → ')}`,
        successRate: Math.round(pattern.successRate * 100),
        avgDuration: pattern.avgDuration,
        useCount: this.memory.getSuccessRate(pattern.taskType)
      })),
      recommendations: [
        'Use Queen Agent for complex multi-step ServiceNow tasks',
        'Enable --debug mode for detailed hive-mind insights',
        'Export memory regularly to preserve learning patterns',
        'Let Queen analyze objectives for optimal agent coordination'
      ],
      commonTasks: Object.entries(neuralInsights.weights || {})
        .map(([type, count]) => ({
          type,
          count: typeof count === 'number' ? count : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      memoryStats: {
        totalPatterns: this.memory['memory'].patterns.length,
        totalArtifacts: this.memory['memory'].artifacts.size,
        totalLearnings: this.memory['memory'].learnings.size
      },
      neuralInsights
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('🛑 DISABLED: ServiceNow Queen shutdown disabled for persistence');
    this.logger.info('🔄 Queen Agent and MCP servers will continue running indefinitely');
    // DISABLED: All shutdown logic for persistent operation
    /*
    if (this.config.debugMode) {
      this.logger.info('🛑 Shutting down ServiceNow Queen Agent');
    }
    
    // Clean up all agents
    const activeAgents = this.agentFactory.getActiveAgents();
    for (const agent of activeAgents) {
      this.agentFactory.terminateAgent(agent.id);
    }
    
    // Shutdown MCP Bridge
    if (this.mcpBridge) {
      await this.mcpBridge.shutdown();
    }
    */
    
    // Close memory system
    this.memory.close();
  }

  /**
   * STRATEGIC ORCHESTRATION METHODS
   * These methods implement the Queen Agent's strategic thinking capabilities
   */

  /**
   * Perform deep problem analysis to understand what user ACTUALLY needs
   */
  private async performDeepProblemAnalysis(objective: string): Promise<any> {
    this.logger.info('🧠 Deep Problem Analysis: Looking beyond surface requirements...');
    
    // Analyze the objective for hidden complexity and real business needs
    const analysis = {
      coreProblem: this.extractCoreProblem(objective),
      complexity: this.assessObjectiveComplexity(objective),
      businessImpact: this.assessBusinessImpact(objective),
      stakeholders: this.identifyStakeholders(objective),
      hiddenRequirements: this.identifyHiddenRequirements(objective),
      successCriteria: this.defineSuccessCriteria(objective)
    };

    this.logger.info(`🎯 Core Problem Identified: ${analysis.coreProblem}`);
    this.logger.info(`📈 Success Criteria: ${analysis.successCriteria.join(', ')}`);
    
    return analysis;
  }

  /**
   * Perform comprehensive risk assessment
   */
  private async performRiskAssessment(objective: string, problemAnalysis: any): Promise<any> {
    this.logger.info('⚠️ Strategic Risk Assessment: Identifying all potential failure points...');
    
    const risks = [
      ...this.identifyTechnicalRisks(objective, problemAnalysis),
      ...this.identifyBusinessRisks(objective, problemAnalysis),
      ...this.identifyOperationalRisks(objective, problemAnalysis),
      ...this.identifyComplianceRisks(objective, problemAnalysis)
    ];

    const criticalRisks = risks.filter(risk => risk.impact === 'high' && risk.likelihood === 'high');
    const overallRisk = this.calculateOverallRisk(risks);

    return {
      risks,
      criticalRisks,
      overallRisk,
      mitigationStrategies: this.developMitigationStrategies(criticalRisks)
    };
  }

  /**
   * Extract the core business problem from user request
   */
  private getTableForType(type: string): string {
    const typeToTable: Record<string, string> = {
      'widget': 'sp_widget',
      'flow': 'sys_hub_flow',
      'script': 'sys_script_include',
      'business_rule': 'sys_script',
      'ui_page': 'sys_ui_page',
      'client_script': 'sys_script_client',
      'ui_policy': 'sys_ui_policy',
      'scheduled_job': 'sysauto_script',
      'fix_script': 'sys_script_fix'
    };
    return typeToTable[type] || 'sys_metadata';
  }
  
  private extractSysIdFromObjective(objective: string): string | undefined {
    // Look for sys_id patterns in the objective
    const sysIdPattern = /[a-f0-9]{32}/i;
    const match = objective.match(sysIdPattern);
    return match ? match[0] : undefined;
  }
  
  private extractCoreProblem(objective: string): string {
    const objective_lower = objective.toLowerCase();
    
    // Analyze patterns to understand underlying need
    if (objective_lower.includes('widget') || objective_lower.includes('dashboard')) {
      return 'Users need better access to information or functionality through improved interface';
    } else if (objective_lower.includes('workflow') || objective_lower.includes('process')) {
      return 'Business process efficiency and automation needs improvement';
    } else if (objective_lower.includes('integration') || objective_lower.includes('api')) {
      return 'Systems need to communicate effectively to eliminate manual work';
    } else if (objective_lower.includes('report') || objective_lower.includes('analytics')) {
      return 'Decision makers need better visibility into business performance';
    } else if (objective_lower.includes('notification') || objective_lower.includes('alert')) {
      return 'Stakeholders need timely awareness of important events or status changes';
    } else {
      return 'Business capability needs enhancement through ServiceNow platform optimization';
    }
  }

  /**
   * Assess objective complexity
   */
  private assessObjectiveComplexity(objective: string): 'low' | 'medium' | 'high' {
    let complexity_score = 0;
    
    const high_complexity_indicators = ['integration', 'multiple', 'complex', 'enterprise', 'automated', 'workflow'];
    const medium_complexity_indicators = ['dashboard', 'report', 'widget', 'form', 'approval'];
    
    high_complexity_indicators.forEach(indicator => {
      if (objective.toLowerCase().includes(indicator)) complexity_score += 2;
    });
    
    medium_complexity_indicators.forEach(indicator => {
      if (objective.toLowerCase().includes(indicator)) complexity_score += 1;
    });
    
    if (objective.length > 100) complexity_score += 1;
    if (objective.split(' ').length > 20) complexity_score += 1;
    
    if (complexity_score >= 4) return 'high';
    if (complexity_score >= 2) return 'medium';
    return 'low';
  }

  /**
   * Assess business impact
   */
  private assessBusinessImpact(objective: string): 'low' | 'medium' | 'high' {
    const high_impact_keywords = ['critical', 'urgent', 'production', 'enterprise', 'compliance', 'security'];
    const medium_impact_keywords = ['efficiency', 'automation', 'improvement', 'optimization', 'user experience'];
    
    const objective_lower = objective.toLowerCase();
    
    if (high_impact_keywords.some(keyword => objective_lower.includes(keyword))) return 'high';
    if (medium_impact_keywords.some(keyword => objective_lower.includes(keyword))) return 'medium';
    return 'low';
  }

  /**
   * Identify stakeholders affected by the change
   */
  private identifyStakeholders(objective: string): string[] {
    const stakeholders = new Set<string>();
    const objective_lower = objective.toLowerCase();
    
    // Default stakeholders for any ServiceNow change
    stakeholders.add('End Users');
    stakeholders.add('System Administrators');
    
    // Add specific stakeholders based on objective
    if (objective_lower.includes('approval')) stakeholders.add('Approvers');
    if (objective_lower.includes('manager')) stakeholders.add('Managers');
    if (objective_lower.includes('report') || objective_lower.includes('dashboard')) stakeholders.add('Business Analysts');
    if (objective_lower.includes('integration')) stakeholders.add('IT Operations');
    if (objective_lower.includes('security') || objective_lower.includes('compliance')) stakeholders.add('Security Team');
    if (objective_lower.includes('catalog') || objective_lower.includes('service')) stakeholders.add('Service Desk');
    
    return Array.from(stakeholders);
  }

  /**
   * Identify hidden requirements not explicitly stated
   */
  private identifyHiddenRequirements(objective: string): string[] {
    const hiddenReqs: string[] = [];
    const objective_lower = objective.toLowerCase();
    
    // Universal hidden requirements
    hiddenReqs.push('Solution must be maintainable by current team');
    hiddenReqs.push('Performance must not degrade existing system');
    hiddenReqs.push('Solution must be scalable for future growth');
    
    // Context-specific hidden requirements
    if (objective_lower.includes('widget') || objective_lower.includes('portal')) {
      hiddenReqs.push('Must work across all browsers and devices');
      hiddenReqs.push('Must meet accessibility standards');
    }
    
    if (objective_lower.includes('integration')) {
      hiddenReqs.push('Must handle integration failures gracefully');
      hiddenReqs.push('Must maintain data consistency');
    }
    
    if (objective_lower.includes('workflow') || objective_lower.includes('automation')) {
      hiddenReqs.push('Must handle exceptions and edge cases');
      hiddenReqs.push('Must provide clear audit trail');
    }
    
    return hiddenReqs;
  }

  /**
   * Define clear success criteria
   */
  private defineSuccessCriteria(objective: string): string[] {
    const criteria: string[] = [];
    const objective_lower = objective.toLowerCase();
    
    // Universal success criteria
    criteria.push('Solution deployed without system disruption');
    criteria.push('All stakeholders can use the solution effectively');
    criteria.push('Performance meets or exceeds baseline requirements');
    
    // Specific success criteria based on objective
    if (objective_lower.includes('widget') || objective_lower.includes('dashboard')) {
      criteria.push('Users can access information faster than before');
      criteria.push('User satisfaction with interface is positive');
    }
    
    if (objective_lower.includes('workflow') || objective_lower.includes('automation')) {
      criteria.push('Process time reduced compared to manual process');
      criteria.push('Error rate is lower than manual process');
    }
    
    if (objective_lower.includes('integration')) {
      criteria.push('Data flows correctly between systems');
      criteria.push('Integration performs within SLA requirements');
    }
    
    return criteria;
  }

  /**
   * Identify technical risks
   */
  private identifyTechnicalRisks(objective: string, analysis: any): any[] {
    const risks = [];
    const objective_lower = objective.toLowerCase();
    
    if (objective_lower.includes('integration')) {
      risks.push({
        type: 'technical',
        description: 'Integration points may fail or perform poorly',
        impact: 'high',
        likelihood: 'medium',
        mitigation: 'Implement robust error handling and monitoring'
      });
    }
    
    if (objective_lower.includes('widget') || objective_lower.includes('custom')) {
      risks.push({
        type: 'technical', 
        description: 'Custom code may conflict with platform updates',
        impact: 'medium',
        likelihood: 'medium',
        mitigation: 'Follow platform best practices and test thoroughly'
      });
    }
    
    if (analysis.complexity === 'high') {
      risks.push({
        type: 'technical',
        description: 'High complexity increases chance of defects',
        impact: 'high',
        likelihood: 'high',
        mitigation: 'Break down into smaller phases with thorough testing'
      });
    }
    
    return risks;
  }

  /**
   * Identify business risks
   */
  private identifyBusinessRisks(objective: string, analysis: any): any[] {
    const risks = [];
    
    if (analysis.businessImpact === 'high') {
      risks.push({
        type: 'business',
        description: 'High business impact means high visibility and pressure',
        impact: 'high',
        likelihood: 'medium',
        mitigation: 'Ensure thorough testing and stakeholder communication'
      });
    }
    
    if (analysis.stakeholders.length > 5) {
      risks.push({
        type: 'business',
        description: 'Many stakeholders increase coordination complexity',
        impact: 'medium', 
        likelihood: 'high',
        mitigation: 'Establish clear communication plan and change management'
      });
    }
    
    return risks;
  }

  /**
   * Identify operational risks
   */
  private identifyOperationalRisks(objective: string, analysis: any): any[] {
    const risks = [];
    const objective_lower = objective.toLowerCase();
    
    if (objective_lower.includes('automation') || objective_lower.includes('workflow')) {
      risks.push({
        type: 'operational',
        description: 'Automated processes may fail and require manual intervention',
        impact: 'medium',
        likelihood: 'medium',
        mitigation: 'Build in manual override capabilities and monitoring'
      });
    }
    
    return risks;
  }

  /**
   * Identify compliance risks
   */
  private identifyComplianceRisks(objective: string, analysis: any): any[] {
    const risks = [];
    const objective_lower = objective.toLowerCase();
    
    if (objective_lower.includes('data') || objective_lower.includes('integration')) {
      risks.push({
        type: 'compliance',
        description: 'Data handling may not meet privacy or security requirements',
        impact: 'high',
        likelihood: 'low',
        mitigation: 'Review with security and compliance teams'
      });
    }
    
    return risks;
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(risks: any[]): 'low' | 'medium' | 'high' {
    const high_risk_count = risks.filter(r => r.impact === 'high' && r.likelihood === 'high').length;
    const medium_risk_count = risks.filter(r => 
      (r.impact === 'high' && r.likelihood === 'medium') || 
      (r.impact === 'medium' && r.likelihood === 'high')
    ).length;
    
    if (high_risk_count > 0) return 'high';
    if (medium_risk_count > 1) return 'high';
    if (medium_risk_count > 0 || risks.length > 3) return 'medium';
    return 'low';
  }

  /**
   * Develop mitigation strategies for critical risks
   */
  private developMitigationStrategies(criticalRisks: any[]): string[] {
    const strategies = criticalRisks.map(risk => risk.mitigation);
    
    // Add general mitigation strategies
    strategies.push('Implement comprehensive testing at each phase');
    strategies.push('Establish rollback procedures before deployment');
    strategies.push('Monitor solution performance post-deployment');
    
    return [...new Set(strategies)]; // Remove duplicates
  }

  /**
   * Design solution architecture based on strategic analysis
   */
  private async designSolutionArchitecture(problemAnalysis: any, riskAssessment: any): Promise<any> {
    this.logger.info('🏗️ Designing Strategic Solution Architecture...');
    
    // Determine optimal approach based on complexity and risks
    let approach = 'standard';
    let recommendedAgents = ['researcher', 'widget-creator', 'tester'];
    
    if (problemAnalysis.complexity === 'high' || riskAssessment.overallRisk === 'high') {
      approach = 'phased-implementation';
      recommendedAgents = ['researcher', 'app-architect', 'widget-creator', 'security-specialist', 'tester'];
    }
    
    if (riskAssessment.criticalRisks.length > 2) {
      approach = 'risk-first-architecture';
      recommendedAgents.unshift('security-specialist');
    }
    
    // Add specialized agents based on problem domain
    const objective_lower = problemAnalysis.coreProblem.toLowerCase();
    if (objective_lower.includes('integration')) {
      recommendedAgents.push('integration-specialist');
    }
    if (objective_lower.includes('workflow') || objective_lower.includes('process')) {
      recommendedAgents.push('flow-builder');
    }
    if (objective_lower.includes('performance')) {
      recommendedAgents.push('performance-specialist');
    }
    
    return {
      approach,
      recommendedAgents: [...new Set(recommendedAgents)], // Remove duplicates
      implementationSteps: this.generateImplementationSteps(approach, problemAnalysis),
      qualityGates: this.defineQualityGates(problemAnalysis, riskAssessment),
      monitoringStrategy: this.defineMonitoringStrategy(problemAnalysis)
    };
  }

  /**
   * Generate implementation steps based on approach
   */
  private generateImplementationSteps(approach: string, problemAnalysis: any): string[] {
    const baseSteps = [
      'Validate requirements with stakeholders',
      'Create proof of concept',
      'Implement core functionality',
      'Conduct security review',
      'Perform comprehensive testing',
      'Deploy with monitoring'
    ];
    
    if (approach === 'phased-implementation') {
      return [
        'Phase 1: Research and architecture design',
        'Phase 2: Build minimal viable solution',
        'Phase 3: Add advanced features',
        'Phase 4: Performance optimization',
        'Phase 5: Full deployment and monitoring'
      ];
    } else if (approach === 'risk-first-architecture') {
      return [
        'Risk mitigation planning',
        'Security architecture review',
        ...baseSteps,
        'Post-deployment risk validation'
      ];
    }
    
    return baseSteps;
  }

  /**
   * Define quality gates based on analysis
   */
  private defineQualityGates(problemAnalysis: any, riskAssessment: any): string[] {
    const gates = [
      'Requirements validation complete',
      'Architecture review passed',
      'Code review completed',
      'Security scan passed',
      'Performance benchmarks met'
    ];
    
    if (riskAssessment.overallRisk === 'high') {
      gates.unshift('Risk mitigation plan approved');
      gates.push('Rollback procedures tested');
    }
    
    if (problemAnalysis.businessImpact === 'high') {
      gates.push('Stakeholder sign-off obtained');
      gates.push('Production readiness review passed');
    }
    
    return gates;
  }

  /**
   * Define monitoring strategy
   */
  private defineMonitoringStrategy(problemAnalysis: any): any {
    return {
      metrics: [
        'System performance indicators',
        'User experience metrics',
        'Error rates and failure patterns',
        'Business impact measurements'
      ],
      alerting: [
        'Performance degradation alerts',
        'Error threshold alerts',
        'User satisfaction alerts'
      ],
      reporting: [
        'Daily operational health reports',
        'Weekly business impact reports',
        'Monthly optimization recommendations'
      ]
    };
  }
}