/**
 * Snow-Flow BYOLLM - Model Selector
 *
 * USER-CONTROLLED model selection system.
 * Priority: CLI flag > Agent override > Environment > Config > Default
 *
 * Philosophy: The USER chooses the model, not the system.
 */
export interface ModelSelectionConfig {
    cliModel?: string;
    agentType?: string;
    taskDescription?: string;
    preset?: string;
}
export interface ModelConfig {
    provider: string;
    model: string;
    reason: string;
}
export interface ModelPreset {
    description: string;
    defaultModel: string;
    agentOverrides?: Record<string, string>;
}
export interface UserConfig {
    llm?: {
        provider?: string;
        model?: string;
        proxyUrl?: string;
    };
    presets?: Record<string, ModelPreset>;
}
export declare class ModelSelector {
    private configCache;
    /**
     * Select model based on USER input.
     * IMPORTANT: This does NOT analyze task complexity or automatically choose.
     * It respects user's choice via CLI, env vars, config, or defaults.
     */
    selectModel(config: ModelSelectionConfig): ModelConfig;
    /**
     * Get agent-specific override from environment
     */
    private getAgentOverride;
    /**
     * Get model from preset configuration
     */
    private getPresetModel;
    /**
     * Load model from user config file
     */
    private loadFromConfig;
    /**
     * Load user configuration from ~/.snow-flow/config.json
     */
    private loadUserConfig;
    /**
     * Get available models from LiteLLM config
     */
    getAvailableModels(): string[];
    /**
     * Get available presets
     */
    getAvailablePresets(): string[];
    /**
     * Validate that a model name is available
     */
    isValidModel(model: string): boolean;
    /**
     * Get model cost information (per 1M tokens)
     */
    getModelCost(model: string): {
        input: number;
        output: number;
    } | null;
    /**
     * Clear config cache (for testing)
     */
    clearCache(): void;
}
export declare const modelSelector: ModelSelector;
//# sourceMappingURL=model-selector.d.ts.map