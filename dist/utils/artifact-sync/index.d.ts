/**
 * Artifact Sync System - Public API
 *
 * This module provides dynamic synchronization between ServiceNow artifacts
 * and local files, enabling Claude Code to use its native tools on ServiceNow code.
 */
export * from './artifact-registry';
export { ArtifactLocalSync } from '../artifact-local-sync';
export { SmartFieldFetcher } from '../smart-field-fetcher';
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
//# sourceMappingURL=index.d.ts.map