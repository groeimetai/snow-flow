/**
 * Queen Memory System with Hierarchical Patterns
 * Enhanced memory system for ServiceNow Queen Agent coordination
 */

import { HierarchicalMemorySystem } from '../memory/hierarchical-memory-system';
import { SnowFlowMemoryOrganizer, SNOW_FLOW_AGENT_CAPABILITIES } from '../memory/snow-flow-memory-patterns';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface QueenMemoryPattern {
  // Objective tracking
  'objectives/[id]/definition': 'Store objective details and requirements';
  'objectives/[id]/_analysis': 'Task _analysis and breakdown';
  'objectives/[id]/status': 'Current status and progress';
  
  // Agent coordination
  'agents/[id]/profile': 'Agent capabilities and status';
  'agents/[id]/tasks': 'Assigned tasks and progress';
  'agents/[id]/results': 'Task completion results';
  
  // ServiceNow artifacts
  'artifacts/widgets/[name]': 'Service Portal widgets';
  'artifacts/flows/[name]': 'Flow Designer flows';
  'artifacts/scripts/[name]': 'Scripts and includes';
  'artifacts/deployments/[id]': 'Deployment results';
  
  // Learning patterns
  'patterns/successful/[type]': 'Successful patterns for reuse';
  'patterns/failures/[type]': 'Failure patterns to avoid';
  'patterns/optimizations/[type]': 'Performance optimizations';
  
  // Swarm coordination
  'swarm/[id]/topology': 'Swarm structure and relationships';
  'swarm/[id]/communication': 'Inter-agent messages';
  'swarm/[id]/consensus': 'Decision points and outcomes';
}

export class QueenMemorySystem extends EventEmitter {
  private memory: HierarchicalMemorySystem;
  private logger: Logger;
  private objectiveCache: Map<string, any> = new Map();
  private agentIndex: Map<string, Set<string>> = new Map(); // agentId -> memory keys

  constructor(memory: HierarchicalMemorySystem) {
    super();
    this.memory = memory;
    this.logger = new Logger('QueenMemorySystem');
  }

