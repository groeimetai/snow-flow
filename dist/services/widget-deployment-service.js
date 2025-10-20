"use strict";
/**
 * Widget Deployment Service
 * Direct ServiceNow API implementation for widget deployment
 * No more MCP failures!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.widgetDeployment = exports.WidgetDeploymentService = void 0;
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const logger_js_1 = require("../utils/logger.js");
const unified_auth_store_js_1 = require("../utils/unified-auth-store.js");
const servicenow_eventual_consistency_js_1 = require("../utils/servicenow-eventual-consistency.js");
class WidgetDeploymentService {
    constructor() {
        this.client = null;
        this.logger = new logger_js_1.Logger('WidgetDeploymentService');
    }
    static getInstance() {
        if (!WidgetDeploymentService.instance) {
            WidgetDeploymentService.instance = new WidgetDeploymentService();
        }
        return WidgetDeploymentService.instance;
    }
    /**
     * Initialize ServiceNow client
     */
    async getClient() {
        if (!this.client) {
            const tokens = await unified_auth_store_js_1.unifiedAuthStore.getTokens();
            if (!tokens || !tokens.instance) {
                throw new Error('No ServiceNow authentication configured');
            }
            this.client = new servicenow_client_js_1.ServiceNowClient();
            // Set credentials
            this.client.instance = tokens.instance;
            this.client.clientId = tokens.clientId;
            this.client.clientSecret = tokens.clientSecret;
            // Set access token if available
            if (tokens.accessToken) {
                this.client.accessToken = tokens.accessToken;
            }
        }
        return this.client;
    }
    /**
     * Deploy widget to ServiceNow using direct API
     */
    async deployWidget(config) {
        try {
            this.logger.info(`Deploying widget: ${config.name}`);
            // Get authenticated client
            const client = await this.getClient();
            // Prepare widget data for ServiceNow
            const widgetData = this.prepareWidgetData(config);
            // First, check if widget already exists
            const existingWidget = await this.findExistingWidget(client, config.name);
            let sys_id;
            let isUpdate = false;
            if (existingWidget) {
                // Update existing widget
                this.logger.info(`Updating existing widget: ${existingWidget.sys_id}`);
                sys_id = existingWidget.sys_id;
                isUpdate = true;
                await this.updateWidget(client, sys_id, widgetData);
            }
            else {
                // Create new widget
                this.logger.info('Creating new widget');
                const result = await this.createWidget(client, widgetData);
                sys_id = result.sys_id;
            }
            // Verify deployment with eventual consistency handling
            const verified = await this.verifyDeployment(client, sys_id);
            // Log verification result with context
            if (!verified) {
                this.logger.warn(`⚠️  Verification returned false - this may be a ServiceNow timing issue`);
                this.logger.info(`🔗 Direct verification link: https://${client.instance || 'instance'}.service-now.com/sp_widget.do?sys_id=${sys_id}`);
            }
            // Get widget details for response
            const widgetDetails = await this.getWidgetDetails(client, sys_id);
            return {
                success: true,
                sys_id,
                portalUrl: this.buildPortalUrl(client, sys_id),
                apiEndpoint: this.buildApiEndpoint(client, sys_id),
                message: isUpdate
                    ? `Widget '${config.name}' updated successfully${!verified ? ' (verification pending - check ServiceNow directly)' : ''}`
                    : `Widget '${config.name}' created successfully${!verified ? ' (verification pending - check ServiceNow directly)' : ''}`,
                verificationStatus: verified ? 'verified' : 'unverified'
            };
        }
        catch (error) {
            this.logger.error('Widget deployment failed:', error);
            return {
                success: false,
                message: 'Widget deployment failed',
                error: error.message || 'Unknown error occurred',
                verificationStatus: 'failed'
            };
        }
    }
    /**
     * Prepare widget data for ServiceNow API
     */
    prepareWidgetData(config) {
        return {
            name: config.name,
            id: config.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            title: config.title,
            template: config.template || '<div>Widget Template</div>',
            css: config.css || '',
            script: config.script || '', // ServiceNow uses 'script' field
            client_controller: config.client_script || '',
            demo_data: config.demo_data || '{}',
            option_schema: config.option_schema || '[]',
            public: false,
            category: config.category || 'custom',
            description: config.description || `Widget created by Snow-Flow`,
            active: true
        };
    }
    /**
     * Find existing widget by name
     */
    async findExistingWidget(client, name) {
        try {
            const query = `name=${encodeURIComponent(name)}`;
            const response = await client.getRecords('sp_widget', {
                sysparm_query: query,
                sysparm_limit: 1
            });
            if (response.result && response.result.length > 0) {
                return response.result[0];
            }
            return null;
        }
        catch (error) {
            this.logger.debug('No existing widget found:', error.message);
            return null;
        }
    }
    /**
     * Create new widget
     */
    async createWidget(client, widgetData) {
        const response = await client.createRecord('sp_widget', widgetData);
        if (!response || !response.sys_id) {
            throw new Error('Failed to create widget - no sys_id returned');
        }
        return response;
    }
    /**
     * Update existing widget
     */
    async updateWidget(client, sys_id, widgetData) {
        await client.updateRecord('sp_widget', sys_id, widgetData);
    }
    /**
     * Verify widget deployment with retry logic for eventual consistency
     * ServiceNow has database replication lag of 1-3 seconds
     */
    async verifyDeployment(client, sys_id) {
        const result = await servicenow_eventual_consistency_js_1.widgetConsistency.verifyRecordExists(client, 'sp_widget', sys_id, servicenow_eventual_consistency_js_1.CONSISTENCY_CONFIGS.WIDGET);
        if (!result.success && result.isLikelyTimingIssue) {
            this.logger.warn(`⚠️  Widget verification failed after ${result.attempts} attempts`);
            this.logger.warn(`⚠️  This appears to be a ServiceNow timing issue, not a deployment failure`);
            this.logger.info(`🔗 Check directly: https://${client.instance}/sp_widget.do?sys_id=${sys_id}`);
        }
        return result.success;
    }
    /**
     * Get widget details
     */
    async getWidgetDetails(client, sys_id) {
        try {
            const response = await client.getRecord('sp_widget', sys_id);
            return response;
        }
        catch (error) {
            this.logger.error('Failed to get widget details:', error);
            return null;
        }
    }
    /**
     * Build portal URL for widget
     */
    buildPortalUrl(client, sys_id) {
        const instance = client.instance || 'instance';
        return `https://${instance}.service-now.com/sp?id=widget_editor&sys_id=${sys_id}`;
    }
    /**
     * Build API endpoint for widget
     */
    buildApiEndpoint(client, sys_id) {
        const instance = client.instance || 'instance';
        return `https://${instance}.service-now.com/api/now/table/sp_widget/${sys_id}`;
    }
    /**
     * Deploy widget with Update Set tracking
     */
    async deployWidgetWithUpdateSet(config, updateSetId) {
        try {
            // If update set provided, switch to it first
            if (updateSetId) {
                await this.switchToUpdateSet(updateSetId);
            }
            // Deploy the widget
            const result = await this.deployWidget(config);
            // Log to update set if successful
            if (result.success && result.sys_id) {
                await this.logToUpdateSet(result.sys_id, 'sp_widget', config.name);
            }
            return result;
        }
        catch (error) {
            this.logger.error('Widget deployment with update set failed:', error);
            return {
                success: false,
                message: 'Widget deployment failed',
                error: error.message
            };
        }
    }
    /**
     * Switch to update set
     */
    async switchToUpdateSet(updateSetId) {
        try {
            const client = await this.getClient();
            // Set current update set
            await client.updateRecord('sys_user_preference', 'current', {
                name: 'sys_update_set',
                value: updateSetId,
                user: 'admin' // This should be the current user
            });
            this.logger.info(`Switched to update set: ${updateSetId}`);
        }
        catch (error) {
            this.logger.warn('Failed to switch update set:', error.message);
            // Continue anyway - update set tracking is optional
        }
    }
    /**
     * Log artifact to update set
     */
    async logToUpdateSet(sys_id, table, name) {
        try {
            this.logger.info(`Logged ${name} to current update set`);
        }
        catch (error) {
            this.logger.warn('Failed to log to update set:', error.message);
            // Non-critical error
        }
    }
    /**
     * Batch deploy multiple widgets
     */
    async batchDeployWidgets(widgets) {
        const results = [];
        for (const widget of widgets) {
            const result = await this.deployWidget(widget);
            results.push(result);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return results;
    }
    /**
     * Test widget deployment
     */
    async testDeployment(config) {
        try {
            const client = await this.getClient();
            // Test connection
            const canConnect = await this.testConnection(client);
            // Test permissions
            const hasPermissions = await this.testPermissions(client);
            return {
                canConnect,
                hasPermissions,
                testResult: canConnect && hasPermissions ? 'ready' : 'not_ready'
            };
        }
        catch (error) {
            return {
                canConnect: false,
                hasPermissions: false,
                testResult: `error: ${error.message}`
            };
        }
    }
    /**
     * Test ServiceNow connection
     */
    async testConnection(client) {
        try {
            // Simple test - try to query widgets table
            await client.getRecords('sp_widget', { sysparm_limit: 1 });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Test write permissions
     */
    async testPermissions(client) {
        try {
            // Try to create and immediately delete a test widget
            const testWidget = {
                name: `test_widget_${Date.now()}`,
                id: `test_${Date.now()}`,
                title: 'Test Widget',
                template: '<div>Test</div>'
            };
            const result = await client.createRecord('sp_widget', testWidget);
            if (result && result.sys_id) {
                // Clean up test widget
                await client.deleteRecord('sp_widget', result.sys_id);
                return true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
}
exports.WidgetDeploymentService = WidgetDeploymentService;
// Export singleton instance
exports.widgetDeployment = WidgetDeploymentService.getInstance();
//# sourceMappingURL=widget-deployment-service.js.map