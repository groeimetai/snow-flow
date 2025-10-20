/**
 * ServiceNow Queen Agent Integration Example
 *
 * Shows how to integrate the Queen Agent with existing snow-flow CLI
 */
import { ServiceNowQueen } from '../../queen/index.js';
/**
 * Example: Queen Agent integration for snow-flow CLI
 */
export declare class QueenIntegration {
    queen: ServiceNowQueen;
    private logger;
    constructor(options?: {
        debugMode?: boolean;
        memoryPath?: string;
    });
    /**
     * Replace existing swarm command with Queen intelligence
     */
    executeSwarmObjective(objective: string, options?: any): Promise<any>;
    /**
     * Replace SPARC team commands with dynamic agent spawning
     */
    executeDynamicTeam(taskType: 'widget' | 'flow' | 'app', objective: string): Promise<any>;
    /**
     * Memory-driven development workflow
     */
    memoryDrivenWorkflow(objective: string): Promise<any>;
    /**
     * Real-time monitoring integration
     */
    logHiveMindStatus(): void;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
/**
 * CLI Integration Examples
 */
export declare function replaceSwarmCommand(objective: string, options: any): Promise<any>;
export declare function replaceTeamCommand(teamType: string, objective: string): Promise<any>;
export declare function memoryDrivenSparc(objective: string): Promise<any>;
/**
 * Usage in snow-flow CLI commands:
 *
 * // OLD:
 * ./snow-flow swarm "create widget" --strategy development --mode hierarchical
 *
 * // NEW:
 * ./snow-flow queen "create widget" --monitor
 *
 * // OLD:
 * ./snow-flow sparc team widget "create dashboard"
 *
 * // NEW:
 * ./snow-flow queen "create dashboard" --type widget
 *
 * // OLD:
 * ./snow-flow sparc run coder "implement feature"
 *
 * // NEW:
 * ./snow-flow queen "implement feature" --memory-driven
 */
/**
 * Example CLI integration in existing command handlers:
 */
export declare const CLI_INTEGRATION_EXAMPLES: {
    swarmReplacement(args: string[], options: any): Promise<any>;
    teamReplacement(teamType: string, args: string[]): Promise<any>;
    queenCommand(args: string[], options: any): Promise<any>;
};
/**
 * Backward compatibility wrapper
 */
export declare function createBackwardCompatibleQueen(): {
    executeSwarm: (objective: string, options?: any) => Promise<any>;
    executeTeam: (type: string, objective: string) => Promise<any>;
    executeSparc: (mode: string, objective: string) => Promise<any>;
    getStatus: () => any;
};
export default QueenIntegration;
//# sourceMappingURL=integration-example.d.ts.map