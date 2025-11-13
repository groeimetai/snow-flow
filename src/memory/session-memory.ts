/**
 * Session Memory System for Swarm Operations
 * Provides session-based memory storage for multi-agent coordination
 */

import { BasicMemorySystem } from './memory-system';

export class SessionMemorySystem extends BasicMemorySystem {
  /**
   * Store learning/session data
   * @param key - Storage key
   * @param data - Data to store
   */
  async storeLearning(key: string, data: any): Promise<void> {
    await this.store(key, data);
  }

  /**
   * Retrieve learning/session data
   * @param key - Storage key
   */
  async retrieveLearning(key: string): Promise<any> {
    return await this.retrieve(key);
  }

  /**
   * Get learning/session data (alias for retrieveLearning)
   * @param key - Storage key
   */
  async getLearning(key: string): Promise<any> {
    return await this.retrieveLearning(key);
  }

  /**
   * Update existing learning/session data
   * @param key - Storage key
   * @param updates - Partial updates to merge
   */
  async updateLearning(key: string, updates: any): Promise<void> {
    const existing = await this.retrieve(key);
    if (existing) {
      await this.store(key, { ...existing, ...updates });
    } else {
      await this.store(key, updates);
    }
  }

  /**
   * List all session keys
   */
  async listSessions(): Promise<string[]> {
    const allKeys = await this.list();
    return allKeys.filter(key => key.startsWith('session_'));
  }

  /**
   * Clear all session data
   */
  async clearSessions(): Promise<void> {
    const sessions = await this.listSessions();
    for (const session of sessions) {
      await this.delete(session);
    }
  }
}

/**
 * Queen Memory System for Multi-Agent Orchestration
 * Extends SessionMemorySystem with additional orchestration capabilities
 */
export class QueenMemorySystem extends SessionMemorySystem {
  /**
   * Store agent state
   * @param agentId - Agent identifier
   * @param state - Agent state data
   */
  async storeAgentState(agentId: string, state: any): Promise<void> {
    await this.store(`agent_${agentId}`, state);
  }

  /**
   * Get agent state
   * @param agentId - Agent identifier
   */
  async getAgentState(agentId: string): Promise<any> {
    return await this.retrieve(`agent_${agentId}`);
  }

  /**
   * List all active agents
   */
  async listAgents(): Promise<string[]> {
    const allKeys = await this.list();
    return allKeys
      .filter(key => key.startsWith('agent_'))
      .map(key => key.replace('agent_', ''));
  }

  /**
   * Store orchestration result
   * @param taskId - Task identifier
   * @param result - Task result data
   */
  async storeResult(taskId: string, result: any): Promise<void> {
    await this.store(`result_${taskId}`, result);
  }

  /**
   * Get orchestration result
   * @param taskId - Task identifier
   */
  async getResult(taskId: string): Promise<any> {
    return await this.retrieve(`result_${taskId}`);
  }
}
