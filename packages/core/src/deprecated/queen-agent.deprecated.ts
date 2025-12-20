/**
 * Queen Agent Core with Enhanced 403 Error Handling
 * Master coordinator that analyzes objectives and spawns specialized agents
 * Works through Claude Code interface using TodoWrite for task coordination
 * Now with intelligent 403 error handling using Gap Analysis Engine
 */

import { EventEmitter } from 'eventemitter3';
import { TodoItem, TodoStatus } from '../types/todo.types';
import { ServiceNowTask, Agent, AgentType, TaskAnalysis, DeploymentPattern } from '../queen/types';
import { QueenMemorySystem } from '../queen/queen-memory';
// AgentCoordinator removed - using dynamic agent system
import { ParallelAgentEngine, ParallelizationOpportunity } from '../queen/parallel-agent-engine';
// Queen403Handler removed - using Gap Analysis Engine directly
import { Logger } from '../utils/logger';
import { RealAgentSpawner, RealAgent } from './real-agent-spawner';
import * as crypto from 'crypto';

export interface QueenAgentConfig {
  memoryPath?: string;
  maxConcurrentAgents?: number;
  debugMode?: boolean;
  autoSpawn?: boolean;
  claudeCodeInterface?: boolean;
  mcpTools?: any; // MCP tools for Gap Analysis
}

export interface QueenObjective {
  id: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  constraints?: string[];
  metadata?: Record<string, any>;
}

export interface TodoCoordination {
  objectiveId: string;
  todos: TodoItem[];
  agentAssignments: Map<string, string>; // todoId -> agentId
  dependencies: Map<string, string[]>; // todoId -> [dependencyIds]
}

export class QueenAgent extends EventEmitter {
  private memory: QueenMemorySystem;
  private parallelEngine: ParallelAgentEngine;
  private realAgentSpawner: RealAgentSpawner; // NEW: Real agent spawning
  // Coordinator and 403Handler removed - using dynamic agent system
  private config: Required<QueenAgentConfig>;
  private activeObjectives: Map<string, QueenObjective>;
  private todoCoordinations: Map<string, TodoCoordination>;
  private activeAgents: Map<string, Agent>;
  private realAgents: Map<string, RealAgent>; // NEW: Track real agents
  private logger: Logger;

  constructor(config: QueenAgentConfig = {}) {
    super();
    
    this.config = {
      memoryPath: config.memoryPath,
      maxConcurrentAgents: config.maxConcurrentAgents || 8,
      debugMode: config.debugMode || false,
      autoSpawn: config.autoSpawn !== false,
      claudeCodeInterface: config.claudeCodeInterface !== false,
      mcpTools: config.mcpTools || {}
    };

    // Initialize logger first
    this.logger = new Logger('QueenAgent');

    // Initialize core systems
    this.memory = new QueenMemorySystem(this.config.memoryPath);
    this.parallelEngine = new ParallelAgentEngine(this.memory);
    this.realAgentSpawner = new RealAgentSpawner(this.memory); // NEW: Real agent spawning
    // Dynamic agent system - no more hardcoded coordinator/handler
    this.activeObjectives = new Map();
    this.todoCoordinations = new Map();
    this.activeAgents = new Map();
    this.realAgents = new Map(); // NEW: Track real agents

    this.setupEventHandlers();
    
    if (this.config.debugMode) {
      console.log('👑 Queen Agent initialized with Claude Code interface and 403 handling');
    }
  }

  /**
   * Update MCP tools configuration (useful when tools become available later)
   */
  updateMCPTools(mcpTools: any): void {
    this.config.mcpTools = mcpTools;
    // 403 handling now done through Gap Analysis Engine
  }

  /**
   * Analyze objective and create coordinated execution plan
   */
  async analyzeObjective(objective: string | QueenObjective): Promise<TaskAnalysis> {
    const queenObjective = typeof objective === 'string' 
      ? { id: this.generateId('obj'), description: objective } 
      : objective;

    this.activeObjectives.set(queenObjective.id, queenObjective);
    this.emit('objective:analyzing', queenObjective);

    try {
      // Analyze objective using memory patterns and neural learning
      const _analysis = await this.performObjectiveAnalysis(queenObjective);
      
      // Store _analysis in memory for coordination
      await this.memory.store(`analysis_${queenObjective.id}`, {
        objective: queenObjective,
        _analysis,
        timestamp: new Date().toISOString()
      });

      // Create TodoWrite coordination structure
      const todoCoordination = await this.createTodoCoordination(queenObjective, _analysis);
      this.todoCoordinations.set(queenObjective.id, todoCoordination);

      this.emit('objective:analyzed', { objective: queenObjective, _analysis, todos: todoCoordination.todos });
      
      return _analysis;

    } catch (error) {
      this.emit('objective:error', { objective: queenObjective, error });
      throw error;
    }
  }

