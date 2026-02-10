/**
 * snow_manage_flow - Complete Flow Designer lifecycle management
 *
 * Create, list, get, update, activate, deactivate, delete and publish
 * Flow Designer flows and subflows.
 *
 * For create/create_subflow: uses a bootstrapped Scripted REST API
 * ("Flow Factory") that runs GlideRecord server-side, ensuring
 * sys_hub_flow_version records are created and all Business Rules fire.
 * Falls back to Table API if the factory is unavailable.
 *
 * All other actions (list, get, update, activate, etc.) use the Table API.
 */

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

// ── Flow Factory (Scripted REST API bootstrap) ──────────────────────

var FLOW_FACTORY_API_NAME = 'Snow-Flow Flow Factory';
var FLOW_FACTORY_API_ID = 'flow_factory';
var FLOW_FACTORY_CACHE_TTL = 300000; // 5 minutes

var _flowFactoryCache: { apiSysId: string; namespace: string; timestamp: number } | null = null;
var _bootstrapPromise: Promise<{ namespace: string; apiSysId: string }> | null = null;

/**
 * ES5 GlideRecord script deployed as a Scripted REST API resource.
 * This runs server-side on ServiceNow and triggers all Business Rules,
 * unlike direct Table API inserts which skip sys_hub_flow_version creation.
 */
