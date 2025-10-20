/**
 * ServiceNow Action Type Cache
 * Dynamically discovers and caches Flow Designer action types
 */
import { ServiceNowClient } from './servicenow-client.js';
export interface ActionType {
    sys_id: string;
    name: string;
    label: string;
    category?: string;
    inputs?: any;
    outputs?: any;
}
export interface TriggerType {
    sys_id: string;
    name: string;
    label: string;
    table_name?: string;
}
export declare class ActionTypeCache {
    private logger;
    private client;
    private cacheDir;
    private actionTypesCache;
    private triggerTypesCache;
    private cacheLoaded;
    constructor(client: ServiceNowClient);
    private ensureCacheDir;
    /**
     * Get action type by name or label
     */
    getActionType(nameOrLabel: string): Promise<ActionType | null>;
    /**
     * Get trigger type by name or label
     */
    getTriggerType(nameOrLabel: string): Promise<TriggerType | null>;
    /**
     * Ensure cache is loaded
     */
    private ensureCache;
    /**
     * Load cache from file
     */
    private loadFromFile;
    /**
     * Save cache to file
     */
    private saveToFile;
    /**
     * Refresh cache from ServiceNow
     */
    refreshCache(): Promise<void>;
    /**
     * Get all action types (for debugging/listing)
     */
    getAllActionTypes(): Promise<ActionType[]>;
    /**
     * Get all trigger types (for debugging/listing)
     */
    getAllTriggerTypes(): Promise<TriggerType[]>;
    /**
     * Clear cache (force refresh on next access)
     */
    clearCache(): void;
}
//# sourceMappingURL=action-type-cache.d.ts.map