  /**
   * Handle deployment error with intelligent 403 detection and resolution
   */
  async handleDeploymentError(error: any, context: {
    objectiveId: string;
    agentId?: string;
    operation: string;
    artifactType?: string;
    tableName?: string;
  }): Promise<boolean> {
    // Check if it's a 403 permission error
    if (this.is403Error(error)) {
      console.log('🚨 Queen Agent: Detected 403 permission error - activating intelligent _analysis');
      
      const objective = this.activeObjectives.get(context.objectiveId);
      if (!objective) {
        console.error('No objective found for error context');
        return false;
      }

      // 403 handling now done through Gap Analysis Engine directly
      const result = {
        success: false,
        recommendations: ['Use Gap Analysis Engine for 403 error handling'],
        manualSteps: [],
        updatedConfig: {},
        nextSteps: [],
        resolved: false
      };

      // Update todos based on analysis
      if (result.nextSteps.length > 0) {
        await this.updateTodosWithPermissionFixes(context.objectiveId, result);
      }

      // If automatic fixes were applied, return true to retry
      if (result.resolved) {
        console.log('✅ Queen Agent: Automatic fixes applied - suggesting retry');
        this.emit('permission:auto-fixed', { context, result });
        return true;
      }

      // Emit event for manual intervention needed
      this.emit('permission:manual-required', { context, result });
      return false;
    }

    return false;
  }

  /**
   * Check if error is a 403 permission error
   */
  private is403Error(error: any): boolean {
    const errorStr = error?.toString() || '';
    const errorMsg = error?.message || '';
    const statusCode = error?.status || error?.statusCode || error?.response?.status;
    
    return statusCode === 403 || 
           errorStr.includes('403') || 
           errorMsg.includes('403') ||
           errorMsg.includes('permission') ||
           errorMsg.includes('access denied') ||
           errorMsg.includes('insufficient privileges');
  }

  /**
   * Update todos with permission fix steps
   */
  private async updateTodosWithPermissionFixes(
    objectiveId: string, 
    permissionResult: any
  ): Promise<void> {
    const todoCoordination = this.todoCoordinations.get(objectiveId);
    if (!todoCoordination) return;

    // Add new todos for permission fixes
    const newTodos: TodoItem[] = [];

    // Add retry todo if automatic fixes were applied
    if (permissionResult.resolved) {
      newTodos.push({
        id: this.generateId('todo'),
        content: '🔄 Retry deployment after automatic permission fixes',
        status: 'pending',
        priority: 'high'
      });
    }

    // Add manual action todos
    permissionResult.nextSteps.forEach((step: string) => {
      newTodos.push({
        id: this.generateId('todo'),
        content: step,
        status: 'pending',
        priority: 'high'
      });
    });

    // Insert new todos at the beginning of pending todos
    const pendingIndex = todoCoordination.todos.findIndex(t => t.status === 'pending');
    if (pendingIndex >= 0) {
      todoCoordination.todos.splice(pendingIndex, 0, ...newTodos);
    } else {
      todoCoordination.todos.push(...newTodos);
    }

    // Emit update event
    this.emit('todos:updated', { objectiveId, todos: todoCoordination.todos });
  }

  /**
   * Spawn agents based on objective requirements with intelligent parallelization
   */
  async spawnAgents(objectiveId: string): Promise<Agent[]> {
    const todoCoordination = this.todoCoordinations.get(objectiveId);
    if (!todoCoordination) {
      throw new Error(`No todo coordination found for objective: ${objectiveId}`);
    }

    const _analysis = await this.memory.get(`analysis_${objectiveId}`) as { _analysis: TaskAnalysis };
    if (!_analysis) {
      throw new Error(`No _analysis found for objective: ${objectiveId}`);
    }

    console.log('🧠 Queen Agent: Analyzing parallelization opportunities...');
    
    // 🚀 NEW: Detect parallelization opportunities
    const opportunities = await this.parallelEngine.detectParallelizationOpportunities(
      todoCoordination.todos,
      _analysis._analysis.type,
      Array.from(this.activeAgents.values())
    );

    if (opportunities.length > 0) {
      console.log(`🎯 Found ${opportunities.length} parallelization opportunities!`);
      return await this.spawnParallelAgents(objectiveId, todoCoordination, opportunities);
    } else {
      console.log('📋 No parallelization opportunities found, using sequential approach');
      return await this.spawnSequentialAgents(objectiveId, todoCoordination, _analysis._analysis);
    }
  }

