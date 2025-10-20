"use strict";
// Minimal MCP bridge placeholder. We will hook this into AI SDK tools in a next step.
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMCPTools = loadMCPTools;
async function loadMCPTools(start) {
    // Prefer using AI SDK's experimental MCP client to yield ready-to-use Tool[]
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { experimental_createMCPClient } = require('ai');
        // Use SDK-provided stdio transport
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio');
        const client = await experimental_createMCPClient({
            name: 'snow-flow',
            transport: new StdioClientTransport({
                command: start.cmd,
                args: start.args ?? [],
                env: start.env ?? {},
            }),
        });
        const tools = await client.tools();
        return { tools, close: client.close };
    }
    catch (err) {
        // Fallback: no AI SDK available, return empty tools and noop close but with a hint.
        const hint = 'AI SDK MCP bridge not available. Install "ai" or verify version to enable MCP tools.';
        console.warn(`[snow-flow] ${hint}`);
        return { tools: [], close: async () => { } };
    }
}
//# sourceMappingURL=bridge.js.map