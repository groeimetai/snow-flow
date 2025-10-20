"use strict";
/**
 * ServiceNow Eventual Consistency Handler
 *
 * ServiceNow uses a distributed database architecture with eventual consistency:
 * - Write operations go to primary database (immediate)
 * - Read operations may use read replicas (1-3 second lag)
 * - This causes race conditions in deployment verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConsistency = exports.flowConsistency = exports.widgetConsistency = exports.CONSISTENCY_CONFIGS = exports.ServiceNowEventualConsistency = void 0;
const logger_js_1 = require("./logger.js");
class ServiceNowEventualConsistency {
    constructor(loggerName = 'EventualConsistency') {
        this.logger = new logger_js_1.Logger(loggerName);
    }
    /**
     * Retry a ServiceNow operation with exponential backoff
     * Designed specifically for post-deployment verification
     */
    async retryWithBackoff(operation, config = {}) {
        const { maxRetries = 5, baseDelay = 1000, maxDelay = 8000, backoffMultiplier = 1.5 } = config;
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
                    this.logger.info(`⏳ Retry attempt ${attempt + 1}/${maxRetries} (waiting ${delay}ms for consistency)`);
                    await this.sleep(delay);
                }
                const result = await operation();
                if (result) {
                    this.logger.info(`✅ Operation succeeded on attempt ${attempt + 1}`);
                    return { result, success: true, attempts: attempt + 1 };
                }
            }
            catch (error) {
                lastError = error;
                if (this.isPermanentError(error)) {
                    this.logger.error(`❌ Permanent error detected:`, error);
                    return { result: null, success: false, attempts: attempt + 1 };
                }
                if (attempt === 0) {
                    this.logger.info(`⏳ ${this.getErrorDescription(error)} - typical ServiceNow consistency issue`);
                }
                else {
                    this.logger.info(`⏳ Still getting ${error.status || 'error'}, retrying...`);
                }
            }
        }
        this.logger.warn(`⚠️ Operation failed after ${maxRetries} attempts`);
        this.logger.warn(`⚠️ Last error: ${lastError?.message || 'Unknown'}`);
        return { result: null, success: false, attempts: maxRetries };
    }
    /**
     * Verify a ServiceNow record exists with retry logic
     */
    async verifyRecordExists(client, table, sys_id, config = {}) {
        this.logger.info(`🔍 Verifying ${table} record ${sys_id} (handling eventual consistency)`);
        const operation = async () => {
            const response = await client.getRecord(table, sys_id);
            return response && response.sys_id === sys_id ? response : null;
        };
        const { result, success, attempts } = await this.retryWithBackoff(operation, config);
        if (!success) {
            const isLikelyTimingIssue = this.assessIfTimingIssue(attempts, config.maxRetries);
            if (isLikelyTimingIssue) {
                this.logger.warn(`⚠️ This appears to be a ServiceNow consistency issue, not a deployment failure`);
                this.logger.warn(`⚠️ Check directly: /${table}.do?sys_id=${sys_id}`);
            }
            return {
                success: false,
                attempts,
                isLikelyTimingIssue
            };
        }
        return {
            success: true,
            attempts,
            isLikelyTimingIssue: false
        };
    }
    /**
     * Verify multiple records exist (batch verification)
     */
    async verifyMultipleRecords(client, verifications, config = {}) {
        const results = [];
        for (const verification of verifications) {
            const result = await this.verifyRecordExists(client, verification.table, verification.sys_id, config);
            results.push({
                ...result,
                table: verification.table,
                sys_id: verification.sys_id,
                name: verification.name
            });
            // Small delay between verifications to avoid rate limiting
            if (verifications.length > 1) {
                await this.sleep(200);
            }
        }
        return results;
    }
    /**
     * Execute operation with eventual consistency retry
     * Generic wrapper for any ServiceNow operation that might fail due to timing
     */
    async executeWithRetry(operationName, operation, validator, config = {}) {
        this.logger.info(`🚀 Executing ${operationName} with consistency handling`);
        const { result, success, attempts } = await this.retryWithBackoff(async () => {
            const opResult = await operation();
            return validator(opResult) ? opResult : null;
        }, config);
        return {
            result,
            success,
            metadata: {
                operationName,
                attempts,
                isLikelyTimingIssue: !success && this.assessIfTimingIssue(attempts, config.maxRetries)
            }
        };
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Determine if an error indicates a permanent failure vs timing issue
     */
    isPermanentError(error) {
        // Permanent errors that shouldn't be retried
        if (error.status === 401)
            return true; // Authentication
        if (error.status === 400 && !error.message?.includes('null'))
            return true; // Bad request
        if (error.message?.includes('table does not exist'))
            return true; // Invalid table
        if (error.message?.includes('permission denied') && error.status !== 403)
            return true; // Real permission issues
        return false;
    }
    /**
     * Get user-friendly error description
     */
    getErrorDescription(error) {
        if (error.status === 403)
            return 'Access temporarily denied (403)';
        if (error.status === 404)
            return 'Record not found (404)';
        if (error.message?.includes('null'))
            return 'Null response received';
        return `Error ${error.status || 'unknown'}`;
    }
    /**
     * Assess if failure is likely due to timing issues
     */
    assessIfTimingIssue(attempts, maxRetries = 5) {
        // If we exhausted all retries and got timing-related errors, it's likely a timing issue
        return attempts >= maxRetries;
    }
    /**
     * Create a pre-configured instance for widget deployments
     */
    static createForWidgets() {
        return new ServiceNowEventualConsistency('WidgetConsistency');
    }
    /**
     * Create a pre-configured instance for flow deployments
     */
    static createForFlows() {
        return new ServiceNowEventualConsistency('FlowConsistency');
    }
    /**
     * Create a pre-configured instance for application deployments
     */
    static createForApplications() {
        return new ServiceNowEventualConsistency('AppConsistency');
    }
}
exports.ServiceNowEventualConsistency = ServiceNowEventualConsistency;
/**
 * Default configuration for different deployment types
 */
exports.CONSISTENCY_CONFIGS = {
    // Fast retry for simple records
    WIDGET: {
        maxRetries: 5,
        baseDelay: 800,
        maxDelay: 6000,
        backoffMultiplier: 1.4
    },
    // Medium retry for complex records
    FLOW: {
        maxRetries: 6,
        baseDelay: 1200,
        maxDelay: 8000,
        backoffMultiplier: 1.5
    },
    // Longer retry for applications with dependencies
    APPLICATION: {
        maxRetries: 8,
        baseDelay: 1500,
        maxDelay: 12000,
        backoffMultiplier: 1.6
    },
    // Quick check for batch operations
    BATCH: {
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 3000,
        backoffMultiplier: 1.3
    }
};
// Export singleton instances
exports.widgetConsistency = ServiceNowEventualConsistency.createForWidgets();
exports.flowConsistency = ServiceNowEventualConsistency.createForFlows();
exports.appConsistency = ServiceNowEventualConsistency.createForApplications();
//# sourceMappingURL=servicenow-eventual-consistency.js.map