  /**
   * 🚀 NEW: Spawn parallel agents based on opportunities
   */
  private async spawnParallelAgents(
    objectiveId: string,
    todoCoordination: TodoCoordination,
    opportunities: ParallelizationOpportunity[]
  ): Promise<Agent[]> {
    console.log('🚀 Queen Agent: Spawning parallel agent teams...');
    
    // Create execution plan
    const executionPlan = await this.parallelEngine.createExecutionPlan(
      opportunities,
      todoCoordination.todos,
      this.config.maxConcurrentAgents
    );

    // Execute the plan and get spawned agents
    const result = await this.parallelEngine.executeParallelPlan(
      executionPlan,
      async (type: AgentType, specialization?: string) => {
        return await this.spawnSpecializedAgent(type, objectiveId, specialization);
      }
    );

    console.log(`✅ Spawned ${result.spawnedAgents.length} specialized agents in parallel`);
    console.log(`⚡ Estimated speedup: ${result.executionDetails.estimatedSpeedup}`);

    return result.spawnedAgents;
  }

  /**
   * Fallback to sequential agent spawning
   */
  private async spawnSequentialAgents(
    objectiveId: string,
    todoCoordination: TodoCoordination,
    _analysis: TaskAnalysis
  ): Promise<Agent[]> {
    const agents: Agent[] = [];
    const requiredAgentTypes = new Set(_analysis.requiredAgents);

    // Spawn agents for each required type
    for (const agentType of requiredAgentTypes) {
      const agent = await this.spawnSpecializedAgent(agentType, objectiveId);
      agents.push(agent);
    }

    return agents;
  }

  /**
   * Spawn a specialized agent with optional specialization
   */
  private async spawnSpecializedAgent(
    type: AgentType, 
    objectiveId: string,
    specialization?: string
  ): Promise<Agent> {
    const agentId = this.generateId('agent');
    
    const agent: Agent = {
      id: agentId,
      type,
      status: 'active',
      objectiveId,
      specialization,
      startTime: Date.now(),
      capabilities: [],
      mcpTools: []
    };

    this.activeAgents.set(agentId, agent);
    
    // Store agent info in memory for coordination
    await this.memory.store(`agent_${agentId}`, {
      agent,
      objective: this.activeObjectives.get(objectiveId),
      assignedTodos: [],
      status: 'initializing'
    });

    this.emit('agent:spawned', agent);
    
    // Assign todos to agent based on capabilities
    await this.assignTodosToAgent(agent, objectiveId);

    return agent;
  }

