import { EventEmitter } from 'eventemitter3';

export interface SnowAgent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  lastActivity: Date;
}

export type AgentType = 
  | 'coordinator'
  | 'researcher' 
  | 'coder'
  | 'analyst'
  | 'architect'
  | 'tester'
  | 'reviewer'
  | 'optimizer'
  | 'documenter'
  | 'monitor'
  | 'servicenow-specialist'
  | 'workflow-designer'
  | 'ui-builder'
  | 'security-auditor'
  | 'integration-specialist'
  // 🚀 NEW: Specialized agents for parallel execution (v1.1.91)
  | 'widget-creator'          // Widget development specialist
  | 'widget-builder'          // Widget builder (alias)
  | 'flow-builder'            // Flow development specialist
  | 'script-writer'           // Script development specialist
  | 'security-agent'          // Security _analysis specialist (alias)
  | 'app-architect'           // Application architecture specialist
  | 'css-specialist'          // Styling and responsive design specialist
  | 'backend-specialist'      // Server script specialist
  | 'frontend-specialist'     // Client script specialist
  | 'ui-ux-specialist'        // User experience specialist
  | 'performance-specialist'  // Performance optimization
  | 'accessibility-specialist'// Accessibility compliance
  | 'trigger-specialist'      // Flow trigger configuration
  | 'action-specialist'       // Flow action development
  | 'approval-specialist'     // Approval process specialist
  | 'notification-specialist' // Notification configuration
  | 'error-handler'          // Error handling specialist
  | 'security-specialist'     // Security implementation
  | 'api-specialist'         // API integration specialist
  | 'transform-specialist'    // Data transformation specialist
  | 'monitoring-specialist'   // Integration monitoring
  | 'documentation-specialist';// Documentation specialist

export type AgentStatus = 'idle' | 'busy' | 'error' | 'terminated';

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgent?: string;
  dependencies: string[];
  result?: any;
  error?: Error;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export type TaskType = 
  | 'research'
  | 'development'
  | '_analysis'
  | 'testing'
  | 'optimization'
  | 'documentation'
  | 'servicenow-config'
  | 'servicenow-script'
  | 'servicenow-workflow'
  | 'servicenow-ui';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface SwarmConfig {
  maxAgents: number;
  topology: SwarmTopology;
  strategy: SwarmStrategy;
  enableParallel: boolean;
  enableMonitoring: boolean;
  memoryNamespace: string;
}

export type SwarmTopology = 'hierarchical' | 'mesh' | 'ring' | 'star';
export type SwarmStrategy = 'balanced' | 'specialized' | 'adaptive' | 'auto';

export interface MemoryEntry {
  key: string;
  value: any;
  namespace: string;
  ttl?: number;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  metadata: Record<string, any>;
}

export interface OrchestratorEvents {
  'agent:spawned': (agent: SnowAgent) => void;
  'agent:terminated': (agentId: string) => void;
  'agent:status': (agentId: string, status: AgentStatus) => void;
  'task:created': (task: Task) => void;
  'task:assigned': (taskId: string, agentId: string) => void;
  'task:completed': (taskId: string, result: any) => void;
  'task:failed': (taskId: string, error: Error) => void;
  'agent:initialized': (config: SwarmConfig) => void;
  'swarm:initialized': (config: SwarmConfig) => void; // Backward compatibility alias
  'error': (error: Error) => void;
}

export interface BaseOrchestratorOptions {
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  memoryNamespace?: string;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface ServiceNowConfig {
  instance: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  authMethod: 'basic' | 'oauth';
  apiVersion?: string;
}

export interface ServiceNowContext {
  config: ServiceNowConfig;
  currentApp?: string;
  updateSet?: string;
  scope?: string;
  tables?: string[];
}

export interface AgentMessage {
  from: string;
  to: string;
  type: MessageType;
  payload: any;
  timestamp: Date;
  correlationId?: string;
}

export type MessageType = 
  | 'task_assignment'
  | 'task_result'
  | 'coordination'
  | 'knowledge_share'
  | 'status_update'
  | 'error';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers?: WorkflowTrigger[];
  variables?: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  dependencies: string[];
  outputs?: string[];
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event' | 'webhook';
  config: Record<string, any>;
}