  /**
   * Store objective with full context
   */
  async storeObjective(objectiveId: string, objective: {
    description: string;
    requirements?: string[];
    constraints?: string[];
    expectedOutcome?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    const key = `objectives/${objectiveId}/definition`;
    
    await this.memory.storeHierarchical({
      key,
      namespace: 'objectives',
      type: 'definition',
      value: objective,
      metadata: {
        tags: ['objective', 'requirement', objective.priority || 'medium'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1
      },
      ttl: 86400000 * 30, // 30 days
    });

    this.objectiveCache.set(objectiveId, objective);
    this.emit('objective:stored', { objectiveId, objective });
  }

  /**
   * Store task _analysis with patterns
   */
  async storeTaskAnalysis(objectiveId: string, _analysis: {
    taskType: string;
    requiredCapabilities: string[];
    suggestedAgents: string[];
    estimatedComplexity: number;
    dependencies?: string[];
    similarPatterns?: string[];
  }): Promise<void> {
    const key = `objectives/${objectiveId}/_analysis`;
    
    await this.memory.storeHierarchical({
      key,
      namespace: 'objectives',
      type: '_analysis',
      value: _analysis,
      metadata: {
        tags: ['_analysis', _analysis.taskType, 'complexity-' + _analysis.estimatedComplexity],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1,
        relationships: {
          requires: _analysis.dependencies || [],
          similar: _analysis.similarPatterns || [],
        },
      },
    });

    // Track patterns for learning
    if (_analysis.similarPatterns && _analysis.similarPatterns.length > 0) {
      await this.memory.trackAccessPattern('pattern_reuse', {
        objectiveId,
        patterns: _analysis.similarPatterns,
      });
    }
  }

  /**
   * Store agent profile with capabilities
   */
  async storeAgentProfile(agentId: string, profile: {
    type: string;
    capabilities: string[];
    status: 'idle' | 'working' | 'completed' | 'failed';
    performance?: {
      tasksCompleted: number;
      successRate: number;
      avgExecutionTime: number;
    };
  }): Promise<void> {
    const key = `agents/${agentId}/profile`;
    
    await this.memory.storeHierarchical({
      key,
      namespace: 'agents',
      type: 'profile',
      value: profile,
      metadata: {
        tags: ['agent', profile.type, profile.status, ...profile.capabilities],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1
      },
    });

    // Update agent index
    if (!this.agentIndex.has(agentId)) {
      this.agentIndex.set(agentId, new Set());
    }
    this.agentIndex.get(agentId)!.add(key);
  }

  /**
   * Store agent task assignment
   */
  async storeAgentTask(agentId: string, taskId: string, task: {
    objective: string;
    action: string;
    priority: number;
    dependencies?: string[];
    deadline?: Date;
  }): Promise<void> {
    const key = `agents/${agentId}/tasks/${taskId}`;
    
    await this.memory.storeHierarchical({
      key,
      namespace: 'agents',
      type: 'task',
      value: task,
      metadata: {
        tags: ['task', 'agent-task', `priority-${task.priority}`],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1,
        relationships: {
          assignedTo: [agentId],
          dependsOn: task.dependencies || [],
        },
      },
    });

    // Create relationship
    await this.memory.createRelationship(
      `agents/${agentId}/profile`,
      key,
      'assigned_task',
      { assignedAt: new Date().toISOString() }
    );

    this.agentIndex.get(agentId)?.add(key);
  }

  /**
   * Store ServiceNow artifact with full metadata
   */
  async storeArtifact(artifact: {
    type: 'widget' | 'flow' | 'script' | 'table' | 'application';
    name: string;
    sysId?: string;
    content: any;
    dependencies?: string[];
    deployment?: {
      instance: string;
      updateSet?: string;
      deployedAt: Date;
    };
  }): Promise<void> {
    const key = `artifacts/${artifact.type}s/${artifact.name}`;
    const memoryStructure = this.getArtifactMemoryStructure(artifact);
    
    await this.memory.storeHierarchical({
      key,
      namespace: 'artifacts',
      type: artifact.type,
      value: {
        ...artifact,
        memoryMetadata: memoryStructure,
      },
      metadata: {
        tags: ['artifact', artifact.type, 'servicenow'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1,
        relationships: {
          dependsOn: artifact.dependencies || [],
          deployedTo: artifact.deployment ? [artifact.deployment.instance] : [],
        },
      },
    });

    // Store deployment info separately if exists
    if (artifact.deployment) {
      await this.storeDeployment(artifact.name, { ...artifact.deployment, status: 'success' as const });
    }
  }

  /**
   * Store deployment information
   */
  async storeDeployment(artifactName: string, deployment: {
    instance: string;
    updateSet?: string;
    deployedAt: Date;
    status: 'success' | 'failed' | 'pending';
    errors?: string[];
  }): Promise<void> {
    const deploymentId = `${artifactName}_${deployment.instance}_${Date.now()}`;
    const key = `artifacts/deployments/${deploymentId}`;
    
    await this.memory.storeHierarchical({
      key,
      namespace: 'artifacts',
      type: 'deployment',
      value: deployment,
      metadata: {
        tags: ['deployment', deployment.status, deployment.instance],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1
      },
    });
  }

  /**
   * Store successful pattern for learning
   */
  async storeSuccessfulPattern(pattern: {
    type: string;
    objective: string;
    approach: string;
    agents: string[];
    duration: number;
    outcome: any;
  }): Promise<void> {
    const key = `patterns/successful/${pattern.type}/${Date.now()}`;
    
    await this.memory.storeHierarchical({
      key,
      namespace: 'patterns',
      type: 'successful',
      value: pattern,
      metadata: {
        tags: ['pattern', 'success', pattern.type],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1
      },
      ttl: 86400000 * 90, // 90 days
    });

    this.emit('pattern:learned', { type: 'success', pattern });
  }

  /**
   * Store failure pattern for avoidance
   */
  async storeFailurePattern(pattern: {
    type: string;
    objective: string;
    approach: string;
    failureReason: string;
    lessons: string[];
  }): Promise<void> {
    const key = `patterns/failures/${pattern.type}/${Date.now()}`;
    
    await this.memory.storeHierarchical({
      key,
      namespace: 'patterns',
      type: 'failure',
      value: pattern,
      metadata: {
        tags: ['pattern', 'failure', pattern.type],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1
      },
      ttl: 86400000 * 90, // 90 days
    });

    this.emit('pattern:learned', { type: 'failure', pattern });
  }

  /**
   * Find similar objectives from history
   */
  async findSimilarObjectives(objective: string, limit: number = 5): Promise<any[]> {
    // Search by objective keywords
    const keywords = objective.toLowerCase().split(' ')
      .filter(word => word.length > 3);
    
    const results = await this.memory.search({
      namespace: 'objectives',
      type: 'definition',
      limit: limit * 2, // Get more to filter
    });

    // Score by keyword matches
    const scored = results.map(entry => {
      const desc = (entry.value.description || '').toLowerCase();
      const score = keywords.reduce((sum, keyword) => 
        sum + (desc.includes(keyword) ? 1 : 0), 0
      );
      return { entry, score };
    });

    // Return top matches
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.entry);
  }

  /**
   * Get successful patterns for a task type
   */
  async getSuccessfulPatterns(taskType: string): Promise<any[]> {
    return await this.memory.search({
      namespace: 'patterns',
      type: 'successful',
      tags: [taskType],
      limit: 10,
    });
  }

  /**
   * Get agent's complete memory
   */
  async getAgentMemory(agentId: string): Promise<HierarchicalMemoryEntry[]> {
    return await this.memory.getAgentMemory(agentId);
  }

  /**
   * Get swarm coordination data
   */
  async getSwarmData(swarmId: string): Promise<{
    topology: any;
    communication: any[];
    consensus: any[];
  }> {
    const [topology, communication, consensus] = await Promise.all([
      this.memory.getHierarchical(`swarm/${swarmId}/topology`),
      this.memory.search({
        namespace: 'swarm',
        pattern: `${swarmId}/communication`,
      }),
      this.memory.search({
        namespace: 'swarm',
        pattern: `${swarmId}/consensus`,
      }),
    ]);

    return {
      topology: topology?.value || null,
      communication: communication.map(c => c.value),
      consensus: consensus.map(c => c.value),
    };
  }

  /**
   * Store inter-agent communication
   */
  async storeAgentCommunication(
    fromAgent: string,
    toAgent: string,
    message: any,
    swarmId?: string
  ): Promise<void> {
    const key = swarmId 
      ? `swarm/${swarmId}/communication/${Date.now()}`
      : `agents/communication/${fromAgent}_to_${toAgent}_${Date.now()}`;
    
    await this.memory.storeHierarchical({
      key,
      namespace: swarmId ? 'swarm' : 'agents',
      type: 'communication',
      value: {
        from: fromAgent,
        to: toAgent,
        message,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        tags: ['communication', 'agent-message'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1,
        relationships: {
          from: [fromAgent],
          to: [toAgent],
        },
      },
    });
  }

  /**
   * Get namespace statistics for monitoring
   */
  async getMemoryStats(): Promise<{
    namespaces: Record<string, number>;
    totalEntries: number;
    patterns: number;
    artifacts: number;
    agents: number;
  }> {
    const namespaces = await this.memory.getNamespaceStats();
    
    return {
      namespaces,
      totalEntries: Object.values(namespaces).reduce((sum, count) => sum + count, 0),
      patterns: namespaces['patterns'] || 0,
      artifacts: namespaces['artifacts'] || 0,
      agents: namespaces['agents'] || 0,
    };
  }

  /**
   * Helper to get artifact memory structure
   */
  private getArtifactMemoryStructure(artifact: any): any {
    switch (artifact.type) {
      case 'widget':
        return SnowFlowMemoryOrganizer.getWidgetMemoryStructure(artifact.name);
      case 'flow':
        return SnowFlowMemoryOrganizer.getFlowMemoryStructure(artifact.name);
      case 'script':
        return SnowFlowMemoryOrganizer.getScriptMemoryStructure(
          artifact.name, 
          artifact.scriptType || 'server'
        );
      default:
        return {
          key: SnowFlowMemoryOrganizer.generateKey('artifacts', artifact.type, artifact.name),
          metadata: {
            type: artifact.type,
            created: new Date().toISOString(),
          },
        };
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    return await this.memory.cleanupExpired();
  }
}