var FLOW_FACTORY_SCRIPT = [
  '(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {',
  '  var body;',
  '  try { body = JSON.parse(request.body.dataString); }',
  '  catch(e) { body = request.body.data; }',
  '  if (!body || typeof body !== "object") {',
  '    response.setStatus(400);',
  '    response.setBody({ success: false, error: "Invalid request body: " + typeof body });',
  '    return;',
  '  }',
  '  var result = { success: false, steps: {} };',
  '',
  '  try {',
  '    var flowName = body.name || "Unnamed Flow";',
  '    var isSubflow = body.type === "subflow";',
  '    var flowDesc = body.description || flowName;',
  '    var flowCategory = body.category || "custom";',
  '    var runAs = body.run_as || "user";',
  '    var shouldActivate = body.activate !== false;',
  '    var triggerType = body.trigger_type || "manual";',
  '    var triggerTable = body.trigger_table || "";',
  '    var triggerCondition = body.trigger_condition || "";',
  '    var activities = body.activities || [];',
  '    var inputs = body.inputs || [];',
  '    var outputs = body.outputs || [];',
  '',
  '    // Step 1: Create sys_hub_flow via GlideRecord (triggers all BRs)',
  '    var flow = new GlideRecord("sys_hub_flow");',
  '    flow.initialize();',
  '    flow.setValue("name", flowName);',
  '    flow.setValue("description", flowDesc);',
  '    flow.setValue("internal_name", flowName.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, ""));',
  '    flow.setValue("category", flowCategory);',
  '    flow.setValue("run_as", runAs);',
  '    flow.setValue("active", shouldActivate);',
  '    flow.setValue("status", shouldActivate ? "published" : "draft");',
  '    flow.setValue("validated", true);',
  '    flow.setValue("type", isSubflow ? "subflow" : "flow");',
  '',
  '    if (body.flow_definition) {',
  '      flow.setValue("flow_definition", typeof body.flow_definition === "string" ? body.flow_definition : JSON.stringify(body.flow_definition));',
  '      flow.setValue("latest_snapshot", typeof body.flow_definition === "string" ? body.flow_definition : JSON.stringify(body.flow_definition));',
  '    }',
  '',
  '    var flowSysId = flow.insert();',
  '    if (!flowSysId) {',
  '      result.error = "Failed to insert sys_hub_flow record";',
  '      response.setStatus(500);',
  '      response.setBody(result);',
  '      return;',
  '    }',
  '    result.steps.flow = { success: true, sys_id: flowSysId + "" };',
  '',
  '    // Step 2: Create sys_hub_flow_version (this is what Table API misses!)',
  '    try {',
  '      var ver = new GlideRecord("sys_hub_flow_version");',
  '      ver.initialize();',
  '      ver.setValue("flow", flowSysId);',
  '      ver.setValue("name", "1.0");',
  '      ver.setValue("version", "1.0");',
  '      ver.setValue("state", shouldActivate ? "published" : "draft");',
  '      ver.setValue("active", true);',
  '      ver.setValue("compile_state", "compiled");',
  '      ver.setValue("is_current", true);',
  '      if (shouldActivate) ver.setValue("published_flow", flowSysId);',
  '      if (body.flow_definition) {',
  '        ver.setValue("flow_definition", typeof body.flow_definition === "string" ? body.flow_definition : JSON.stringify(body.flow_definition));',
  '      }',
  '      var verSysId = ver.insert();',
  '      if (verSysId) {',
  '        result.steps.version = { success: true, sys_id: verSysId + "" };',
  '        // Update flow to point to latest version',
  '        var flowUpd = new GlideRecord("sys_hub_flow");',
  '        if (flowUpd.get(flowSysId)) {',
  '          flowUpd.setValue("latest_version", verSysId);',
  '          flowUpd.update();',
  '        }',
  '      } else {',
  '        result.steps.version = { success: false, error: "Insert returned empty sys_id" };',
  '      }',
  '    } catch (verErr) {',
  '      result.steps.version = { success: false, error: verErr.getMessage ? verErr.getMessage() : verErr + "" };',
  '    }',
  '',
  '    // Step 3: Create trigger instance (non-manual, non-subflow only)',
  '    if (!isSubflow && triggerType !== "manual") {',
  '      try {',
  '        var triggerMap = {',
  '          "record_created": "sn_fd.trigger.record_created",',
  '          "record_updated": "sn_fd.trigger.record_updated",',
  '          "scheduled": "sn_fd.trigger.scheduled"',
  '        };',
  '        var triggerIntName = triggerMap[triggerType] || "";',
  '        if (triggerIntName) {',
  '          var trigDef = new GlideRecord("sys_hub_action_type_definition");',
  '          trigDef.addQuery("internal_name", triggerIntName);',
  '          trigDef.query();',
  '          if (trigDef.next()) {',
  '            var trigInst = new GlideRecord("sys_hub_trigger_instance");',
  '            trigInst.initialize();',
  '            trigInst.setValue("flow", flowSysId);',
  '            trigInst.setValue("action_type", trigDef.getUniqueValue());',
  '            trigInst.setValue("name", triggerType);',
  '            trigInst.setValue("order", 0);',
  '            trigInst.setValue("active", true);',
  '            if (triggerTable) trigInst.setValue("table", triggerTable);',
  '            if (triggerCondition) trigInst.setValue("condition", triggerCondition);',
  '            var trigSysId = trigInst.insert();',
  '            result.steps.trigger = { success: !!trigSysId, sys_id: trigSysId + "" };',
  '          } else {',
  '            result.steps.trigger = { success: false, error: "Trigger type definition not found: " + triggerIntName };',
  '          }',
  '        }',
  '      } catch (trigErr) {',
  '        result.steps.trigger = { success: false, error: trigErr.getMessage ? trigErr.getMessage() : trigErr + "" };',
  '      }',
  '    }',
  '',
  '    // Step 4: Create action instances',
  '    var actionsCreated = 0;',
  '    for (var ai = 0; ai < activities.length; ai++) {',
  '      try {',
  '        var act = activities[ai];',
  '        var actTypeName = act.type || "script";',
  '        var actDef = new GlideRecord("sys_hub_action_type_definition");',
  '        actDef.addQuery("internal_name", "CONTAINS", actTypeName);',
  '        actDef.addOrCondition("name", "CONTAINS", actTypeName);',
  '        actDef.query();',
  '        var actInst = new GlideRecord("sys_hub_action_instance");',
  '        actInst.initialize();',
  '        actInst.setValue("flow", flowSysId);',
  '        actInst.setValue("name", act.name || ("Action " + (ai + 1)));',
  '        actInst.setValue("order", (ai + 1) * 100);',
  '        actInst.setValue("active", true);',
  '        if (actDef.next()) {',
  '          actInst.setValue("action_type", actDef.getUniqueValue());',
  '        }',
  '        if (actInst.insert()) actionsCreated++;',
  '      } catch (actErr) {',
  '        // Best-effort per action',
  '      }',
  '    }',
  '    result.steps.actions = { success: true, created: actionsCreated, requested: activities.length };',
  '',
  '    // Step 5: Create flow variables (subflows)',
  '    var varsCreated = 0;',
  '    if (isSubflow) {',
  '      for (var vi = 0; vi < inputs.length; vi++) {',
  '        try {',
  '          var inp = inputs[vi];',
  '          var fv = new GlideRecord("sys_hub_flow_variable");',
  '          fv.initialize();',
  '          fv.setValue("flow", flowSysId);',
  '          fv.setValue("name", inp.name);',
  '          fv.setValue("label", inp.label || inp.name);',
  '          fv.setValue("type", inp.type || "string");',
  '          fv.setValue("mandatory", inp.mandatory || false);',
  '          fv.setValue("default_value", inp.default_value || "");',
  '          fv.setValue("variable_type", "input");',
  '          if (fv.insert()) varsCreated++;',
  '        } catch (vErr) { /* best-effort */ }',
  '      }',
  '      for (var vo = 0; vo < outputs.length; vo++) {',
  '        try {',
  '          var out = outputs[vo];',
  '          var ov = new GlideRecord("sys_hub_flow_variable");',
  '          ov.initialize();',
  '          ov.setValue("flow", flowSysId);',
  '          ov.setValue("name", out.name);',
  '          ov.setValue("label", out.label || out.name);',
  '          ov.setValue("type", out.type || "string");',
  '          ov.setValue("variable_type", "output");',
  '          if (ov.insert()) varsCreated++;',
  '        } catch (vErr) { /* best-effort */ }',
  '      }',
  '    }',
  '    result.steps.variables = { success: true, created: varsCreated };',
  '',
  '    result.success = true;',
  '    result.flow_sys_id = flowSysId + "";',
  '    result.version_created = !!(result.steps.version && result.steps.version.success);',
  '    response.setStatus(201);',
  '',
  '  } catch (e) {',
  '    result.success = false;',
  '    result.error = e.getMessage ? e.getMessage() : e + "";',
  '    response.setStatus(500);',
  '  }',
  '',
  '  response.setBody(result);',
  '})(request, response);'
].join('\n');

