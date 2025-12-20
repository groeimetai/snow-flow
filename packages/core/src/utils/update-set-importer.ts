#!/usr/bin/env node
/**
 * Update Set Importer
 * 
 * Programmatically imports Update Set XML files into ServiceNow
 * via REST API with full error handling and verification
 */

import { ServiceNowClient } from './servicenow-client.js';
import { ServiceNowOAuth } from './snow-oauth.js';
import { Logger } from './logger.js';
import * as fs from 'fs';
import * as path from 'path';

export interface ImportOptions {
  autoPreview?: boolean;
  autoCommit?: boolean;
  skipOnConflict?: boolean;
  backupBeforeCommit?: boolean;
  validateFirst?: boolean;
}

export interface ImportResult {
  success: boolean;
  remoteUpdateSetId?: string;
  localUpdateSetId?: string;
  previewStatus?: 'clean' | 'conflicts' | 'errors';
  previewProblems?: any[];
  commitStatus?: 'success' | 'failed' | 'skipped';
  error?: string;
  backupPath?: string;
  flowSysId?: string;
  flowUrl?: string;
}

export class UpdateSetImporter {
  private client: ServiceNowClient;
  private oauth: ServiceNowOAuth;
  private logger: Logger;
  
  constructor() {
    this.client = new ServiceNowClient();
    this.oauth = new ServiceNowOAuth();
    this.logger = new Logger('UpdateSetImporter');
  }

