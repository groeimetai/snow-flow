/**
 * Hierarchical Memory System
 * Extended memory system with hierarchical organization
 */

import { MemorySystem } from './memory-system';

export interface HierarchicalMemorySystem extends MemorySystem {
  dbPath?: string;
  namespace?: string;
  cache?: any;
  ttl?: number;
  
  storeInNamespace(namespace: string, key: string, value: any): Promise<void>;
  retrieveFromNamespace(namespace: string, key: string): Promise<any>;
  listNamespaces(): Promise<string[]>;
  clearNamespace(namespace: string): Promise<void>;
  // Extended compatibility methods
  storeHierarchical?(path: string, data: any): Promise<void>;
  getHierarchical?(path: string): Promise<any>;
  search?(pattern: string): Promise<any[]>;
  getAgentMemory?(agentId: string): Promise<any>;
  trackAccessPattern?(key: string): Promise<void>;
  createRelationship?(from: string, to: string, type: string): Promise<void>;
  getNamespaceStats?(namespace: string): Promise<any>;
  cleanupExpired?(): Promise<void>;
}

export class DefaultHierarchicalMemorySystem implements HierarchicalMemorySystem {
  private memory: Map<string, Map<string, any>> = new Map();
  public dbPath?: string;
  public namespace?: string;

  constructor(dbPath?: string, namespace?: string) {
    this.dbPath = dbPath;
    this.namespace = namespace || 'default';
  }

  private getNamespaceMap(namespace: string): Map<string, any> {
    if (!this.memory.has(namespace)) {
      this.memory.set(namespace, new Map());
    }
    return this.memory.get(namespace)!;
  }

  async store(key: string, value: any): Promise<void> {
    await this.storeInNamespace(this.namespace || 'default', key, value);
  }

  async retrieve(key: string): Promise<any> {
    return this.retrieveFromNamespace(this.namespace || 'default', key);
  }

  async get(key: string): Promise<any> {
    return this.retrieve(key);
  }

  async delete(key: string): Promise<boolean> {
    const nsMap = this.getNamespaceMap(this.namespace || 'default');
    return nsMap.delete(key);
  }

  async clear(): Promise<void> {
    await this.clearNamespace(this.namespace || 'default');
  }

  async list(): Promise<string[]> {
    const nsMap = this.getNamespaceMap(this.namespace || 'default');
    return Array.from(nsMap.keys());
  }

  async exists(key: string): Promise<boolean> {
    const nsMap = this.getNamespaceMap(this.namespace || 'default');
    return nsMap.has(key);
  }

  async storeInNamespace(namespace: string, key: string, value: any): Promise<void> {
    const nsMap = this.getNamespaceMap(namespace);
    nsMap.set(key, value);
  }

  async retrieveFromNamespace(namespace: string, key: string): Promise<any> {
    const nsMap = this.getNamespaceMap(namespace);
    return nsMap.get(key);
  }

  async listNamespaces(): Promise<string[]> {
    return Array.from(this.memory.keys());
  }

  async clearNamespace(namespace: string): Promise<void> {
    this.memory.delete(namespace);
  }
}