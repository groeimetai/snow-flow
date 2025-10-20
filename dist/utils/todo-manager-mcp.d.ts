/**
 * MCP-based Todo Manager
 * Alternative to Claude Code's native TodoWrite which has a 30-second timeout
 * This uses our memory tools with NO timeout by default
 */
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
export declare class TodoManagerMCP {
    private static instance;
    private logger;
    private readonly TODO_KEY;
    private constructor();
    static getInstance(): TodoManagerMCP;
    /**
     * Get all todos
     */
    getTodos(): Promise<Todo[]>;
    /**
     * Update todos (replaces entire list like TodoWrite)
     */
    updateTodos(todos: Todo[]): Promise<void>;
    /**
     * Add a single todo
     */
    addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo>;
    /**
     * Update a single todo
     */
    updateTodo(id: string, updates: Partial<Todo>): Promise<Todo | null>;
    /**
     * Mark todo as completed
     */
    completeTodo(id: string): Promise<boolean>;
    /**
     * Mark todo as in progress
     */
    startTodo(id: string): Promise<boolean>;
    /**
     * Delete a todo
     */
    deleteTodo(id: string): Promise<boolean>;
    /**
     * Clear all todos
     */
    clearTodos(): Promise<void>;
    /**
     * Get todos by status
     */
    getTodosByStatus(status: Todo['status']): Promise<Todo[]>;
    /**
     * Get todos by priority
     */
    getTodosByPriority(priority: Todo['priority']): Promise<Todo[]>;
    /**
     * Get todos assigned to specific agent
     */
    getTodosByAgent(agent: string): Promise<Todo[]>;
    /**
     * Generate formatted todo list (similar to TodoWrite output)
     */
    getFormattedTodos(): Promise<string>;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Get statistics
     */
    getStats(): Promise<{
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
        completionRate: number;
    }>;
}
export declare const todoManager: TodoManagerMCP;
//# sourceMappingURL=todo-manager-mcp.d.ts.map