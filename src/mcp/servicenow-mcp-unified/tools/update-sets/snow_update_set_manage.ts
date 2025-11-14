/**
 * snow_update_set_manage - Unified Update Set Management
 *
 * Comprehensive tool for managing Update Set lifecycle: create, switch,
 * complete, export, preview, and artifact tracking.
 *
 * Replaces: snow_update_set_create, snow_update_set_switch,
 * snow_update_set_complete, snow_update_set_export,
 * snow_update_set_preview, snow_update_set_add_artifact
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_set_manage',
  description: `Unified tool for Update Set management (create, switch, complete, export, preview, add_artifact)

⚠️ IMPORTANT: OAuth Context
- snow-flow uses OAuth service account authentication
- Update Sets are created and tracked by the service account
- Setting an Update Set as "current" applies to the SERVICE ACCOUNT, not your UI user
- Changes are automatically captured in the Update Set regardless of UI state
- To see it as current in your ServiceNow UI, provide your ServiceNow username`,
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'update-sets',
  use_cases: ['update-sets', 'change-tracking', 'deployment'],
  complexity: 'intermediate',
  frequency: 'high',

  // Permission enforcement
  // Classification: WRITE - Update operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Management action to perform',
        enum: ['create', 'switch', 'complete', 'export', 'preview', 'add_artifact']
      },
      // Common parameters
      update_set_id: {
        type: 'string',
        description: 'Update Set sys_id (required for switch/complete/export/preview, optional for add_artifact)'
      },
      // CREATE parameters
      name: {
        type: 'string',
        description: '[create] Update Set name (e.g., "STORY-123: Add incident widget")'
      },
      description: {
        type: 'string',
        description: '[create/complete] Description or completion notes'
      },
      user_story: {
        type: 'string',
        description: '[create] User story or ticket number'
      },
      release_date: {
        type: 'string',
        description: '[create] Target release date'
      },
      servicenow_username: {
        type: 'string',
        description: '[create/switch] Optional: ServiceNow username to set Update Set as current for (e.g., "john.doe"). If not provided, Update Set is set as current for the OAuth service account only.'
      },
      auto_switch: {
        type: 'boolean',
        description: '[create] Automatically switch to created Update Set for the service account (default: false). Set to true only if you want the service account to track changes.',
        default: false
      },
      // COMPLETE parameters
      notes: {
        type: 'string',
        description: '[complete] Completion notes or testing instructions'
      },
      // EXPORT parameters
      include_preview: {
        type: 'boolean',
        description: '[export/preview] Include change preview information',
        default: true
      },
      // PREVIEW parameters
      include_payload: {
        type: 'boolean',
        description: '[preview] Include XML payload details',
        default: false
      },
      // ADD_ARTIFACT parameters
      artifact_type: {
        type: 'string',
        description: '[add_artifact] Artifact type (widget, flow, script, etc.)'
      },
      artifact_sys_id: {
        type: 'string',
        description: '[add_artifact] ServiceNow sys_id of the artifact'
      },
      artifact_name: {
        type: 'string',
        description: '[add_artifact] Artifact name for tracking'
      }
    },
    required: ['action']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { action } = args;

  try {
    switch (action) {
      case 'create':
        return await executeCreate(args, context);
      case 'switch':
        return await executeSwitch(args, context);
      case 'complete':
        return await executeComplete(args, context);
      case 'export':
        return await executeExport(args, context);
      case 'preview':
        return await executePreview(args, context);
      case 'add_artifact':
        return await executeAddArtifact(args, context);
      default:
        return createErrorResult(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

// ==================== CREATE ====================
async function executeCreate(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    name,
    description,
    user_story,
    release_date,
    auto_switch = false,
    servicenow_username
  } = args;

  if (!name || !description) {
    return createErrorResult('name and description are required for create action');
  }

  const client = await getAuthenticatedClient(context);

  // Create Update Set
  const response = await client.post('/api/now/table/sys_update_set', {
    name,
    description,
    state: 'in progress',
    application: 'global',
    release_date: release_date || ''
  });

  const updateSet = response.data.result;

  // Switching logic
  let switchResult = {
    switched: false,
    switched_for_user: null as string | null,
    switched_for_service_account: false,
    message: 'Update Set created but NOT set as current (auto_switch=false)'
  };

  // Only attempt switching if auto_switch OR servicenow_username provided
  if (auto_switch || servicenow_username) {
    try {
      // If specific username provided, switch for that user
      if (servicenow_username) {
        await setUpdateSetForUser(client, updateSet.sys_id, servicenow_username);
        switchResult.switched = true;
        switchResult.switched_for_user = servicenow_username;
        switchResult.message = `Update Set set as current for ServiceNow user: ${servicenow_username}`;
      }

      // If auto_switch enabled, also switch for service account
      if (auto_switch) {
        await setUpdateSetForServiceAccount(client, updateSet.sys_id);
        switchResult.switched = true;
        switchResult.switched_for_service_account = true;

        if (servicenow_username) {
          switchResult.message = `Update Set set as current for BOTH service account AND user: ${servicenow_username}`;
        } else {
          switchResult.message = 'Update Set set as current for OAuth service account only (not visible in your UI)';
        }
      }
    } catch (switchError: any) {
      console.error('Failed to switch update set:', switchError.message);
      switchResult.message = `Update Set created but switching failed: ${switchError.message}`;
    }
  }

  return createSuccessResult({
    sys_id: updateSet.sys_id,
    name: updateSet.name,
    description: updateSet.description,
    state: 'in progress',
    created_at: updateSet.sys_created_on,
    created_by: updateSet.sys_created_by,
    user_story,
    switching: switchResult,
    oauth_context_info: {
      message: '⚠️ snow-flow uses OAuth service account - Update Sets apply to service account context',
      note: 'To see Update Set as current in your ServiceNow UI, provide your ServiceNow username in servicenow_username parameter'
    }
  });
}

// Helper: Set update set as current for service account (OAuth user)
async function setUpdateSetForServiceAccount(client: any, updateSetId: string): Promise<void> {
  // Check if preference exists for service account
  const existingPref = await client.get('/api/now/table/sys_user_preference', {
    params: {
      sysparm_query: 'name=sys_update_set^user=javascript:gs.getUserID()',
      sysparm_limit: 1
    }
  });

  if (existingPref.data.result && existingPref.data.result.length > 0) {
    // Update existing preference
    await client.patch(
      `/api/now/table/sys_user_preference/${existingPref.data.result[0].sys_id}`,
      { value: updateSetId }
    );
  } else {
    // Create new preference
    await client.post('/api/now/table/sys_user_preference', {
      name: 'sys_update_set',
      value: updateSetId,
      user: 'javascript:gs.getUserID()'
    });
  }
}

// Helper: Set update set as current for specific ServiceNow user
async function setUpdateSetForUser(client: any, updateSetId: string, username: string): Promise<void> {
  // First, get the user's sys_id from username
  const userResponse = await client.get('/api/now/table/sys_user', {
    params: {
      sysparm_query: `user_name=${username}`,
      sysparm_fields: 'sys_id,user_name,name',
      sysparm_limit: 1
    }
  });

  if (!userResponse.data.result || userResponse.data.result.length === 0) {
    throw new Error(`ServiceNow user not found: ${username}`);
  }

  const userSysId = userResponse.data.result[0].sys_id;

  // Check if preference exists for this user
  const existingPref = await client.get('/api/now/table/sys_user_preference', {
    params: {
      sysparm_query: `name=sys_update_set^user=${userSysId}`,
      sysparm_limit: 1
    }
  });

  if (existingPref.data.result && existingPref.data.result.length > 0) {
    // Update existing preference
    await client.patch(
      `/api/now/table/sys_user_preference/${existingPref.data.result[0].sys_id}`,
      { value: updateSetId }
    );
  } else {
    // Create new preference
    await client.post('/api/now/table/sys_user_preference', {
      name: 'sys_update_set',
      value: updateSetId,
      user: userSysId
    });
  }
}

// ==================== SWITCH ====================
async function executeSwitch(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { update_set_id, servicenow_username } = args;

  if (!update_set_id) {
    return createErrorResult('update_set_id is required for switch action');
  }

  const client = await getAuthenticatedClient(context);

  // Verify Update Set exists
  const checkResponse = await client.get(`/api/now/table/sys_update_set/${update_set_id}`, {
    params: {
      sysparm_fields: 'sys_id,name,description,state,sys_created_on'
    }
  });

  if (!checkResponse.data.result) {
    return createErrorResult(`Update Set not found: ${update_set_id}`);
  }

  const updateSet = checkResponse.data.result;

  // Switch logic
  let switchResult = {
    switched: false,
    switched_for_user: null as string | null,
    switched_for_service_account: false,
    message: ''
  };

  try {
    // If specific username provided, switch for that user
    if (servicenow_username) {
      await setUpdateSetForUser(client, update_set_id, servicenow_username);
      switchResult.switched = true;
      switchResult.switched_for_user = servicenow_username;
      switchResult.message = `Update Set switched for ServiceNow user: ${servicenow_username}`;
    } else {
      // Default: switch for service account only
      await setUpdateSetForServiceAccount(client, update_set_id);
      switchResult.switched = true;
      switchResult.switched_for_service_account = true;
      switchResult.message = 'Update Set switched for OAuth service account only (not visible in your UI)';
    }

    return createSuccessResult({
      sys_id: updateSet.sys_id,
      name: updateSet.name,
      description: updateSet.description,
      state: updateSet.state,
      created_at: updateSet.sys_created_on,
      switching: switchResult,
      oauth_context_info: {
        message: '⚠️ snow-flow uses OAuth service account - Update Sets apply to service account context',
        note: 'To see Update Set as current in your ServiceNow UI, provide your ServiceNow username in servicenow_username parameter'
      }
    });
  } catch (switchError: any) {
    return createErrorResult(`Failed to switch update set: ${switchError.message}`);
  }
}

// ==================== COMPLETE ====================
async function executeComplete(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { update_set_id, notes } = args;
  const client = await getAuthenticatedClient(context);

  let targetId = update_set_id;

  // If no ID specified, use current Update Set
  if (!targetId) {
    const currentResponse = await client.get('/api/now/table/sys_update_set', {
      params: {
        sysparm_query: 'is_current=true',
        sysparm_fields: 'sys_id',
        sysparm_limit: 1
      }
    });

    if (!currentResponse.data.result || currentResponse.data.result.length === 0) {
      return createErrorResult('No Update Set specified and no active Update Set found');
    }

    targetId = currentResponse.data.result[0].sys_id;
  }

  // Get Update Set details
  const getResponse = await client.get(`/api/now/table/sys_update_set/${targetId}`, {
    params: {
      sysparm_fields: 'sys_id,name,description,state'
    }
  });

  if (!getResponse.data.result) {
    return createErrorResult(`Update Set not found: ${targetId}`);
  }

  const updateSet = getResponse.data.result;

  // Mark as complete
  const updateData: any = {
    state: 'complete'
  };

  if (notes) {
    updateData.description = `${updateSet.description}\n\nCompletion Notes: ${notes}`;
  }

  await client.put(`/api/now/table/sys_update_set/${targetId}`, updateData);

  // Get artifact count
  const artifactsResponse = await client.get('/api/now/table/sys_update_xml', {
    params: {
      sysparm_query: `update_set=${targetId}`,
      sysparm_fields: 'sys_id',
      sysparm_limit: 1000
    }
  });

  const artifactCount = artifactsResponse.data.result?.length || 0;

  return createSuccessResult({
    sys_id: targetId,
    name: updateSet.name,
    state: 'complete',
    artifact_count: artifactCount,
    notes: notes || null,
    message: 'Update Set marked as complete. No further changes can be made.'
  });
}

// ==================== EXPORT ====================
async function executeExport(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { update_set_id, include_preview = true } = args;

  if (!update_set_id) {
    return createErrorResult('update_set_id is required for export action');
  }

  const client = await getAuthenticatedClient(context);

  // Get Update Set details
  const updateSetResponse = await client.get(`/api/now/table/sys_update_set/${update_set_id}`, {
    params: {
      sysparm_fields: 'sys_id,name,description,state,sys_created_on,sys_created_by'
    }
  });

  if (!updateSetResponse.data.result) {
    return createErrorResult(`Update Set not found: ${update_set_id}`);
  }

  const updateSet = updateSetResponse.data.result;

  // Get all changes
  const changesResponse = await client.get('/api/now/table/sys_update_xml', {
    params: {
      sysparm_query: `update_set=${update_set_id}`,
      sysparm_fields: 'sys_id,type,name,target_name,action,payload,sys_updated_on',
      sysparm_limit: 10000
    }
  });

  const changes = changesResponse.data.result || [];

  // Build XML export
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const xmlContent = `
<unload unload_date="${new Date().toISOString()}">
  <sys_remote_update_set action="INSERT_OR_UPDATE">
    <sys_id>${updateSet.sys_id}</sys_id>
    <name>${escapeXml(updateSet.name)}</name>
    <description>${escapeXml(updateSet.description || '')}</description>
    <state>${updateSet.state}</state>
    <sys_created_on>${updateSet.sys_created_on}</sys_created_on>
    <sys_created_by>${updateSet.sys_created_by}</sys_created_by>
  </sys_remote_update_set>
  ${changes.map((change: any) => `
  <sys_update_xml action="INSERT_OR_UPDATE">
    <sys_id>${change.sys_id}</sys_id>
    <type>${escapeXml(change.type || '')}</type>
    <name>${escapeXml(change.name || '')}</name>
    <target_name>${escapeXml(change.target_name || '')}</target_name>
    <action>${change.action}</action>
    <update_set>${update_set_id}</update_set>
    <payload>${escapeXml(change.payload || '')}</payload>
    <sys_updated_on>${change.sys_updated_on}</sys_updated_on>
  </sys_update_xml>`).join('')}
</unload>`.trim();

  const xml = xmlHeader + '\n' + xmlContent;

  // Build preview if requested
  let preview = null;
  if (include_preview) {
    const changesByType: Record<string, number> = {};
    changes.forEach((change: any) => {
      const type = change.type || 'Unknown';
      changesByType[type] = (changesByType[type] || 0) + 1;
    });

    preview = {
      total_changes: changes.length,
      changes_by_type: changesByType
    };
  }

  return createSuccessResult({
    update_set: {
      sys_id: updateSet.sys_id,
      name: updateSet.name,
      state: updateSet.state
    },
    export: {
      xml,
      size_bytes: Buffer.byteLength(xml, 'utf8'),
      change_count: changes.length
    },
    ...(preview && { preview }),
    exported_at: new Date().toISOString()
  });
}

// ==================== PREVIEW ====================
async function executePreview(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { update_set_id, include_payload = false } = args;
  const client = await getAuthenticatedClient(context);

  let targetId = update_set_id;

  // If no ID specified, use current Update Set
  if (!targetId) {
    const currentResponse = await client.get('/api/now/table/sys_update_set', {
      params: {
        sysparm_query: 'is_current=true',
        sysparm_fields: 'sys_id,name',
        sysparm_limit: 1
      }
    });

    if (!currentResponse.data.result || currentResponse.data.result.length === 0) {
      return createErrorResult('No Update Set specified and no active Update Set found');
    }

    targetId = currentResponse.data.result[0].sys_id;
  }

  // Get Update Set details
  const updateSetResponse = await client.get(`/api/now/table/sys_update_set/${targetId}`, {
    params: {
      sysparm_fields: 'sys_id,name,description,state,sys_created_on'
    }
  });

  if (!updateSetResponse.data.result) {
    return createErrorResult(`Update Set not found: ${targetId}`);
  }

  const updateSet = updateSetResponse.data.result;

  // Get all changes
  const changesResponse = await client.get('/api/now/table/sys_update_xml', {
    params: {
      sysparm_query: `update_set=${targetId}`,
      sysparm_fields: include_payload
        ? 'sys_id,type,name,target_name,action,sys_updated_on,sys_updated_by,payload'
        : 'sys_id,type,name,target_name,action,sys_updated_on,sys_updated_by',
      sysparm_limit: 1000
    }
  });

  const changes = changesResponse.data.result || [];

  // Group changes by type
  const changesByType: Record<string, any[]> = {};
  changes.forEach((change: any) => {
    const type = change.type || 'Unknown';
    if (!changesByType[type]) {
      changesByType[type] = [];
    }
    changesByType[type].push({
      name: change.name,
      target: change.target_name,
      action: change.action,
      updated_at: change.sys_updated_on,
      updated_by: change.sys_updated_by,
      ...(include_payload && { payload: change.payload })
    });
  });

  return createSuccessResult({
    update_set: {
      sys_id: updateSet.sys_id,
      name: updateSet.name,
      description: updateSet.description,
      state: updateSet.state,
      created_at: updateSet.sys_created_on
    },
    changes: {
      total_count: changes.length,
      by_type: changesByType,
      type_summary: Object.entries(changesByType).map(([type, items]) => ({
        type,
        count: items.length
      }))
    },
    preview_generated_at: new Date().toISOString()
  });
}

// ==================== ADD_ARTIFACT ====================
async function executeAddArtifact(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { artifact_type, artifact_sys_id, artifact_name, update_set_id } = args;

  if (!artifact_type || !artifact_sys_id || !artifact_name) {
    return createErrorResult('artifact_type, artifact_sys_id, and artifact_name are required for add_artifact action');
  }

  const client = await getAuthenticatedClient(context);

  let targetId = update_set_id;

  // If no ID specified, use current Update Set
  if (!targetId) {
    const currentResponse = await client.get('/api/now/table/sys_update_set', {
      params: {
        sysparm_query: 'is_current=true',
        sysparm_fields: 'sys_id,name',
        sysparm_limit: 1
      }
    });

    if (!currentResponse.data.result || currentResponse.data.result.length === 0) {
      return createErrorResult('No Update Set specified and no active Update Set found');
    }

    targetId = currentResponse.data.result[0].sys_id;
  }

  // Create sys_update_xml record to track artifact
  const trackingResponse = await client.post('/api/now/table/sys_update_xml', {
    update_set: targetId,
    type: artifact_type,
    name: artifact_name,
    target_name: artifact_sys_id,
    action: 'INSERT_OR_UPDATE',
    payload: `<!-- Artifact tracked: ${artifact_type} - ${artifact_name} -->`
  });

  const trackingRecord = trackingResponse.data.result;

  return createSuccessResult({
    tracked: true,
    update_set_id: targetId,
    artifact: {
      type: artifact_type,
      sys_id: artifact_sys_id,
      name: artifact_name,
      tracking_record: trackingRecord.sys_id
    },
    message: `Artifact '${artifact_name}' (${artifact_type}) added to Update Set`
  });
}

// Helper function to escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const version = '2.0.0';
export const author = 'Snow-Flow v8.2.0 Tool Merging';
