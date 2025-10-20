"use strict";
/**
 * MCP-based Todo Manager
 * Alternative to Claude Code's native TodoWrite which has a 30-second timeout
 * This uses our memory tools with NO timeout by default
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.todoManager = exports.TodoManagerMCP = void 0;
const reliable_memory_manager_js_1 = require("../mcp/shared/reliable-memory-manager.js");
const logger_js_1 = require("./logger.js");
class TodoManagerMCP {
    constructor() {
        this.TODO_KEY = 'mcp_todos';
        this.logger = new logger_js_1.Logger('TodoManagerMCP');
    }
    static getInstance() {
        if (!TodoManagerMCP.instance) {
            TodoManagerMCP.instance = new TodoManagerMCP();
        }
        return TodoManagerMCP.instance;
    }
    /**
     * Get all todos
     */
    async getTodos() {
        try {
            const todos = await reliable_memory_manager_js_1.reliableMemory.retrieve(this.TODO_KEY);
            return todos || [];
        }
        catch (error) {
            this.logger.error('Failed to retrieve todos:', error);
            return [];
        }
    }
    /**
     * Update todos (replaces entire list like TodoWrite)
     */
    async updateTodos(todos) {
        try {
            // Add timestamps
            const updatedTodos = todos.map(todo => ({
                ...todo,
                updatedAt: new Date(),
                createdAt: todo.createdAt || new Date()
            }));
            // Store with NO timeout - operations run to completion
            await reliable_memory_manager_js_1.reliableMemory.store(this.TODO_KEY, updatedTodos);
            this.logger.info(`Updated ${todos.length} todos successfully`);
            // Also store a backup with timestamp
            const backupKey = `${this.TODO_KEY}_backup_${Date.now()}`;
            await reliable_memory_manager_js_1.reliableMemory.store(backupKey, updatedTodos, 86400000); // 24 hour expiry for backups
        }
        catch (error) {
            this.logger.error('Failed to update todos:', error);
            throw error;
        }
    }
    /**
     * Add a single todo
     */
    async addTodo(todo) {
        const todos = await this.getTodos();
        const newTodo = {
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
    async updateTodo(id, updates) {
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
    async completeTodo(id) {
        const result = await this.updateTodo(id, { status: 'completed' });
        return result !== null;
    }
    /**
     * Mark todo as in progress
     */
    async startTodo(id) {
        const result = await this.updateTodo(id, { status: 'in_progress' });
        return result !== null;
    }
    /**
     * Delete a todo
     */
    async deleteTodo(id) {
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
    async clearTodos() {
        await reliable_memory_manager_js_1.reliableMemory.delete(this.TODO_KEY);
        this.logger.info('All todos cleared');
    }
    /**
     * Get todos by status
     */
    async getTodosByStatus(status) {
        const todos = await this.getTodos();
        return todos.filter(t => t.status === status);
    }
    /**
     * Get todos by priority
     */
    async getTodosByPriority(priority) {
        const todos = await this.getTodos();
        return todos.filter(t => t.priority === priority);
    }
    /**
     * Get todos assigned to specific agent
     */
    async getTodosByAgent(agent) {
        const todos = await this.getTodos();
        return todos.filter(t => t.assignedAgent === agent);
    }
    /**
     * Generate formatted todo list (similar to TodoWrite output)
     */
    async getFormattedTodos() {
        const todos = await this.getTodos();
        if (todos.length === 0) {
            return 'No todos';
        }
        const lines = [];
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
    generateId() {
        return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get statistics
     */
    async getStats() {
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
exports.TodoManagerMCP = TodoManagerMCP;
// Export singleton instance
exports.todoManager = TodoManagerMCP.getInstance();
//# sourceMappingURL=todo-manager-mcp.js.map