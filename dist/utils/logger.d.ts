/**
 * Logger utility for ServiceNow agents
 */
export declare class Logger {
    private logger;
    constructor(agentName: string);
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map