import type { SnowFlowConfig } from '../config/llm-config-loader';
import type { ProviderOptions } from '../llm/providers';
export interface AgentRunOptions extends ProviderOptions {
    system?: string;
    user: string;
    mcp: SnowFlowConfig['mcp'];
    maxSteps?: number;
    showReasoning?: boolean;
    saveOutputPath?: string;
}
export declare function runAgent(opts: AgentRunOptions): Promise<void>;
//# sourceMappingURL=session.d.ts.map