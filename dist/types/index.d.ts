export interface CLIConfig {
    version: string;
    instanceUrl?: string;
    authType?: 'oauth' | 'basic';
    credentials?: AuthCredentials;
    memory?: MemoryConfig;
    claude?: ClaudeConfig;
}
export interface AuthCredentials {
    oauth?: {
        clientId: string;
        clientSecret: string;
        refreshToken?: string;
        accessToken?: string;
        tokenExpiry?: number;
    };
    basic?: {
        username: string;
        password: string;
    };
}
export interface MemoryConfig {
    storageDir: string;
    maxSize: number;
    ttl: number;
}
export interface ClaudeConfig {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
}
export interface SwarmOptions {
    strategy?: 'research' | 'development' | '_analysis' | 'testing' | 'optimization' | 'maintenance';
    mode?: 'centralized' | 'distributed' | 'hierarchical' | 'mesh' | 'hybrid';
    maxAgents?: number;
    parallel?: boolean;
    monitor?: boolean;
    output?: 'json' | 'sqlite' | 'csv' | 'html';
}
export interface Agent {
    id: string;
    name: string;
    type: AgentType;
    status: 'idle' | 'busy' | 'error';
    capabilities: string[];
    memory?: Record<string, any>;
    createdAt: Date;
}
export type AgentType = 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'specialist' | 'schema-designer' | 'widget-builder' | 'workflow-designer' | 'script-generator' | 'security-agent' | 'update-set-manager' | 'ui-ux-specialist' | 'approval-specialist' | 'security-specialist' | 'css-specialist' | 'backend-specialist' | 'frontend-specialist' | 'performance-specialist';
export interface Task {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignedAgent?: string;
    dependencies?: string[];
    result?: any;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface MemoryEntry {
    key: string;
    value: any;
    namespace: string;
    ttl?: number;
    createdAt: Date;
    expiresAt?: Date;
}
export interface ServiceNowWidget {
    name: string;
    id?: string;
    template: string;
    controller: string;
    css?: string;
    serverScript?: string;
    clientScript?: string;
    dependencies?: string[];
    options?: Record<string, any>;
}
export interface ServiceNowApp {
    name: string;
    scope: string;
    version: string;
    description?: string;
    tables?: ServiceNowTable[];
    widgets?: ServiceNowWidget[];
    scripts?: ServiceNowScript[];
    workflows?: ServiceNowWorkflow[];
    updateSets?: ServiceNowUpdateSet[];
}
export interface ServiceNowTable {
    name: string;
    label: string;
    extends?: string;
    fields: ServiceNowField[];
}
export interface ServiceNowField {
    name: string;
    label: string;
    type: string;
    reference?: string;
    mandatory?: boolean;
    defaultValue?: any;
}
export interface ServiceNowScript {
    name: string;
    type: 'business_rule' | 'script_include' | 'client_script' | 'ui_action';
    script: string;
    active: boolean;
    table?: string;
    when?: string;
}
export interface ServiceNowWorkflow {
    name: string;
    description?: string;
    table: string;
    active: boolean;
    activities: WorkflowActivity[];
}
export interface WorkflowActivity {
    name: string;
    type: string;
    config: Record<string, any>;
    transitions: WorkflowTransition[];
}
export interface WorkflowTransition {
    to: string;
    condition?: string;
}
export interface ServiceNowUpdateSet {
    name: string;
    description?: string;
    state: 'in_progress' | 'complete' | 'ignore';
    release_date?: Date;
    sys_id?: string;
}
export * from './snow-flow.types';
//# sourceMappingURL=index.d.ts.map