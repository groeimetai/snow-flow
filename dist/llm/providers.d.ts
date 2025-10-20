import type { SnowFlowConfig } from '../config/llm-config-loader';
export type ProviderId = SnowFlowConfig['llm']['provider'];
export interface ProviderOptions {
    provider: ProviderId;
    model: string;
    baseURL?: string;
    apiKeyEnv?: string;
    extraBody?: Record<string, unknown>;
}
export declare function getModel(opts: ProviderOptions): unknown;
//# sourceMappingURL=providers.d.ts.map