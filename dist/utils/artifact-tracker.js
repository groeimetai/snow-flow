"use strict";
/**
 * Artifact Tracker - Manages consistent sys_id tracking and validation
 * Solves the sys_id inconsistency problem identified in feedback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.artifactTracker = exports.ArtifactTracker = void 0;
const logger_js_1 = require("./logger.js");
const servicenow_client_js_1 = require("./servicenow-client.js");
class ArtifactTracker {
    constructor() {
        this.sessions = new Map();
        this.currentSessionId = null;
        this.logger = new logger_js_1.Logger('ArtifactTracker');
        this.client = new servicenow_client_js_1.ServiceNowClient();
    }
    /**
     * Create or resume a tracking session
     */
    startSession(sessionId) {
        const id = sessionId || this.generateSessionId();
        if (!this.sessions.has(id)) {
            this.sessions.set(id, {
                sessionId: id,
                artifacts: new Map(),
                createdAt: new Date(),
                lastAccessed: new Date()
            });
            this.logger.info(`Started new artifact tracking session: ${id}`);
        }
        else {
            const session = this.sessions.get(id);
            session.lastAccessed = new Date();
            this.logger.info(`Resumed artifact tracking session: ${id}`);
        }
        this.currentSessionId = id;
        return id;
    }
    /**
     * Track a new artifact
     */
    trackArtifact(sys_id, table, name, type, operation = 'create') {
        if (!this.currentSessionId) {
            this.startSession();
        }
        const session = this.sessions.get(this.currentSessionId);
        // Check for existing tracking
        const existingKey = this.findArtifactKey(sys_id, name, type);
        if (existingKey && existingKey !== sys_id) {
            this.logger.warn(`Sys_id inconsistency detected! Found existing artifact with different sys_id:`, {
                new_sys_id: sys_id,
                existing_sys_id: existingKey,
                name,
                type
            });
        }
        const artifact = {
            sys_id,
            table,
            name,
            type,
            status: operation === 'create' ? 'pending' : 'modified',
            operations: [{
                    operation,
                    timestamp: new Date(),
                    success: true,
                    details: `Artifact tracked for ${operation}`
                }],
            lastValidated: new Date()
        };
        session.artifacts.set(sys_id, artifact);
        this.logger.info(`Tracking artifact: ${name} (${sys_id}) in table ${table}`);
        return artifact;
    }
    /**
     * Validate that a sys_id actually exists in ServiceNow
     */
    async validateArtifact(sys_id) {
        if (!this.currentSessionId) {
            return false;
        }
        const session = this.sessions.get(this.currentSessionId);
        if (!session) {
            return false;
        }
        const artifact = session.artifacts.get(sys_id);
        if (!artifact) {
            this.logger.warn(`Cannot validate unknown artifact: ${sys_id}`);
            return false;
        }
        try {
            this.logger.info(`Validating artifact ${sys_id} in table ${artifact.table}`);
            // getRecord returns the data directly or throws an error
            const data = await this.client.getRecord(artifact.table, sys_id);
            // If we got here without throwing, the record exists
            const isValid = !!data;
            // Update tracking
            artifact.operations.push({
                operation: 'validate',
                timestamp: new Date(),
                success: isValid,
                details: isValid ? 'Artifact exists in ServiceNow' : 'Artifact not found in ServiceNow',
                error: undefined
            });
            artifact.lastValidated = new Date();
            return isValid;
        }
        catch (error) {
            // Handle specific error cases
            const errorMessage = String(error);
            let validationDetails = 'Validation error';
            let skipErrorStatus = false;
            // Check if it's a permission error (403) or authentication error (401)
            if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                validationDetails = 'Unable to validate - insufficient read permissions';
                skipErrorStatus = true; // Don't mark as error since deployment succeeded
                this.logger.warn(`Permission issue during validation for ${sys_id}, but deployment was successful`);
            }
            else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                validationDetails = 'Unable to validate - authentication issue';
                skipErrorStatus = true;
                this.logger.warn(`Authentication issue during validation for ${sys_id}, but deployment was successful`);
            }
            else {
                this.logger.error(`Error validating artifact ${sys_id}:`, error);
            }
            artifact.operations.push({
                operation: 'validate',
                timestamp: new Date(),
                success: false,
                details: validationDetails,
                error: errorMessage
            });
            // Only mark as error if it's not a permission issue and deployment already succeeded
            if (!skipErrorStatus && artifact.status !== 'deployed') {
                artifact.status = 'error';
            }
            // For permission/auth errors on successfully deployed artifacts, consider it valid
            if (skipErrorStatus && artifact.status === 'deployed') {
                return true;
            }
            return false;
        }
    }
    /**
     * Record an operation on a tracked artifact
     */
    recordOperation(sys_id, operation, success, details, error) {
        if (!this.currentSessionId) {
            return;
        }
        const session = this.sessions.get(this.currentSessionId);
        if (!session) {
            return;
        }
        const artifact = session.artifacts.get(sys_id);
        if (!artifact) {
            this.logger.warn(`Cannot record operation for unknown artifact: ${sys_id}`);
            return;
        }
        artifact.operations.push({
            operation,
            timestamp: new Date(),
            success,
            details,
            error
        });
        // Update status
        if (success) {
            artifact.status = operation === 'create' ? 'deployed' : 'modified';
        }
        else {
            artifact.status = 'error';
        }
        this.logger.info(`Recorded ${operation} operation for ${sys_id}: ${success ? 'success' : 'failure'}`);
    }
    /**
     * Get all tracked artifacts in current session
     */
    getTrackedArtifacts() {
        if (!this.currentSessionId) {
            return [];
        }
        const session = this.sessions.get(this.currentSessionId);
        if (!session) {
            return [];
        }
        return Array.from(session.artifacts.values());
    }
    /**
     * Get specific artifact by sys_id
     */
    getArtifact(sys_id) {
        if (!this.currentSessionId) {
            return null;
        }
        const session = this.sessions.get(this.currentSessionId);
        if (!session) {
            return null;
        }
        return session.artifacts.get(sys_id) || null;
    }
    /**
     * Find sys_id inconsistencies
     */
    findInconsistencies() {
        const inconsistencies = [];
        if (!this.currentSessionId) {
            return inconsistencies;
        }
        const session = this.sessions.get(this.currentSessionId);
        if (!session) {
            return inconsistencies;
        }
        const artifacts = Array.from(session.artifacts.values());
        const nameTypeMap = new Map();
        // Group by name + type
        for (const artifact of artifacts) {
            const key = `${artifact.name}:${artifact.type}`;
            if (!nameTypeMap.has(key)) {
                nameTypeMap.set(key, []);
            }
            nameTypeMap.get(key).push(artifact);
        }
        // Find duplicates
        for (const [key, duplicates] of nameTypeMap.entries()) {
            if (duplicates.length > 1) {
                inconsistencies.push({
                    artifacts: duplicates,
                    issue: `Multiple sys_ids for same artifact: ${key}`
                });
            }
        }
        return inconsistencies;
    }
    /**
     * Generate session summary for debugging
     */
    getSessionSummary() {
        if (!this.currentSessionId) {
            return { error: 'No active session' };
        }
        const session = this.sessions.get(this.currentSessionId);
        if (!session) {
            return { error: 'Session not found' };
        }
        const artifacts = Array.from(session.artifacts.values());
        const summary = {
            sessionId: this.currentSessionId,
            artifactCount: artifacts.length,
            statusCounts: {
                pending: artifacts.filter(a => a.status === 'pending').length,
                deployed: artifacts.filter(a => a.status === 'deployed').length,
                modified: artifacts.filter(a => a.status === 'modified').length,
                error: artifacts.filter(a => a.status === 'error').length
            },
            inconsistencies: this.findInconsistencies(),
            artifacts: artifacts.map(a => ({
                sys_id: a.sys_id,
                name: a.name,
                type: a.type,
                status: a.status,
                operationCount: a.operations.length,
                lastValidated: a.lastValidated
            }))
        };
        return summary;
    }
    findArtifactKey(sys_id, name, type) {
        if (!this.currentSessionId) {
            return null;
        }
        const session = this.sessions.get(this.currentSessionId);
        if (!session) {
            return null;
        }
        // Look for existing artifact with same name and type
        for (const [existingSysId, artifact] of session.artifacts.entries()) {
            if (artifact.name === name && artifact.type === type && existingSysId !== sys_id) {
                return existingSysId;
            }
        }
        return null;
    }
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ArtifactTracker = ArtifactTracker;
// Global instance for session management
exports.artifactTracker = new ArtifactTracker();
//# sourceMappingURL=artifact-tracker.js.map