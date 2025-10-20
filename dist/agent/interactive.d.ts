import type { SnowFlowConfig } from '../config/llm-config-loader';
import type { ProviderOptions } from '../llm/providers';
export interface InteractiveOptions extends ProviderOptions {
    system?: string;
    mcp: SnowFlowConfig['mcp'];
    maxSteps?: number;
    showReasoning?: boolean;
    resumeId?: string;
}
export declare function runInteractive(opts: InteractiveOptions): Promise<void>;
//# sourceMappingURL=interactive.d.ts.map