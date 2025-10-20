/**
 * 🚀 Smart Rollback System for Deployment Failures
 *
 * Advanced rollback system that automatically detects deployment failures,
 * creates recovery plans, and executes intelligent rollback strategies
 * with minimal downtime and data preservation.
 */
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { MemorySystem } from '../memory/memory-system.js';
export interface RollbackPoint {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    type: 'automatic' | 'manual' | 'scheduled';
    trigger: RollbackTrigger;
    snapshot: SystemSnapshot;
    metadata: {
        deploymentId?: string;
        updateSetId?: string;
        userId: string;
        environment: string;
        artifacts: ArtifactBackup[];
    };
    status: 'active' | 'used' | 'expired' | 'corrupted';
    retentionPolicy: RetentionPolicy;
}
export interface RollbackTrigger {
    type: 'deployment_failure' | 'performance_degradation' | 'error_threshold' | 'manual' | 'scheduled';
    condition?: string;
    threshold?: {
        metric: string;
        value: number;
        operator: '<' | '>' | '=' | '<=' | '>=';
    };
    timeWindow?: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface SystemSnapshot {
    timestamp: string;
    version: string;
    components: ComponentSnapshot[];
    dependencies: DependencyMap[];
    configuration: ConfigurationSnapshot;
    data: DataSnapshot;
    integrity: IntegrityCheck;
}
export interface ComponentSnapshot {
    type: 'flow' | 'widget' | 'script' | 'table' | 'business_rule' | 'client_script';
    id: string;
    name: string;
    state: any;
    version: string;
    dependencies: string[];
    checksum: string;
}
export interface DependencyMap {
    from: string;
    to: string;
    type: 'required' | 'optional' | 'circular';
    version?: string;
}
export interface ConfigurationSnapshot {
    updateSets: UpdateSetBackup[];
    systemProperties: Record<string, any>;
    userPermissions: PermissionSnapshot[];
    activeSchedules: ScheduleSnapshot[];
}
export interface DataSnapshot {
    criticalTables: TableBackup[];
    recentChanges: ChangeRecord[];
    transactionLog: TransactionEntry[];
    consistencyCheck: ConsistencyResult;
}
export interface ArtifactBackup {
    type: string;
    id: string;
    name: string;
    content: string;
    checksum: string;
    dependencies: string[];
    backupLocation: string;
}
export interface UpdateSetBackup {
    sys_id: string;
    name: string;
    state: string;
    xml: string;
    changes: ChangeRecord[];
}
export interface PermissionSnapshot {
    userId: string;
    roles: string[];
    groups: string[];
    permissions: string[];
}
export interface ScheduleSnapshot {
    id: string;
    name: string;
    type: string;
    schedule: string;
    active: boolean;
}
export interface TableBackup {
    name: string;
    records: Record<string, any>[];
    schema: TableSchema;
    indexes: IndexDefinition[];
}
export interface ChangeRecord {
    table: string;
    sys_id: string;
    operation: 'insert' | 'update' | 'delete';
    before?: any;
    after?: any;
    timestamp: string;
    user: string;
}
export interface TransactionEntry {
    id: string;
    timestamp: string;
    operation: string;
    success: boolean;
    error?: string;
    rollbackable: boolean;
}
export interface TableSchema {
    fields: FieldDefinition[];
    relationships: RelationshipDefinition[];
    constraints: ConstraintDefinition[];
}
export interface FieldDefinition {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: any;
}
export interface RelationshipDefinition {
    type: 'one_to_one' | 'one_to_many' | 'many_to_many';
    fromTable: string;
    toTable: string;
    fromField: string;
    toField: string;
}
export interface ConstraintDefinition {
    name: string;
    type: 'primary_key' | 'foreign_key' | 'unique' | 'check';
    fields: string[];
    reference?: string;
}
export interface IndexDefinition {
    name: string;
    fields: string[];
    unique: boolean;
    type: 'btree' | 'hash' | 'gist' | 'gin';
}
export interface IntegrityCheck {
    checksum: string;
    timestamp: string;
    valid: boolean;
    errors: string[];
}
export interface ConsistencyResult {
    valid: boolean;
    issues: ConsistencyIssue[];
    recommendations: string[];
}
export interface ConsistencyIssue {
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: 'referential_integrity' | 'data_corruption' | 'orphaned_records' | 'duplicate_keys';
    description: string;
    affectedRecords: string[];
    autoFixable: boolean;
}
export interface RetentionPolicy {
    maxAge: number;
    maxCount: number;
    compressionEnabled: boolean;
    archiveLocation?: string;
}
export interface RollbackPlan {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    rollbackPointId: string;
    strategy: RollbackStrategy;
    steps: RollbackStep[];
    estimatedTime: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    impactAssessment: ImpactAssessment;
    validationChecks: ValidationCheck[];
}
export interface RollbackStrategy {
    type: 'full_restore' | 'selective_restore' | 'incremental_rollback' | 'blue_green_switch';
    approach: 'aggressive' | 'conservative' | 'minimal_impact';
    preserveData: boolean;
    maintainSessions: boolean;
    downtime: 'zero' | 'minimal' | 'scheduled';
}
export interface RollbackStep {
    order: number;
    name: string;
    description: string;
    action: string;
    parameters: Record<string, any>;
    reversible: boolean;
    critical: boolean;
    estimatedTime: number;
    dependencies: string[];
    validationRequired: boolean;
}
export interface ImpactAssessment {
    affectedUsers: number;
    affectedSystems: string[];
    dataLoss: 'none' | 'minimal' | 'moderate' | 'significant';
    downtime: number;
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
    complianceViolations: string[];
}
export interface ValidationCheck {
    name: string;
    description: string;
    type: 'pre_rollback' | 'post_rollback' | 'continuous';
    script: string;
    expectedResult: any;
    critical: boolean;
    timeout: number;
}
export interface RollbackExecution {
    planId: string;
    executionId: string;
    startTime: string;
    endTime?: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    currentStep?: number;
    results: StepResult[];
    issues: ExecutionIssue[];
    metrics: ExecutionMetrics;
}
export interface StepResult {
    stepOrder: number;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime: string;
    endTime?: string;
    result?: any;
    error?: string;
    validationResults: ValidationResult[];
}
export interface ValidationResult {
    check: string;
    passed: boolean;
    message: string;
    expected: any;
    actual: any;
}
export interface ExecutionIssue {
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: 'validation_failure' | 'step_failure' | 'timeout' | 'dependency_error';
    description: string;
    step?: number;
    resolution?: string;
    autoResolved: boolean;
}
export interface ExecutionMetrics {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    totalTime: number;
    averageStepTime: number;
    resourceUsage: ResourceUsage;
}
export interface ResourceUsage {
    memory: number;
    cpu: number;
    disk: number;
    network: number;
}
export declare class SmartRollbackSystem {
    private logger;
    private client;
    private memory;
    private rollbackPoints;
    private rollbackPlans;
    private activeExecutions;
    private monitoringEnabled;
    constructor(client: ServiceNowClient, memory: MemorySystem);
    /**
     * Create a new rollback point before deployment
     */
    createRollbackPoint(name: string, description: string, options?: {
        type?: 'automatic' | 'manual' | 'scheduled';
        triggers?: RollbackTrigger[];
        includeData?: boolean;
        compressionEnabled?: boolean;
    }): Promise<RollbackPoint>;
    /**
     * Generate intelligent rollback plan
     */
    generateRollbackPlan(rollbackPointId: string, options?: {
        strategy?: 'conservative' | 'aggressive' | 'minimal_impact';
        preserveData?: boolean;
        targetDowntime?: number;
    }): Promise<RollbackPlan>;
    /**
     * Execute rollback plan with monitoring
     */
    executeRollbackPlan(planId: string, options?: {
        dryRun?: boolean;
        skipValidation?: boolean;
        continueOnError?: boolean;
    }): Promise<RollbackExecution>;
    /**
     * Get rollback points with filtering
     */
    getRollbackPoints(filter?: {
        type?: string;
        status?: string;
        maxAge?: number;
    }): RollbackPoint[];
    /**
     * Get active rollback executions
     */
    getActiveExecutions(): RollbackExecution[];
    /**
     * Cancel active rollback execution
     */
    cancelExecution(executionId: string): Promise<boolean>;
    /**
     * Private helper methods
     */
    private createSystemSnapshot;
    private analyzeDifferences;
    private determineOptimalStrategy;
    private generateRollbackSteps;
    private assessRollbackImpact;
    private generateValidationChecks;
    private calculateRiskLevel;
    private executeRollbackStep;
    private runValidationChecks;
    private updateExecutionMetrics;
    private cleanupOldRollbackPoints;
    private startMonitoring;
    private checkAutomaticTriggers;
}
export default SmartRollbackSystem;
//# sourceMappingURL=smart-rollback-system.d.ts.map