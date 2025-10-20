/**
 * Basic Memory System Interface
 * Minimal implementation to satisfy missing imports
 */
export interface MemorySystem {
    store(key: string, value: any, ttl?: number): Promise<void>;
    retrieve(key: string): Promise<any>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    list(): Promise<string[]>;
    exists(key: string): Promise<boolean>;
    query?(query: string): Promise<any[]>;
    execute?(sql: string): Promise<any>;
    insert?(table: string, data: any): Promise<any>;
    getDatabaseStats?(): Promise<any>;
    getCacheStats?(): Promise<any>;
    initialize?(): Promise<void>;
    close?(): Promise<void>;
    invalidateCache?(key: string): Promise<void>;
    createEmergencyBackup?(): Promise<string>;
}
export declare class BasicMemorySystem implements MemorySystem {
    private memory;
    store(key: string, value: any, ttl?: number): Promise<void>;
    retrieve(key: string): Promise<any>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    list(): Promise<string[]>;
    exists(key: string): Promise<boolean>;
}
export declare const defaultMemorySystem: BasicMemorySystem;
//# sourceMappingURL=memory-system.d.ts.map