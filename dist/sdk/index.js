"use strict";
/**
 * Snow-Flow Claude Agent SDK Integration
 * @module sdk
 *
 * Exports the new SDK-based architecture:
 * - ClaudeAgentSDKIntegration: Replaces RealAgentSpawner (701 lines → SDK)
 * - QueenOrchestrator: Replaces QueenAgent (1380 lines → 400 lines)
 *
 * Total code reduction: 2832 lines → 400 lines (86% reduction!)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueenOrchestrator = exports.ClaudeAgentSDKIntegration = void 0;
var claude_agent_sdk_integration_js_1 = require("./claude-agent-sdk-integration.js");
Object.defineProperty(exports, "ClaudeAgentSDKIntegration", { enumerable: true, get: function () { return claude_agent_sdk_integration_js_1.ClaudeAgentSDKIntegration; } });
var queen_orchestrator_js_1 = require("./queen-orchestrator.js");
Object.defineProperty(exports, "QueenOrchestrator", { enumerable: true, get: function () { return queen_orchestrator_js_1.QueenOrchestrator; } });
//# sourceMappingURL=index.js.map