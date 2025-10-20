#!/usr/bin/env node
"use strict";
/**
 * Deployment Metadata Handler
 *
 * Solves Issue #3: Metadata Response Failures
 * Ensures all deployments return proper sys_id and API endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentMetadataHandler = void 0;
exports.getMetadataHandler = getMetadataHandler;
exports.ensureDeploymentMetadata = ensureDeploymentMetadata;
const servicenow_client_js_1 = require("./servicenow-client.js");
const snow_oauth_js_1 = require("./snow-oauth.js");
const logger_js_1 = require("./logger.js");
class DeploymentMetadataHandler {
    constructor() {
        this.metadataCache = new Map();
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
        this.logger = new logger_js_1.Logger('DeploymentMetadataHandler');
    }
    /**
     * Extract metadata from deployment response
     */
    async extractMetadata(deploymentType, deploymentResponse, additionalInfo) {
        try {
            let metadata = null;
            switch (deploymentType) {
                case 'flow':
                    metadata = await this.extractFlowMetadata(deploymentResponse, additionalInfo);
                    break;
                case 'widget':
                    metadata = await this.extractWidgetMetadata(deploymentResponse, additionalInfo);
                    break;
                case 'script':
                    metadata = await this.extractScriptMetadata(deploymentResponse, additionalInfo);
                    break;
                case 'business_rule':
                    metadata = await this.extractBusinessRuleMetadata(deploymentResponse, additionalInfo);
                    break;
                default:
                    metadata = await this.extractGenericMetadata(deploymentType, deploymentResponse, additionalInfo);
            }
            if (!metadata) {
                throw new Error('Failed to extract metadata from deployment response');
            }
            // Verify the deployment
            const verification = await this.verifyDeployment(metadata);
            metadata.verification_status = verification.exists && verification.accessible ? 'verified' : 'failed';
            // Cache the metadata
            this.metadataCache.set(metadata.sys_id, metadata);
            return {
                success: true,
                metadata,
                verification
            };
        }
        catch (error) {
            this.logger.error('Metadata extraction failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Extract flow metadata
     */
    async extractFlowMetadata(response, additionalInfo) {
        let sysId = null;
        let name = '';
        // Try multiple paths to find sys_id
        sysId = response?.sys_id ||
            response?.result?.sys_id ||
            response?.flow?.sys_id ||
            additionalInfo?.flowSysId ||
            additionalInfo?.sys_id;
        // If still no sys_id, try to find it from update set
        if (!sysId && additionalInfo?.update_set_id) {
            sysId = await this.findFlowFromUpdateSet(additionalInfo.update_set_id);
        }
        // If still no sys_id, search by name
        if (!sysId && (response?.name || additionalInfo?.name)) {
            name = response?.name || additionalInfo?.name;
            sysId = await this.findFlowByName(name);
        }
        if (!sysId) {
            this.logger.warn('Could not find flow sys_id in response');
            return null;
        }
        // Get additional details
        const flowDetails = await this.getFlowDetails(sysId);
        const credentials = await this.oauth.getCredentials();
        return {
            sys_id: sysId,
            name: flowDetails?.name || name || 'Unknown Flow',
            type: 'flow',
            table: 'sys_hub_flow',
            api_endpoint: `https://${credentials?.instance}/api/now/table/sys_hub_flow/${sysId}`,
            ui_url: `https://${credentials?.instance}/flow-designer/${sysId}`,
            created_on: flowDetails?.sys_created_on,
            created_by: flowDetails?.sys_created_by,
            update_set_id: additionalInfo?.update_set_id
        };
    }
    /**
     * Extract widget metadata
     */
    async extractWidgetMetadata(response, additionalInfo) {
        let sysId = null;
        let name = '';
        // Try multiple paths to find sys_id
        sysId = response?.sys_id ||
            response?.result?.sys_id ||
            response?.widget?.sys_id ||
            additionalInfo?.widgetSysId ||
            additionalInfo?.sys_id;
        // Search by name if needed
        if (!sysId && (response?.name || additionalInfo?.name)) {
            name = response?.name || additionalInfo?.name;
            sysId = await this.findWidgetByName(name);
        }
        if (!sysId) {
            this.logger.warn('Could not find widget sys_id in response');
            return null;
        }
        const credentials = await this.oauth.getCredentials();
        return {
            sys_id: sysId,
            name: name || response?.title || 'Unknown Widget',
            type: 'widget',
            table: 'sp_widget',
            api_endpoint: `https://${credentials?.instance}/api/now/table/sp_widget/${sysId}`,
            ui_url: `https://${credentials?.instance}/sp_config?id=widget_editor&sys_id=${sysId}`,
            update_set_id: additionalInfo?.update_set_id
        };
    }
    /**
     * Extract script include metadata
     */
    async extractScriptMetadata(response, additionalInfo) {
        let sysId = null;
        sysId = response?.sys_id ||
            response?.result?.sys_id ||
            additionalInfo?.sys_id;
        if (!sysId && response?.name) {
            sysId = await this.findScriptIncludeByName(response.name);
        }
        if (!sysId)
            return null;
        const credentials = await this.oauth.getCredentials();
        return {
            sys_id: sysId,
            name: response?.name || 'Unknown Script',
            type: 'script_include',
            table: 'sys_script_include',
            api_endpoint: `https://${credentials?.instance}/api/now/table/sys_script_include/${sysId}`,
            ui_url: `https://${credentials?.instance}/sys_script_include.do?sys_id=${sysId}`
        };
    }
    /**
     * Extract business rule metadata
     */
    async extractBusinessRuleMetadata(response, additionalInfo) {
        let sysId = null;
        sysId = response?.sys_id ||
            response?.result?.sys_id ||
            additionalInfo?.sys_id;
        if (!sysId && response?.name) {
            sysId = await this.findBusinessRuleByName(response.name, response?.table);
        }
        if (!sysId)
            return null;
        const credentials = await this.oauth.getCredentials();
        return {
            sys_id: sysId,
            name: response?.name || 'Unknown Business Rule',
            type: 'business_rule',
            table: 'sys_script',
            api_endpoint: `https://${credentials?.instance}/api/now/table/sys_script/${sysId}`,
            ui_url: `https://${credentials?.instance}/sys_script.do?sys_id=${sysId}`
        };
    }
    /**
     * Extract generic metadata
     */
    async extractGenericMetadata(type, response, additionalInfo) {
        const sysId = response?.sys_id || response?.result?.sys_id || additionalInfo?.sys_id;
        if (!sysId)
            return null;
        const credentials = await this.oauth.getCredentials();
        const table = additionalInfo?.table || this.getTableForType(type);
        return {
            sys_id: sysId,
            name: response?.name || additionalInfo?.name || `Unknown ${type}`,
            type,
            table,
            api_endpoint: `https://${credentials?.instance}/api/now/table/${table}/${sysId}`,
            ui_url: `https://${credentials?.instance}/${table}.do?sys_id=${sysId}`
        };
    }
    /**
     * Find flow from update set
     */
    async findFlowFromUpdateSet(updateSetId) {
        try {
            const response = await this.client.makeRequest({
                method: 'GET',
                url: '/api/now/table/sys_update_xml',
                params: {
                    sysparm_query: `update_set=${updateSetId}^name^STARTSWITHsys_hub_flow_`,
                    sysparm_limit: 1,
                    sysparm_fields: 'name'
                }
            });
            if (response.result && response.result.length > 0) {
                return response.result[0].name.replace('sys_hub_flow_', '');
            }
        }
        catch (error) {
            this.logger.warn('Error finding flow from update set:', error);
        }
        return null;
    }
    /**
     * Find flow by name
     */
    async findFlowByName(name) {
        try {
            const response = await this.client.makeRequest({
                method: 'GET',
                url: '/api/now/table/sys_hub_flow',
                params: {
                    sysparm_query: `name=${name}^ORinternal_name=${name}`,
                    sysparm_limit: 1,
                    sysparm_fields: 'sys_id'
                }
            });
            if (response.result && response.result.length > 0) {
                return response.result[0].sys_id;
            }
        }
        catch (error) {
            this.logger.warn('Error finding flow by name:', error);
        }
        return null;
    }
    /**
     * Find widget by name
     */
    async findWidgetByName(name) {
        try {
            const response = await this.client.makeRequest({
                method: 'GET',
                url: '/api/now/table/sp_widget',
                params: {
                    sysparm_query: `name=${name}^ORid=${name}`,
                    sysparm_limit: 1,
                    sysparm_fields: 'sys_id'
                }
            });
            if (response.result && response.result.length > 0) {
                return response.result[0].sys_id;
            }
        }
        catch (error) {
            this.logger.warn('Error finding widget by name:', error);
        }
        return null;
    }
    /**
     * Find script include by name
     */
    async findScriptIncludeByName(name) {
        try {
            const response = await this.client.makeRequest({
                method: 'GET',
                url: '/api/now/table/sys_script_include',
                params: {
                    sysparm_query: `name=${name}^ORapi_name=${name}`,
                    sysparm_limit: 1,
                    sysparm_fields: 'sys_id'
                }
            });
            if (response.result && response.result.length > 0) {
                return response.result[0].sys_id;
            }
        }
        catch (error) {
            this.logger.warn('Error finding script include by name:', error);
        }
        return null;
    }
    /**
     * Find business rule by name
     */
    async findBusinessRuleByName(name, table) {
        try {
            let query = `name=${name}`;
            if (table) {
                query += `^collection=${table}`;
            }
            const response = await this.client.makeRequest({
                method: 'GET',
                url: '/api/now/table/sys_script',
                params: {
                    sysparm_query: query,
                    sysparm_limit: 1,
                    sysparm_fields: 'sys_id'
                }
            });
            if (response.result && response.result.length > 0) {
                return response.result[0].sys_id;
            }
        }
        catch (error) {
            this.logger.warn('Error finding business rule by name:', error);
        }
        return null;
    }
    /**
     * Get flow details
     */
    async getFlowDetails(sysId) {
        try {
            const response = await this.client.makeRequest({
                method: 'GET',
                url: `/api/now/table/sys_hub_flow/${sysId}`,
                params: {
                    sysparm_fields: 'name,sys_created_on,sys_created_by,internal_name'
                }
            });
            return response.result;
        }
        catch (error) {
            this.logger.warn('Error getting flow details:', error);
            return null;
        }
    }
    /**
     * Verify deployment exists and is accessible
     */
    async verifyDeployment(metadata) {
        const verification = {
            exists: false,
            accessible: false,
            functional: false
        };
        try {
            // Check if record exists
            const response = await this.client.makeRequest({
                method: 'GET',
                url: `/api/now/table/${metadata.table}/${metadata.sys_id}`,
                params: {
                    sysparm_fields: 'sys_id,name'
                }
            });
            verification.exists = !!response.result;
            verification.accessible = response.success;
            // For flows, check if it's active
            if (metadata.type === 'flow' && response.result) {
                verification.functional = response.result.active === 'true' || response.result.active === true;
            }
            else {
                verification.functional = verification.exists;
            }
        }
        catch (error) {
            this.logger.warn('Verification failed:', error);
        }
        return verification;
    }
    /**
     * Get table name for deployment type
     */
    getTableForType(type) {
        const tableMap = {
            'flow': 'sys_hub_flow',
            'widget': 'sp_widget',
            'script_include': 'sys_script_include',
            'business_rule': 'sys_script',
            'ui_script': 'sys_ui_script',
            'client_script': 'sys_script_client',
            'table': 'sys_db_object',
            'application': 'sys_app'
        };
        return tableMap[type] || 'sys_metadata';
    }
    /**
     * Get cached metadata
     */
    getCachedMetadata(sysId) {
        return this.metadataCache.get(sysId) || null;
    }
    /**
     * Clear metadata cache
     */
    clearCache() {
        this.metadataCache.clear();
    }
}
exports.DeploymentMetadataHandler = DeploymentMetadataHandler;
// Singleton instance
let handlerInstance = null;
/**
 * Get or create handler instance
 */
function getMetadataHandler() {
    if (!handlerInstance) {
        handlerInstance = new DeploymentMetadataHandler();
    }
    return handlerInstance;
}
/**
 * Helper to ensure deployment returns metadata
 */
async function ensureDeploymentMetadata(deploymentType, deploymentResponse, additionalInfo) {
    const handler = getMetadataHandler();
    return handler.extractMetadata(deploymentType, deploymentResponse, additionalInfo);
}
exports.default = DeploymentMetadataHandler;
//# sourceMappingURL=deployment-metadata-handler.js.map