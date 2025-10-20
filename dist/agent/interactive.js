"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInteractive = runInteractive;
const bridge_1 = require("../mcp/bridge");
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const node_readline_1 = __importDefault(require("node:readline"));
const store_js_1 = require("../session/store.js");
const ora_1 = __importDefault(require("ora"));
async function runInteractive(opts) {
    const { provider, model, baseURL, apiKeyEnv, system, mcp, maxSteps = 40, showReasoning = true, resumeId } = opts;
    // Resolve model
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const prov = require('../llm/providers.js');
    const llm = prov.getModel({ provider, model, baseURL, apiKeyEnv });
    const sessionId = resumeId || (0, store_js_1.createSessionId)();
    (0, store_js_1.startSession)({
        id: sessionId,
        startedAt: new Date().toISOString(),
        objective: '(interactive)',
        provider: { id: String(provider), model: String(model), baseURL },
        mcp: { cmd: mcp.cmd, args: mcp.args },
    });
    process.stdout.write(chalk_1.default.bold(`\nSnow-Flow Interactive (${provider}:${model})`) + "\n");
    process.stdout.write(chalk_1.default.gray('Tips: ESC ESC = vorige assistant-antwoord | /quit om te stoppen') + "\n\n");
    // Load tools once with spinner
    const spinner = (0, ora_1.default)('MCP-tools laden...').start();
    const { tools, close } = await (0, bridge_1.loadMCPTools)(mcp).finally(() => spinner.stop());
    const messages = [];
    if (system)
        messages.push({ role: 'system', content: system });
    // Preload previous messages if resuming
    if (resumeId) {
        try {
            const { readSession } = require('../session/store.js');
            const rec = readSession(resumeId);
            if (rec?.messages?.length) {
                const recent = rec.messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-20);
                for (const m of recent)
                    messages.push({ role: m.role, content: m.content });
            }
        }
        catch { }
    }
    // Key handling for ESC ESC
    node_readline_1.default.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY)
        process.stdin.setRawMode(true);
    let lastEsc = 0;
    let lastAssistant = null;
    let showTools = true;
    const onKeypress = (_str, key) => {
        if (!key)
            return;
        if (key.name === 'escape') {
            const now = Date.now();
            if (now - lastEsc < 500) {
                // double ESC
                if (lastAssistant) {
                    const box = (0, boxen_1.default)(lastAssistant.slice(0, 1200) + (lastAssistant.length > 1200 ? '…' : ''), { padding: 1, borderColor: 'yellow', title: 'Vorige assistant', titleAlignment: 'center' });
                    process.stdout.write('\n' + box + '\n');
                }
                else {
                    process.stdout.write(chalk_1.default.gray('\nGeen vorige assistant-respons beschikbaar.') + '\n');
                }
            }
            lastEsc = now;
        }
        if (key.name === 't') {
            showTools = !showTools;
            process.stdout.write('\n' + (showTools ? chalk_1.default.gray('Tool events: ON') : chalk_1.default.gray('Tool events: OFF')) + '\n');
        }
        if (key.name === 'h') {
            const last = messages.slice(-6);
            const text = last.map(m => `${m.role}> ${m.content}`).join('\n');
            const panel = (0, boxen_1.default)(text, { padding: 1, borderColor: 'blue', title: 'History (tail)', titleAlignment: 'center' });
            process.stdout.write('\n' + panel + '\n');
        }
        if (key.name === 's') {
            const fs = require('fs');
            const out = (lastAssistant || '').toString();
            const outPath = `${process.env.HOME || ''}/.snow-flow/sessions/${sessionId}.txt`;
            try {
                fs.writeFileSync(outPath, out, 'utf8');
            }
            catch { }
            process.stdout.write(chalk_1.default.gray(`Saved assistant output to ${outPath}`) + '\n');
        }
    };
    process.stdin.on('keypress', onKeypress);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { streamText } = require('ai');
    const rl = node_readline_1.default.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const ask = (q) => new Promise(resolve => rl.question(q, resolve));
    try {
        const onSignal = async () => {
            try {
                await close();
            }
            catch { }
            (0, store_js_1.endSession)(sessionId);
            process.stdout.write('\n' + chalk_1.default.gray('Session ended.') + '\n');
            process.exit(0);
        };
        process.on('SIGINT', onSignal);
        process.on('SIGTERM', onSignal);
        // loop
        while (true) {
            const input = await ask(chalk_1.default.cyan('You: '));
            if (!input)
                continue;
            if (input.trim() === '/quit')
                break;
            const long = input.length > 1200;
            if (long) {
                const preview = input.slice(0, 1200) + '…';
                const box = (0, boxen_1.default)(preview, { padding: 1, borderColor: 'green', title: 'Preview (truncated)', titleAlignment: 'center' });
                process.stdout.write('\n' + box + '\n');
                const confirm = await ask(chalk_1.default.gray('Doorgaan met verzenden? [y/N] '));
                if (!/^y(es)?$/i.test(confirm.trim()))
                    continue;
            }
            messages.push({ role: 'user', content: input });
            (0, store_js_1.appendMessage)(sessionId, { role: 'user', content: input, timestamp: new Date().toISOString() });
            const result = await streamText({
                model: llm,
                system,
                messages,
                tools,
                maxSteps,
            });
            let buffer = '';
            let inReasoning = false;
            const write = (s) => {
                buffer += s;
                const out = inReasoning && showReasoning ? chalk_1.default.yellow.dim(s) : s;
                process.stdout.write(out);
            };
            if (result.toolCallStream && typeof result.toolCallStream[Symbol.asyncIterator] === 'function') {
                (async () => {
                    for await (const ev of result.toolCallStream) {
                        const name = ev?.toolName || ev?.name || 'tool';
                        const args = ev?.args ? JSON.stringify(ev.args).slice(0, 180) : '';
                        if (showTools)
                            process.stdout.write('\n' + chalk_1.default.cyan(`🔧 Tool → ${name} ${args}`) + '\n');
                        (0, store_js_1.appendToolEvent)(sessionId, { name, argsPreview: args });
                    }
                })().catch(() => { });
            }
            if (result.toolResultStream && typeof result.toolResultStream[Symbol.asyncIterator] === 'function') {
                (async () => {
                    for await (const ev of result.toolResultStream) {
                        const name = ev?.toolName || ev?.name || 'tool';
                        const out = ev?.result ? JSON.stringify(ev.result).slice(0, 180) : '';
                        if (showTools)
                            process.stdout.write(chalk_1.default.magenta(`📦 Result ← ${name} ${out}`) + '\n');
                        (0, store_js_1.appendToolEvent)(sessionId, { name, resultPreview: out });
                    }
                })().catch(() => { });
            }
            process.stdout.write(chalk_1.default.green('\nAssistant: '));
            for await (const chunk of result.textStream) {
                const s = String(chunk);
                if (showReasoning) {
                    if (s.includes('```reasoning') || s.toLowerCase().includes('<thinking>') || /\[\s*reasoning\s*\]/i.test(s))
                        inReasoning = true;
                    if (s.includes('```') || s.toLowerCase().includes('</thinking>'))
                        inReasoning = false;
                }
                write(s);
            }
            process.stdout.write('\n');
            lastAssistant = buffer;
            messages.push({ role: 'assistant', content: buffer });
            (0, store_js_1.appendMessage)(sessionId, { role: 'assistant', content: buffer, timestamp: new Date().toISOString() });
        }
    }
    finally {
        rl.close();
        process.stdin.off('keypress', onKeypress);
        if (process.stdin.isTTY)
            process.stdin.setRawMode(false);
        await close();
        (0, store_js_1.endSession)(sessionId);
    }
}
//# sourceMappingURL=interactive.js.map