  /**
   * Import Update Set XML file to ServiceNow
   */
  async importUpdateSet(
    xmlFilePath: string, 
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      // Check authentication
      const isAuth = await this.oauth.isAuthenticated();
      if (!isAuth) {
        throw new Error('Not authenticated. Run: snow-flow auth login');
      }

      // Read XML file
      const xmlContent = await fs.promises.readFile(xmlFilePath, 'utf-8');
      
      // Validate XML if requested
      if (options.validateFirst) {
        const validation = this.validateXML(xmlContent);
        if (!validation.valid) {
          throw new Error(`XML validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Step 1: Import as remote update set
      this.logger.info('Importing XML as remote update set...');
      const remoteUpdateSetId = await this.importRemoteUpdateSet(xmlContent);
      
      // Step 2: Load the remote update set
      this.logger.info('Loading remote update set...');
      const localUpdateSetId = await this.loadRemoteUpdateSet(remoteUpdateSetId);
      
      // Step 3: Preview if requested
      let previewStatus: 'clean' | 'conflicts' | 'errors' = 'clean';
      let previewProblems: any[] = [];
      
      if (options.autoPreview !== false) {
        this.logger.info('Previewing update set...');
        const preview = await this.previewUpdateSet(localUpdateSetId);
        previewStatus = preview.status;
        previewProblems = preview.problems;
        
        if (previewStatus !== 'clean' && options.skipOnConflict) {
          return {
            success: false,
            remoteUpdateSetId,
            localUpdateSetId,
            previewStatus,
            previewProblems,
            commitStatus: 'skipped',
            error: 'Preview found conflicts/errors, skipping commit'
          };
        }
      }
      
      // Step 4: Backup if requested
      let backupPath: string | undefined;
      if (options.backupBeforeCommit && localUpdateSetId) {
        this.logger.info('Creating backup...');
        backupPath = await this.backupUpdateSet(localUpdateSetId);
      }
      
      // Step 5: Commit if requested and preview is clean
      let commitStatus: 'success' | 'failed' | 'skipped' = 'skipped';
      let flowSysId: string | undefined;
      let flowUrl: string | undefined;
      
      if (options.autoCommit && previewStatus === 'clean') {
        this.logger.info('Committing update set...');
        const commit = await this.commitUpdateSet(localUpdateSetId);
        commitStatus = commit.success ? 'success' : 'failed';
        
        if (commit.success) {
          // Try to find the flow that was deployed
          const flowInfo = await this.findDeployedFlow(localUpdateSetId);
          flowSysId = flowInfo?.sys_id;
          flowUrl = flowInfo?.url;
        }
      }
      
      return {
        success: commitStatus === 'success' || (previewStatus === 'clean' && !options.autoCommit),
        remoteUpdateSetId,
        localUpdateSetId,
        previewStatus,
        previewProblems,
        commitStatus,
        backupPath,
        flowSysId,
        flowUrl
      };
      
    } catch (error) {
      this.logger.error('Import failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Import XML as remote update set
   */
  private async importRemoteUpdateSet(xmlContent: string): Promise<string> {
    const response = await this.client.makeRequest({
      method: 'POST',
      url: '/api/now/v2/table/sys_remote_update_set/import',
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/json'
      },
      data: xmlContent
    });

    if (!response.success || !response.result) {
      throw new Error('Failed to import remote update set');
    }

    // Handle different response formats
    const sysId = response.result.sys_id || 
                  response.result.result?.sys_id ||
                  response.result[0]?.sys_id;
                  
    if (!sysId) {
      throw new Error('Failed to get remote update set sys_id from response');
    }

    return sysId;
  }

  /**
   * Load remote update set to create local update set
   */
  private async loadRemoteUpdateSet(remoteUpdateSetId: string): Promise<string> {
    // First, update state to loaded
    await this.client.makeRequest({
      method: 'PATCH',
      url: `/api/now/table/sys_remote_update_set/${remoteUpdateSetId}`,
      data: {
        state: 'loaded'
      }
    });

    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find the loaded update set
    const response = await this.client.makeRequest({
      method: 'GET',
      url: '/api/now/table/sys_update_set',
      params: {
        sysparm_query: `origin_sys_id=${remoteUpdateSetId}^ORremote_sys_id=${remoteUpdateSetId}`,
        sysparm_limit: 1,
        sysparm_fields: 'sys_id,name,state'
      }
    });

    if (!response.success || !response.result || response.result.length === 0) {
      throw new Error('Failed to find loaded update set');
    }

    return response.result[0].sys_id;
  }

  /**
   * Preview update set
   */
  private async previewUpdateSet(updateSetId: string): Promise<{
    status: 'clean' | 'conflicts' | 'errors';
    problems: any[];
  }> {
    // Trigger preview
    await this.client.makeRequest({
      method: 'POST',
      url: `/api/now/table/sys_update_set/${updateSetId}/preview`,
      data: {}
    });

    // Wait for preview to complete
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = await this.client.makeRequest({
        method: 'GET',
        url: `/api/now/table/sys_update_set/${updateSetId}`,
        params: {
          sysparm_fields: 'state,preview_state'
        }
      });

      if (response.result?.preview_state === 'complete') {
        break;
      }
      
      attempts++;
    }

    // Check for preview problems
    const problemsResponse = await this.client.makeRequest({
      method: 'GET',
      url: '/api/now/table/sys_update_preview_problem',
      params: {
        sysparm_query: `update_set=${updateSetId}`,
        sysparm_limit: 100
      }
    });

    const problems = problemsResponse.result || [];
    let status: 'clean' | 'conflicts' | 'errors' = 'clean';
    
    if (problems.length > 0) {
      const hasErrors = problems.some((p: any) => p.type === 'error');
      status = hasErrors ? 'errors' : 'conflicts';
    }

    return { status, problems };
  }

  /**
   * Commit update set
   */
  private async commitUpdateSet(updateSetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.makeRequest({
        method: 'POST',
        url: `/api/now/table/sys_update_set/${updateSetId}/commit`,
        data: {}
      });

      // Verify commit completed
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const response = await this.client.makeRequest({
        method: 'GET',
        url: `/api/now/table/sys_update_set/${updateSetId}`,
        params: {
          sysparm_fields: 'state'
        }
      });

      const isCommitted = response.result?.state === 'complete' || 
                          response.result?.state === 'committed';
      
      return { success: isCommitted };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Backup update set before commit
   */
  private async backupUpdateSet(updateSetId: string): Promise<string> {
    const response = await this.client.makeRequest({
      method: 'GET',
      url: `/api/now/v2/table/sys_update_set/${updateSetId}/export`
    });

    const backupDir = path.join(process.cwd(), 'update-set-backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(
      backupDir, 
      `backup_${updateSetId}_${Date.now()}.xml`
    );
    
    fs.writeFileSync(backupPath, response.result || response);
    return backupPath;
  }

  /**
   * Find deployed flow from update set
   */
  private async findDeployedFlow(updateSetId: string): Promise<{ sys_id: string; url: string } | null> {
    try {
      // Look for flow in update set
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
        const flowSysId = response.result[0].name.replace('sys_hub_flow_', '');
        const credentials = await this.oauth.getCredentials();
        const flowUrl = `https://${credentials?.instance}/flow_designer/${flowSysId}`;
        
        return { sys_id: flowSysId, url: flowUrl };
      }
    } catch (error) {
      this.logger.warn('Could not find deployed flow:', error);
    }
    
    return null;
  }

  /**
   * Validate XML structure
   */
  private validateXML(xml: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!xml.includes('<?xml')) {
      errors.push('Missing XML declaration');
    }
    
    if (!xml.includes('<sys_remote_update_set')) {
      errors.push('Missing sys_remote_update_set element');
    }
    
    if (!xml.includes('<unload')) {
      errors.push('Missing unload root element');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Static helper to import with default options
   */
  static async importFlow(xmlFilePath: string): Promise<ImportResult> {
    const importer = new UpdateSetImporter();
    return importer.importUpdateSet(xmlFilePath, {
      autoPreview: true,
      autoCommit: true,
      skipOnConflict: false,
      backupBeforeCommit: true,
      validateFirst: true
    });
  }
}

// Export helper functions
export async function deployFlowXML(
  xmlFilePath: string,
  autoCommit: boolean = true
): Promise<ImportResult> {
  const importer = new UpdateSetImporter();
  return importer.importUpdateSet(xmlFilePath, {
    autoPreview: true,
    autoCommit,
    skipOnConflict: false,
    backupBeforeCommit: true,
    validateFirst: true
  });
}

export async function previewFlowXML(xmlFilePath: string): Promise<ImportResult> {
  const importer = new UpdateSetImporter();
  return importer.importUpdateSet(xmlFilePath, {
    autoPreview: true,
    autoCommit: false,
    skipOnConflict: false,
    backupBeforeCommit: false,
    validateFirst: true
  });
}

export default UpdateSetImporter;