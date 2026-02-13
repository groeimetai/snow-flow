import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';
import { summary } from '../../shared/output-formatter.js';

// ── helpers ────────────────────────────────────────────────────────────

function sanitizeInternalName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function isSysId(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}

// ── GraphQL Flow Designer helpers ─────────────────────────────────────

function jsToGraphQL(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'string') return JSON.stringify(val);
  if (typeof val === 'number' || typeof val === 'bigint') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (Array.isArray(val)) return '[' + val.map(jsToGraphQL).join(', ') + ']';
  if (typeof val === 'object') {
    return '{' + Object.entries(val).map(([k, v]) => k + ': ' + jsToGraphQL(v)).join(', ') + '}';
  }
  return String(val);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function executeFlowPatchMutation(
  client: any,
  flowPatch: any,
  responseFields: string
): Promise<any> {
  const mutation = 'mutation { global { snFlowDesigner { flow(flowPatch: ' +
    jsToGraphQL(flowPatch) + ') { id ' + responseFields + ' __typename } __typename } __typename } }';
  const resp = await client.post('/api/now/graphql', { variables: {}, query: mutation });
  const errors = resp.data?.errors;
  if (errors && errors.length > 0) {
    throw new Error('GraphQL error: ' + JSON.stringify(errors[0].message || errors[0]));
  }
  return resp.data?.data?.global?.snFlowDesigner?.flow || resp.data;
}

async function lookupDefinitionParams(client: any, defSysId: string): Promise<any[]> {
  const queries = [
    { table: 'sys_hub_action_type_param', query: 'action_type=' + defSysId },
    { table: 'sys_hub_action_type_param', query: 'model=' + defSysId },
    { table: 'sys_hub_action_input_param', query: 'action_type=' + defSysId },
    { table: 'sys_hub_action_input_param', query: 'model=' + defSysId },
  ];
  const fields = 'sys_id,name,element,label,internal_type,type,type_label,order,mandatory,readonly,maxsize,data_structure,reference,reference_display,ref_qual,choice_option,column_name,default_value,use_dependent,dependent_on,internal_link,attributes,sys_class_name';
  for (const q of queries) {
    try {
      const resp = await client.get('/api/now/table/' + q.table, {
        params: { sysparm_query: q.query, sysparm_fields: fields, sysparm_display_value: 'false', sysparm_limit: 50 }
      });
      const raw = resp.data.result || [];
      if (raw.length === 0) continue;
      const seen = new Set<string>();
      const unique: any[] = [];
      for (const r of raw) {
        const id = r.sys_id || '';
        if (id === defSysId) continue;
        if (id && seen.has(id)) continue;
        const name = r.name || r.element || '';
        if (!name) continue;
        seen.add(id);
        unique.push(r);
      }
      if (unique.length > 0) return unique;
    } catch (_) {}
  }
  return [];
}

function str(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.value !== undefined) return String(v.value);
  return String(v);
}

function buildGraphQLInput(p: any, defaultValue?: any, forTrigger?: boolean): any {
  const name = str(p.name) || str(p.element) || '';
  const type = str(p.internal_type) || str(p.type) || 'string';
  const isMandatory = p.mandatory === 'true' || p.mandatory === true;
  const order = parseInt(str(p.order)) || 100;
  const defVal = defaultValue !== undefined ? defaultValue : (str(p.default_value) || '');
  const valueObj = type === 'conditions'
    ? { schemaless: false, schemalessValue: '', value: '^EQ' }
    : defVal
      ? { schemaless: false, schemalessValue: '', value: String(defVal) }
      : { value: '' };
  const parameter: any = {
    id: str(p.sys_id) || '',
    label: str(p.label) || name,
    name,
    type,
    type_label: str(p.type_label) || '',
    hint: '',
    order,
    extended: false,
    mandatory: isMandatory,
    readonly: p.readonly === 'true' || p.readonly === true,
    maxsize: parseInt(str(p.maxsize)) || 80,
    data_structure: str(p.data_structure) || '',
    reference: str(p.reference) || '',
    reference_display: str(p.reference_display) || '',
    ref_qual: str(p.ref_qual) || '',
    choiceOption: str(p.choice_option) || '',
    table: '',
    columnName: str(p.column_name) || '',
    defaultValue: str(p.default_value) || '',
    use_dependent: p.use_dependent === 'true' || p.use_dependent === true,
    dependent_on: str(p.dependent_on) || '',
    show_ref_finder: false,
    local: false,
    attributes: str(p.attributes) || '',
    sys_class_name: str(p.sys_class_name) || '',
    children: []
  };
  if (!forTrigger) {
    parameter.dynamic = null;
  } else {
    parameter.internal_link = p.internal_link || '';
  }

  if (forTrigger) {
    return {
      name, label: str(p.label) || name, internalType: type, mandatory: isMandatory,
      order, valueSysId: '', field_name: name, type,
      children: [], displayValue: { value: '' }, value: valueObj, parameter
    };
  }
  return {
    id: str(p.sys_id) || '', name,
    children: [], displayValue: { value: '' }, value: valueObj, parameter
  };
}

