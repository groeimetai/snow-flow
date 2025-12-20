/**
 * ServiceNow Action Type Cache
 * Dynamically discovers and caches Flow Designer action types
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { ServiceNowClient } from './servicenow-client.js';
import { Logger } from './logger.js';

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

export class ActionTypeCache {
  private logger: Logger;
  private client: ServiceNowClient;
  private cacheDir: string;
  private actionTypesCache: Map<string, ActionType> = new Map();
  private triggerTypesCache: Map<string, TriggerType> = new Map();
  private cacheLoaded = false;

  constructor(client: ServiceNowClient) {
    this.logger = new Logger('ActionTypeCache');
    this.client = client;
    this.cacheDir = path.join(process.env.SNOW_FLOW_HOME || path.join(os.homedir(), '.snow-flow'), 'cache');
    this.ensureCacheDir();
  }

  private ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get action type by name or label
   */
  async getActionType(nameOrLabel: string): Promise<ActionType | null> {
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
  async getTriggerType(nameOrLabel: string): Promise<TriggerType | null> {
    await this.ensureCache();
    
    // Map common names to actual trigger names
    const triggerMap: Record<string, string> = {
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
  private async ensureCache() {
    if (this.cacheLoaded) return;
    
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
  private loadFromFile(): boolean {
    try {
      const actionTypesFile = path.join(this.cacheDir, 'action_types.json');
      const triggerTypesFile = path.join(this.cacheDir, 'trigger_types.json');
      
      if (fs.existsSync(actionTypesFile) && fs.existsSync(triggerTypesFile)) {
        const actionTypes = JSON.parse(fs.readFileSync(actionTypesFile, 'utf-8'));
        const triggerTypes = JSON.parse(fs.readFileSync(triggerTypesFile, 'utf-8'));
        
        // Check if cache is recent (less than 24 hours old)
        const stats = fs.statSync(actionTypesFile);
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours < 24) {
          // Load into memory
          actionTypes.forEach((at: ActionType) => {
            this.actionTypesCache.set(at.sys_id, at);
          });
          
          triggerTypes.forEach((tt: TriggerType) => {
            this.triggerTypesCache.set(tt.sys_id, tt);
          });
          
          this.logger.info(`Loaded ${actionTypes.length} action types and ${triggerTypes.length} trigger types from cache`);
          return true;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load cache from file:', error);
    }
    
    return false;
  }

  /**
   * Save cache to file
   */
  private saveToFile() {
    try {
      const actionTypesFile = path.join(this.cacheDir, 'action_types.json');
      const triggerTypesFile = path.join(this.cacheDir, 'trigger_types.json');
      
      const actionTypes = Array.from(this.actionTypesCache.values());
      const triggerTypes = Array.from(this.triggerTypesCache.values());
      
      fs.writeFileSync(actionTypesFile, JSON.stringify(actionTypes, null, 2));
      fs.writeFileSync(triggerTypesFile, JSON.stringify(triggerTypes, null, 2));
      
      this.logger.info('Saved cache to file');
    } catch (error) {
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
        actionTypesResponse.data.forEach((at: any) => {
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
        triggerTypesResponse.data.forEach((tt: any) => {
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
      
    } catch (error) {
      this.logger.error('Failed to refresh cache:', error);
      // Try to continue with empty cache
      this.cacheLoaded = true;
    }
  }

  /**
   * Get all action types (for debugging/listing)
   */
  async getAllActionTypes(): Promise<ActionType[]> {
    await this.ensureCache();
    return Array.from(this.actionTypesCache.values());
  }

  /**
   * Get all trigger types (for debugging/listing)
   */
  async getAllTriggerTypes(): Promise<TriggerType[]> {
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
      const actionTypesFile = path.join(this.cacheDir, 'action_types.json');
      const triggerTypesFile = path.join(this.cacheDir, 'trigger_types.json');
      
      if (fs.existsSync(actionTypesFile)) fs.unlinkSync(actionTypesFile);
      if (fs.existsSync(triggerTypesFile)) fs.unlinkSync(triggerTypesFile);
    } catch (error) {
      // Ignore errors
    }
  }
}