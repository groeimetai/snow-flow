/**
 * Snow-Flow Memory Patterns
 * Common memory patterns and utilities for Snow-Flow
 */

export interface MemoryPattern {
  pattern: string;
  namespace: string;
  type: string;
}

export const MEMORY_PATTERNS = {
  AGENT: 'agent/*',
  TASK: 'task/*',
  SESSION: 'session/*',
  ARTIFACT: 'artifact/*',
  CONFIG: 'config/*',
  TEMP: 'temp/*'
} as const;

export const MEMORY_NAMESPACES = {
  QUEEN: 'queen',
  AGENTS: 'agents',
  TASKS: 'tasks',
  SESSIONS: 'sessions',
  ARTIFACTS: 'artifacts',
  CONFIG: 'config',
  TEMP: 'temp'
} as const;

export function createMemoryKey(namespace: string, type: string, id: string): string {
  return `${namespace}/${type}/${id}`;
}

export function parseMemoryKey(key: string): { namespace: string; type: string; id: string } | null {
  const parts = key.split('/');
  if (parts.length >= 3) {
    return {
      namespace: parts[0],
      type: parts[1],
      id: parts.slice(2).join('/')
    };
  }
  return null;
}

export function matchesPattern(key: string, pattern: string): boolean {
  const regex = new RegExp(pattern.replace('*', '.*'));
  return regex.test(key);
}

// Export stub implementations for compatibility
export class SnowFlowMemoryOrganizer {
  static organize(data: any) { return data; }
}

export const SNOW_FLOW_AGENT_CAPABILITIES = {
  RESEARCHER: 'researcher',
  CODER: 'coder',
  ANALYST: 'analyst'
};

export interface HierarchicalMemoryEntry {
  key: string;
  value: any;
  namespace: string;
}

export interface MemorySearchOptions {
  pattern?: string;
  limit?: number;
  namespace?: string;
}