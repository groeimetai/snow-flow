/**
 * MCP-based Todo Manager
 * Alternative to Claude Code's native TodoWrite which has a 30-second timeout
 * This uses our memory tools with NO timeout by default
 */

import { reliableMemory } from '../mcp/shared/reliable-memory-manager.js';
import { Logger } from './logger.js';

export interface Todo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignedAgent?: string;
  dependencies?: string[];
  estimatedTime?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TodoManagerMCP {
  private static instance: TodoManagerMCP;
  private logger: Logger;
  private readonly TODO_KEY = 'mcp_todos';

  private constructor() {
    this.logger = new Logger('TodoManagerMCP');
  }

  static getInstance(): TodoManagerMCP {
    if (!TodoManagerMCP.instance) {
      TodoManagerMCP.instance = new TodoManagerMCP();
    }
    return TodoManagerMCP.instance;
  }

  /**
   * Get all todos
   */
  async getTodos(): Promise<Todo[]> {
    try {
      const todos = await reliableMemory.retrieve(this.TODO_KEY);
      return todos || [];
    } catch (error) {
      this.logger.error('Failed to retrieve todos:', error);
      return [];
    }
  }

  /**
   * Update todos (replaces entire list like TodoWrite)
   */
  async updateTodos(todos: Todo[]): Promise<void> {
    try {
      // Add timestamps
      const updatedTodos = todos.map(todo => ({
        ...todo,
        updatedAt: new Date(),
        createdAt: todo.createdAt || new Date()
      }));

      // Store with NO timeout - operations run to completion
      await reliableMemory.store(this.TODO_KEY, updatedTodos);
      
      this.logger.info(`Updated ${todos.length} todos successfully`);
      
      // Also store a backup with timestamp
      const backupKey = `${this.TODO_KEY}_backup_${Date.now()}`;
      await reliableMemory.store(backupKey, updatedTodos, 86400000); // 24 hour expiry for backups
      
    } catch (error) {
      this.logger.error('Failed to update todos:', error);
      throw error;
    }
  }

  /**
   * Add a single todo
   */
  async addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    const todos = await this.getTodos();
    
    const newTodo: Todo = {
      ...todo,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    todos.push(newTodo);
    await this.updateTodos(todos);
    
    return newTodo;
  }

  /**
   * Update a single todo
   */
  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo | null> {
    const todos = await this.getTodos();
    const index = todos.findIndex(t => t.id === id);
    
    if (index === -1) {
      this.logger.warn(`Todo ${id} not found`);
      return null;
    }
    
    todos[index] = {
      ...todos[index],
      ...updates,
      id: todos[index].id, // Preserve ID
      createdAt: todos[index].createdAt, // Preserve creation date
      updatedAt: new Date()
    };
    
    await this.updateTodos(todos);
    return todos[index];
  }

  /**
   * Mark todo as completed
   */
  async completeTodo(id: string): Promise<boolean> {
    const result = await this.updateTodo(id, { status: 'completed' });
    return result !== null;
  }

  /**
   * Mark todo as in progress
   */
  async startTodo(id: string): Promise<boolean> {
    const result = await this.updateTodo(id, { status: 'in_progress' });
    return result !== null;
  }

  /**
   * Delete a todo
   */
  async deleteTodo(id: string): Promise<boolean> {
    const todos = await this.getTodos();
    const filtered = todos.filter(t => t.id !== id);
    
    if (filtered.length === todos.length) {
      return false; // Nothing was deleted
    }
    
    await this.updateTodos(filtered);
    return true;
  }

  /**
   * Clear all todos
   */
  async clearTodos(): Promise<void> {
    await reliableMemory.delete(this.TODO_KEY);
    this.logger.info('All todos cleared');
  }

  /**
   * Get todos by status
   */
  async getTodosByStatus(status: Todo['status']): Promise<Todo[]> {
    const todos = await this.getTodos();
    return todos.filter(t => t.status === status);
  }

  /**
   * Get todos by priority
   */
  async getTodosByPriority(priority: Todo['priority']): Promise<Todo[]> {
    const todos = await this.getTodos();
    return todos.filter(t => t.priority === priority);
  }

  /**
   * Get todos assigned to specific agent
   */
  async getTodosByAgent(agent: string): Promise<Todo[]> {
    const todos = await this.getTodos();
    return todos.filter(t => t.assignedAgent === agent);
  }

  /**
   * Generate formatted todo list (similar to TodoWrite output)
   */
  async getFormattedTodos(): Promise<string> {
    const todos = await this.getTodos();
    
    if (todos.length === 0) {
      return 'No todos';
    }
    
    const lines: string[] = [];
    
    // Group by status
    const pending = todos.filter(t => t.status === 'pending');
    const inProgress = todos.filter(t => t.status === 'in_progress');
    const completed = todos.filter(t => t.status === 'completed');
    
    if (inProgress.length > 0) {
      lines.push('🔄 In Progress:');
      inProgress.forEach(t => {
        const priority = t.priority ? ` [${t.priority}]` : '';
        const agent = t.assignedAgent ? ` (@${t.assignedAgent})` : '';
        lines.push(`  ▶ ${t.content}${priority}${agent}`);
      });
    }
    
    if (pending.length > 0) {
      lines.push('\n📋 Pending:');
      pending.forEach(t => {
        const priority = t.priority ? ` [${t.priority}]` : '';
        const agent = t.assignedAgent ? ` (@${t.assignedAgent})` : '';
        lines.push(`  ○ ${t.content}${priority}${agent}`);
      });
    }
    
    if (completed.length > 0) {
      lines.push('\n✅ Completed:');
      completed.forEach(t => {
        lines.push(`  ✓ ${t.content}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    completionRate: number;
  }> {
    const todos = await this.getTodos();
    
    const stats = {
      total: todos.length,
      pending: todos.filter(t => t.status === 'pending').length,
      inProgress: todos.filter(t => t.status === 'in_progress').length,
      completed: todos.filter(t => t.status === 'completed').length,
      completionRate: 0
    };
    
    if (stats.total > 0) {
      stats.completionRate = (stats.completed / stats.total) * 100;
    }
    
    return stats;
  }
}

// Export singleton instance
export const todoManager = TodoManagerMCP.getInstance();