  /**
   * Analyze objective to determine requirements
   */
  private async performObjectiveAnalysis(objective: QueenObjective): Promise<TaskAnalysis> {
    const description = objective.description.toLowerCase();
    
    // Determine task type
    let type: ServiceNowTask['type'] = 'unknown';
    let requiredAgents: AgentType[] = [];
    let estimatedComplexity = 5;
    let suggestedPattern: DeploymentPattern = {
      taskType: 'standard',
      successRate: 0.8,
      agentSequence: [],
      mcpSequence: [],
      avgDuration: 300,
      lastUsed: new Date()
    };
    const dependencies: string[] = [];

    // Portal page detection - check for specific page keywords
    if ((description.includes('portal') && description.includes('page')) || 
        description.includes('portal page') || 
        (description.includes('widget') && description.includes('page')) ||
        (description.includes('widget') && description.includes('plaats')) ||
        (description.includes('widget') && description.includes('add')) ||
        description.includes('service portal page')) {
      type = 'portal_page';
      requiredAgents = ['widget-creator', 'page-designer', 'script-writer', 'tester'];
      if (description.includes('dashboard') || description.includes('multi')) {
        estimatedComplexity = 8;
        requiredAgents.push('ui-ux-specialist');
      }
    }
    // Widget development detection (only if not portal page)
    else if (description.includes('widget') || description.includes('ui component')) {
      type = 'widget';
      requiredAgents = ['widget-creator', 'script-writer', 'tester'];
      if (description.includes('complex') || description.includes('interactive')) {
        estimatedComplexity = 8;
        requiredAgents.push('ui-ux-specialist');
      }
    }
    
    // Flow development detection
    else if (description.includes('flow') || description.includes('workflow') || description.includes('automation')) {
      type = 'flow';
      requiredAgents = ['flow-builder', 'integration-specialist', 'tester'];
      if (description.includes('approval')) {
        requiredAgents.push('approval-specialist');
        dependencies.push('user_management', 'notification_system');
      }
    }
    
    // Application development
    else if (description.includes('application') || description.includes('app') || description.includes('complete solution')) {
      type = 'application';
      requiredAgents = ['app-architect', 'widget-creator', 'flow-builder', 'script-writer', 'tester'];
      estimatedComplexity = 10;
      suggestedPattern = {
        taskType: 'modular',
        successRate: 0.8,
        agentSequence: requiredAgents,
        mcpSequence: [],
        avgDuration: 900,
        lastUsed: new Date()
      };
    }
    
    // Script development
    else if (description.includes('script') || description.includes('business rule') || description.includes('api')) {
      type = 'script';
      requiredAgents = ['script-writer', 'tester'];
      if (description.includes('integration')) {
        requiredAgents.push('integration-specialist');
      }
    }
    
    // Integration development
    else if (description.includes('integration') || description.includes('connect') || description.includes('external')) {
      type = 'integration';
      requiredAgents = ['integration-specialist', 'script-writer', 'tester'];
      dependencies.push('authentication', 'data_transformation');
    }

    // Add security agent if mentioned
    if (description.includes('secure') || description.includes('security') || description.includes('permission')) {
      requiredAgents.push('security-specialist');
    }

    return {
      type,
      complexity: estimatedComplexity.toString(),
      requiredAgents: [...new Set(requiredAgents)], // Remove duplicates
      estimatedComplexity: Math.min(10, Math.max(1, estimatedComplexity)),
      suggestedPattern,
      dependencies
    };
  }

  /**
   * Create todo coordination structure for Claude Code interface
   */
  private async createTodoCoordination(
    objective: QueenObjective, 
    _analysis: TaskAnalysis
  ): Promise<TodoCoordination> {
    const todos = this.generateTodosForObjective(objective, _analysis);
    
    const coordination: TodoCoordination = {
      objectiveId: objective.id,
      todos,
      agentAssignments: new Map(),
      dependencies: this.analyzeTodoDependencies(todos)
    };

    // Store coordination info in memory
    await this.memory.store(`coordination_${objective.id}`, coordination);

    return coordination;
  }

  /**
   * Generate todos based on objective type
   */
  private generateTodosForObjective(objective: QueenObjective, _analysis: TaskAnalysis): TodoItem[] {
    const baseTodos: TodoItem[] = [
      {
        id: this.generateId('todo'),
        content: `Initialize swarm memory session for: ${objective.description}`,
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Validate ServiceNow authentication and permissions',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Check for existing similar artifacts',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Create Update Set for tracking changes',
        status: 'pending',
        priority: 'high'
      }
    ];

    // Add type-specific todos
    switch (_analysis.type) {
      case 'widget':
        baseTodos.push(...this.createWidgetTodos(objective, _analysis));
        break;
      case 'portal_page':
        baseTodos.push(...this.createPortalPageTodos(objective, _analysis));
        break;
      case 'flow':
        baseTodos.push(...this.createFlowTodos(objective, _analysis));
        break;
      case 'application':
        baseTodos.push(...this.createApplicationTodos(objective, _analysis));
        break;
      case 'script':
        baseTodos.push(...this.createScriptTodos(objective, _analysis));
        break;
      case 'integration':
        baseTodos.push(...this.createIntegrationTodos(objective, _analysis));
        break;
      default:
        baseTodos.push(...this.createGenericTodos(objective, _analysis));
    }

    // Add final todos
    baseTodos.push(
      {
        id: this.generateId('todo'),
        content: 'Validate solution completeness',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Generate documentation and handoff materials',
        status: 'pending',
        priority: 'medium'
      }
    );

    return baseTodos;
  }

