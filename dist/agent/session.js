"use strict";
// Agent session placeholder to keep build green.
// Will be replaced with streaming + tool-calling using the AI SDK.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const bridge_1 = require("../mcp/bridge");
const boxen_1 = __importDefault(require("boxen"));
const chalk_1 = __importDefault(require("chalk"));
const store_js_1 = require("../session/store.js");
async function runAgent(opts) {
    const { mcp, system, user, maxSteps = 40, provider, model, baseURL, apiKeyEnv, showReasoning = true, saveOutputPath } = opts;
    // Resolve model via provider registry
    let llm;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const prov = require('../llm/providers.js');
        llm = prov.getModel({ provider, model, baseURL, apiKeyEnv });
    }
    catch (e) {
        console.error('❌ LLM provider init error:', e instanceof Error ? e.message : String(e));
        throw e;
    }
    // Load MCP tools (if AI SDK MCP client is available)
    const { tools, close } = await (0, bridge_1.loadMCPTools)(mcp);
    // Stream using AI SDK
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { streamText } = require('ai');
        const sessionId = (0, store_js_1.createSessionId)();
        (0, store_js_1.startSession)({
            id: sessionId,
            startedAt: new Date().toISOString(),
            objective: user,
            provider: { id: String(provider), model: String(model), baseURL },
            mcp: { cmd: mcp.cmd, args: mcp.args },
        });
        (0, store_js_1.appendMessage)(sessionId, { role: 'user', content: user, timestamp: new Date().toISOString() });
        const result = await streamText({
            model: llm,
            system: system ?? 'You are Snow-Flow, a ServiceNow engineering agent. Be precise. Use tools when helpful.',
            messages: [{ role: 'user', content: user }],
            tools,
            maxSteps,
        });
        let buffer = '';
        let inReasoning = false;
        const writeChunk = (s) => {
            buffer += s;
            const colored = inReasoning && showReasoning ? chalk_1.default.yellow.dim(s) : s;
            process.stdout.write(colored);
        };
        // Optional: stream tool call events if provided by SDK
        if (result.toolCallStream && typeof result.toolCallStream[Symbol.asyncIterator] === 'function') {
            (async () => {
                for await (const ev of result.toolCallStream) {
                    const name = ev?.toolName || ev?.name || 'tool';
                    const args = ev?.args ? JSON.stringify(ev.args).slice(0, 200) : '';
                    process.stdout.write('\n' + chalk_1.default.cyan(`🔧 Tool → ${name} ${args}`) + '\n');
                    (0, store_js_1.appendToolEvent)(sessionId, { name, argsPreview: args });
                }
            })().catch(() => { });
        }
        if (result.toolResultStream && typeof result.toolResultStream[Symbol.asyncIterator] === 'function') {
            (async () => {
                for await (const ev of result.toolResultStream) {
                    const name = ev?.toolName || ev?.name || 'tool';
                    const out = ev?.result ? JSON.stringify(ev.result).slice(0, 200) : '';
                    process.stdout.write(chalk_1.default.magenta(`📦 Result ← ${name} ${out}`) + '\n');
                    (0, store_js_1.appendToolEvent)(sessionId, { name, resultPreview: out });
                }
            })().catch(() => { });
        }
        for await (const chunk of result.textStream) {
            const str = String(chunk);
            // Heuristic: detect reasoning blocks (```reasoning, <thinking>, [reasoning])
            if (showReasoning) {
                if (str.includes('```reasoning') || str.toLowerCase().includes('<thinking>') || /\[\s*reasoning\s*\]/i.test(str))
                    inReasoning = true;
                if (str.includes('```') || str.toLowerCase().includes('</thinking>'))
                    inReasoning = false;
            }
            writeChunk(str);
        }
        // Render a boxed summary if output is long
        if (buffer.length > 4000) {
            const preview = buffer.slice(0, 1200) + '…';
            const box = (0, boxen_1.default)(preview, { padding: 1, borderColor: 'green', title: 'Preview (truncated)', titleAlignment: 'center' });
            process.stdout.write('\n' + box + '\n');
            process.stdout.write(chalk_1.default.gray(`Full length: ${buffer.length} chars`) + '\n');
        }
        if (saveOutputPath) {
            const fs = require('fs');
            fs.writeFileSync(saveOutputPath, buffer, 'utf8');
            process.stdout.write(chalk_1.default.gray(`Saved full output to ${saveOutputPath}`) + '\n');
        }
        (0, store_js_1.appendMessage)(sessionId, { role: 'assistant', content: buffer, timestamp: new Date().toISOString() });
        (0, store_js_1.endSession)(sessionId);
    }
    finally {
        await close();
    }
}
//# sourceMappingURL=session.js.map