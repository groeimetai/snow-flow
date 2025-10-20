"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionId = createSessionId;
exports.startSession = startSession;
exports.readSession = readSession;
exports.listSessions = listSessions;
exports.appendMessage = appendMessage;
exports.appendToolEvent = appendToolEvent;
exports.endSession = endSession;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
function ensureDir(dir) {
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
}
function sessionsDir() {
    const dir = path_1.default.join(os_1.default.homedir(), '.snow-flow', 'sessions');
    ensureDir(dir);
    return dir;
}
function createSessionId() {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function sessionPath(id) {
    return path_1.default.join(sessionsDir(), `${id}.json`);
}
function startSession(rec) {
    const full = { ...rec, messages: rec.messages ?? [], toolEvents: [] };
    fs_1.default.writeFileSync(sessionPath(rec.id), JSON.stringify(full, null, 2), 'utf8');
    return full;
}
function readSession(id) {
    const p = sessionPath(id);
    if (!fs_1.default.existsSync(p))
        return undefined;
    return JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
}
function listSessions() {
    const dir = sessionsDir();
    const files = fs_1.default.readdirSync(dir).filter(f => f.endsWith('.json'));
    return files.map(f => {
        const rec = JSON.parse(fs_1.default.readFileSync(path_1.default.join(dir, f), 'utf8'));
        return { id: rec.id, startedAt: rec.startedAt, objective: rec.objective };
    }).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}
function appendMessage(id, msg) {
    const rec = readSession(id);
    if (!rec)
        return;
    rec.messages.push(msg);
    fs_1.default.writeFileSync(sessionPath(id), JSON.stringify(rec, null, 2), 'utf8');
}
function appendToolEvent(id, ev) {
    const rec = readSession(id);
    if (!rec)
        return;
    const item = { name: ev.name, when: new Date().toISOString(), argsPreview: ev.argsPreview, resultPreview: ev.resultPreview };
    (rec.toolEvents = rec.toolEvents || []).push(item);
    fs_1.default.writeFileSync(sessionPath(id), JSON.stringify(rec, null, 2), 'utf8');
}
function endSession(id, summary) {
    const rec = readSession(id);
    if (!rec)
        return;
    rec.endedAt = new Date().toISOString();
    if (summary)
        rec.summary = summary;
    fs_1.default.writeFileSync(sessionPath(id), JSON.stringify(rec, null, 2), 'utf8');
}
//# sourceMappingURL=store.js.map