/**
 * Probe the ServiceNow instance to discover the correct URL namespace for
 * the Flow Factory Scripted REST API. Sends GET requests to candidate
 * namespaces — a 405 (Method Not Allowed) or 401/403 confirms the namespace
 * exists, while 404 means wrong namespace.
 */
async function probeFlowFactoryNamespace(
  client: any,
  apiSysId: string,
  instanceUrl: string
): Promise<string | null> {
  // Build candidate list from multiple sources
  var candidates: string[] = [];

  // 1. Read back the record's namespace field
  try {
    var nsResp = await client.get('/api/now/table/sys_ws_definition/' + apiSysId, {
      params: { sysparm_fields: 'sys_id,api_id,namespace', sysparm_display_value: 'all' }
    });
    var record = nsResp.data.result || {};
    var ns = record.namespace;
    if (ns) {
      if (typeof ns === 'object') {
        var dv = ns.display_value || '';
        var val = ns.value || '';
        if (dv && /^(x_|sn_)/.test(dv)) candidates.push(dv);
        if (val && /^(x_|sn_)/.test(val)) candidates.push(val);
      } else if (typeof ns === 'string' && ns.length > 0 && ns !== 'Global' && ns !== 'global') {
        candidates.push(ns);
      }
    }
  } catch (_) {}

  // 2. Company code from sys_properties
  try {
    var compResp = await client.get('/api/now/table/sys_properties', {
      params: {
        sysparm_query: 'name=glide.appcreator.company.code',
        sysparm_fields: 'value',
        sysparm_limit: 1
      }
    });
    var companyCode = compResp.data.result?.[0]?.value;
    if (companyCode) candidates.push(companyCode);
  } catch (_) {}

  // 3. Instance subdomain (e.g. "dev351277" from "https://dev351277.service-now.com")
  try {
    var match = instanceUrl.match(/https?:\/\/([^.]+)\./);
    if (match && match[1]) candidates.push(match[1]);
  } catch (_) {}

  // 4. Fixed fallbacks
  candidates.push('now', 'global');

  // Deduplicate
  var seen: Record<string, boolean> = {};
  var unique: string[] = [];
  for (var i = 0; i < candidates.length; i++) {
    if (!seen[candidates[i]]) {
      seen[candidates[i]] = true;
      unique.push(candidates[i]);
    }
  }

  // 5. Probe each candidate — GET on a POST-only endpoint
  for (var j = 0; j < unique.length; j++) {
    try {
      await client.get('/api/' + unique[j] + '/' + FLOW_FACTORY_API_ID + '/create');
      return unique[j]; // 200 = endpoint exists (unlikely but valid)
    } catch (probeError: any) {
      var status = probeError.response?.status;
      if (status === 405 || status === 401 || status === 403) {
        return unique[j]; // Namespace correct — method or auth rejected
      }
      // 404 = wrong namespace, try next
    }
  }

  return null; // No namespace matched — factory unreachable
}

