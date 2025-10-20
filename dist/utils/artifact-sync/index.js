"use strict";
/**
 * Artifact Sync System - Public API
 *
 * This module provides dynamic synchronization between ServiceNow artifacts
 * and local files, enabling Claude Code to use its native tools on ServiceNow code.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartFieldFetcher = exports.ArtifactLocalSync = void 0;
__exportStar(require("./artifact-registry"), exports);
var artifact_local_sync_1 = require("../artifact-local-sync");
Object.defineProperty(exports, "ArtifactLocalSync", { enumerable: true, get: function () { return artifact_local_sync_1.ArtifactLocalSync; } });
var smart_field_fetcher_1 = require("../smart-field-fetcher");
Object.defineProperty(exports, "SmartFieldFetcher", { enumerable: true, get: function () { return smart_field_fetcher_1.SmartFieldFetcher; } });
/**
 * Example usage:
 *
 * ```typescript
 * import { ArtifactLocalSync, getArtifactConfig } from './utils/artifact-sync';
 *
 * const sync = new ArtifactLocalSync(serviceNowClient);
 *
 * // Pull any artifact type
 * const artifact = await sync.pullArtifact('sp_widget', 'widget_sys_id');
 * const artifact = await sync.pullArtifact('sys_script', 'business_rule_sys_id');
 * const artifact = await sync.pullArtifact('sys_script_include', 'script_include_sys_id');
 *
 * // Auto-detect artifact type
 * const artifact = await sync.pullArtifactBySysId('any_sys_id');
 *
 * // Push changes back
 * await sync.pushArtifact('sys_id');
 *
 * // Validate coherence
 * const results = await sync.validateArtifactCoherence('sys_id');
 * ```
 */ 
//# sourceMappingURL=index.js.map