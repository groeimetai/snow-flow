"use strict";
/**
 * LLM Config Loader
 * Loads Snow-Flow configuration with LLM provider settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSnowFlowConfig = loadSnowFlowConfig;
exports.getLLMConfig = getLLMConfig;
const snow_flow_config_js_1 = require("./snow-flow-config.js");
/**
 * Load Snow-Flow configuration with optional LLM settings
 */
function loadSnowFlowConfig() {
    try {
        // Load base config from snow-flow-config
        const baseConfig = snow_flow_config_js_1.snowFlowConfig || {};
        // Add LLM configuration if available
        const config = {
            ...baseConfig,
            llm: {
                provider: process.env.LLM_PROVIDER || 'claude',
                model: process.env.LLM_MODEL || 'claude-3-sonnet',
                apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
            }
        };
        return config;
    }
    catch (error) {
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
function getLLMConfig() {
    const config = loadSnowFlowConfig();
    return config.llm || {
        provider: 'claude',
        model: 'claude-3-sonnet'
    };
}
//# sourceMappingURL=llm-config-loader.js.map