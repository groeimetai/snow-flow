/**
 * Hierarchical Memory System
 * Extended memory system with hierarchical organization
 */
import { MemorySystem } from './memory-system.js';
export interface HierarchicalMemorySystem extends MemorySystem {
    dbPath?: string;
    namespace?: string;
    cache?: any;
    ttl?: number;
    storeInNamespace(namespace: string, key: string, value: any): Promise<void>;
    retrieveFromNamespace(namespace: string, key: string): Promise<any>;
    listNamespaces(): Promise<string[]>;
    clearNamespace(namespace: string): Promise<void>;
    storeHierarchical?(path: string, data: any): Promise<void>;
    getHierarchical?(path: string): Promise<any>;
    search?(pattern: string): Promise<any[]>;
    getAgentMemory?(agentId: string): Promise<any>;
    trackAccessPattern?(key: string): Promise<void>;
    createRelationship?(from: string, to: string, type: string): Promise<void>;
    getNamespaceStats?(namespace: string): Promise<any>;
    cleanupExpired?(): Promise<void>;
}
export declare class DefaultHierarchicalMemorySystem implements HierarchicalMemorySystem {
    private memory;
    dbPath?: string;
    namespace?: string;
    constructor(dbPath?: string, namespace?: string);
    private getNamespaceMap;
    store(key: string, value: any): Promise<void>;
    retrieve(key: string): Promise<any>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    list(): Promise<string[]>;
    exists(key: string): Promise<boolean>;
    storeInNamespace(namespace: string, key: string, value: any): Promise<void>;
    retrieveFromNamespace(namespace: string, key: string): Promise<any>;
    listNamespaces(): Promise<string[]>;
    clearNamespace(namespace: string): Promise<void>;
}
//# sourceMappingURL=hierarchical-memory-system.d.ts.map