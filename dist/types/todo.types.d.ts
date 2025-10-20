/**
 * TodoWrite Integration Types
 * Types for integrating with Claude Code's TodoWrite tool
 */
export interface TodoItem {
    id: string;
    content: string;
    status: TodoStatus;
    priority: TodoPriority;
    assignedAgent?: string;
    dependencies?: string[];
    metadata?: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
    completedAt?: Date;
}
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TodoPriority = 'low' | 'medium' | 'high' | 'critical';
export interface TodoCoordination {
    taskId: string;
    todos: TodoItem[];
    agentAssignments: Map<string, string>;
    dependencies: Map<string, string[]>;
}
export interface TodoUpdate {
    todoId: string;
    updates: Partial<TodoItem>;
    updatedBy: string;
    timestamp: Date;
}
export interface TodoProgress {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    percentComplete: number;
}
export interface TodoAgentAssignment {
    todoId: string;
    agentId: string;
    agentType: string;
    assignedAt: Date;
    estimatedDuration?: number;
}
export interface TodoDependencyGraph {
    nodes: TodoNode[];
    edges: TodoEdge[];
}
export interface TodoNode {
    id: string;
    todo: TodoItem;
    level: number;
    criticalPath: boolean;
}
export interface TodoEdge {
    from: string;
    to: string;
    type: 'blocks' | 'requires' | 'optional';
}
//# sourceMappingURL=todo.types.d.ts.map