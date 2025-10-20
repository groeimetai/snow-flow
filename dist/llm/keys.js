"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setApiKey = setApiKey;
exports.getApiKey = getApiKey;
exports.clearApiKey = clearApiKey;
exports.listKeys = listKeys;
const conf_1 = __importDefault(require("conf"));
// Avoid generic type for broader compatibility with shimmed types
const store = new conf_1.default({ projectName: 'snow-flow' });
function setApiKey(provider, value) {
    store.set(`keys.${provider}`, value);
}
function getApiKey(provider) {
    return store.get(`keys.${provider}`);
}
function clearApiKey(provider) {
    store.delete(`keys.${provider}`);
}
function listKeys() {
    const providers = ['openai', 'google', 'openrouter', 'openai-compatible', 'ollama'];
    const out = {};
    for (const p of providers)
        out[p] = getApiKey(p);
    return out;
}
//# sourceMappingURL=keys.js.map