async function addTriggerViaGraphQL(
  client: any,
  flowId: string,
  triggerType: string,
  table?: string,
  condition?: string
): Promise<{ success: boolean; triggerId?: string; steps?: any; error?: string }> {
  const steps: any = {};

  const triggerMap: Record<string, { type: string; name: string; triggerType: string; defNames: string[] }> = {
    'record_created': { type: 'record_create', name: 'Created', triggerType: 'Record',
      defNames: ['sn_fd.trigger.record_create', 'global.sn_fd.trigger.record_create', 'sn_fd.trigger.record_created', 'global.sn_fd.trigger.record_created'] },
    'record_updated': { type: 'record_update', name: 'Updated', triggerType: 'Record',
      defNames: ['sn_fd.trigger.record_update', 'global.sn_fd.trigger.record_update', 'sn_fd.trigger.record_updated', 'global.sn_fd.trigger.record_updated'] },
    'record_create_or_update': { type: 'record_create_or_update', name: 'Created or Updated', triggerType: 'Record',
      defNames: ['sn_fd.trigger.record_create_or_update', 'global.sn_fd.trigger.record_create_or_update'] },
    'scheduled': { type: 'scheduled', name: 'Scheduled', triggerType: 'Scheduled',
      defNames: ['sn_fd.trigger.scheduled', 'global.sn_fd.trigger.scheduled'] },
  };

  const config = triggerMap[triggerType] || triggerMap['record_create_or_update'];

  let trigDefId: string | null = null;
  const defTables = ['sys_hub_action_type_definition', 'sys_hub_trigger_definition'];
  for (const defTable of defTables) {
    if (trigDefId) break;
    for (const defName of config.defNames) {
      try {
        const resp = await client.get('/api/now/table/' + defTable, {
          params: { sysparm_query: 'internal_name=' + defName, sysparm_fields: 'sys_id', sysparm_limit: 1 }
        });
        trigDefId = resp.data.result?.[0]?.sys_id || null;
        if (trigDefId) break;
      } catch (_) {}
    }
  }
  if (!trigDefId) {
    for (const defTable of defTables) {
      if (trigDefId) break;
      try {
        const resp = await client.get('/api/now/table/' + defTable, {
          params: {
            sysparm_query: 'internal_nameLIKE' + config.type + '^ORnameLIKE' + config.name,
            sysparm_fields: 'sys_id,internal_name', sysparm_limit: 10
          }
        });
        for (const r of (resp.data.result || [])) {
          if ((r.internal_name || '').indexOf(config.type) > -1) { trigDefId = r.sys_id; break; }
        }
      } catch (_) {}
    }
  }
  if (!trigDefId) return { success: false, error: 'Trigger definition not found for: ' + triggerType, steps };
  steps.def_lookup = { id: trigDefId };

  const params = await lookupDefinitionParams(client, trigDefId);
  steps.params_found = params.length;

  const gqlInputs = params.map((p: any) => buildGraphQLInput(p, undefined, true));

  if (gqlInputs.length === 0 && config.triggerType === 'Record') {
    gqlInputs.push(
      buildGraphQLInput({ name: 'table', label: 'Table', internal_type: 'table_name', mandatory: 'true', order: '1' }, undefined, true),
      buildGraphQLInput({ name: 'condition', label: 'Condition', internal_type: 'conditions', mandatory: 'false', order: '100', use_dependent: 'true', dependent_on: 'table' }, undefined, true)
    );
  }

  const triggerResponseFields = 'triggerInstances { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }';
  try {
    const insertResult = await executeFlowPatchMutation(client, {
      flowId: flowId,
      triggerInstances: {
        insert: [{
          flowSysId: flowId,
          name: config.name,
          triggerType: config.triggerType,
          triggerDefinitionId: trigDefId,
          type: config.type,
          hasDynamicOutputs: false,
          metadata: '{"predicates":[]}',
          inputs: gqlInputs,
          outputs: []
        }]
      }
    }, triggerResponseFields);

    const triggerId = insertResult?.triggerInstances?.inserts?.[0]?.sysId;
    steps.insert = { success: !!triggerId, triggerId };
    if (!triggerId) return { success: false, steps, error: 'GraphQL trigger INSERT returned no trigger ID' };

    if (table) {
      const updateInputs: any[] = [
        {
          name: 'table',
          displayField: 'number',
          displayValue: { schemaless: false, schemalessValue: '', value: table.charAt(0).toUpperCase() + table.slice(1) },
          value: { schemaless: false, schemalessValue: '', value: table }
        },
        {
          name: 'condition',
          displayValue: { schemaless: false, schemalessValue: '', value: condition || '^EQ' }
        }
      ];
      try {
        await executeFlowPatchMutation(client, {
          flowId: flowId,
          triggerInstances: { update: [{ id: triggerId, inputs: updateInputs }] }
        }, triggerResponseFields);
        steps.update = { success: true, table, condition: condition || '^EQ' };
      } catch (e: any) {
        steps.update = { success: false, error: e.message };
      }
    }

    return { success: true, triggerId, steps };
  } catch (e: any) {
    steps.insert = { success: false, error: e.message };
    return { success: false, steps, error: 'GraphQL trigger INSERT failed: ' + e.message };
  }
}

async function addActionViaGraphQL(
  client: any,
  flowId: string,
  actionType: string,
  actionName: string,
  inputs?: Record<string, string>,
  order?: number
): Promise<{ success: boolean; actionId?: string; steps?: any; error?: string }> {
  const steps: any = {};

  const actionTypeNames: Record<string, string[]> = {
    'log': ['sn_fd.action.log', 'global.sn_fd.action.log', 'global.log'],
    'create_record': ['sn_fd.action.create_record', 'global.sn_fd.action.create_record'],
    'update_record': ['sn_fd.action.update_record', 'global.sn_fd.action.update_record'],
    'notification': ['sn_fd.action.send_notification', 'global.sn_fd.action.send_notification'],
    'script': ['sn_fd.action.script', 'global.sn_fd.action.script', 'global.script_action'],
    'field_update': ['sn_fd.action.field_update', 'global.sn_fd.action.field_update'],
    'wait': ['sn_fd.action.wait', 'global.sn_fd.action.wait'],
    'approval': ['sn_fd.action.create_approval', 'global.sn_fd.action.create_approval'],
  };

  let actionDefId: string | null = null;
  const candidates = actionTypeNames[actionType] || [];
  for (const name of candidates) {
    try {
      const resp = await client.get('/api/now/table/sys_hub_action_type_definition', {
        params: { sysparm_query: 'internal_name=' + name, sysparm_fields: 'sys_id', sysparm_limit: 1 }
      });
      actionDefId = resp.data.result?.[0]?.sys_id || null;
      if (actionDefId) break;
    } catch (_) {}
  }
  if (!actionDefId) {
    try {
      const resp = await client.get('/api/now/table/sys_hub_action_type_definition', {
        params: {
          sysparm_query: 'internal_nameLIKE' + actionType + '^ORnameLIKE' + actionType,
          sysparm_fields: 'sys_id,internal_name', sysparm_limit: 5
        }
      });
      actionDefId = resp.data.result?.[0]?.sys_id || null;
    } catch (_) {}
  }
  if (!actionDefId) return { success: false, error: 'Action definition not found for: ' + actionType, steps };
  steps.def_lookup = { id: actionDefId };

  const params = await lookupDefinitionParams(client, actionDefId);
  steps.params_found = params.length;
  steps.params_detail = params.map((p: any) => ({ sys_id: p.sys_id, name: p.name || p.element, type: str(p.internal_type) || str(p.type) }));

  const gqlInputs = params.map((p: any) => {
    const pName = p.name || p.element || '';
    const providedValue = inputs?.[pName];
    return buildGraphQLInput(p, providedValue);
  });

  const uuid = generateUUID();
  const actionResponseFields = 'actions { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }';
  try {
    const result = await executeFlowPatchMutation(client, {
      flowId: flowId,
      actions: {
        insert: [{
          actionTypeSysId: actionDefId,
          metadata: '{"predicates":[]}',
          flowSysId: flowId,
          generationSource: '',
          order: String(order || 1),
          parent: '',
          uiUniqueIdentifier: uuid,
          type: 'action',
          parentUiId: '',
          inputs: gqlInputs
        }]
      }
    }, actionResponseFields);

    const actionId = result?.actions?.inserts?.[0]?.sysId;
    steps.insert = { success: !!actionId, actionId, uuid };

    if (actionId && inputs && Object.keys(inputs).length > 0) {
      const updateInputs = Object.entries(inputs).map(([name, value]) => ({
        name,
        value: { schemaless: false, schemalessValue: '', value: String(value) }
      }));
      try {
        await executeFlowPatchMutation(client, {
          flowId: flowId,
          actions: { update: [{ uiUniqueIdentifier: uuid, type: 'action', inputs: updateInputs }] }
        }, actionResponseFields);
        steps.value_update = { success: true };
      } catch (e: any) {
        steps.value_update = { success: false, error: e.message };
      }
    }

    return { success: true, actionId: actionId || undefined, steps };
  } catch (e: any) {
    steps.insert = { success: false, error: e.message };
    return { success: false, steps, error: 'GraphQL action INSERT failed: ' + e.message };
  }
}

