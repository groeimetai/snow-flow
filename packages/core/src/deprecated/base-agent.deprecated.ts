/**
 * Base Agent Class
 * Common functionality for all ServiceNow specialist agents
 */

import { Agent, AgentMessage, ServiceNowArtifact, AgentType } from '../queen/types';
import { QueenMemorySystem } from '../queen/queen-memory';
import * as crypto from 'crypto';

export interface AgentConfig {
  id?: string;
  type: AgentType;
  capabilities: string[];
  mcpTools: string[];
  memoryPath?: string;
  debugMode?: boolean;
}

export interface AgentResult {
  success: boolean;
  artifacts?: ServiceNowArtifact[];
  message?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

export abstract class BaseAgent implements Agent {
  public id: string;
  public type: AgentType;
  public status: Agent['status'];
  public task?: string;
  public capabilities: string[];
  public mcpTools: string[];
  
  protected memory: QueenMemorySystem;
  protected debugMode: boolean;
  protected messageQueue: AgentMessage[] = [];

  constructor(config: AgentConfig) {
    this.id = config.id || this.generateAgentId(config.type);
    this.type = config.type;
    this.status = 'idle';
    this.capabilities = config.capabilities;
    this.mcpTools = config.mcpTools;
    this.debugMode = config.debugMode || false;
    
    // Initialize memory system
    this.memory = new QueenMemorySystem(config.memoryPath);
    
    if (this.debugMode) {
      console.log(`🤖 ${this.type} agent initialized with ID: ${this.id}`);
    }
  }

  /**
   * Execute the agent's main task
   * Must be implemented by each specific agent
   */
  abstract execute(instruction: string, context?: Record<string, any>): Promise<AgentResult>;

  /**
   * Validate agent can handle the task
   * Can be overridden by specific agents
   */
  async canHandle(instruction: string): Promise<boolean> {
    // Default implementation checks if instruction mentions agent capabilities
    const lowerInstruction = instruction.toLowerCase();
    return this.capabilities.some(capability => 
      lowerInstruction.includes(capability.toLowerCase().split(' ')[0])
    );
  }

  /**
   * Store artifact in shared memory for other agents
   */
  protected async storeArtifact(artifact: ServiceNowArtifact): Promise<void> {
    const key = `artifact_${artifact.type}_${artifact.name}`;
    await this.memory.storeInContext(key, artifact);
    
    if (this.debugMode) {
      console.log(`📦 Stored artifact: ${key}`);
    }
  }

  /**
   * Retrieve artifact from shared memory
   */
  protected async getArtifact(type: string, name: string): Promise<ServiceNowArtifact | null> {
    const key = `artifact_${type}_${name}`;
    return await this.memory.getFromContext(key);
  }

  /**
   * Report progress to Queen Agent
   */
  protected async reportProgress(message: string, percentage: number): Promise<void> {
    const progressKey = `progress_${this.id}`;
    await this.memory.storeInContext(progressKey, {
      agentId: this.id,
      agentType: this.type,
      message,
      percentage,
      timestamp: new Date()
    });
    
    if (this.debugMode) {
      console.log(`📊 ${this.type}: ${message} (${percentage}%)`);
    }
  }

  /**
   * Send message to another agent
   */
  protected sendMessage(to: string, type: AgentMessage['type'], content: any): void {
    const message: AgentMessage = {
      from: this.id,
      to,
      type,
      content,
      timestamp: new Date()
    };
    
    // Store in shared memory for recipient
    const messageKey = `message_${to}_${Date.now()}`;
    this.memory.storeInContext(messageKey, message);
    
    if (this.debugMode) {
      console.log(`📨 Message sent from ${this.id} to ${to}: ${type}`);
    }
  }

  /**
   * Retrieve messages for this agent
   */
  protected async getMessages(): Promise<AgentMessage[]> {
    const _messagePrefix = `message_${this.id}_`;
    const messages: AgentMessage[] = [];
    
    // This is a simplified implementation
    // In a real system, we'd query the memory system more efficiently
    return messages;
  }

  /**
   * Handle coordination with other agents
   */
  protected async coordinateWith(agentType: AgentType, request: any): Promise<any> {
    const coordinationKey = `coordination_${this.id}_${agentType}_${Date.now()}`;
    await this.memory.storeInContext(coordinationKey, {
      from: this.id,
      toType: agentType,
      request,
      timestamp: new Date()
    });
    
    // Wait for response (simplified)
    const responseKey = `${coordinationKey}_response`;
    let attempts = 0;
    while (attempts < 30) { // 30 second timeout
      const response = await this.memory.getFromContext(responseKey);
      if (response) {
        return response;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error(`Coordination timeout with ${agentType}`);
  }

  /**
   * Log activity for learning
   */
  protected async logActivity(action: string, success: boolean, details?: any): Promise<void> {
    const learningKey = `agent_activity_${this.type}_${action}`;
    await this.memory.storeLearning(learningKey, JSON.stringify({
      agentId: this.id,
      action,
      success,
      details,
      timestamp: new Date()
    }), success ? 0.9 : 0.3);
  }

  /**
   * Update agent status
   */
  protected setStatus(status: Agent['status']): void {
    this.status = status;
    const statusKey = `agent_status_${this.id}`;
    this.memory.storeInContext(statusKey, {
      agentId: this.id,
      status,
      timestamp: new Date()
    });
  }

  /**
   * Check if agent should work with another agent
   */
  protected shouldCoordinate(otherAgentType: AgentType): boolean {
    // Define coordination rules
    // Simplified coordination rules after flow-builder removal  
    const coordinationRules: Partial<Record<AgentType, AgentType[]>> = {
      'researcher': ['script-writer', 'researcher'],
      'script-writer': ['tester', 'app-architect'], 
      'widget-creator': ['researcher', 'ui-ux-specialist'],
      'app-architect': ['script-writer', 'integration-specialist'],
      'tester': ['script-writer', 'security-specialist'],
      'integration-specialist': ['app-architect', 'script-writer']
    };
    
    return coordinationRules[this.type]?.includes(otherAgentType) || false;
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(type: AgentType): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${type}_${timestamp}_${random}`;
  }

  /**
   * Get agent information
   */
  getInfo(): Record<string, any> {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      capabilities: this.capabilities,
      mcpTools: this.mcpTools,
      task: this.task
    };
  }

  /**
   * Cleanup agent resources
   */
  async cleanup(): Promise<void> {
    // Clean up any resources
    this.messageQueue = [];
    this.status = 'idle';
    
    if (this.debugMode) {
      console.log(`🧹 ${this.type} agent ${this.id} cleaned up`);
    }
  }
}