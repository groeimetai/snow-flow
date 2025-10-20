"use strict";
/**
 * Snow-Flow BYOLLM - Model Selector
 *
 * USER-CONTROLLED model selection system.
 * Priority: CLI flag > Agent override > Environment > Config > Default
 *
 * Philosophy: The USER chooses the model, not the system.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelSelector = exports.ModelSelector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class ModelSelector {
    constructor() {
        this.configCache = null;
    }
    /**
     * Select model based on USER input.
     * IMPORTANT: This does NOT analyze task complexity or automatically choose.
     * It respects user's choice via CLI, env vars, config, or defaults.
     */
    selectModel(config) {
        // 1. HIGHEST PRIORITY: CLI flag
        if (config.cliModel) {
            return {
                provider: 'litellm',
                model: config.cliModel,
                reason: `User specified via --model flag`
            };
        }
        // 2. Agent-specific override (via environment variable)
        if (config.agentType) {
            const agentModel = this.getAgentOverride(config.agentType);
            if (agentModel) {
                return {
                    provider: 'litellm',
                    model: agentModel,
                    reason: `User configured agent override: AGENT_${config.agentType.toUpperCase()}_MODEL`
                };
            }
        }
        // 3. Preset (if user specified)
        if (config.preset) {
            const presetModel = this.getPresetModel(config.preset, config.agentType);
            if (presetModel) {
                return {
                    provider: 'litellm',
                    model: presetModel,
                    reason: `User selected preset: ${config.preset}`
                };
            }
        }
        // 4. Environment variable
        const envModel = process.env.LLM_MODEL;
        if (envModel) {
            return {
                provider: 'litellm',
                model: envModel,
                reason: 'User set LLM_MODEL environment variable'
            };
        }
        // 5. Config file
        const configModel = this.loadFromConfig();
        if (configModel) {
            return {
                provider: 'litellm',
                model: configModel,
                reason: 'User configured in ~/.snow-flow/config.json'
            };
        }
        // 6. Default fallback (Claude Sonnet - same as before BYOLLM)
        return {
            provider: 'litellm',
            model: 'claude-sonnet-3.5',
            reason: 'Default model (user did not specify)'
        };
    }
    /**
     * Get agent-specific override from environment
     */
    getAgentOverride(agentType) {
        const envKey = `AGENT_${agentType.toUpperCase().replace(/-/g, '_')}_MODEL`;
        return process.env[envKey] || null;
    }
    /**
     * Get model from preset configuration
     */
    getPresetModel(presetName, agentType) {
        const userConfig = this.loadUserConfig();
        const preset = userConfig?.presets?.[presetName];
        if (!preset) {
            console.warn(`Preset "${presetName}" not found in config`);
            return null;
        }
        // Check for agent-specific override in preset
        if (agentType && preset.agentOverrides?.[agentType]) {
            return preset.agentOverrides[agentType];
        }
        // Return preset default
        return preset.defaultModel;
    }
    /**
     * Load model from user config file
     */
    loadFromConfig() {
        const userConfig = this.loadUserConfig();
        return userConfig?.llm?.model || null;
    }
    /**
     * Load user configuration from ~/.snow-flow/config.json
     */
    loadUserConfig() {
        if (this.configCache) {
            return this.configCache;
        }
        try {
            const configPath = path.join(os.homedir(), '.snow-flow', 'config.json');
            if (!fs.existsSync(configPath)) {
                return null;
            }
            const configData = fs.readFileSync(configPath, 'utf-8');
            this.configCache = JSON.parse(configData);
            return this.configCache;
        }
        catch (error) {
            console.warn(`Failed to load user config: ${error}`);
            return null;
        }
    }
    /**
     * Get available models from LiteLLM config
     */
    getAvailableModels() {
        return [
            'claude-sonnet-3.5',
            'claude-haiku-3.5',
            'gpt-4o',
            'gpt-4o-mini',
            'gemini-pro',
            'gemini-flash',
            'deepseek-coder',
            'deepseek-chat',
            'llama-3.1',
            'llama-3.3',
            'qwen-2.5-coder'
        ];
    }
    /**
     * Get available presets
     */
    getAvailablePresets() {
        const userConfig = this.loadUserConfig();
        return userConfig?.presets ? Object.keys(userConfig.presets) : [];
    }
    /**
     * Validate that a model name is available
     */
    isValidModel(model) {
        return this.getAvailableModels().includes(model);
    }
    /**
     * Get model cost information (per 1M tokens)
     */
    getModelCost(model) {
        const costs = {
            'claude-sonnet-3.5': { input: 3.0, output: 15.0 },
            'claude-haiku-3.5': { input: 0.8, output: 4.0 },
            'gpt-4o': { input: 2.5, output: 10.0 },
            'gpt-4o-mini': { input: 0.15, output: 0.60 },
            'gemini-pro': { input: 1.25, output: 5.0 },
            'gemini-flash': { input: 0.075, output: 0.30 },
            'deepseek-coder': { input: 0.14, output: 0.28 },
            'deepseek-chat': { input: 0.14, output: 0.28 },
            'llama-3.1': { input: 0, output: 0 },
            'llama-3.3': { input: 0, output: 0 },
            'qwen-2.5-coder': { input: 0, output: 0 }
        };
        return costs[model] || null;
    }
    /**
     * Clear config cache (for testing)
     */
    clearCache() {
        this.configCache = null;
    }
}
exports.ModelSelector = ModelSelector;
// Singleton instance
exports.modelSelector = new ModelSelector();
//# sourceMappingURL=model-selector.js.map