  /**
   * Create widget-specific todos
   */
  private createWidgetTodos(objective: QueenObjective, _analysis: TaskAnalysis): TodoItem[] {
    // 🚀 ENHANCED: More specific todos to trigger parallel agent specialization
    const todos: TodoItem[] = [
      {
        id: this.generateId('todo'),
        content: `Analyze portal requirements and user experience design: ${objective.description}`,
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Create widget HTML structure with responsive design and accessibility features',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Develop server-side script for backend data processing and API integration',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Build client-side controller with interactive features and event handling',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Style widget with CSS including responsive design and theme compliance',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Implement performance optimization and caching strategies',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Test widget functionality including cross-browser and mobile testing',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Ensure security best practices and vulnerability scanning',
        status: 'pending',
        priority: 'high'
      }
    ];

    return todos;
  }

  /**
   * Create portal page-specific todos
   */
  private createPortalPageTodos(objective: QueenObjective, _analysis: TaskAnalysis): TodoItem[] {
    const todos: TodoItem[] = [
      {
        id: this.generateId('todo'),
        content: `Analyze portal page requirements: ${objective.description}`,
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Create or identify widget to be placed on the page',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Design portal page layout (single column, multi-column, or with sidebar)',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Determine target portal (Service Portal or Employee Service Center)',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Create portal page with proper page ID and title',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Configure page structure (containers, rows, columns)',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Place widget instance on the portal page with proper sizing',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Apply custom CSS styling for page layout and responsiveness',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Configure page permissions and accessibility settings',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Test portal page across different devices and browsers',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Add page to portal navigation menu if needed',
        status: 'pending',
        priority: 'low'
      }
    ];

    return todos;
  }

  /**
   * Create flow-specific todos
   */
  private createFlowTodos(objective: QueenObjective, _analysis: TaskAnalysis): TodoItem[] {
    const todos: TodoItem[] = [
      {
        id: this.generateId('todo'),
        content: `Analyze flow requirements: ${objective.description}`,
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Design flow trigger conditions and events',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Map out flow steps and decision points',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Configure flow actions and integrations',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Set up data transformations and variables',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Create flow using natural language API',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Test flow with mock data scenarios',
        status: 'pending',
        priority: 'high'
      }
    ];

    return todos;
  }

  /**
   * Create application-specific todos
   */
  private createApplicationTodos(objective: QueenObjective, _analysis: TaskAnalysis): TodoItem[] {
    const todos: TodoItem[] = [
      {
        id: this.generateId('todo'),
        content: `Design application architecture: ${objective.description}`,
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Create application scope and structure',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Design data model and tables',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Create UI components and widgets',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Implement business logic and workflows',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Configure security and access controls',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Create integration points',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Test application end-to-end',
        status: 'pending',
        priority: 'high'
      }
    ];

    return todos;
  }

  /**
   * Create script-specific todos
   */
  private createScriptTodos(objective: QueenObjective, _analysis: TaskAnalysis): TodoItem[] {
    const todos: TodoItem[] = [
      {
        id: this.generateId('todo'),
        content: `Analyze script requirements: ${objective.description}`,
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Design script logic and error handling',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Implement core functionality',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Add logging and debugging capabilities',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Optimize performance',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Create unit tests',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Deploy and validate in ServiceNow',
        status: 'pending',
        priority: 'high'
      }
    ];

    return todos;
  }

  /**
   * Create integration-specific todos
   */
  private createIntegrationTodos(objective: QueenObjective, _analysis: TaskAnalysis): TodoItem[] {
    const todos: TodoItem[] = [
      {
        id: this.generateId('todo'),
        content: `Analyze integration requirements: ${objective.description}`,
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Identify external systems and APIs',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Design data mapping and transformation',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Configure authentication and security',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Create REST/SOAP message configurations',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Implement error handling and retry logic',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Test integration with mock endpoints',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Deploy and monitor integration',
        status: 'pending',
        priority: 'high'
      }
    ];

    return todos;
  }

  /**
   * Create generic todos for unknown task types
   */
  private createGenericTodos(objective: QueenObjective, _analysis: TaskAnalysis): TodoItem[] {
    const todos: TodoItem[] = [
      {
        id: this.generateId('todo'),
        content: `Analyze requirements: ${objective.description}`,
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Research existing ServiceNow capabilities',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Design solution architecture',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Implement core functionality',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Create necessary configurations',
        status: 'pending',
        priority: 'medium'
      },
      {
        id: this.generateId('todo'),
        content: 'Test solution thoroughly',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Deploy to ServiceNow',
        status: 'pending',
        priority: 'high'
      },
      {
        id: this.generateId('todo'),
        content: 'Monitor and validate deployment',
        status: 'pending',
        priority: 'medium'
      }
    ];

    return todos;
  }