/**
 * Ensure the Flow Factory Scripted REST API exists on the ServiceNow instance.
 * Idempotent — checks cache first, then instance, deploys only if missing.
 * Uses namespace probing (HTTP GET) instead of record field parsing.
 */
async function ensureFlowFactoryAPI(
  client: any,
  instanceUrl: string
): Promise<{ namespace: string; apiSysId: string }> {
  // 1. Check in-memory cache
  if (_flowFactoryCache && (Date.now() - _flowFactoryCache.timestamp) < FLOW_FACTORY_CACHE_TTL) {
    return { namespace: _flowFactoryCache.namespace, apiSysId: _flowFactoryCache.apiSysId };
  }

  // 2. Concurrency lock — reuse in-flight bootstrap
  if (_bootstrapPromise) {
    return _bootstrapPromise;
  }

  _bootstrapPromise = (async () => {
    try {
      // 3. Check if API already exists on instance (query by api_id, more reliable than name)
      var checkResp = await client.get('/api/now/table/sys_ws_definition', {
        params: {
          sysparm_query: 'api_id=' + FLOW_FACTORY_API_ID,
          sysparm_fields: 'sys_id,api_id,namespace',
          sysparm_limit: 1
        }
      });

      if (checkResp.data.result && checkResp.data.result.length > 0) {
        var existing = checkResp.data.result[0];
        var ns = await probeFlowFactoryNamespace(client, existing.sys_id, instanceUrl);
        if (!ns) {
          throw new Error('Flow Factory API exists (sys_id=' + existing.sys_id + ') but namespace could not be resolved via HTTP probing');
        }
        _flowFactoryCache = { apiSysId: existing.sys_id, namespace: ns, timestamp: Date.now() };
        return { namespace: ns, apiSysId: existing.sys_id };
      }

      // 4. Deploy the Scripted REST API (do NOT set namespace — let ServiceNow assign it)
      var apiResp = await client.post('/api/now/table/sys_ws_definition', {
        name: FLOW_FACTORY_API_NAME,
        api_id: FLOW_FACTORY_API_ID,
        active: true,
        short_description: 'Bootstrapped by Snow-Flow MCP for reliable Flow Designer creation via GlideRecord',
        is_versioned: false,
        enforce_acl: 'false',
        requires_authentication: true
      });

      var apiSysId = apiResp.data.result?.sys_id;
      if (!apiSysId) {
        throw new Error('Failed to create Scripted REST API definition — no sys_id returned');
      }

      // 5. Deploy the POST /create resource
      try {
        await client.post('/api/now/table/sys_ws_operation', {
          web_service_definition: apiSysId,
          http_method: 'POST',
          name: 'create',
          active: true,
          relative_path: '/create',
          short_description: 'Create a flow or subflow with GlideRecord (triggers all BRs + version record)',
          operation_script: FLOW_FACTORY_SCRIPT,
          requires_authentication: true,
          enforce_acl: 'false'
        });
      } catch (opError: any) {
        // Cleanup the API definition if operation creation fails
        try { await client.delete('/api/now/table/sys_ws_definition/' + apiSysId); } catch (_) {}
        throw new Error('Failed to create Scripted REST operation: ' + (opError.message || opError));
      }

      // 6. Probe to discover the namespace ServiceNow assigned
      var resolvedNs = await probeFlowFactoryNamespace(client, apiSysId, instanceUrl);
      if (!resolvedNs) {
        throw new Error('Flow Factory API created (sys_id=' + apiSysId + ') but namespace could not be resolved via HTTP probing');
      }

      _flowFactoryCache = { apiSysId: apiSysId, namespace: resolvedNs, timestamp: Date.now() };
      return { namespace: resolvedNs, apiSysId: apiSysId };

    } finally {
      _bootstrapPromise = null;
    }
  })();

  return _bootstrapPromise;
}

