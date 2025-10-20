"use strict";
/**
 * ServiceNow Action Type Cache
 * Dynamically discovers and caches Flow Designer action types
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionTypeCache = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const logger_js_1 = require("./logger.js");
class ActionTypeCache {
    constructor(client) {
        this.actionTypesCache = new Map();
        this.triggerTypesCache = new Map();
        this.cacheLoaded = false;
        this.logger = new logger_js_1.Logger('ActionTypeCache');
        this.client = client;
        this.cacheDir = path_1.default.join(process.env.SNOW_FLOW_HOME || path_1.default.join(os_1.default.homedir(), '.snow-flow'), 'cache');
        this.ensureCacheDir();
    }
    ensureCacheDir() {
        if (!fs_1.default.existsSync(this.cacheDir)) {
            fs_1.default.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    /**
     * Get action type by name or label
     */
    async getActionType(nameOrLabel) {
        await this.ensureCache();
        // First try exact match
        for (const [_, actionType] of this.actionTypesCache) {
            if (actionType.name === nameOrLabel || actionType.label === nameOrLabel) {
                return actionType;
            }
        }
        // Then try case-insensitive match
        const lowerSearch = nameOrLabel.toLowerCase();
        for (const [_, actionType] of this.actionTypesCache) {
            if (actionType.name.toLowerCase() === lowerSearch ||
                actionType.label.toLowerCase() === lowerSearch) {
                return actionType;
            }
        }
        // Finally try partial match
        for (const [_, actionType] of this.actionTypesCache) {
            if (actionType.name.toLowerCase().includes(lowerSearch) ||
                actionType.label.toLowerCase().includes(lowerSearch)) {
                return actionType;
            }
        }
        return null;
    }
    /**
     * Get trigger type by name or label
     */
    async getTriggerType(nameOrLabel) {
        await this.ensureCache();
        // Map common names to actual trigger names
        const triggerMap = {
            'record_created': 'Created',
            'record_updated': 'Updated',
            'record_deleted': 'Deleted',
            'created_or_updated': 'Created or Updated',
            'scheduled': 'Scheduled',
            'manual': 'Manual'
        };
        const searchName = triggerMap[nameOrLabel] || nameOrLabel;
        // Try exact match
        for (const [_, triggerType] of this.triggerTypesCache) {
            if (triggerType.name === searchName || triggerType.label === searchName) {
                return triggerType;
            }
        }
        // Try case-insensitive match
        const lowerSearch = searchName.toLowerCase();
        for (const [_, triggerType] of this.triggerTypesCache) {
            if (triggerType.name.toLowerCase() === lowerSearch ||
                triggerType.label.toLowerCase() === lowerSearch) {
                return triggerType;
            }
        }
        return null;
    }
    /**
     * Ensure cache is loaded
     */
    async ensureCache() {
        if (this.cacheLoaded)
            return;
        // Try to load from file cache first
        if (this.loadFromFile()) {
            this.cacheLoaded = true;
            return;
        }
        // Otherwise fetch from ServiceNow
        await this.refreshCache();
    }
    /**
     * Load cache from file
     */
    loadFromFile() {
        try {
            const actionTypesFile = path_1.default.join(this.cacheDir, 'action_types.json');
            const triggerTypesFile = path_1.default.join(this.cacheDir, 'trigger_types.json');
            if (fs_1.default.existsSync(actionTypesFile) && fs_1.default.existsSync(triggerTypesFile)) {
                const actionTypes = JSON.parse(fs_1.default.readFileSync(actionTypesFile, 'utf-8'));
                const triggerTypes = JSON.parse(fs_1.default.readFileSync(triggerTypesFile, 'utf-8'));
                // Check if cache is recent (less than 24 hours old)
                const stats = fs_1.default.statSync(actionTypesFile);
                const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                if (ageInHours < 24) {
                    // Load into memory
                    actionTypes.forEach((at) => {
                        this.actionTypesCache.set(at.sys_id, at);
                    });
                    triggerTypes.forEach((tt) => {
                        this.triggerTypesCache.set(tt.sys_id, tt);
                    });
                    this.logger.info(`Loaded ${actionTypes.length} action types and ${triggerTypes.length} trigger types from cache`);
                    return true;
                }
            }
        }
        catch (error) {
            this.logger.warn('Failed to load cache from file:', error);
        }
        return false;
    }
    /**
     * Save cache to file
     */
    saveToFile() {
        try {
            const actionTypesFile = path_1.default.join(this.cacheDir, 'action_types.json');
            const triggerTypesFile = path_1.default.join(this.cacheDir, 'trigger_types.json');
            const actionTypes = Array.from(this.actionTypesCache.values());
            const triggerTypes = Array.from(this.triggerTypesCache.values());
            fs_1.default.writeFileSync(actionTypesFile, JSON.stringify(actionTypes, null, 2));
            fs_1.default.writeFileSync(triggerTypesFile, JSON.stringify(triggerTypes, null, 2));
            this.logger.info('Saved cache to file');
        }
        catch (error) {
            this.logger.warn('Failed to save cache to file:', error);
        }
    }
    /**
     * Refresh cache from ServiceNow
     */
    async refreshCache() {
        this.logger.info('Refreshing action type cache from ServiceNow...');
        try {
            // Fetch all action types
            const actionTypesResponse = await this.client.getRecords('sys_hub_action_type_base', {
                sysparm_limit: 1000,
                sysparm_fields: 'sys_id,name,label,category,active',
                sysparm_query: 'active=true'
            });
            if (actionTypesResponse.success && actionTypesResponse.data) {
                this.actionTypesCache.clear();
                actionTypesResponse.data.forEach((at) => {
                    this.actionTypesCache.set(at.sys_id, {
                        sys_id: at.sys_id,
                        name: at.name,
                        label: at.label || at.name,
                        category: at.category
                    });
                });
                this.logger.info(`Cached ${actionTypesResponse.data.length} action types`);
            }
            // Fetch all trigger types
            const triggerTypesResponse = await this.client.getRecords('sys_hub_trigger_type', {
                sysparm_limit: 100,
                sysparm_fields: 'sys_id,name,label,table_name'
            });
            if (triggerTypesResponse.success && triggerTypesResponse.data) {
                this.triggerTypesCache.clear();
                triggerTypesResponse.data.forEach((tt) => {
                    this.triggerTypesCache.set(tt.sys_id, {
                        sys_id: tt.sys_id,
                        name: tt.name,
                        label: tt.label || tt.name,
                        table_name: tt.table_name
                    });
                });
                this.logger.info(`Cached ${triggerTypesResponse.data.length} trigger types`);
            }
            // Save to file
            this.saveToFile();
            this.cacheLoaded = true;
        }
        catch (error) {
            this.logger.error('Failed to refresh cache:', error);
            // Try to continue with empty cache
            this.cacheLoaded = true;
        }
    }
    /**
     * Get all action types (for debugging/listing)
     */
    async getAllActionTypes() {
        await this.ensureCache();
        return Array.from(this.actionTypesCache.values());
    }
    /**
     * Get all trigger types (for debugging/listing)
     */
    async getAllTriggerTypes() {
        await this.ensureCache();
        return Array.from(this.triggerTypesCache.values());
    }
    /**
     * Clear cache (force refresh on next access)
     */
    clearCache() {
        this.actionTypesCache.clear();
        this.triggerTypesCache.clear();
        this.cacheLoaded = false;
        // Also remove cache files
        try {
            const actionTypesFile = path_1.default.join(this.cacheDir, 'action_types.json');
            const triggerTypesFile = path_1.default.join(this.cacheDir, 'trigger_types.json');
            if (fs_1.default.existsSync(actionTypesFile))
                fs_1.default.unlinkSync(actionTypesFile);
            if (fs_1.default.existsSync(triggerTypesFile))
                fs_1.default.unlinkSync(triggerTypesFile);
        }
        catch (error) {
            // Ignore errors
        }
    }
}
exports.ActionTypeCache = ActionTypeCache;
//# sourceMappingURL=action-type-cache.js.map