async function createFlowViaProcessFlowAPI(
  client: any,
  params: {
    name: string;
    description: string;
    isSubflow: boolean;
    runAs: string;
    shouldActivate: boolean;
  }
): Promise<{
  success: boolean;
  flowSysId?: string;
  versionCreated?: boolean;
  flowData?: any;
  error?: string;
}> {
  try {
    var flowResp = await client.post(
      '/api/now/processflow/flow',
      {
        access: 'public',
        description: params.description || '',
        flowPriority: 'MEDIUM',
        name: params.name,
        protection: '',
        runAs: params.runAs || 'user',
        runWithRoles: { value: '', displayValue: '' },
        scope: 'global',
        scopeDisplayName: '',
        scopeName: '',
        security: { can_read: true, can_write: true },
        status: 'draft',
        type: params.isSubflow ? 'subflow' : 'flow',
        userHasRolesAssignedToFlow: true,
        active: false,
        deleted: false
      },
      {
        params: {
          param_only_properties: 'true',
          sysparm_transaction_scope: 'global'
        }
      }
    );

    var flowResult = flowResp.data?.result?.data;
    if (!flowResult?.id) {
      var errDetail = flowResp.data?.result?.errorMessage || 'no flow id returned';
      return { success: false, error: 'ProcessFlow API: ' + errDetail };
    }

    var flowSysId = flowResult.id;

    var versionCreated = false;
    try {
      await client.post(
        '/api/now/processflow/versioning/create_version',
        { item_sys_id: flowSysId, type: 'Autosave', annotation: '', favorite: false },
        { params: { sysparm_transaction_scope: 'global' } }
      );
      versionCreated = true;
    } catch (_) {
    }

    return { success: true, flowSysId, versionCreated, flowData: flowResult };
  } catch (e: any) {
    var msg = e.message || '';
    try { msg += ' — ' + JSON.stringify(e.response?.data || '').substring(0, 200); } catch (_) {}
    return { success: false, error: 'ProcessFlow API: ' + msg };
  }
}

// ── resolve helpers ───────────────────────────────────────────────────

async function resolveFlowId(client: any, flowId: string): Promise<string> {
  if (isSysId(flowId)) return flowId;

  var lookup = await client.get('/api/now/table/sys_hub_flow', {
    params: {
      sysparm_query: 'name=' + flowId,
      sysparm_fields: 'sys_id',
      sysparm_limit: 1
    }
  });

  if (!lookup.data.result || lookup.data.result.length === 0) {
    throw new SnowFlowError(ErrorType.NOT_FOUND, 'Flow not found: ' + flowId);
  }
  return lookup.data.result[0].sys_id;
}

// ── tool definition ────────────────────────────────────────────────────

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_manage_flow',
  description: 'Complete Flow Designer lifecycle: create flows/subflows, list, get details, update, activate, deactivate, delete and publish',
  category: 'automation',
  subcategory: 'flow-designer',
  use_cases: ['flow-designer', 'automation', 'flow-management', 'subflow'],
  complexity: 'advanced',
  frequency: 'high',
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'create_subflow', 'list', 'get', 'update', 'activate', 'deactivate', 'delete', 'publish', 'add_trigger', 'add_action'],
        description: 'Action to perform'
      },

      flow_id: {
        type: 'string',
        description: 'Flow sys_id or name (required for get, update, activate, deactivate, delete, publish)'
      },

      name: {
        type: 'string',
        description: 'Flow name (required for create / create_subflow)'
      },
      description: {
        type: 'string',
        description: 'Flow description'
      },
      trigger_type: {
        type: 'string',
        enum: ['record_created', 'record_updated', 'scheduled', 'manual'],
        description: 'Trigger type (create only, default: manual)',
        default: 'manual'
      },
      table: {
        type: 'string',
        description: 'Table for record-based triggers (e.g. "incident") or list filter'
      },
      trigger_condition: {
        type: 'string',
        description: 'Encoded query condition for the trigger'
      },
      category: {
        type: 'string',
        description: 'Flow category',
        default: 'custom'
      },
      run_as: {
        type: 'string',
        enum: ['user', 'system'],
        description: 'Run-as context (default: user)',
        default: 'user'
      },
      activities: {
        type: 'array',
        description: 'Flow action steps',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Step name' },
            type: {
              type: 'string',
              enum: ['notification', 'field_update', 'create_record', 'script', 'log', 'wait', 'approval'],
              description: 'Action type'
            },
            inputs: { type: 'object', description: 'Step-specific input values' }
          }
        }
      },
      inputs: {
        type: 'array',
        description: 'Flow input variables',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            label: { type: 'string' },
            type: { type: 'string', enum: ['string', 'integer', 'boolean', 'reference', 'object', 'array'] },
            mandatory: { type: 'boolean' },
            default_value: { type: 'string' }
          }
        }
      },
      outputs: {
        type: 'array',
        description: 'Flow output variables',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            label: { type: 'string' },
            type: { type: 'string', enum: ['string', 'integer', 'boolean', 'reference', 'object', 'array'] }
          }
        }
      },
      activate: {
        type: 'boolean',
        description: 'Activate flow after creation (default: true)',
        default: true
      },
      type: {
        type: 'string',
        enum: ['flow', 'subflow', 'all'],
        description: 'Filter by type (list only, default: all)',
        default: 'all'
      },
      active_only: {
        type: 'boolean',
        description: 'Only list active flows (default: true)',
        default: true
      },
      limit: {
        type: 'number',
        description: 'Max results for list',
        default: 50
      },
      action_type: {
        type: 'string',
        enum: ['log', 'create_record', 'update_record', 'notification', 'script', 'field_update', 'wait', 'approval'],
        description: 'Action type to add (for add_action)',
        default: 'log'
      },
      action_name: {
        type: 'string',
        description: 'Display name for the action (for add_action)'
      },
      action_inputs: {
        type: 'object',
        description: 'Key-value pairs for action inputs (e.g. {log_message: "test", log_level: "info"})'
      },
      update_fields: {
        type: 'object',
        description: 'Fields to update (for update action)',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          run_as: { type: 'string' }
        }
      }
    },
    required: ['action']
  }
};