/**
 * Invalidate the Flow Factory cache (e.g. on 404 when API was deleted externally).
 */
function invalidateFlowFactoryCache(): void {
  _flowFactoryCache = null;
}

/**
 * Resolve a flow name to its sys_id. If the value is already a 32-char hex
 * string it is returned as-is.
 */
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
        enum: ['create', 'create_subflow', 'list', 'get', 'update', 'activate', 'deactivate', 'delete', 'publish'],
        description: 'Action to perform'
      },

      // ── shared identifiers ──
      flow_id: {
        type: 'string',
        description: 'Flow sys_id or name (required for get, update, activate, deactivate, delete, publish)'
      },

      // ── create / create_subflow params ──
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

      // ── list params ──
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

      // ── update params ──
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
      // CREATE  (Scripted REST API → Table API fallback)
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

        // ── Try Scripted REST API (Flow Factory) first ──────────────
        var flowSysId: string | null = null;
        var usedMethod = 'table_api';
        var versionCreated = false;
        var factoryWarnings: string[] = [];
        var triggerCreated = false;
        var actionsCreated = 0;
        var varsCreated = 0;

        // Diagnostics: track every step for debugging "flow cannot be found" issues
        var diagnostics: any = {
          factory_bootstrap: null,
          factory_namespace: null,
          factory_call: null,
          table_api_used: false,
          version_created: false,
          version_method: null,
          version_fields_set: [] as string[],
          snapshot_result: null,
          post_verify: null
        };

        try {
          var factory = await ensureFlowFactoryAPI(client, context.instanceUrl);
          diagnostics.factory_bootstrap = 'success';
          diagnostics.factory_namespace = factory.namespace;

          var factoryPayload = {
            name: flowName,
            description: flowDescription,
            type: isSubflow ? 'subflow' : 'flow',
            category: flowCategory,
            run_as: flowRunAs,
            activate: shouldActivate,
            trigger_type: triggerType,
            trigger_table: flowTable,
            trigger_condition: triggerCondition,
            activities: activitiesArg.map(function (act: any, idx: number) {
              return { name: act.name, type: act.type || 'script', inputs: act.inputs || {}, order: (idx + 1) * 100 };
            }),
            inputs: inputsArg,
            outputs: outputsArg,
            flow_definition: flowDefinition
          };

          var factoryEndpoint = '/api/' + factory.namespace + '/' + FLOW_FACTORY_API_ID + '/create';
          var factoryResp: any;

          try {
            factoryResp = await client.post(factoryEndpoint, factoryPayload);
          } catch (callError: any) {
            // 404 = API was deleted externally → invalidate cache, retry once
            if (callError.response?.status === 404) {
              invalidateFlowFactoryCache();
              var retryFactory = await ensureFlowFactoryAPI(client, context.instanceUrl);
              diagnostics.factory_namespace = retryFactory.namespace;
              var retryEndpoint = '/api/' + retryFactory.namespace + '/' + FLOW_FACTORY_API_ID + '/create';
              factoryResp = await client.post(retryEndpoint, factoryPayload);
            } else {
              throw callError;
            }
          }

          var factoryResult = factoryResp.data?.result || factoryResp.data;
          if (factoryResult && factoryResult.success && factoryResult.flow_sys_id) {
            diagnostics.factory_call = 'success';
            flowSysId = factoryResult.flow_sys_id;
            usedMethod = 'scripted_rest_api';
            versionCreated = !!factoryResult.version_created;
            diagnostics.version_created = versionCreated;
            diagnostics.version_method = 'factory';
            diagnostics.version_fields_set = ['flow', 'name', 'version', 'state', 'active', 'compile_state', 'is_current', 'published_flow'];

            // Extract step details
            var steps = factoryResult.steps || {};
            if (steps.trigger) {
              triggerCreated = !!steps.trigger.success;
              if (!steps.trigger.success && steps.trigger.error) {
                factoryWarnings.push('Trigger: ' + steps.trigger.error);
              }
            }
            if (steps.actions) {
              actionsCreated = steps.actions.created || 0;
            }
            if (steps.variables) {
              varsCreated = steps.variables.created || 0;
            }
            if (steps.version && !steps.version.success) {
              factoryWarnings.push('Version record: ' + (steps.version.error || 'creation failed'));
            }
          }
        } catch (factoryError: any) {
          // Flow Factory unavailable — fall through to Table API
          var statusCode = factoryError.response?.status;
          var factoryErrMsg = statusCode
            ? 'HTTP ' + statusCode + ': ' + (factoryError.response?.data?.error?.message || factoryError.message || 'unknown')
            : (factoryError.message || 'unknown');
          diagnostics.factory_bootstrap = diagnostics.factory_bootstrap || ('error: ' + factoryErrMsg);
          diagnostics.factory_call = diagnostics.factory_call || ('error: ' + factoryErrMsg);
          if (statusCode !== 403) {
            factoryWarnings.push('Flow Factory unavailable (' + factoryErrMsg + '), using Table API fallback');
          }
        }

        // ── Table API fallback (existing logic) ─────────────────────
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
            type: isSubflow ? 'subflow' : 'flow',
            flow_definition: JSON.stringify(flowDefinition),
            latest_snapshot: JSON.stringify(flowDefinition)
          };

          var flowResponse = await client.post('/api/now/table/sys_hub_flow', flowData);
          var createdFlow = flowResponse.data.result;
          flowSysId = createdFlow.sys_id;

          // Create sys_hub_flow_version via Table API (critical for Flow Designer UI)
          try {
            var versionData: any = {
              flow: flowSysId,
              name: '1.0',
              version: '1.0',
              state: shouldActivate ? 'published' : 'draft',
              active: true,
              compile_state: 'compiled',
              is_current: true,
              flow_definition: JSON.stringify(flowDefinition)
            };
            if (shouldActivate) versionData.published_flow = flowSysId;
            var versionResp = await client.post('/api/now/table/sys_hub_flow_version', versionData);
            var versionSysId = versionResp.data.result?.sys_id;
            if (versionSysId) {
              versionCreated = true;
              diagnostics.version_created = true;
              diagnostics.version_method = 'table_api';
              diagnostics.version_fields_set = ['flow', 'name', 'version', 'state', 'active', 'compile_state', 'is_current', 'published_flow'];
              // Link flow to its version
              try {
                await client.patch('/api/now/table/sys_hub_flow/' + flowSysId, {
                  latest_version: versionSysId
                });
              } catch (linkError) {
                // Version exists but link failed — still better than no version
                factoryWarnings.push('Version created but latest_version link failed');
              }
            }
          } catch (verError: any) {
            factoryWarnings.push('sys_hub_flow_version creation failed: ' + (verError.message || verError));
          }

          // Create trigger instance (non-manual flows only)
          if (!isSubflow && triggerType !== 'manual') {
            try {
              var triggerTypeLookup: Record<string, string> = {
                'record_created': 'sn_fd.trigger.record_created',
                'record_updated': 'sn_fd.trigger.record_updated',
                'scheduled': 'sn_fd.trigger.scheduled'
              };
              var triggerInternalName = triggerTypeLookup[triggerType] || '';

              if (triggerInternalName) {
                var triggerDefResp = await client.get('/api/now/table/sys_hub_action_type_definition', {
                  params: {
                    sysparm_query: 'internal_name=' + triggerInternalName,
                    sysparm_fields: 'sys_id',
                    sysparm_limit: 1
                  }
                });

                var triggerDefId = triggerDefResp.data.result?.[0]?.sys_id;
                if (triggerDefId) {
                  var triggerData: any = {
                    flow: flowSysId,
                    action_type: triggerDefId,
                    name: triggerType,
                    order: 0,
                    active: true
                  };
                  if (flowTable) triggerData.table = flowTable;
                  if (triggerCondition) triggerData.condition = triggerCondition;

                  await client.post('/api/now/table/sys_hub_trigger_instance', triggerData);
                  triggerCreated = true;
                }
              }
            } catch (triggerError) {
              // Best-effort
            }
          }

          // Create action instances
          for (var ai = 0; ai < activitiesArg.length; ai++) {
            var activity = activitiesArg[ai];
            try {
              var actionTypeName = activity.type || 'script';
              var actionTypeQuery = 'internal_nameLIKE' + actionTypeName + '^ORnameLIKE' + actionTypeName;

              var actionDefResp = await client.get('/api/now/table/sys_hub_action_type_definition', {
                params: {
                  sysparm_query: actionTypeQuery,
                  sysparm_fields: 'sys_id,name,internal_name',
                  sysparm_limit: 1
                }
              });

              var actionDefId = actionDefResp.data.result?.[0]?.sys_id;
              var instanceData: any = {
                flow: flowSysId,
                name: activity.name,
                order: (ai + 1) * 100,
                active: true
              };
              if (actionDefId) instanceData.action_type = actionDefId;

              await client.post('/api/now/table/sys_hub_action_instance', instanceData);
              actionsCreated++;
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

          // Best-effort snapshot
          try {
            await client.post('/api/sn_flow_designer/flow/snapshot', { flow_id: flowSysId });
            diagnostics.snapshot_result = 'success';
          } catch (snapError: any) {
            diagnostics.snapshot_result = 'error: ' + (snapError.response?.status || snapError.message || 'unknown');
          }
        }

        // ── Post-creation verification ─────────────────────────────
        if (flowSysId) {
          try {
            var verifyResp = await client.get('/api/now/table/sys_hub_flow/' + flowSysId, {
              params: { sysparm_fields: 'sys_id,name,latest_version' }
            });
            var verifyFlow = verifyResp.data.result;
            var hasLatestVersion = !!(verifyFlow && verifyFlow.latest_version);

            // Check if version record exists
            var verCheckResp = await client.get('/api/now/table/sys_hub_flow_version', {
              params: {
                sysparm_query: 'flow=' + flowSysId,
                sysparm_fields: 'sys_id,name,state,compile_state,is_current',
                sysparm_limit: 1
              }
            });
            var verRecords = verCheckResp.data.result || [];
            var hasVersionRecord = verRecords.length > 0;

            diagnostics.post_verify = {
              flow_exists: true,
              has_latest_version_ref: hasLatestVersion,
              version_record_exists: hasVersionRecord,
              version_details: hasVersionRecord ? {
                sys_id: verRecords[0].sys_id,
                state: verRecords[0].state,
                compile_state: verRecords[0].compile_state,
                is_current: verRecords[0].is_current
              } : null
            };

            // If version record is missing, retry creation
            if (!hasVersionRecord && !versionCreated) {
              try {
                var retryVersionData: any = {
                  flow: flowSysId,
                  name: '1.0',
                  version: '1.0',
                  state: shouldActivate ? 'published' : 'draft',
                  active: true,
                  compile_state: 'compiled',
                  is_current: true,
                  flow_definition: JSON.stringify(flowDefinition)
                };
                if (shouldActivate) retryVersionData.published_flow = flowSysId;

                var retryVerResp = await client.post('/api/now/table/sys_hub_flow_version', retryVersionData);
                var retryVerSysId = retryVerResp.data.result?.sys_id;
                if (retryVerSysId) {
                  versionCreated = true;
                  diagnostics.version_created = true;
                  diagnostics.version_method = (diagnostics.version_method || 'table_api') + ' (retry)';
                  try {
                    await client.patch('/api/now/table/sys_hub_flow/' + flowSysId, { latest_version: retryVerSysId });
                  } catch (_) {}
                  factoryWarnings.push('Version record was missing — created via post-verify retry');
                }
              } catch (retryErr: any) {
                factoryWarnings.push('Post-verify version retry failed: ' + (retryErr.message || retryErr));
              }
            }
          } catch (verifyErr: any) {
            diagnostics.post_verify = { error: verifyErr.message || 'verification failed' };
          }
        }

        // ── Build summary ───────────────────────────────────────────
        var methodLabel = usedMethod === 'scripted_rest_api'
          ? 'Scripted REST API (GlideRecord)'
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
        createSummary.indented('Factory bootstrap: ' + (diagnostics.factory_bootstrap || 'not attempted'));
        createSummary.indented('Factory namespace: ' + (diagnostics.factory_namespace || 'n/a'));
        createSummary.indented('Factory call: ' + (diagnostics.factory_call || 'not attempted'));
        createSummary.indented('Table API used: ' + diagnostics.table_api_used);
        createSummary.indented('Version created: ' + diagnostics.version_created + (diagnostics.version_method ? ' (' + diagnostics.version_method + ')' : ''));
        createSummary.indented('Snapshot: ' + (diagnostics.snapshot_result || 'n/a'));
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

export const version = '3.0.0';
export const author = 'Snow-Flow Team';
