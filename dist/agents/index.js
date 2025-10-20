"use strict";
/**
 * ServiceNow Agent System - Claude Agent SDK Integration v4.7.0
 * DEPRECATED: Custom agents replaced by @anthropic-ai/claude-agent-sdk@0.1.1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueenOrchestrator = exports.ClaudeAgentSDKIntegration = void 0;
// Re-export SDK components for backward compatibility
var index_js_1 = require("../sdk/index.js");
Object.defineProperty(exports, "ClaudeAgentSDKIntegration", { enumerable: true, get: function () { return index_js_1.ClaudeAgentSDKIntegration; } });
Object.defineProperty(exports, "QueenOrchestrator", { enumerable: true, get: function () { return index_js_1.QueenOrchestrator; } });
// SDK-based agent system:
// - Agents are spawned via ClaudeAgentSDKIntegration
// - Queen intelligence via QueenOrchestrator
// - 86% code reduction (2832 → 400 lines)
//# sourceMappingURL=index.js.map