/**
 * LLM Config Loader
 * Loads Snow-Flow configuration with LLM provider settings
 */

import { snowFlowConfig } from './snow-flow-config.js';

export interface SnowFlowConfig {
  instance?: string;
  username?: string;
  password?: string;
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  debug?: boolean;
  llm?: {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseURL?: string;
    apiKeyEnv?: string;
  };
  mcp?: {
    enabled?: boolean;
    servers?: string[];
  };
  agent?: {
    maxWorkers?: number;
    timeout?: number;
    system?: any;
    maxSteps?: number;
  };
}

/**
 * Load Snow-Flow configuration with optional LLM settings
 */
export function loadSnowFlowConfig(): SnowFlowConfig {
  try {
    // Load base config from snow-flow-config
    const baseConfig = snowFlowConfig || {};
    
    // Add LLM configuration if available
    const config: SnowFlowConfig = {
      ...baseConfig,
      llm: {
        provider: process.env.LLM_PROVIDER || 'claude',
        model: process.env.LLM_MODEL || 'claude-3-sonnet',
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
      }
    };
    
    return config;
  } catch (error) {
    // Fallback to basic config
    return {
      debug: false,
      llm: {
        provider: 'claude',
        model: 'claude-3-sonnet'
      }
    };
  }
}

/**
 * Get LLM configuration specifically
 */
export function getLLMConfig() {
  const config = loadSnowFlowConfig();
  return config.llm || {
    provider: 'claude',
    model: 'claude-3-sonnet'
  };
}