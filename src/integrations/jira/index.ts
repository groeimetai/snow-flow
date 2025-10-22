/**
 * Jira Integration Module
 *
 * Provides complete Jira integration capabilities for Snow-Flow Enterprise:
 * - API client for Jira REST operations
 * - Sync engine for Jira → ServiceNow synchronization
 * - Field mapping and transformation
 * - ServiceNow client interface
 * - Type definitions and error handling
 *
 * All operations require valid enterprise license with 'jira' feature.
 */

export * from './types.js';
export * from './api-client.js';
export * from './sync-engine.js';
export * from './servicenow-mapper.js';
export * from './servicenow-client.js';
