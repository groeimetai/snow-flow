"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSessionCommands = registerSessionCommands;
const chalk_1 = __importDefault(require("chalk"));
const store_js_1 = require("../session/store.js");
function registerSessionCommands(program) {
    const sess = program.command('session').description('Manage and inspect Snow-Flow sessions');
    sess
        .command('list')
        .description('List recent sessions')
        .action(() => {
        const rows = (0, store_js_1.listSessions)().slice(0, 30);
        if (!rows.length)
            return console.log('No sessions yet.');
        for (const r of rows) {
            console.log(`${chalk_1.default.gray(r.startedAt)}  ${chalk_1.default.cyan(r.id)}  ${r.objective}`);
        }
    });
    sess
        .command('show <id>')
        .description('Show session details')
        .action((id) => {
        const rec = (0, store_js_1.readSession)(id);
        if (!rec)
            return console.error(chalk_1.default.red('Session not found.'));
        console.log(chalk_1.default.cyan(`Session ${rec.id}`));
        console.log(`${chalk_1.default.gray(rec.startedAt)} → ${chalk_1.default.gray(rec.endedAt ?? '…')}`);
        console.log('Objective:', rec.objective);
        console.log('Provider:', `${rec.provider.id} ${rec.provider.model}`);
        console.log('MCP:', `${rec.mcp.cmd} ${(rec.mcp.args || []).join(' ')}`);
        console.log('\nMessages:');
        for (const m of rec.messages) {
            console.log(`- ${chalk_1.default.yellow(m.role)} ${chalk_1.default.gray(m.timestamp)}\n  ${m.content.slice(0, 400)}${m.content.length > 400 ? '…' : ''}`);
        }
        if (rec.toolEvents?.length) {
            console.log('\nTool events:');
            for (const ev of rec.toolEvents) {
                console.log(`  🔧 ${ev.name} ${chalk_1.default.gray(ev.when)} ${ev.argsPreview ? ('args:' + ev.argsPreview) : ''} ${ev.resultPreview ? ('res:' + ev.resultPreview) : ''}`);
            }
        }
    });
}
//# sourceMappingURL=session.js.map