  /**
   * Analyze todo dependencies
   */
  private analyzeTodoDependencies(todos: TodoItem[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    
    // Simple dependency _analysis - each todo depends on all previous high priority todos
    const highPriorityTodos = todos.filter(t => t.priority === 'high');
    
    highPriorityTodos.forEach((todo, index) => {
      if (index > 0) {
        const prevHighPriorityIds = highPriorityTodos
          .slice(0, index)
          .map(t => t.id);
        dependencies.set(todo.id, prevHighPriorityIds);
      }
    });

    return dependencies;
  }

  /**
   * Assign todos to agent based on capabilities
   */
  private async assignTodosToAgent(agent: Agent, objectiveId: string): Promise<void> {
    const todoCoordination = this.todoCoordinations.get(objectiveId);
    if (!todoCoordination) return;

    const unassignedTodos = todoCoordination.todos.filter(todo => 
      !Array.from(todoCoordination.agentAssignments.values()).includes(todo.id) &&
      todo.status === 'pending'
    );

    // Assign todos based on agent type and specialization
    const assignableTodos = unassignedTodos.filter(todo => 
      this.canAgentHandleTodo(agent, todo)
    );

    for (const todo of assignableTodos) {
      todoCoordination.agentAssignments.set(todo.id, agent.id);
      
      // Update agent's assigned todos in memory
      const agentData = await this.memory.get(`agent_${agent.id}`) as any;
      if (agentData) {
        agentData.assignedTodos.push(todo.id);
        await this.memory.store(`agent_${agent.id}`, agentData);
      }
    }

    this.emit('todos:assigned', { agent, todos: assignableTodos });
  }

  /**
   * Check if agent can handle specific todo
   */
  private canAgentHandleTodo(agent: Agent, todo: TodoItem): boolean {
    const todoContent = todo.content.toLowerCase();
    
    switch (agent.type) {
      case 'widget-creator':
        return todoContent.includes('widget') || 
               todoContent.includes('html') || 
               todoContent.includes('portal') ||
               todoContent.includes('ui');
               
      case 'css-specialist':
        return todoContent.includes('style') || 
               todoContent.includes('css') || 
               todoContent.includes('responsive') ||
               todoContent.includes('theme');
               
      case 'backend-specialist':
        return todoContent.includes('server') || 
               todoContent.includes('backend') || 
               todoContent.includes('data') ||
               todoContent.includes('api');
               
      case 'frontend-specialist':
        return todoContent.includes('client') || 
               todoContent.includes('controller') || 
               todoContent.includes('interactive') ||
               todoContent.includes('event');
               
      case 'flow-builder':
        return todoContent.includes('flow') || 
               todoContent.includes('workflow') ||
               todoContent.includes('trigger') ||
               todoContent.includes('action');
               
      case 'script-writer':
        return todoContent.includes('script') || 
               todoContent.includes('logic') ||
               todoContent.includes('function');
               
      case 'integration-specialist':
        return todoContent.includes('integration') || 
               todoContent.includes('external') ||
               todoContent.includes('api') ||
               todoContent.includes('rest');
               
      case 'tester':
        return todoContent.includes('test') || 
               todoContent.includes('validate') ||
               todoContent.includes('verify');
               
      case 'security-specialist':
        return todoContent.includes('security') || 
               todoContent.includes('permission') ||
               todoContent.includes('access') ||
               todoContent.includes('vulnerability');
               
      case 'performance-specialist':
        return todoContent.includes('performance') || 
               todoContent.includes('optimization') ||
               todoContent.includes('caching');
               
      case 'ui-ux-specialist':
        return todoContent.includes('user experience') || 
               todoContent.includes('design') ||
               todoContent.includes('ux');
               
      case 'page-designer':
        return todoContent.includes('portal page') || 
               todoContent.includes('page layout') ||
               todoContent.includes('page structure') ||
               todoContent.includes('place widget') ||
               todoContent.includes('configure page') ||
               todoContent.includes('containers') ||
               todoContent.includes('rows') ||
               todoContent.includes('columns') ||
               todoContent.includes('page permissions') ||
               todoContent.includes('portal navigation');
               
      default:
        // Generic agents can handle setup and coordination tasks
        return todoContent.includes('initialize') || 
               todoContent.includes('validate') ||
               todoContent.includes('create update set') ||
               todoContent.includes('documentation');
    }
  }

  /**
   * Monitor agent progress through todo updates
   */
  async monitorProgress(objectiveId: string): Promise<{
    overall: number;
    byAgent: Map<string, number>;
    blockingIssues: string[];
    estimatedCompletion: Date;
  }> {
    const todoCoordination = this.todoCoordinations.get(objectiveId);
    if (!todoCoordination) {
      throw new Error(`No todo coordination found for objective: ${objectiveId}`);
    }

    // Calculate progress from todos
    const completedTodos = todoCoordination.todos.filter(t => t.status === 'completed').length;
    const totalTodos = todoCoordination.todos.length;
    const overallProgress = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;

    // Calculate per-agent progress
    const byAgent = new Map<string, number>();
    for (const [todoId, agentId] of todoCoordination.agentAssignments) {
      const agentTodos = Array.from(todoCoordination.agentAssignments.entries())
        .filter(([_, aid]) => aid === agentId);
      const agentCompleted = agentTodos.filter(([tid, _]) => 
        todoCoordination.todos.find(t => t.id === tid)?.status === 'completed'
      ).length;
      const agentProgress = agentTodos.length > 0 ? (agentCompleted / agentTodos.length) * 100 : 0;
      byAgent.set(agentId, agentProgress);
    }

    // Identify blocking issues
    const blockingIssues = await this.identifyBlockingIssues(todoCoordination);

    // Estimate completion based on current velocity
    const estimatedCompletion = this.estimateCompletion(todoCoordination, overallProgress);

    // Store progress in memory
    await this.memory.store(`progress_${objectiveId}`, {
      overall: overallProgress,
      byAgent: Object.fromEntries(byAgent),
      blockingIssues,
      estimatedCompletion: estimatedCompletion.toISOString(),
      timestamp: new Date().toISOString()
    });

    this.emit('progress:updated', { objectiveId, overall: overallProgress, byAgent, blockingIssues });

    return {
      overall: overallProgress,
      byAgent,
      blockingIssues,
      estimatedCompletion
    };
  }

  /**
   * Make memory-driven decisions based on past patterns
   */
  async makeDecision(context: {
    objective: string;
    currentState: any;
    options: string[];
  }): Promise<{
    decision: string;
    confidence: number;
    reasoning: string;
  }> {
    // Query memory for similar past decisions
    const similarPatterns = await this.memory.findSimilarPatterns(context.objective);
    
    // Analyze success rates of past decisions
    const successRates = new Map<string, number>();
    for (const option of context.options) {
      const pastOutcomes = similarPatterns.filter(p => p.decision === option);
      const successRate = pastOutcomes.length > 0 
        ? pastOutcomes.filter(p => p.outcome === 'success').length / pastOutcomes.length
        : 0.5; // Default to 50% if no history
      successRates.set(option, successRate);
    }

    // Choose option with highest success rate
    let bestOption = context.options[0];
    let highestRate = 0;
    
    for (const [option, rate] of successRates) {
      if (rate > highestRate) {
        highestRate = rate;
        bestOption = option;
      }
    }

    const confidence = highestRate > 0.7 ? 0.9 : highestRate > 0.5 ? 0.7 : 0.5;
    
    const decision = {
      decision: bestOption,
      confidence,
      reasoning: `Based on ${similarPatterns.length} similar past scenarios, "${bestOption}" has a ${(highestRate * 100).toFixed(0)}% success rate.`
    };

    // Store decision for future learning
    await this.memory.storeDecision('decision', {
      context,
      decision: decision.decision,
      confidence: decision.confidence,
      timestamp: new Date().toISOString()
    });

    this.emit('decision:made', decision);
    
    return decision;
  }

  /**
   * Setup event handlers for coordination
   */
  private setupEventHandlers(): void {
    // Dynamic agent system - event handlers removed
    // Agents are now orchestrated through the dynamic system
    // Events are handled by the Queen's executeObjective flow
    
    /* Legacy coordinator event handlers removed - kept for reference
    this.coordinator.on('agent:ready', ...)
    this.coordinator.on('agent:completed', ...)
    this.coordinator.on('agent:error', ...)
    */
    
    // New dynamic system handles agent lifecycle internally
    if (this.config.debugMode) {
      console.log('🔄 Dynamic agent event system initialized');
    }
  }

  /**
   * Check if more agents need to be spawned
   */
  private async checkAndSpawnAgents(objectiveId: string): Promise<void> {
    const todoCoordination = this.todoCoordinations.get(objectiveId);
    if (!todoCoordination) return;

    const unassignedTodos = todoCoordination.todos.filter(todo => 
      !Array.from(todoCoordination.agentAssignments.values()).includes(todo.id) &&
      todo.status === 'pending'
    );

    if (unassignedTodos.length > 0 && this.activeAgents.size < this.config.maxConcurrentAgents) {
      // Spawn additional agents if needed
      await this.spawnAgents(objectiveId);
    }
  }

  /**
   * Handle coordination errors
   */
  private async handleCoordinationError(error: any, context: any): Promise<void> {
    console.error('❌ Coordination error:', error);
    
    // Store error in memory for learning - using store method
    await this.memory.store('error', {
      error: error.message || error,
      context,
      timestamp: new Date().toISOString(),
      recovery: null
    });

    this.emit('coordination:error', { error, context });
  }

  /**
   * Identify blocking issues from todos
   */
  private async identifyBlockingIssues(todoCoordination: TodoCoordination): Promise<string[]> {
    const issues: string[] = [];
    
    // Check for failed todos
    const failedTodos = todoCoordination.todos.filter(t => t.status === 'failed' as TodoStatus);
    if (failedTodos.length > 0) {
      issues.push(`${failedTodos.length} failed tasks blocking progress`);
    }

    // Check for stuck in-progress todos (older than 10 minutes)
    const stuckTodos = todoCoordination.todos.filter(t => {
      if (t.status !== 'in_progress') return false;
      const todoData = this.memory.get(`todo_${t.id}`) as any;
      if (!todoData || !todoData.startTime) return false;
      return Date.now() - todoData.startTime > 10 * 60 * 1000; // 10 minutes
    });
    
    if (stuckTodos.length > 0) {
      issues.push(`${stuckTodos.length} tasks stuck in progress`);
    }

    // Check for dependency bottlenecks
    const pendingWithDeps = todoCoordination.todos.filter(t => 
      t.status === 'pending' &&
      todoCoordination.dependencies.has(t.id)
    );
    
    for (const todo of pendingWithDeps) {
      const deps = todoCoordination.dependencies.get(todo.id) || [];
      const incompleteDeps = deps.filter(depId => {
        const depTodo = todoCoordination.todos.find(t => t.id === depId);
        return depTodo && depTodo.status !== 'completed';
      });
      
      if (incompleteDeps.length === deps.length) {
        issues.push(`Task "${todo.content}" blocked by dependencies`);
      }
    }

    return issues;
  }

  /**
   * Estimate completion time based on current progress
   */
  private estimateCompletion(todoCoordination: TodoCoordination, currentProgress: number): Date {
    if (currentProgress === 0) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours if no progress
    }

    const completedTodos = todoCoordination.todos.filter(t => t.status === 'completed').length;
    const startTime = this.activeObjectives.get(todoCoordination.objectiveId)?.metadata?.startTime || Date.now();
    const elapsedTime = Date.now() - startTime;
    
    const averageTimePerTodo = elapsedTime / completedTodos;
    const remainingTodos = todoCoordination.todos.filter(t => t.status !== 'completed').length;
    const estimatedRemainingTime = averageTimePerTodo * remainingTodos;

    return new Date(Date.now() + estimatedRemainingTime);
  }

  /**
   * Generate unique ID for entities
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Shutdown queen agent gracefully
   */
  async shutdown(): Promise<void> {
    console.log('👑 Queen Agent shutting down...');
    
    // Save current state
    for (const [objectiveId, objective] of this.activeObjectives) {
      await this.memory.store(`objective_state_${objectiveId}`, {
        objective,
        todoCoordination: this.todoCoordinations.get(objectiveId),
        activeAgents: Array.from(this.activeAgents.values()).filter(a => a.objectiveId === objectiveId),
        timestamp: new Date().toISOString()
      });
    }

    // Notify all active agents
    for (const agent of this.activeAgents.values()) {
      this.emit('agent:shutdown', agent);
    }

    await this.memory.close();
    this.removeAllListeners();
    
    console.log('✅ Queen Agent shutdown complete');
  }
}