// ── execute ────────────────────────────────────────────────────────────

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  var action = args.action;

  try {
    var client = await getAuthenticatedClient(context);

    switch (action) {

      // ────────────────────────────────────────────────────────────────
      // CREATE
      // ────────────────────────────────────────────────────────────────
      case 'create':
      case 'create_subflow': {
        var flowName = args.name;
        if (!flowName) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'name is required for ' + action);
        }

        var isSubflow = action === 'create_subflow';
        var flowDescription = args.description || flowName;
        var triggerType = isSubflow ? 'manual' : (args.trigger_type || 'manual');
        var flowTable = args.table || '';
        var triggerCondition = args.trigger_condition || '';
        var flowCategory = args.category || 'custom';
        var flowRunAs = isSubflow ? 'user_who_calls' : (args.run_as || 'user');
        var activitiesArg = args.activities || [];
        var inputsArg = args.inputs || [];
        var outputsArg = args.outputs || [];
        var shouldActivate = args.activate !== false;

        // Build flow_definition JSON (shared by both methods)
        var flowDefinition: any = {
          name: flowName,
          description: flowDescription,
          trigger: {
            type: triggerType,
            table: flowTable,
            condition: triggerCondition
          },
          activities: activitiesArg.map(function (act: any, idx: number) {
            return {
              name: act.name,
              label: act.name,
              type: act.type || 'script',
              inputs: act.inputs || {},
              order: (idx + 1) * 100,
              active: true
            };
          }),
          inputs: inputsArg.map(function (inp: any) {
            return {
              name: inp.name,
              label: inp.label || inp.name,
              type: inp.type || 'string',
              mandatory: inp.mandatory || false,
              default_value: inp.default_value || ''
            };
          }),
          outputs: outputsArg.map(function (out: any) {
            return {
              name: out.name,
              label: out.label || out.name,
              type: out.type || 'string'
            };
          }),
          version: '1.0'
        };

        if (isSubflow) {
          delete flowDefinition.trigger;
        }

        // ── Pipeline: ProcessFlow API (primary) → Table API (fallback) ──
        var flowSysId: string | null = null;
        var usedMethod = 'table_api';
        var versionCreated = false;
        var factoryWarnings: string[] = [];
        var triggerCreated = false;
        var actionsCreated = 0;
        var varsCreated = 0;

        // Diagnostics
        var diagnostics: any = {
          processflow_api: null,
          table_api_used: false,
          version_created: false,
          version_method: null,
          post_verify: null
        };

        // ── ProcessFlow API (primary — same REST endpoint as Flow Designer UI) ──
        // Uses /api/now/processflow/flow to create engine-registered flows,
        // then /api/now/processflow/versioning/create_version for versioning.
        try {
          var pfResult = await createFlowViaProcessFlowAPI(client, {
            name: flowName,
            description: flowDescription,
            isSubflow: isSubflow,
            runAs: flowRunAs,
            shouldActivate: shouldActivate
          });
          diagnostics.processflow_api = {
            success: pfResult.success,
            versionCreated: pfResult.versionCreated,
            error: pfResult.error
          };
          if (pfResult.success && pfResult.flowSysId) {
            flowSysId = pfResult.flowSysId;
            usedMethod = 'processflow_api';
            versionCreated = !!pfResult.versionCreated;
            diagnostics.version_created = versionCreated;
            diagnostics.version_method = 'processflow_api';
          }
        } catch (pfErr: any) {
          diagnostics.processflow_api = { error: pfErr.message || 'unknown' };
          factoryWarnings.push('ProcessFlow API failed: ' + (pfErr.message || pfErr));
        }

        // ── Triggers, actions, variables for ProcessFlow-created flows ──
        // Uses GraphQL mutations (same as Flow Designer UI) for proper engine registration
        if (flowSysId && usedMethod === 'processflow_api') {
          if (!isSubflow && triggerType !== 'manual') {
            try {
              var pfTrigResult = await addTriggerViaGraphQL(client, flowSysId, triggerType, flowTable, triggerCondition);
              triggerCreated = pfTrigResult.success;
              diagnostics.trigger_graphql = pfTrigResult;
            } catch (_) { /* best-effort */ }
          }
          for (var pfai = 0; pfai < activitiesArg.length; pfai++) {
            try {
              var pfAct = activitiesArg[pfai];
              var pfActResult = await addActionViaGraphQL(client, flowSysId, pfAct.type || 'log', pfAct.name || ('Action ' + (pfai + 1)), pfAct.inputs, pfai + 1);
              if (pfActResult.success) actionsCreated++;
              diagnostics['action_' + pfai] = pfActResult;
            } catch (_) { /* best-effort */ }
          }
          if (isSubflow) {
            for (var pfvi = 0; pfvi < inputsArg.length; pfvi++) {
              try {
                var pfInp = inputsArg[pfvi];
                await client.post('/api/now/table/sys_hub_flow_variable', {
                  flow: flowSysId, name: pfInp.name, label: pfInp.label || pfInp.name,
                  type: pfInp.type || 'string', mandatory: pfInp.mandatory || false,
                  default_value: pfInp.default_value || '', variable_type: 'input'
                });
                varsCreated++;
              } catch (_) {}
            }
            for (var pfvo = 0; pfvo < outputsArg.length; pfvo++) {
              try {
                var pfOut = outputsArg[pfvo];
                await client.post('/api/now/table/sys_hub_flow_variable', {
                  flow: flowSysId, name: pfOut.name, label: pfOut.label || pfOut.name,
                  type: pfOut.type || 'string', variable_type: 'output'
                });
                varsCreated++;
              } catch (_) {}
            }
          }
        }

        // ── Table API fallback (last resort) ─────────────────────────
        if (!flowSysId) {
          diagnostics.table_api_used = true;
          var flowData: any = {
            name: flowName,
            description: flowDescription,
            active: shouldActivate,
            internal_name: sanitizeInternalName(flowName),
            category: flowCategory,
            run_as: flowRunAs,
            status: shouldActivate ? 'published' : 'draft',
            validated: true,
            type: isSubflow ? 'subflow' : 'flow'
            // Do NOT set flow_definition or latest_snapshot on flow record
            // Reference flow analysis: flow_definition=null, latest_snapshot=version sys_id
          };

          var flowResponse = await client.post('/api/now/table/sys_hub_flow', flowData);
          var createdFlow = flowResponse.data.result;
          flowSysId = createdFlow.sys_id;

          // Create sys_hub_flow_version via Table API (critical for Flow Designer UI)
          // Strategy: INSERT as draft → UPDATE to published/compiled
          // The UPDATE triggers Business Rules that compile the flow and set latest_version
          try {
            // Step 1: INSERT version as DRAFT (minimal fields)
            var versionInsertData: any = {
              flow: flowSysId,
              name: '1.0',
              version: '1.0',
              state: 'draft',
              active: false,
              compile_state: 'draft',
              is_current: false,
              internal_name: sanitizeInternalName(flowName) + '_v1_0'
            };
            var versionResp = await client.post('/api/now/table/sys_hub_flow_version', versionInsertData);
            var versionSysId = versionResp.data.result?.sys_id;

            if (versionSysId) {
              // Step 2: UPDATE version → triggers compilation Business Rules
              var versionUpdateData: any = {
                state: shouldActivate ? 'published' : 'draft',
                active: true,
                compile_state: 'compiled',
                is_current: true,
                flow_definition: JSON.stringify(flowDefinition)
              };
              if (shouldActivate) versionUpdateData.published_flow = flowSysId;
              try {
                await client.patch('/api/now/table/sys_hub_flow_version/' + versionSysId, versionUpdateData);
              } catch (updateErr: any) {
                diagnostics.version_update_error = updateErr.message || 'unknown';
              }

              versionCreated = true;
              diagnostics.version_created = true;
              diagnostics.version_method = 'table_api (draft→update)';

              // Set latest_snapshot on flow record to version sys_id (reference field)
              try {
                await client.patch('/api/now/table/sys_hub_flow/' + flowSysId, {
                  latest_snapshot: versionSysId
                });
                diagnostics.latest_snapshot_set = versionSysId;
              } catch (snapshotErr: any) {
                diagnostics.latest_snapshot_error = snapshotErr.message || 'unknown';
              }
            }
          } catch (verError: any) {
            factoryWarnings.push('sys_hub_flow_version creation failed: ' + (verError.message || verError));
          }

          // Create trigger via GraphQL (same method as Flow Designer UI)
          if (!isSubflow && triggerType !== 'manual') {
            try {
              var taTrigResult = await addTriggerViaGraphQL(client, flowSysId, triggerType, flowTable, triggerCondition);
              triggerCreated = taTrigResult.success;
              diagnostics.trigger_graphql = taTrigResult;
            } catch (triggerError) {
              // Best-effort
            }
          }

          // Create actions via GraphQL (same method as Flow Designer UI)
          for (var ai = 0; ai < activitiesArg.length; ai++) {
            var activity = activitiesArg[ai];
            try {
              var taActResult = await addActionViaGraphQL(client, flowSysId, activity.type || 'log', activity.name || ('Action ' + (ai + 1)), activity.inputs, ai + 1);
              if (taActResult.success) actionsCreated++;
              diagnostics['action_' + ai] = taActResult;
            } catch (actError) {
              // Best-effort
            }
          }

          // Create flow variables (subflows)
          if (isSubflow) {
            for (var vi = 0; vi < inputsArg.length; vi++) {
              var inp = inputsArg[vi];
              try {
                await client.post('/api/now/table/sys_hub_flow_variable', {
                  flow: flowSysId,
                  name: inp.name,
                  label: inp.label || inp.name,
                  type: inp.type || 'string',
                  mandatory: inp.mandatory || false,
                  default_value: inp.default_value || '',
                  variable_type: 'input'
                });
                varsCreated++;
              } catch (varError) { /* best-effort */ }
            }
            for (var vo = 0; vo < outputsArg.length; vo++) {
              var out = outputsArg[vo];
              try {
                await client.post('/api/now/table/sys_hub_flow_variable', {
                  flow: flowSysId,
                  name: out.name,
                  label: out.label || out.name,
                  type: out.type || 'string',
                  variable_type: 'output'
                });
                varsCreated++;
              } catch (varError) { /* best-effort */ }
            }
          }

        }

        // Engine REST registration skipped — all sn_fd endpoints return 400 on this instance type

        // ── Post-creation verification ─────────────────────────────
        if (flowSysId) {
          try {
            var verifyResp = await client.get('/api/now/table/sys_hub_flow/' + flowSysId, {
              params: {
                sysparm_fields: 'sys_id,name,latest_version,latest_published_version,internal_name',
                sysparm_display_value: 'false'
              }
            });
            var verifyFlow = verifyResp.data.result;
            var latestVersionVal = verifyFlow?.latest_version || null;
            var hasLatestVersion = !!latestVersionVal;

            // Check version record details
            var verCheckResp = await client.get('/api/now/table/sys_hub_flow_version', {
              params: {
                sysparm_query: 'flow=' + flowSysId,
                sysparm_fields: 'sys_id,name,state,compile_state,is_current,active,internal_name',
                sysparm_limit: 1
              }
            });
            var verRecords = verCheckResp.data.result || [];
            var hasVersionRecord = verRecords.length > 0;

            diagnostics.post_verify = {
              flow_exists: true,
              flow_internal_name: verifyFlow?.internal_name || 'not set',
              latest_version_value: latestVersionVal || 'null',
              latest_published_version: verifyFlow?.latest_published_version || 'null',
              has_latest_version_ref: hasLatestVersion,
              version_record_exists: hasVersionRecord,
              version_details: hasVersionRecord ? {
                sys_id: verRecords[0].sys_id,
                state: verRecords[0].state,
                compile_state: verRecords[0].compile_state,
                is_current: verRecords[0].is_current,
                active: verRecords[0].active,
                internal_name: verRecords[0].internal_name || 'not set'
              } : null
            };

            // If latest_version still not set and version exists, try one more time
            if (!hasLatestVersion && hasVersionRecord) {
              try {
                await client.patch('/api/now/table/sys_hub_flow/' + flowSysId, {
                  latest_version: verRecords[0].sys_id,
                  latest_published_version: shouldActivate ? verRecords[0].sys_id : undefined
                });
                // Readback
                var finalCheck = await client.get('/api/now/table/sys_hub_flow/' + flowSysId, {
                  params: { sysparm_fields: 'latest_version', sysparm_display_value: 'false' }
                });
                diagnostics.post_verify.latest_version_final = finalCheck.data.result?.latest_version || 'still null';
              } catch (finalLinkErr: any) {
                diagnostics.post_verify.latest_version_final_error = finalLinkErr.message || 'unknown';
              }
            }
          } catch (verifyErr: any) {
            diagnostics.post_verify = { error: verifyErr.message || 'verification failed' };
          }
        }

        // ── Build summary ───────────────────────────────────────────
        var methodLabel = usedMethod === 'processflow_api'
          ? 'ProcessFlow API (Flow Designer engine)'
          : 'Table API' + (factoryWarnings.length > 0 ? ' (fallback)' : '');

        var createSummary = summary()
          .success('Created ' + (isSubflow ? 'subflow' : 'flow') + ': ' + flowName)
          .field('sys_id', flowSysId!)
          .field('Type', isSubflow ? 'Subflow' : 'Flow')
          .field('Category', flowCategory)
          .field('Status', shouldActivate ? 'Published (active)' : 'Draft')
          .field('Method', methodLabel);

        if (diagnostics.factory_namespace) {
          createSummary.field('Namespace', diagnostics.factory_namespace);
        }

        if (versionCreated) {
          createSummary.field('Version', 'v1.0 created' + (diagnostics.version_method ? ' (' + diagnostics.version_method + ')' : ''));
        } else {
          createSummary.warning('Version record NOT created — flow may show "cannot be found" in Flow Designer');
        }

        if (!isSubflow && triggerType !== 'manual') {
          createSummary.field('Trigger', triggerType + (triggerCreated ? ' (created)' : ' (best-effort)'));
          if (flowTable) createSummary.field('Table', flowTable);
        }
        if (activitiesArg.length > 0) {
          createSummary.field('Actions', actionsCreated + '/' + activitiesArg.length + ' created');
        }
        if (varsCreated > 0) {
          createSummary.field('Variables', varsCreated + ' created');
        }
        for (var wi = 0; wi < factoryWarnings.length; wi++) {
          createSummary.warning(factoryWarnings[wi]);
        }

        // Diagnostics section
        createSummary.blank().line('Diagnostics:');
        if (diagnostics.processflow_api) {
          var pf = diagnostics.processflow_api;
          createSummary.indented('ProcessFlow API: ' + (pf.success ? 'success' : 'failed') + (pf.versionCreated ? ' (version created)' : ''));
          if (pf.error) createSummary.indented('  Error: ' + pf.error);
        }
        createSummary.indented('Table API fallback used: ' + diagnostics.table_api_used);
        createSummary.indented('Version created: ' + diagnostics.version_created + (diagnostics.version_method ? ' (' + diagnostics.version_method + ')' : ''));
        if (diagnostics.post_verify) {
          if (diagnostics.post_verify.error) {
            createSummary.indented('Post-verify: error — ' + diagnostics.post_verify.error);
          } else {
            createSummary.indented('Post-verify: flow=' + diagnostics.post_verify.flow_exists +
              ', version_record=' + diagnostics.post_verify.version_record_exists +
              ', latest_version_ref=' + diagnostics.post_verify.has_latest_version_ref);
          }
        }

        return createSuccessResult({
          created: true,
          method: usedMethod,
          version_created: versionCreated,
          flow: {
            sys_id: flowSysId,
            name: flowName,
            type: isSubflow ? 'subflow' : 'flow',
            category: flowCategory,
            active: shouldActivate,
            status: shouldActivate ? 'published' : 'draft'
          },
          trigger: !isSubflow && triggerType !== 'manual' ? {
            type: triggerType,
            table: flowTable,
            condition: triggerCondition,
            created: triggerCreated
          } : null,
          activities_created: actionsCreated,
          activities_requested: activitiesArg.length,
          variables_created: varsCreated,
          warnings: factoryWarnings.length > 0 ? factoryWarnings : undefined,
          diagnostics: diagnostics
        }, {}, createSummary.build());
      }

      // ────────────────────────────────────────────────────────────────
      // LIST
      // ────────────────────────────────────────────────────────────────
      case 'list': {
        var listQuery = '';
        var filterType = args.type || 'all';
        var activeOnly = args.active_only !== false;
        var listLimit = args.limit || 50;
        var filterTable = args.table || '';

        if (filterType !== 'all') {
          listQuery = 'type=' + filterType;
        }
        if (activeOnly) {
          listQuery += (listQuery ? '^' : '') + 'active=true';
        }
        if (filterTable) {
          listQuery += (listQuery ? '^' : '') + 'flow_definitionLIKE' + filterTable;
        }

        var listResp = await client.get('/api/now/table/sys_hub_flow', {
          params: {
            sysparm_query: listQuery || undefined,
            sysparm_fields: 'sys_id,name,description,type,category,active,status,run_as,sys_created_on,sys_updated_on',
            sysparm_limit: listLimit
          }
        });

        var flows = (listResp.data.result || []).map(function (f: any) {
          return {
            sys_id: f.sys_id,
            name: f.name,
            description: f.description,
            type: f.type,
            category: f.category,
            active: f.active === 'true',
            status: f.status,
            run_as: f.run_as,
            created: f.sys_created_on,
            updated: f.sys_updated_on
          };
        });

        var listSummary = summary()
          .success('Found ' + flows.length + ' flow' + (flows.length === 1 ? '' : 's'));

        for (var li = 0; li < Math.min(flows.length, 15); li++) {
          var lf = flows[li];
          listSummary.bullet(
            lf.name +
            ' [' + (lf.type || 'flow') + ']' +
            (lf.active ? '' : ' (inactive)')
          );
        }
        if (flows.length > 15) {
          listSummary.indented('... and ' + (flows.length - 15) + ' more');
        }

        return createSuccessResult({
          action: 'list',
          count: flows.length,
          flows: flows
        }, {}, listSummary.build());
      }

      // ────────────────────────────────────────────────────────────────
      // GET
      // ────────────────────────────────────────────────────────────────
      case 'get': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for get action');
        }

        var getSysId = await resolveFlowId(client, args.flow_id);

        // Fetch flow record
        var getResp = await client.get('/api/now/table/sys_hub_flow/' + getSysId);
        var flowRecord = getResp.data.result;

        // Fetch trigger instances
        var triggerInstances: any[] = [];
        try {
          var trigResp = await client.get('/api/now/table/sys_hub_trigger_instance', {
            params: {
              sysparm_query: 'flow=' + getSysId,
              sysparm_fields: 'sys_id,name,action_type,table,condition,active,order',
              sysparm_limit: 10
            }
          });
          triggerInstances = trigResp.data.result || [];
        } catch (e) { /* best-effort */ }

        // Fetch action instances
        var actionInstances: any[] = [];
        try {
          var actResp = await client.get('/api/now/table/sys_hub_action_instance', {
            params: {
              sysparm_query: 'flow=' + getSysId + '^ORDERBYorder',
              sysparm_fields: 'sys_id,name,action_type,order,active',
              sysparm_limit: 50
            }
          });
          actionInstances = actResp.data.result || [];
        } catch (e) { /* best-effort */ }

        // Fetch flow variables
        var flowVars: any[] = [];
        try {
          var varResp = await client.get('/api/now/table/sys_hub_flow_variable', {
            params: {
              sysparm_query: 'flow=' + getSysId,
              sysparm_fields: 'sys_id,name,label,type,mandatory,variable_type,default_value',
              sysparm_limit: 50
            }
          });
          flowVars = varResp.data.result || [];
        } catch (e) { /* best-effort */ }

        // Fetch recent executions
        var executions: any[] = [];
        try {
          var execResp = await client.get('/api/now/table/sys_hub_flow_run', {
            params: {
              sysparm_query: 'flow=' + getSysId + '^ORDERBYDESCsys_created_on',
              sysparm_fields: 'sys_id,state,started,ended,duration,trigger_record_table,trigger_record_id',
              sysparm_limit: 10
            }
          });
          executions = execResp.data.result || [];
        } catch (e) { /* best-effort */ }

        var getSummary = summary()
          .success('Flow: ' + (flowRecord.name || args.flow_id))
          .field('sys_id', flowRecord.sys_id)
          .field('Type', flowRecord.type)
          .field('Category', flowRecord.category)
          .field('Status', flowRecord.active === 'true' ? 'Active' : 'Inactive')
          .field('Run as', flowRecord.run_as)
          .field('Description', flowRecord.description);

        if (triggerInstances.length > 0) {
          getSummary.blank().line('Triggers: ' + triggerInstances.length);
          for (var ti = 0; ti < triggerInstances.length; ti++) {
            getSummary.bullet(triggerInstances[ti].name || 'trigger-' + ti);
          }
        }
        if (actionInstances.length > 0) {
          getSummary.blank().line('Actions: ' + actionInstances.length);
          for (var aci = 0; aci < Math.min(actionInstances.length, 10); aci++) {
            getSummary.bullet(actionInstances[aci].name || 'action-' + aci);
          }
        }
        if (flowVars.length > 0) {
          getSummary.blank().line('Variables: ' + flowVars.length);
        }
        if (executions.length > 0) {
          getSummary.blank().line('Recent executions: ' + executions.length);
          for (var ei = 0; ei < Math.min(executions.length, 5); ei++) {
            var ex = executions[ei];
            getSummary.bullet((ex.state || 'unknown') + ' - ' + (ex.started || 'pending'));
          }
        }

        return createSuccessResult({
          action: 'get',
          flow: {
            sys_id: flowRecord.sys_id,
            name: flowRecord.name,
            description: flowRecord.description,
            type: flowRecord.type,
            category: flowRecord.category,
            active: flowRecord.active === 'true',
            status: flowRecord.status,
            run_as: flowRecord.run_as,
            created: flowRecord.sys_created_on,
            updated: flowRecord.sys_updated_on
          },
          triggers: triggerInstances.map(function (t: any) {
            return {
              sys_id: t.sys_id,
              name: t.name,
              action_type: typeof t.action_type === 'object' ? t.action_type.display_value : t.action_type,
              table: t.table,
              condition: t.condition,
              active: t.active === 'true'
            };
          }),
          actions: actionInstances.map(function (a: any) {
            return {
              sys_id: a.sys_id,
              name: a.name,
              action_type: typeof a.action_type === 'object' ? a.action_type.display_value : a.action_type,
              order: a.order,
              active: a.active === 'true'
            };
          }),
          variables: flowVars.map(function (v: any) {
            return {
              sys_id: v.sys_id,
              name: v.name,
              label: v.label,
              type: v.type,
              mandatory: v.mandatory === 'true',
              variable_type: v.variable_type,
              default_value: v.default_value
            };
          }),
          recent_executions: executions.map(function (e: any) {
            return {
              sys_id: e.sys_id,
              state: e.state,
              started: e.started,
              ended: e.ended,
              duration: e.duration,
              trigger_table: e.trigger_record_table,
              trigger_record: e.trigger_record_id
            };
          })
        }, {}, getSummary.build());
      }

      // ────────────────────────────────────────────────────────────────
      // UPDATE
      // ────────────────────────────────────────────────────────────────
      case 'update': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for update action');
        }
        var updateFields = args.update_fields;
        if (!updateFields || Object.keys(updateFields).length === 0) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'update_fields is required for update action');
        }

        var updateSysId = await resolveFlowId(client, args.flow_id);
        await client.patch('/api/now/table/sys_hub_flow/' + updateSysId, updateFields);

        var updateSummary = summary()
          .success('Updated flow: ' + args.flow_id)
          .field('sys_id', updateSysId);

        var fieldNames = Object.keys(updateFields);
        for (var fi = 0; fi < fieldNames.length; fi++) {
          updateSummary.field(fieldNames[fi], updateFields[fieldNames[fi]]);
        }

        return createSuccessResult({
          action: 'update',
          flow_id: updateSysId,
          updated_fields: fieldNames,
          message: 'Flow updated successfully'
        }, {}, updateSummary.build());
      }

      // ────────────────────────────────────────────────────────────────
      // ACTIVATE / PUBLISH
      // ────────────────────────────────────────────────────────────────
      case 'activate':
      case 'publish': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for ' + action + ' action');
        }

        var activateSysId = await resolveFlowId(client, args.flow_id);
        await client.patch('/api/now/table/sys_hub_flow/' + activateSysId, {
          active: true,
          status: 'published',
          validated: true
        });

        var activateSummary = summary()
          .success('Flow activated and published')
          .field('sys_id', activateSysId);

        return createSuccessResult({
          action: action,
          flow_id: activateSysId,
          active: true,
          status: 'published',
          message: 'Flow activated and published'
        }, {}, activateSummary.build());
      }

      // ────────────────────────────────────────────────────────────────
      // DEACTIVATE
      // ────────────────────────────────────────────────────────────────
      case 'deactivate': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for deactivate action');
        }

        var deactivateSysId = await resolveFlowId(client, args.flow_id);
        await client.patch('/api/now/table/sys_hub_flow/' + deactivateSysId, {
          active: false
        });

        var deactivateSummary = summary()
          .success('Flow deactivated')
          .field('sys_id', deactivateSysId);

        return createSuccessResult({
          action: 'deactivate',
          flow_id: deactivateSysId,
          active: false,
          message: 'Flow deactivated'
        }, {}, deactivateSummary.build());
      }

      // ────────────────────────────────────────────────────────────────
      // DELETE
      // ────────────────────────────────────────────────────────────────
      case 'delete': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for delete action');
        }

        var deleteSysId = await resolveFlowId(client, args.flow_id);
        await client.delete('/api/now/table/sys_hub_flow/' + deleteSysId);

        var deleteSummary = summary()
          .success('Flow deleted')
          .field('sys_id', deleteSysId);

        return createSuccessResult({
          action: 'delete',
          flow_id: deleteSysId,
          message: 'Flow deleted'
        }, {}, deleteSummary.build());
      }

      // ────────────────────────────────────────────────────────────────
      // ADD_TRIGGER
      // ────────────────────────────────────────────────────────────────
      case 'add_trigger': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for add_trigger');
        }
        var addTrigFlowId = await resolveFlowId(client, args.flow_id);
        var addTrigType = args.trigger_type || 'record_create_or_update';
        var addTrigTable = args.table || '';
        var addTrigCondition = args.trigger_condition || '';

        var addTrigResult = await addTriggerViaGraphQL(client, addTrigFlowId, addTrigType, addTrigTable, addTrigCondition);

        var addTrigSummary = summary();
        if (addTrigResult.success) {
          addTrigSummary
            .success('Trigger added via GraphQL')
            .field('Flow', addTrigFlowId)
            .field('Type', addTrigType)
            .field('Trigger ID', addTrigResult.triggerId || 'unknown');
          if (addTrigTable) addTrigSummary.field('Table', addTrigTable);
        } else {
          addTrigSummary.error('Failed to add trigger: ' + (addTrigResult.error || 'unknown'));
        }

        return addTrigResult.success
          ? createSuccessResult({ action: 'add_trigger', ...addTrigResult }, {}, addTrigSummary.build())
          : createErrorResult(addTrigResult.error || 'Failed to add trigger');
      }

      // ────────────────────────────────────────────────────────────────
      // ADD_ACTION
      // ────────────────────────────────────────────────────────────────
      case 'add_action': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for add_action');
        }
        var addActFlowId = await resolveFlowId(client, args.flow_id);
        var addActType = args.action_type || 'log';
        var addActName = args.action_name || args.name || addActType;
        var addActInputs = args.action_inputs || args.inputs || {};

        var addActResult = await addActionViaGraphQL(client, addActFlowId, addActType, addActName, addActInputs);

        var addActSummary = summary();
        if (addActResult.success) {
          addActSummary
            .success('Action added via GraphQL')
            .field('Flow', addActFlowId)
            .field('Type', addActType)
            .field('Name', addActName)
            .field('Action ID', addActResult.actionId || 'unknown');
        } else {
          addActSummary.error('Failed to add action: ' + (addActResult.error || 'unknown'));
        }

        return addActResult.success
          ? createSuccessResult({ action: 'add_action', ...addActResult }, {}, addActSummary.build())
          : createErrorResult(addActResult.error || 'Failed to add action');
      }

      default:
        throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'Unknown action: ' + action);
    }

  } catch (error: any) {
    if (error instanceof SnowFlowError) {
      return createErrorResult(error);
    }
    if (error.response?.status === 403) {
      return createErrorResult(
        'Permission denied (403): Your ServiceNow user lacks Flow Designer permissions. ' +
        'Required roles: "flow_designer" or "admin". Contact your ServiceNow administrator.'
      );
    }
    return createErrorResult(
      new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message, { originalError: error })
    );
  }
}

export const version = '6.0.0';
export const author = 'Snow-Flow Team';
