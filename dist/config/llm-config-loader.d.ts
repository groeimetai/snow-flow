/**
 * LLM Config Loader
 * Loads Snow-Flow configuration with LLM provider settings
 */
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
export declare function loadSnowFlowConfig(): SnowFlowConfig;
/**
 * Get LLM configuration specifically
 */
export declare function getLLMConfig(): {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseURL?: string;
    apiKeyEnv?: string;
};
//# sourceMappingURL=llm-config-loader.d.ts.map