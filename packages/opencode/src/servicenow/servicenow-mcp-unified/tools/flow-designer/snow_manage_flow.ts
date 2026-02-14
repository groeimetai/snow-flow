/**
 * Snow-Flow Flow Designer Tool
 *
 * DISCLAIMER:
 * This tool uses both official and undocumented ServiceNow APIs to interact
 * with Flow Designer. The GraphQL-based operations (snFlowDesigner) use
 * internal ServiceNow APIs that are not officially documented and may change
 * without notice. Use at your own risk.
 *
 * This tool is not affiliated with, endorsed by, or sponsored by ServiceNow, Inc.
 * ServiceNow is a registered trademark of ServiceNow, Inc.
 *
 * A valid ServiceNow subscription and credentials are required to use this tool.
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

/**
 * Get the current max global order from the flow's version payload.
 *
 * IMPORTANT: Flow Designer elements (actions, flow logic, subflows) are NOT stored as
 * individual records in sys_hub_action_instance / sys_hub_flow_logic / sys_hub_sub_flow_instance.
 * They only exist inside the sys_hub_flow_version.payload (managed by the GraphQL API).
 * Table API queries on these tables will always return 0 results.
 *
 * This function reads the version payload to determine the current max order.
 * If the payload can't be read/parsed, it returns 0 (caller should use explicit order).
 */
async function getMaxOrderFromVersion(client: any, flowId: string): Promise<number> {
  try {
    const resp = await client.get('/api/now/table/sys_hub_flow_version', {
      params: {
        sysparm_query: 'flow=' + flowId + '^ORDERBYDESCsys_created_on',
        sysparm_fields: 'sys_id,payload',
        sysparm_limit: 1
      }
    });
    const payload = resp.data.result?.[0]?.payload;
    if (!payload) return 0;
    // Payload may be JSON containing flow elements with order fields
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    // Extract max order from any structure — search recursively for "order" values
    let maxOrder = 0;
    const findOrders = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.order !== undefined) {
        const o = parseInt(String(obj.order), 10);
        if (!isNaN(o) && o > maxOrder) maxOrder = o;
      }
      if (Array.isArray(obj)) obj.forEach(findOrders);
      else Object.values(obj).forEach(findOrders);
    };
    findOrders(parsed);
    return maxOrder;
  } catch (_) {
    return 0;
  }
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

/**
 * Acquire the Flow Designer editing lock on a flow.
 * The UI calls safeEdit(create: flowId) when opening the editor.
 * This must be called before GraphQL mutations on existing flows.
 */
async function acquireFlowEditingLock(client: any, flowId: string): Promise<{ success: boolean; error?: string }> {
  try {
    var mutation = 'mutation { global { snFlowDesigner { safeEdit(safeEditInput: {create: "' + flowId + '"}) { createResult { canEdit id editingUserDisplayName __typename } __typename } __typename } __typename } }';
    var resp = await client.post('/api/now/graphql', { variables: {}, query: mutation });
    var result = resp.data?.data?.global?.snFlowDesigner?.safeEdit?.createResult;
    if (result?.canEdit === true || result?.canEdit === 'true') {
      return { success: true };
    }
    var editingUser = result?.editingUserDisplayName || 'another user';
    return { success: false, error: 'Flow is locked by ' + editingUser };
  } catch (e: any) {
    return { success: false, error: e.message || 'unknown error' };
  }
}

/**
 * Release the Flow Designer editing lock on a flow.
 * The UI calls safeEdit(delete: flowId) when closing the editor.
 * Without this, the flow remains locked to the API user forever.
 */
async function releaseFlowEditingLock(client: any, flowId: string): Promise<boolean> {
  try {
    var mutation = 'mutation { global { snFlowDesigner { safeEdit(safeEditInput: {delete: "' + flowId + '"}) { deleteResult { deleteSuccess id __typename } __typename } __typename } __typename } }';
    var resp = await client.post('/api/now/graphql', { variables: {}, query: mutation });
    return resp.data?.data?.global?.snFlowDesigner?.safeEdit?.deleteResult?.deleteSuccess === true;
  } catch (_) {
    return false;
  }
}

/** Safely extract a string from a ServiceNow Table API value (handles reference objects like {value, link}). */
const str = (val: any): string =>
  typeof val === 'object' && val !== null ? (val.display_value || val.value || '') : (val || '');

// Type label mapping for parameter definitions
const TYPE_LABELS: Record<string, string> = {
  string: 'String', integer: 'Integer', boolean: 'True/False', choice: 'Choice',
  reference: 'Reference', object: 'Object', glide_date_time: 'Date/Time',
  glide_date: 'Date', decimal: 'Decimal', conditions: 'Conditions',
  glide_list: 'List', html: 'HTML', script: 'Script', url: 'URL',
};

/**
 * Build full action input objects matching the Flow Designer UI format.
 * The UI sends inputs WITH parameter definitions in the INSERT mutation (not empty inputs + separate UPDATE).
 */
async function buildActionInputsForInsert(
  client: any,
  actionDefId: string,
  userValues?: Record<string, string>
): Promise<{ inputs: any[]; resolvedInputs: Record<string, string>; actionParams: any[] }> {
  // Query sys_hub_action_input with full field set
  var actionParams: any[] = [];
  try {
    var resp = await client.get('/api/now/table/sys_hub_action_input', {
      params: {
        sysparm_query: 'model=' + actionDefId,
        sysparm_fields: 'sys_id,element,label,internal_type,mandatory,default_value,order,max_length,hint,read_only,extended,data_structure,reference,reference_display,ref_qual,choice_option,table_name,column_name,use_dependent,dependent_on,show_ref_finder,local,attributes,sys_class_name',
        sysparm_display_value: 'false',
        sysparm_limit: 50
      }
    });
    actionParams = resp.data.result || [];
  } catch (_) {}

  // Fuzzy-match user-provided values to actual field names
  var resolvedInputs: Record<string, string> = {};
  if (userValues) {
    var paramElements = actionParams.map(function (p: any) { return str(p.element); });
    for (var [key, value] of Object.entries(userValues)) {
      if (paramElements.includes(key)) {
        resolvedInputs[key] = value;
        continue;
      }
      var match = actionParams.find(function (p: any) {
        var el = str(p.element);
        return el.endsWith('_' + key) || el.startsWith(key + '_') || el === key || str(p.label).toLowerCase() === key.toLowerCase();
      });
      if (match) resolvedInputs[str(match.element)] = value;
      else resolvedInputs[key] = value;
    }
  }

  // Build full input objects with parameter definitions (matching UI format)
  // Use str() on all fields — the Table API may return reference fields as objects {value, link}
  var inputs = actionParams.map(function (rec: any) {
    var paramType = str(rec.internal_type) || 'string';
    var element = str(rec.element);
    var userVal = resolvedInputs[element] || '';
    return {
      id: str(rec.sys_id),
      name: element,
      children: [],
      displayValue: { value: '' },
      value: { schemaless: false, schemalessValue: '', value: userVal },
      parameter: {
        id: str(rec.sys_id),
        label: str(rec.label) || element,
        name: element,
        type: paramType,
        type_label: TYPE_LABELS[paramType] || paramType.charAt(0).toUpperCase() + paramType.slice(1),
        hint: str(rec.hint),
        order: parseInt(str(rec.order) || '0', 10),
        extended: str(rec.extended) === 'true',
        mandatory: str(rec.mandatory) === 'true',
        readonly: str(rec.read_only) === 'true',
        maxsize: parseInt(str(rec.max_length) || '8000', 10),
        data_structure: str(rec.data_structure),
        reference: str(rec.reference),
        reference_display: str(rec.reference_display),
        ref_qual: str(rec.ref_qual),
        choiceOption: str(rec.choice_option),
        table: str(rec.table_name),
        columnName: str(rec.column_name),
        defaultValue: str(rec.default_value),
        use_dependent: str(rec.use_dependent) === 'true',
        dependent_on: str(rec.dependent_on),
        show_ref_finder: str(rec.show_ref_finder) === 'true',
        local: str(rec.local) === 'true',
        attributes: str(rec.attributes),
        sys_class_name: str(rec.sys_class_name),
        children: []
      }
    };
  });

  // Check for mandatory fields that are missing a value
  var missingMandatory = inputs
    .filter(function (inp: any) { return inp.parameter?.mandatory && !inp.value?.value; })
    .map(function (inp: any) { return inp.name + ' (' + (inp.parameter?.label || inp.name) + ')'; });

  return { inputs, resolvedInputs, actionParams, missingMandatory };
}

/**
 * Build full flow logic input objects AND flowLogicDefinition matching the Flow Designer UI format.
 * The UI sends inputs WITH parameter definitions and the full flowLogicDefinition in the INSERT mutation.
 *
 * Flow logic definitions (IF, ELSE, FOR_EACH, etc.) store their input parameters in
 * sys_hub_flow_logic_input (NOT sys_hub_action_input), using the definition's sys_id as the 'model' reference.
 */
async function buildFlowLogicInputsForInsert(
  client: any,
  defId: string,
  defRecord: { name?: string; type?: string; description?: string; order?: string; attributes?: string; compilation_class?: string; quiescence?: string; visible?: string; category?: string; connected_to?: string },
  userValues?: Record<string, string>
): Promise<{ inputs: any[]; flowLogicDefinition: any; resolvedInputs: Record<string, string>; inputQueryError?: string; defParamsCount: number }> {
  // Query sys_hub_flow_logic_input for this definition's inputs (separate table from sys_hub_action_input)
  // Field names verified from actual sys_hub_flow_logic_input XML schema
  var defParams: any[] = [];
  var inputQueryError = '';
  try {
    var resp = await client.get('/api/now/table/sys_hub_flow_logic_input', {
      params: {
        sysparm_query: 'model=' + defId,
        sysparm_fields: 'sys_id,element,label,internal_type,mandatory,default_value,order,max_length,hint,read_only,attributes,sys_class_name,reference,choice,dependent,dependent_on_field,use_dependent_field,column_label',
        sysparm_display_value: 'false',
        sysparm_limit: 50
      }
    });
    defParams = resp.data.result || [];
  } catch (e: any) {
    inputQueryError = e.message || 'unknown error';
    // Fallback: try with minimal fields
    try {
      var resp2 = await client.get('/api/now/table/sys_hub_flow_logic_input', {
        params: {
          sysparm_query: 'model=' + defId,
          sysparm_fields: 'sys_id,element,label,internal_type,mandatory,order,max_length,attributes',
          sysparm_display_value: 'false',
          sysparm_limit: 50
        }
      });
      defParams = resp2.data.result || [];
      inputQueryError = '';
    } catch (e2: any) {
      inputQueryError += '; fallback also failed: ' + (e2.message || '');
    }
  }

  // Fuzzy-match user-provided values to actual field names
  var resolvedInputs: Record<string, string> = {};
  if (userValues) {
    var paramElements = defParams.map(function (p: any) { return str(p.element); });
    for (var [key, value] of Object.entries(userValues)) {
      if (paramElements.includes(key)) {
        resolvedInputs[key] = value;
        continue;
      }
      var match = defParams.find(function (p: any) {
        var el = str(p.element);
        return el.endsWith('_' + key) || el === key || str(p.label).toLowerCase() === key.toLowerCase();
      });
      if (match) resolvedInputs[str(match.element)] = value;
      else resolvedInputs[key] = value;
    }
  }

  // Build parameter definition objects (shared between inputs array and flowLogicDefinition.inputs)
  var inputDefs = defParams.map(function (rec: any) {
    var paramType = str(rec.internal_type) || 'string';
    var element = str(rec.element);
    return {
      id: str(rec.sys_id),
      label: str(rec.label) || element,
      name: element,
      type: paramType,
      type_label: TYPE_LABELS[paramType] || paramType.charAt(0).toUpperCase() + paramType.slice(1),
      hint: str(rec.hint),
      order: parseInt(str(rec.order) || '0', 10),
      extended: str(rec.extended) === 'true',
      mandatory: str(rec.mandatory) === 'true',
      readonly: str(rec.read_only) === 'true',
      maxsize: parseInt(str(rec.max_length) || '8000', 10),
      data_structure: str(rec.data_structure),
      reference: str(rec.reference),
      reference_display: str(rec.reference_display),
      ref_qual: str(rec.ref_qual),
      choiceOption: str(rec.choice_option),
      table: str(rec.table_name),
      columnName: str(rec.column_name),
      defaultValue: str(rec.default_value),
      use_dependent: str(rec.use_dependent) === 'true',
      dependent_on: str(rec.dependent_on),
      show_ref_finder: str(rec.show_ref_finder) === 'true',
      local: str(rec.local) === 'true',
      attributes: str(rec.attributes),
      sys_class_name: str(rec.sys_class_name),
      children: []
    };
  });

  // Build full input objects with parameter definitions and user values
  var inputs = inputDefs.map(function (paramDef: any) {
    var userVal = resolvedInputs[paramDef.name] || '';
    return {
      id: paramDef.id,
      name: paramDef.name,
      children: [],
      displayValue: { value: '' },
      value: { schemaless: false, schemalessValue: '', value: userVal },
      parameter: paramDef
    };
  });

  // Build flowLogicDefinition object (matching UI format)
  var flowLogicDefinition: any = {
    id: defId,
    name: defRecord.name || '',
    description: str(defRecord.description),
    connectedTo: str(defRecord.connected_to),
    quiescence: str(defRecord.quiescence) || 'never',
    compilationClass: str(defRecord.compilation_class),
    order: parseInt(str(defRecord.order) || '1', 10),
    type: str(defRecord.type) || '',
    visible: str(defRecord.visible) !== 'false',
    attributes: str(defRecord.attributes),
    userCanRead: true,
    category: str(defRecord.category),
    inputs: inputDefs,
    variables: '[]'
  };

  // Check for mandatory fields that are missing a value
  var missingMandatory = inputs
    .filter(function (inp: any) { return inp.parameter?.mandatory && !inp.value?.value; })
    .map(function (inp: any) { return inp.name + ' (' + (inp.parameter?.label || inp.name) + ')'; });

  return { inputs, flowLogicDefinition, resolvedInputs, inputQueryError: inputQueryError || undefined, defParamsCount: defParams.length, missingMandatory };
}

// Note: reordering of existing elements is NOT possible via Table API because
// Flow Designer elements only exist in the version payload (managed by GraphQL).
// The caller must provide the correct global order. When inserting between existing
// elements, the caller should include the necessary sibling updates in the same
// GraphQL mutation (matching how the Flow Designer UI works).

/**
 * Calculate the insert order for a new flow element.
 *
 * Flow Designer uses GLOBAL ordering: all elements (actions, flow logic, subflows)
 * share a single sequential numbering (1, 2, 3, 4, 5...).
 *
 * IMPORTANT: Flow elements do NOT exist as individual records in the Table API.
 * They only live inside the version payload managed by the GraphQL API.
 * Therefore we CANNOT query Table API to find existing elements or their orders.
 *
 * Order computation strategy:
 * 1. If explicit order is provided → use it as the global order (the caller knows best)
 * 2. Otherwise → try to determine max order from version payload, return max + 1
 */
async function calculateInsertOrder(
  client: any,
  flowId: string,
  _parentUiId?: string,
  explicitOrder?: number
): Promise<number> {
  // Explicit order provided: trust it as the correct global order.
  // This matches how the Flow Designer UI works — it computes the correct global
  // order client-side and sends it in the mutation.
  if (explicitOrder) return explicitOrder;

  // No explicit order: try to find max order from version payload
  const maxOrder = await getMaxOrderFromVersion(client, flowId);
  if (maxOrder > 0) return maxOrder + 1;

  // Last resort fallback
  return 1;
}

/**
 * Flatten an attributes object { key: "val" } into comma-separated "key=val," string (matching UI format).
 * If already a string, returns as-is.
 */
function flattenAttributes(attrs: any): string {
  if (!attrs || typeof attrs === 'string') return attrs || '';
  return Object.entries(attrs).map(([k, v]) => k + '=' + v).join(',') + ',';
}

/**
 * Build full trigger input and output objects for the INSERT mutation by fetching from the
 * triggerpicker API (/api/now/hub/triggerpicker/{id}) — the same endpoint Flow Designer UI uses.
 *
 * The UI sends ALL inputs with full parameter definitions (choices, defaults, attributes) and
 * ALL outputs in a single INSERT mutation. This function replicates that format exactly.
 *
 * Fallback: if the triggerpicker API fails, queries sys_hub_trigger_input / sys_hub_trigger_output
 * via the Table API (same approach as buildActionInputsForInsert / buildFlowLogicInputsForInsert).
 */
/**
 * Parse XML string from triggerpicker API to extract input/output elements.
 * The triggerpicker endpoint may return XML instead of JSON on some instances.
 */
function parseTriggerpickerXml(xmlStr: string): { inputs: any[]; outputs: any[] } {
  var inputs: any[] = [];
  var outputs: any[] = [];

  // Helper: extract text content of an XML element by tag name
  var getTag = function (xml: string, tag: string): string {
    var m = xml.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'));
    return m ? m[1].trim() : '';
  };

  // Helper: extract all occurrences of a repeated element
  var getAll = function (xml: string, tag: string): string[] {
    var re = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'g');
    var results: string[] = [];
    var m;
    while ((m = re.exec(xml)) !== null) results.push(m[1]);
    return results;
  };

  // Try to find input elements — XML may wrap them in <inputs><element>...</element></inputs>
  // or <trigger_inputs><input>...</input></trigger_inputs> etc.
  var inputsSection = getTag(xmlStr, 'inputs') || getTag(xmlStr, 'trigger_inputs') || xmlStr;
  var inputElements = getAll(inputsSection, 'element');
  if (inputElements.length === 0) inputElements = getAll(inputsSection, 'input');
  if (inputElements.length === 0) inputElements = getAll(inputsSection, 'trigger_input');

  for (var ii = 0; ii < inputElements.length; ii++) {
    var el = inputElements[ii];
    var name = getTag(el, 'name') || getTag(el, 'element');
    if (!name) continue;
    inputs.push({
      id: getTag(el, 'sys_id') || getTag(el, 'id'),
      name: name,
      label: getTag(el, 'label') || name,
      type: getTag(el, 'type') || getTag(el, 'internal_type') || 'string',
      type_label: getTag(el, 'type_label') || '',
      mandatory: getTag(el, 'mandatory') === 'true',
      order: parseInt(getTag(el, 'order') || '0', 10),
      maxsize: parseInt(getTag(el, 'maxsize') || getTag(el, 'max_length') || '4000', 10),
      hint: getTag(el, 'hint'),
      defaultValue: getTag(el, 'defaultValue') || getTag(el, 'default_value'),
      defaultDisplayValue: getTag(el, 'defaultDisplayValue') || getTag(el, 'default_display_value'),
      choiceOption: getTag(el, 'choiceOption') || getTag(el, 'choice_option'),
      reference: getTag(el, 'reference'),
      reference_display: getTag(el, 'reference_display'),
      use_dependent: getTag(el, 'use_dependent') === 'true',
      dependent_on: getTag(el, 'dependent_on'),
      internal_link: getTag(el, 'internal_link'),
      attributes: getTag(el, 'attributes')
    });
  }

  var outputsSection = getTag(xmlStr, 'outputs') || getTag(xmlStr, 'trigger_outputs') || '';
  var outputElements = getAll(outputsSection, 'element');
  if (outputElements.length === 0) outputElements = getAll(outputsSection, 'output');
  if (outputElements.length === 0) outputElements = getAll(outputsSection, 'trigger_output');

  for (var oi = 0; oi < outputElements.length; oi++) {
    var oel = outputElements[oi];
    var oname = getTag(oel, 'name') || getTag(oel, 'element');
    if (!oname) continue;
    outputs.push({
      id: getTag(oel, 'sys_id') || getTag(oel, 'id'),
      name: oname,
      label: getTag(oel, 'label') || oname,
      type: getTag(oel, 'type') || getTag(oel, 'internal_type') || 'string',
      type_label: getTag(oel, 'type_label') || '',
      mandatory: getTag(oel, 'mandatory') === 'true',
      order: parseInt(getTag(oel, 'order') || '0', 10),
      maxsize: parseInt(getTag(oel, 'maxsize') || getTag(oel, 'max_length') || '200', 10),
      hint: getTag(oel, 'hint'),
      reference: getTag(oel, 'reference'),
      reference_display: getTag(oel, 'reference_display'),
      use_dependent: getTag(oel, 'use_dependent') === 'true',
      dependent_on: getTag(oel, 'dependent_on'),
      internal_link: getTag(oel, 'internal_link'),
      attributes: getTag(oel, 'attributes')
    });
  }

  return { inputs, outputs };
}

/**
 * Build a single trigger input object in GraphQL mutation format.
 * Used by buildTriggerInputsForInsert and the hardcoded fallback.
 */
function buildTriggerInputObj(inp: any, userTable?: string, userCondition?: string): any {
  var paramType = inp.type || 'string';
  var name = inp.name || '';
  var label = inp.label || name;
  var attrs = typeof inp.attributes === 'object' ? flattenAttributes(inp.attributes) : (inp.attributes || '');

  // Determine value: user-provided > default
  var value = '';
  if (name === 'table' && userTable) value = userTable;
  else if (name === 'condition') value = userCondition || '^EQ';
  else if (inp.defaultValue) value = inp.defaultValue;

  var parameter: any = {
    id: inp.id || '', label: label, name: name, type: paramType,
    type_label: inp.type_label || TYPE_LABELS[paramType] || paramType,
    order: inp.order || 0, extended: inp.extended || false,
    mandatory: inp.mandatory || false, readonly: inp.readonly || false,
    maxsize: inp.maxsize || 4000, data_structure: '',
    reference: inp.reference || '', reference_display: inp.reference_display || '',
    ref_qual: inp.ref_qual || '', choiceOption: inp.choiceOption || '',
    table: '', columnName: '', defaultValue: inp.defaultValue || '',
    use_dependent: inp.use_dependent || false, dependent_on: inp.dependent_on || '',
    internal_link: inp.internal_link || '', show_ref_finder: inp.show_ref_finder || false,
    local: inp.local || false, attributes: attrs, sys_class_name: '', children: []
  };
  if (inp.hint) parameter.hint = inp.hint;
  if (inp.defaultDisplayValue) parameter.defaultDisplayValue = inp.defaultDisplayValue;
  if (inp.choices) parameter.choices = inp.choices;
  if (inp.defaultChoices) parameter.defaultChoices = inp.defaultChoices;

  var inputObj: any = {
    name: name, label: label, internalType: paramType,
    mandatory: inp.mandatory || false, order: inp.order || 0,
    valueSysId: '', field_name: name, type: paramType, children: [],
    displayValue: { value: '' },
    value: value ? { schemaless: false, schemalessValue: '', value: value } : { value: '' },
    parameter: parameter
  };

  if (inp.choices && Array.isArray(inp.choices)) {
    inputObj.choiceList = inp.choices.map(function (c: any) {
      return { label: c.label, value: c.value };
    });
  }

  return inputObj;
}

/**
 * Build a single trigger output object in GraphQL mutation format.
 */
function buildTriggerOutputObj(out: any): any {
  var paramType = out.type || 'string';
  var name = out.name || '';
  var label = out.label || name;
  var attrs = typeof out.attributes === 'object' ? flattenAttributes(out.attributes) : (out.attributes || '');

  var parameter: any = {
    id: out.id || '', label: label, name: name, type: paramType,
    type_label: out.type_label || TYPE_LABELS[paramType] || paramType,
    hint: out.hint || '', order: out.order || 0, extended: out.extended || false,
    mandatory: out.mandatory || false, readonly: out.readonly || false,
    maxsize: out.maxsize || 200, data_structure: '',
    reference: out.reference || '', reference_display: out.reference_display || '',
    ref_qual: '', choiceOption: '', table: '', columnName: '', defaultValue: '',
    use_dependent: out.use_dependent || false, dependent_on: out.dependent_on || '',
    internal_link: out.internal_link || '', show_ref_finder: false, local: false,
    attributes: attrs, sys_class_name: ''
  };

  var children: any[] = [];
  var paramChildren: any[] = [];
  if (out.children && Array.isArray(out.children)) {
    children = out.children.map(function (child: any) {
      return { id: '', name: child.name || '', scriptActive: false, children: [], value: { value: '' }, script: null };
    });
    paramChildren = out.children.map(function (child: any) {
      return {
        id: '', label: child.label || child.name || '', name: child.name || '',
        type: child.type || 'string', type_label: child.type_label || TYPE_LABELS[child.type || 'string'] || 'String',
        hint: '', order: child.order || 0, extended: false, mandatory: false, readonly: false, maxsize: 0,
        data_structure: '', reference: '', reference_display: '', ref_qual: '', choiceOption: '',
        table: '', columnName: '', defaultValue: '', defaultDisplayValue: '',
        use_dependent: false, dependent_on: false, show_ref_finder: false, local: false,
        attributes: '', sys_class_name: '',
        uiDisplayType: child.uiDisplayType || child.type || 'string',
        uiDisplayTypeLabel: child.type_label || 'String',
        internal_link: '', value: '', display_value: '', scriptActive: false,
        parent: out.id || '',
        fieldFacetMap: 'uiTypeLabel=' + (child.type_label || 'String') + ',',
        children: [], script: null
      };
    });
  }
  parameter.children = paramChildren;

  return {
    name: name, value: '', displayValue: '', type: paramType,
    order: out.order || 0, label: label, children: children, parameter: parameter
  };
}

/**
 * Hardcoded record trigger inputs — used as ultimate fallback when API and Table lookups fail.
 * These definitions match the exact format captured from the Flow Designer UI for record-based triggers
 * (record_create, record_update, record_create_or_update). Field names and types are consistent across instances.
 */
function getRecordTriggerFallbackInputs(): any[] {
  return [
    { name: 'table', label: 'Table', type: 'table_name', type_label: 'Table Name', mandatory: true, order: 1, maxsize: 80, attributes: 'filter_table_source=RECORD_WATCHER_RESTRICTED,' },
    { name: 'condition', label: 'Condition', type: 'conditions', type_label: 'Conditions', mandatory: false, order: 100, maxsize: 4000, use_dependent: true, dependent_on: 'table', attributes: 'extended_operators=VALCHANGES;CHANGESFROM;CHANGESTO,wants_to_add_conditions=true,modelDependent=trigger_inputs,' },
    { name: 'run_on_extended', label: 'run_on_extended', type: 'choice', type_label: 'Choice', mandatory: false, order: 100, maxsize: 40, defaultValue: 'false', defaultDisplayValue: 'Run only on current table', choiceOption: '3', attributes: 'advanced=true,', choices: [{ label: 'Run only on current table', value: 'false', order: 0 }, { label: 'Run on current and extended tables', value: 'true', order: 1 }], defaultChoices: [{ label: 'Run only on current table', value: 'false', order: 1 }, { label: 'Run on current and extended tables', value: 'true', order: 2 }] },
    { name: 'run_flow_in', label: 'run_flow_in', type: 'choice', type_label: 'Choice', mandatory: false, order: 100, maxsize: 40, defaultValue: 'any', defaultDisplayValue: 'any', choiceOption: '3', attributes: 'advanced=true,', choices: [{ label: 'Run flow in background (default)', value: 'background', order: 0 }, { label: 'Run flow in foreground', value: 'foreground', order: 1 }], defaultChoices: [{ label: 'Run flow in background (default)', value: 'background', order: 1 }, { label: 'Run flow in foreground', value: 'foreground', order: 2 }] },
    { name: 'run_when_user_list', label: 'run_when_user_list', type: 'glide_list', type_label: 'List', mandatory: false, order: 100, maxsize: 4000, reference: 'sys_user', reference_display: 'User', attributes: 'advanced=true,' },
    { name: 'run_when_setting', label: 'run_when_setting', type: 'choice', type_label: 'Choice', mandatory: false, order: 100, maxsize: 40, defaultValue: 'both', defaultDisplayValue: 'Run for Both Interactive and Non-Interactive Sessions', choiceOption: '3', attributes: 'advanced=true,', choices: [{ label: 'Only Run for Non-Interactive Session', value: 'non_interactive', order: 0 }, { label: 'Only Run for User Interactive Session', value: 'interactive', order: 1 }, { label: 'Run for Both Interactive and Non-Interactive Sessions', value: 'both', order: 2 }], defaultChoices: [{ label: 'Only Run for Non-Interactive Session', value: 'non_interactive', order: 1 }, { label: 'Only Run for User Interactive Session', value: 'interactive', order: 2 }, { label: 'Run for Both Interactive and Non-Interactive Sessions', value: 'both', order: 3 }] },
    { name: 'run_when_user_setting', label: 'run_when_user_setting', type: 'choice', type_label: 'Choice', mandatory: false, order: 100, maxsize: 40, defaultValue: 'any', defaultDisplayValue: 'Run for any user', choiceOption: '3', attributes: 'advanced=true,', choices: [{ label: 'Do not run if triggered by the following users', value: 'not_one_of', order: 0 }, { label: 'Only Run if triggered by the following users', value: 'one_of', order: 1 }, { label: 'Run for any user', value: 'any', order: 2 }], defaultChoices: [{ label: 'Do not run if triggered by the following users', value: 'not_one_of', order: 1 }, { label: 'Only Run if triggered by the following users', value: 'one_of', order: 2 }, { label: 'Run for any user', value: 'any', order: 3 }] },
    { name: 'trigger_strategy', label: 'Run Trigger', type: 'choice', type_label: 'Choice', mandatory: false, order: 200, maxsize: 40, defaultValue: 'once', defaultDisplayValue: 'Once', choiceOption: '3', hint: 'Run Trigger every time the condition matches, or only the first time.', choices: [{ label: 'Once', value: 'once', order: 0 }, { label: 'For each unique change', value: 'unique_changes', order: 1 }, { label: 'Only if not currently running', value: 'always', order: 2 }, { label: 'For every update', value: 'every', order: 3 }], defaultChoices: [{ label: 'Once', value: 'once', order: 1 }, { label: 'For each unique change', value: 'unique_changes', order: 2 }, { label: 'Only if not currently running', value: 'always', order: 3 }, { label: 'For every update', value: 'every', order: 4 }] }
  ];
}

function getRecordTriggerFallbackOutputs(): any[] {
  return [
    { name: 'current', label: 'Record', type: 'document_id', type_label: 'Document ID', mandatory: true, order: 100, maxsize: 200, use_dependent: true, dependent_on: 'table_name', internal_link: 'table' },
    { name: 'changed_fields', label: 'Changed Fields', type: 'array.object', type_label: 'Array.Object', mandatory: false, order: 100, maxsize: 4000, attributes: 'uiTypeLabel=Array.Object,co_type_name=FDCollection,child_label=FDChangeDetails,child_type_label=Object,element_mapping_provider=com.glide.flow_design.action.data.FlowDesignVariableMapper,pwd2droppable=true,uiType=array.object,child_type=object,child_name=FDChangeDetails,', children: [{ name: 'field_name', label: 'Field Name', type: 'string', type_label: 'String', order: 1 }, { name: 'previous_value', label: 'Previous Value', type: 'string', type_label: 'String', order: 2 }, { name: 'current_value', label: 'Current Value', type: 'string', type_label: 'String', order: 3 }, { name: 'previous_display_value', label: 'Previous Display Value', type: 'string', type_label: 'String', order: 4 }, { name: 'current_display_value', label: 'Current Display Value', type: 'string', type_label: 'String', order: 5 }] },
    { name: 'table_name', label: 'Table Name', type: 'table_name', type_label: 'Table Name', mandatory: false, order: 101, maxsize: 200, internal_link: 'table', attributes: 'test_input_hidden=true,' },
    { name: 'run_start_time', label: 'Run Start Time UTC', type: 'glide_date_time', type_label: 'Date/Time', mandatory: false, order: 110, maxsize: 200, attributes: 'test_input_hidden=true,' },
    { name: 'run_start_date_time', label: 'Run Start Date/Time', type: 'glide_date_time', type_label: 'Date/Time', mandatory: false, order: 110, maxsize: 200, attributes: 'test_input_hidden=true,' }
  ];
}

async function buildTriggerInputsForInsert(
  client: any,
  trigDefId: string,
  trigType: string,
  userTable?: string,
  userCondition?: string
): Promise<{ inputs: any[]; outputs: any[]; source: string; error?: string }> {
  var apiInputs: any[] = [];
  var apiOutputs: any[] = [];
  var fetchError = '';
  var source = '';

  // Strategy 1: triggerpicker API (primary — same as Flow Designer UI)
  try {
    var tpResp = await client.get('/api/now/hub/triggerpicker/' + trigDefId, {
      params: { sysparm_transaction_scope: 'global' },
      headers: { Accept: 'application/json' }
    });
    var tpRaw = tpResp.data;
    var tpData = tpRaw?.result || tpRaw;

    // Handle JSON object response
    if (tpData && typeof tpData === 'object' && !Array.isArray(tpData)) {
      // Try common field name variations
      var foundInputs = Array.isArray(tpData.inputs) ? tpData.inputs
        : Array.isArray(tpData.trigger_inputs) ? tpData.trigger_inputs
        : Array.isArray(tpData.input) ? tpData.input : null;
      var foundOutputs = Array.isArray(tpData.outputs) ? tpData.outputs
        : Array.isArray(tpData.trigger_outputs) ? tpData.trigger_outputs
        : Array.isArray(tpData.output) ? tpData.output : null;
      if (foundInputs) { apiInputs = foundInputs; source = 'triggerpicker_json'; }
      if (foundOutputs) apiOutputs = foundOutputs;

      // If no arrays found, try to explore nested structure
      if (!foundInputs && !foundOutputs) {
        for (var key of Object.keys(tpData)) {
          var val = tpData[key];
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            if (Array.isArray(val.inputs)) { apiInputs = val.inputs; source = 'triggerpicker_json.' + key; }
            if (Array.isArray(val.outputs)) apiOutputs = val.outputs;
          }
        }
      }
    }

    // Handle XML string response
    if (apiInputs.length === 0 && typeof tpData === 'string' && tpData.includes('<')) {
      var xmlResult = parseTriggerpickerXml(tpData);
      if (xmlResult.inputs.length > 0) {
        apiInputs = xmlResult.inputs;
        apiOutputs = xmlResult.outputs;
        source = 'triggerpicker_xml';
      }
    }
    // Also check if the raw response itself is XML (not wrapped in result)
    if (apiInputs.length === 0 && typeof tpRaw === 'string' && tpRaw.includes('<')) {
      var xmlResult2 = parseTriggerpickerXml(tpRaw);
      if (xmlResult2.inputs.length > 0) {
        apiInputs = xmlResult2.inputs;
        apiOutputs = xmlResult2.outputs;
        source = 'triggerpicker_xml_raw';
      }
    }
  } catch (tpErr: any) {
    fetchError = 'triggerpicker: ' + (tpErr.message || 'unknown');
  }

  // Strategy 2: Table API fallback (query sys_hub_trigger_input / sys_hub_trigger_output)
  if (apiInputs.length === 0) {
    try {
      var tiResp = await client.get('/api/now/table/sys_hub_trigger_input', {
        params: {
          sysparm_query: 'model=' + trigDefId,
          sysparm_fields: 'sys_id,element,label,internal_type,mandatory,default_value,order,max_length,hint,read_only,attributes,reference,reference_display,choice,dependent_on_field,use_dependent_field',
          sysparm_display_value: 'false',
          sysparm_limit: 50
        }
      });
      var tableInputs = tiResp.data.result || [];
      if (tableInputs.length > 0) {
        apiInputs = tableInputs.map(function (rec: any) {
          return {
            id: str(rec.sys_id), name: str(rec.element), label: str(rec.label) || str(rec.element),
            type: str(rec.internal_type) || 'string',
            type_label: TYPE_LABELS[str(rec.internal_type) || 'string'] || str(rec.internal_type),
            mandatory: str(rec.mandatory) === 'true',
            order: parseInt(str(rec.order) || '0', 10),
            maxsize: parseInt(str(rec.max_length) || '4000', 10),
            hint: str(rec.hint), defaultValue: str(rec.default_value),
            reference: str(rec.reference), reference_display: str(rec.reference_display),
            use_dependent: str(rec.use_dependent_field) === 'true',
            dependent_on: str(rec.dependent_on_field),
            attributes: str(rec.attributes)
          };
        });
        source = 'table_api';
        fetchError = '';
      }
    } catch (tiErr: any) {
      fetchError += '; table_api_inputs: ' + (tiErr.message || 'unknown');
    }
  }
  if (apiOutputs.length === 0) {
    try {
      var toResp = await client.get('/api/now/table/sys_hub_trigger_output', {
        params: {
          sysparm_query: 'model=' + trigDefId,
          sysparm_fields: 'sys_id,element,label,internal_type,mandatory,order,max_length,hint,attributes,reference,reference_display,use_dependent_field,dependent_on_field',
          sysparm_display_value: 'false',
          sysparm_limit: 50
        }
      });
      var tableOutputs = toResp.data.result || [];
      if (tableOutputs.length > 0) {
        apiOutputs = tableOutputs.map(function (rec: any) {
          return {
            id: str(rec.sys_id), name: str(rec.element), label: str(rec.label) || str(rec.element),
            type: str(rec.internal_type) || 'string',
            type_label: TYPE_LABELS[str(rec.internal_type) || 'string'] || str(rec.internal_type),
            mandatory: str(rec.mandatory) === 'true',
            order: parseInt(str(rec.order) || '0', 10),
            maxsize: parseInt(str(rec.max_length) || '200', 10),
            hint: str(rec.hint), reference: str(rec.reference), reference_display: str(rec.reference_display),
            use_dependent: str(rec.use_dependent_field) === 'true',
            dependent_on: str(rec.dependent_on_field),
            attributes: str(rec.attributes)
          };
        });
      }
    } catch (_) {}
  }

  // Strategy 3: Hardcoded fallback for record-based triggers (ultimate safety net)
  // Uses exact definitions captured from the Flow Designer UI
  var isRecordTrigger = /record/.test(trigType.toLowerCase());
  if (apiInputs.length === 0 && isRecordTrigger) {
    apiInputs = getRecordTriggerFallbackInputs();
    source = 'hardcoded_fallback';
  }
  if (apiOutputs.length === 0 && isRecordTrigger) {
    apiOutputs = getRecordTriggerFallbackOutputs();
  }

  // Transform to GraphQL mutation format
  var inputs = apiInputs.map(function (inp: any) { return buildTriggerInputObj(inp, userTable, userCondition); });
  var outputs = apiOutputs.map(function (out: any) { return buildTriggerOutputObj(out); });

  // Final safety net: ensure table and condition inputs are ALWAYS present for record triggers
  if (isRecordTrigger) {
    var hasTable = inputs.some(function (i: any) { return i.name === 'table'; });
    var hasCondition = inputs.some(function (i: any) { return i.name === 'condition'; });
    if (!hasTable) {
      inputs.unshift(buildTriggerInputObj(
        { name: 'table', label: 'Table', type: 'table_name', type_label: 'Table Name', mandatory: true, order: 1, maxsize: 80, attributes: 'filter_table_source=RECORD_WATCHER_RESTRICTED,' },
        userTable, userCondition
      ));
      source += '+table_injected';
    }
    if (!hasCondition) {
      var condIdx = inputs.findIndex(function (i: any) { return i.name === 'table'; });
      inputs.splice(condIdx + 1, 0, buildTriggerInputObj(
        { name: 'condition', label: 'Condition', type: 'conditions', type_label: 'Conditions', mandatory: false, order: 100, maxsize: 4000, use_dependent: true, dependent_on: 'table', attributes: 'extended_operators=VALCHANGES;CHANGESFROM;CHANGESTO,wants_to_add_conditions=true,modelDependent=trigger_inputs,' },
        userTable, userCondition
      ));
      source += '+condition_injected';
    }
  }

  return { inputs, outputs, source: source || 'none', error: fetchError || undefined };
}

async function addTriggerViaGraphQL(
  client: any,
  flowId: string,
  triggerType: string,
  table?: string,
  condition?: string
): Promise<{ success: boolean; triggerId?: string; steps?: any; error?: string }> {
  const steps: any = {};

  // Dynamically look up trigger definition in sys_hub_trigger_definition
  let trigDefId: string | null = null;
  let trigName = '';
  let trigType = triggerType;
  let trigCategory = '';

  // Build search variations: record_updated → also try record_update, and vice versa
  const variations = [triggerType];
  if (triggerType.endsWith('ed')) variations.push(triggerType.slice(0, -1), triggerType.slice(0, -2));
  else if (triggerType.endsWith('e')) variations.push(triggerType + 'd');
  else variations.push(triggerType + 'ed', triggerType + 'd');

  const assignFound = (found: any, matched: string) => {
    trigDefId = found.sys_id;
    trigName = str(found.name) || triggerType;
    trigType = str(found.type) || triggerType;
    trigCategory = str(found.category);
    steps.def_lookup = { id: found.sys_id, type: str(found.type), name: str(found.name), category: str(found.category), matched };
  };

  // Try exact match on type and name for each variation
  for (const variant of variations) {
    if (trigDefId) break;
    for (const field of ['type', 'name']) {
      if (trigDefId) break;
      try {
        const resp = await client.get('/api/now/table/sys_hub_trigger_definition', {
          params: {
            sysparm_query: field + '=' + variant,
            sysparm_fields: 'sys_id,type,name,category',
            sysparm_display_value: 'true',
            sysparm_limit: 1
          }
        });
        const found = resp.data.result?.[0];
        if (found?.sys_id) assignFound(found, field + '=' + variant);
      } catch (_) {}
    }
  }
  // Fallback: LIKE search using shortest variation (most likely to match)
  if (!trigDefId) {
    const shortest = variations.reduce((a, b) => a.length <= b.length ? a : b);
    try {
      const resp = await client.get('/api/now/table/sys_hub_trigger_definition', {
        params: {
          sysparm_query: 'typeLIKE' + shortest + '^ORnameLIKE' + shortest,
          sysparm_fields: 'sys_id,type,name,category',
          sysparm_display_value: 'true',
          sysparm_limit: 5
        }
      });
      const results = resp.data.result || [];
      steps.def_lookup_fallback_candidates = results.map((r: any) => ({ sys_id: r.sys_id, type: r.type, name: r.name, category: r.category }));
      if (results[0]?.sys_id) assignFound(results[0], 'LIKE ' + shortest);
    } catch (_) {}
  }
  if (!trigDefId) return { success: false, error: 'Trigger definition not found for: ' + triggerType, steps };

  // Build full trigger inputs and outputs from triggerpicker API (matching UI format)
  // Pass empty table/condition — values are set via separate UPDATE (two-step, matching UI)
  var triggerData = await buildTriggerInputsForInsert(client, trigDefId!, trigType, undefined, undefined);
  steps.trigger_data = { inputCount: triggerData.inputs.length, outputCount: triggerData.outputs.length, source: triggerData.source, error: triggerData.error };

  const triggerResponseFields = 'triggerInstances { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }';
  try {
    // Step 1: INSERT with empty table/condition values (matching UI behavior from trigger-query.txt)
    // The UI always inserts the trigger with empty inputs first, then updates with actual values.
    var insertInputs = triggerData.inputs.map(function (inp: any) {
      if (inp.name === 'table' || inp.name === 'condition') {
        return { ...inp, value: { value: '' }, displayValue: { value: '' } };
      }
      return inp;
    });

    const insertResult = await executeFlowPatchMutation(client, {
      flowId: flowId,
      triggerInstances: {
        insert: [{
          flowSysId: flowId,
          name: trigName,
          triggerType: trigCategory,
          triggerDefinitionId: trigDefId,
          type: trigType,
          hasDynamicOutputs: false,
          metadata: '{"predicates":[]}',
          inputs: insertInputs,
          outputs: triggerData.outputs
        }]
      }
    }, triggerResponseFields);

    const triggerId = insertResult?.triggerInstances?.inserts?.[0]?.sysId;
    const triggerUiId = insertResult?.triggerInstances?.inserts?.[0]?.uiUniqueIdentifier;
    steps.insert = { success: !!triggerId, triggerId, triggerUiId };
    if (!triggerId) return { success: false, steps, error: 'GraphQL trigger INSERT returned no trigger ID' };

    // Step 2: UPDATE with actual table and condition values (matching UI behavior)
    // The UI sends: table with displayField+displayValue+value, condition with displayField+displayValue(empty)+value, metadata with predicates
    if (table) {
      try {
        var tableDisplayName = '';
        try {
          var tblResp = await client.get('/api/now/table/sys_db_object', {
            params: { sysparm_query: 'name=' + table, sysparm_fields: 'label', sysparm_display_value: 'true', sysparm_limit: 1 }
          });
          tableDisplayName = str(tblResp.data.result?.[0]?.label) || '';
        } catch (_) {}
        if (!tableDisplayName) {
          tableDisplayName = table.charAt(0).toUpperCase() + table.slice(1).replace(/_/g, ' ');
        }

        // Build condition predicates via query_parse API (same as UI)
        var conditionValue = condition || '^EQ';
        var predicatesJson = '[]';
        if (conditionValue && conditionValue !== '^EQ') {
          try {
            var qpResp = await client.get('/api/now/ui/query_parse/' + table + '/map', {
              params: { table: table, sysparm_query: conditionValue }
            });
            var qpResult = qpResp.data?.result;
            if (qpResult) {
              predicatesJson = typeof qpResult === 'string' ? qpResult : JSON.stringify(qpResult);
            }
          } catch (_) {
            // Fallback: build minimal predicates from parsed condition
            var parsedClauses = parseEncodedQuery(conditionValue);
            if (parsedClauses.length > 0) {
              var minPredicates = parsedClauses.map(function (c) {
                return { field: c.field, operator: c.operator, value: c.value };
              });
              predicatesJson = JSON.stringify(minPredicates);
            }
          }
        }

        var trigUpdateInputs: any[] = [
          {
            name: 'table',
            displayField: 'number',
            displayValue: { schemaless: false, schemalessValue: '', value: tableDisplayName },
            value: { schemaless: false, schemalessValue: '', value: table }
          },
          {
            name: 'condition',
            displayField: '',
            displayValue: { value: '' },
            value: { schemaless: false, schemalessValue: '', value: conditionValue }
          }
        ];

        await executeFlowPatchMutation(client, {
          flowId: flowId,
          triggerInstances: {
            update: [{
              id: triggerId,
              inputs: trigUpdateInputs,
              metadata: '{"predicates":' + predicatesJson + '}'
            }]
          }
        }, triggerResponseFields);
        steps.trigger_update = { success: true, table: table, tableDisplay: tableDisplayName, predicates: predicatesJson };
      } catch (updateErr: any) {
        steps.trigger_update = { success: false, error: updateErr.message };
        // Trigger was created — update failure is non-fatal
      }
    }

    return { success: true, triggerId, steps };
  } catch (e: any) {
    steps.insert = { success: false, error: e.message };
    return { success: false, steps, error: 'GraphQL trigger INSERT failed: ' + e.message };
  }
}

// Common short-name aliases for action types — maps user-friendly names to ServiceNow internal names
const ACTION_TYPE_ALIASES: Record<string, string[]> = {
  script: ['script_step', 'run_script', 'Run Script'],
  log: ['log_message', 'Log Message', 'Log'],
  create_record: ['Create Record'],
  update_record: ['Update Record'],
  notification: ['send_notification', 'send_email', 'Send Notification', 'Send Email'],
  field_update: ['set_field_values', 'Set Field Values'],
  wait: ['wait_for', 'Wait For Duration', 'Wait'],
  approval: ['ask_for_approval', 'create_approval', 'Ask for Approval'],
};

async function addActionViaGraphQL(
  client: any,
  flowId: string,
  actionType: string,
  actionName: string,
  inputs?: Record<string, string>,
  parentUiId?: string,
  order?: number,
  spoke?: string
): Promise<{ success: boolean; actionId?: string; steps?: any; error?: string }> {
  const steps: any = {};

  // Dynamically look up action definition in sys_hub_action_type_snapshot and sys_hub_action_type_definition
  // Prefer global/core actions over spoke-specific ones (e.g. core "Update Record" vs spoke-specific "Update Record")
  const snapshotFields = 'sys_id,internal_name,name,sys_scope,sys_package';
  let actionDefId: string | null = null;

  // Helper: pick the best match from candidates — prefer spoke filter, then global scope
  const pickBest = (candidates: any[]): any => {
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    // If spoke filter is specified, match against scope or package name
    if (spoke) {
      var spokeLC = spoke.toLowerCase();
      var spokeMatch = candidates.find((c: any) =>
        str(c.sys_scope).toLowerCase().includes(spokeLC) ||
        str(c.sys_package).toLowerCase().includes(spokeLC) ||
        str(c.internal_name).toLowerCase().includes(spokeLC)
      );
      if (spokeMatch) return spokeMatch;
    }
    // Prefer global scope
    var global = candidates.find((c: any) => str(c.sys_scope) === 'global' || str(c.sys_scope) === 'rhino.global');
    if (global) return global;
    // Prefer records without "spoke" in the package name
    var nonSpoke = candidates.find((c: any) => !str(c.sys_package).toLowerCase().includes('spoke'));
    if (nonSpoke) return nonSpoke;
    return candidates[0];
  };

  // Helper: search a table for action definitions by exact match and LIKE
  const searchTable = async (tableName: string, searchTerms: string[]): Promise<void> => {
    for (var si = 0; si < searchTerms.length && !actionDefId; si++) {
      var term = searchTerms[si];
      // Exact match on internal_name and name
      for (const field of ['internal_name', 'name']) {
        if (actionDefId) break;
        try {
          const resp = await client.get('/api/now/table/' + tableName, {
            params: { sysparm_query: field + '=' + term, sysparm_fields: snapshotFields, sysparm_limit: 10 }
          });
          const results = resp.data.result || [];
          if (results.length > 1) {
            steps.def_lookup_candidates = results.map((r: any) => ({ sys_id: r.sys_id, internal_name: str(r.internal_name), name: str(r.name), scope: str(r.sys_scope), package: str(r.sys_package) }));
          }
          const found = pickBest(results);
          if (found?.sys_id) {
            actionDefId = found.sys_id;
            steps.def_lookup = { id: found.sys_id, internal_name: str(found.internal_name), name: str(found.name), scope: str(found.sys_scope), package: str(found.sys_package), matched: tableName + ':' + field + '=' + term };
          }
        } catch (_) {}
      }
      // LIKE search
      if (!actionDefId) {
        try {
          const resp = await client.get('/api/now/table/' + tableName, {
            params: {
              sysparm_query: 'internal_nameLIKE' + term + '^ORnameLIKE' + term,
              sysparm_fields: snapshotFields, sysparm_limit: 10
            }
          });
          const results = resp.data.result || [];
          if (results.length > 0 && !steps.def_lookup_fallback_candidates) {
            steps.def_lookup_fallback_candidates = results.map((r: any) => ({ sys_id: r.sys_id, internal_name: str(r.internal_name), name: str(r.name), scope: str(r.sys_scope), package: str(r.sys_package) }));
          }
          const found = pickBest(results);
          if (found?.sys_id) {
            actionDefId = found.sys_id;
            steps.def_lookup = { id: found.sys_id, internal_name: str(found.internal_name), name: str(found.name), scope: str(found.sys_scope), package: str(found.sys_package), matched: tableName + ':LIKE ' + term };
          }
        } catch (_) {}
      }
    }
  };

  // Build search terms: original actionType + any alias variations
  var searchTerms = [actionType];
  var aliases = ACTION_TYPE_ALIASES[actionType.toLowerCase()];
  if (aliases) searchTerms = searchTerms.concat(aliases);

  // Search 1: sys_hub_action_type_snapshot (published action snapshots)
  await searchTable('sys_hub_action_type_snapshot', searchTerms);

  // Search 2: sys_hub_action_type_definition (action definitions — includes built-in/native actions)
  if (!actionDefId) {
    steps.snapshot_not_found = true;
    await searchTable('sys_hub_action_type_definition', searchTerms);
  }

  if (!actionDefId) return { success: false, error: 'Action definition not found for: ' + actionType + ' (searched snapshot + definition tables with terms: ' + searchTerms.join(', ') + ')', steps };

  // Build full input objects with parameter definitions (matching UI format)
  const inputResult = await buildActionInputsForInsert(client, actionDefId, inputs);
  steps.available_inputs = inputResult.actionParams.map((p: any) => ({ element: p.element, label: p.label }));
  steps.resolved_inputs = inputResult.resolvedInputs;

  // Validate mandatory fields
  if (inputResult.missingMandatory && inputResult.missingMandatory.length > 0) {
    steps.missing_mandatory = inputResult.missingMandatory;
    return { success: false, error: 'Missing required inputs for ' + actionType + ': ' + inputResult.missingMandatory.join(', ') + '. These fields are mandatory in Flow Designer.', steps };
  }

  // Calculate insertion order
  const resolvedOrder = await calculateInsertOrder(client, flowId, parentUiId, order);
  steps.insert_order = resolvedOrder;

  const uuid = generateUUID();

  // ── Data pill transformation for record actions (Update/Create Record) ──
  // These actions need: record → data pill, table_name → displayValue, field values → packed into values string
  var recordActionResult = await transformActionInputsForRecordAction(
    client, flowId, inputResult.inputs, inputResult.resolvedInputs,
    inputResult.actionParams, uuid
  );
  steps.record_action = recordActionResult.steps;
  var hasRecordPills = (recordActionResult.labelCacheUpdates.length + recordActionResult.labelCacheInserts.length) > 0;

  // For record actions: clear data pill values from INSERT — they'll be set via separate UPDATE
  // (Flow Designer's GraphQL API ignores labelCache during INSERT, it only works with UPDATE)
  var insertInputs = recordActionResult.inputs;
  if (hasRecordPills) {
    // Clone inputs and clear data pill values for INSERT
    insertInputs = recordActionResult.inputs.map(function (inp: any) {
      if (inp.name === 'record' && inp.value?.value?.startsWith('{{')) {
        return { ...inp, value: { schemaless: false, schemalessValue: '', value: '' } };
      }
      if (inp.name === 'values' && inp.value?.value?.includes('{{')) {
        return { ...inp, value: { schemaless: false, schemalessValue: '', value: '' } };
      }
      return inp;
    });
    steps.record_action_strategy = 'two_step';
  }

  const actionResponseFields = 'actions { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' +
    ' flowLogics { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' +
    ' subflows { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }';

  // Build mutation payload — INSERT with inputs (data pill values cleared for record actions)
  const flowPatch: any = {
    flowId: flowId,
    actions: {
      insert: [{
        actionTypeSysId: actionDefId,
        metadata: '{"predicates":[]}',
        flowSysId: flowId,
        generationSource: '',
        order: String(resolvedOrder),
        parent: parentUiId || '',
        uiUniqueIdentifier: uuid,
        type: 'action',
        parentUiId: parentUiId || '',
        inputs: insertInputs
      }]
    }
  };

  // Add parent flow logic update signal (tells GraphQL the parent was modified)
  if (parentUiId) {
    flowPatch.flowLogics = { update: [{ uiUniqueIdentifier: parentUiId, type: 'flowlogic' }] };
  }

  try {
    // Step 1: INSERT the action element
    const result = await executeFlowPatchMutation(client, flowPatch, actionResponseFields);
    const actionId = result?.actions?.inserts?.[0]?.sysId;
    steps.insert = { success: !!actionId, actionId, uuid };
    if (!actionId) return { success: false, steps, error: 'GraphQL action INSERT returned no ID' };

    // Step 2: UPDATE with data pill values + labelCache (separate mutation, matching UI behavior)
    // The Flow Designer UI uses labelCache UPDATE for existing pills (record-level)
    // and labelCache INSERT for new pills (field-level in values).
    if (hasRecordPills) {
      var updateInputs: any[] = [];
      // Collect inputs for the UPDATE mutation
      for (var ri = 0; ri < recordActionResult.inputs.length; ri++) {
        var inp = recordActionResult.inputs[ri];
        var val = inp.value?.value || '';
        if (inp.name === 'record' && val.startsWith('{{')) {
          // UI only sends `value` for the record pill (no displayValue)
          updateInputs.push({
            name: 'record',
            value: { schemaless: false, schemalessValue: '', value: val }
          });
        } else if (inp.name === 'table_name') {
          // displayValue must use full schemaless format: {schemaless, schemalessValue, value}
          updateInputs.push({
            name: 'table_name',
            displayValue: inp.displayValue || { schemaless: false, schemalessValue: '', value: '' },
            value: inp.value || { schemaless: false, schemalessValue: '', value: '' }
          });
        } else if (inp.name === 'values') {
          // UI sends {name: "values"} without value property when empty, with value when set
          if (val) {
            updateInputs.push({ name: 'values', value: { schemaless: false, schemalessValue: '', value: val } });
          } else {
            updateInputs.push({ name: 'values' });
          }
        }
      }

      if (updateInputs.length > 0) {
        try {
          var updatePatch: any = {
            flowId: flowId,
            labelCache: {} as any,
            actions: {
              update: [{
                uiUniqueIdentifier: uuid,
                type: 'action',
                inputs: updateInputs
              }]
            }
          };
          // All pills → labelCache INSERT (trigger created by our code, entries may not exist yet)
          if (recordActionResult.labelCacheInserts.length > 0) {
            updatePatch.labelCache.insert = recordActionResult.labelCacheInserts;
          }
          // Log the exact GraphQL mutation for debugging
          steps.record_update_mutation = jsToGraphQL(updatePatch);
          var actionUpdateResult = await executeFlowPatchMutation(client, updatePatch, actionResponseFields);
          steps.record_update = { success: true, inputCount: updateInputs.length, response: actionUpdateResult };
        } catch (ue: any) {
          steps.record_update = { success: false, error: ue.message };
          // Action was created — update failure is non-fatal
        }
      }
    }

    return { success: true, actionId: actionId || undefined, steps };
  } catch (e: any) {
    steps.insert = { success: false, error: e.message };
    return { success: false, steps, error: 'GraphQL action INSERT failed: ' + e.message };
  }
}

// ── DATA PILL CONDITION HELPERS ────────────────────────────────────────

/**
 * Get trigger info from a flow for constructing data pill references.
 * Reads the flow version payload to find the trigger name, table, and outputs.
 *
 * Returns the data pill base (e.g., "Created or Updated_1") and table (e.g., "incident").
 * The data pill base is used as: {{dataPillBase.fieldName}} in condition values.
 */
async function getFlowTriggerInfo(
  client: any,
  flowId: string
): Promise<{ dataPillBase: string; triggerName: string; table: string; tableLabel: string; tableRef: string; error?: string; debug?: any }> {
  var triggerName = '';
  var table = '';
  var tableLabel = '';
  var debug: any = {};

  // PRIMARY: Read flow via ProcessFlow REST API (same endpoint as Flow Designer UI)
  // This API returns XML (not JSON). We parse trigger info from the XML string.
  try {
    debug.processflow_api = 'attempting';
    // Note: do NOT pass custom headers in config — some Axios interceptors freeze the config
    // object, causing "Attempted to assign to readonly property" errors.
    var pfResp = await client.get('/api/now/processflow/flow/' + flowId);
    var pfRaw = pfResp.data;
    debug.processflow_api = 'success';
    debug.processflow_type = typeof pfRaw;

    if (typeof pfRaw === 'string' && pfRaw.indexOf('<triggerInstances>') >= 0) {
      // Response is XML — parse trigger info with regex
      debug.processflow_format = 'xml';

      // Extract the triggerInstances block
      var trigBlockMatch = pfRaw.match(/<triggerInstances>([\s\S]*?)<\/triggerInstances>/);
      if (trigBlockMatch) {
        var trigBlock = trigBlockMatch[1];

        // Trigger name: <name>X</name> that appears near <triggerType> at end of block
        // Structure: ...<name>Created or Updated</name><comment/>...<triggerType>Record</triggerType>
        var trigNameMatch = trigBlock.match(/<name>([^<]+)<\/name>[\s\S]{0,300}<triggerType>/);
        if (trigNameMatch) {
          triggerName = trigNameMatch[1];
          debug.processflow_trigger_name = triggerName;
        }

        // Table: find <name>table</name> ... <value>X</value> inside trigger inputs
        var tableMatch = trigBlock.match(/<name>table<\/name>[\s\S]*?<value>([^<]+)<\/value>/);
        if (tableMatch) {
          table = tableMatch[1];
          debug.processflow_table = table;
        }
      }
    } else if (pfRaw && typeof pfRaw === 'object') {
      // Response is JSON — traverse object structure
      debug.processflow_format = 'json';
      var pfData = pfRaw.result || pfRaw;
      debug.processflow_keys = pfData && typeof pfData === 'object' ? Object.keys(pfData).slice(0, 20) : null;

      // ProcessFlow API wraps actual flow data inside a "data" property
      // e.g. {data: {triggerInstances: [...]}, errorMessage, errorCode, integrationsPluginActive}
      if (pfData.data && typeof pfData.data === 'object' && !pfData.triggerInstances) {
        pfData = pfData.data;
        debug.processflow_unwrapped = true;
        debug.processflow_data_keys = typeof pfData === 'object' ? Object.keys(pfData).slice(0, 20) : null;
      }

      var pfTriggers = pfData?.triggerInstances || pfData?.trigger_instances || pfData?.triggers || [];
      if (!Array.isArray(pfTriggers) && pfData?.model?.triggerInstances) {
        pfTriggers = pfData.model.triggerInstances;
      }
      if (!Array.isArray(pfTriggers) && pfData?.definition?.triggerInstances) {
        pfTriggers = pfData.definition.triggerInstances;
      }

      if (Array.isArray(pfTriggers) && pfTriggers.length > 0) {
        var pfTrig = pfTriggers[0];
        triggerName = pfTrig.name || pfTrig.triggerName || '';
        if (pfTrig.inputs && Array.isArray(pfTrig.inputs)) {
          for (var pfi = 0; pfi < pfTrig.inputs.length; pfi++) {
            if (pfTrig.inputs[pfi].name === 'table') {
              table = pfTrig.inputs[pfi].value?.value || str(pfTrig.inputs[pfi].value) || '';
              break;
            }
          }
        }
      }
    }
  } catch (pfErr: any) {
    debug.processflow_api = 'error: ' + pfErr.message;
  }

  // Fallback 1: Read version payload (legacy approach)
  if (!triggerName || !table) {
    debug.version_fallback = 'attempting';
    try {
      var resp = await client.get('/api/now/table/sys_hub_flow_version', {
        params: {
          sysparm_query: 'flow=' + flowId + '^ORDERBYDESCsys_created_on',
          sysparm_fields: 'sys_id,payload',
          sysparm_limit: 1
        }
      });
      var payload = resp.data.result?.[0]?.payload;
      if (payload) {
        var parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        debug.version_payload_keys = Object.keys(parsed);
        var trigInst = parsed.triggerInstances || parsed.trigger_instances || [];
        debug.version_trigger_count = Array.isArray(trigInst) ? trigInst.length : typeof trigInst;
        if (Array.isArray(trigInst) && trigInst.length > 0) {
          var t0 = trigInst[0];
          debug.version_trigger_keys = Object.keys(t0);
          debug.version_trigger_name_field = t0.name || t0.triggerName || t0.triggerDefinitionName || '';
          if (!triggerName) triggerName = t0.name || t0.triggerName || t0.triggerDefinitionName || '';
          // Also try getting the trigger definition name (e.g. "Created or Updated")
          if (!triggerName && t0.triggerDefinition) {
            triggerName = t0.triggerDefinition.name || '';
          }
          if (!table && t0.inputs) {
            var t0Inputs = Array.isArray(t0.inputs) ? t0.inputs : [];
            for (var vi = 0; vi < t0Inputs.length; vi++) {
              if (t0Inputs[vi].name === 'table') {
                table = t0Inputs[vi].value?.value || str(t0Inputs[vi].value) || '';
                debug.version_table_input = t0Inputs[vi];
                break;
              }
            }
          }
          // Fallback: try reading table directly from trigger object
          if (!table && t0.table) table = str(t0.table);
        }
      }
    } catch (_) {}
  }

  // Fallback 2: query sys_hub_flow for table + trigger definition for name
  if (!triggerName || !table) {
    debug.flow_record_fallback = 'attempting';
    try {
      var flowResp = await client.get('/api/now/table/sys_hub_flow', {
        params: { sysparm_query: 'sys_id=' + flowId, sysparm_fields: 'sys_id,name,table,trigger_type', sysparm_limit: 1 }
      });
      var flowRec = flowResp.data.result?.[0];
      debug.flow_record = { table: str(flowRec?.table), trigger_type: str(flowRec?.trigger_type) };
      if (!table && flowRec?.table) table = str(flowRec.table);
      var trigTypeId = str(flowRec?.trigger_type);
      if (!triggerName && trigTypeId) {
        try {
          var trigDefResp = await client.get('/api/now/table/sys_hub_trigger_definition', {
            params: { sysparm_query: 'sys_id=' + trigTypeId, sysparm_fields: 'name,type', sysparm_limit: 1 }
          });
          var trigDef = trigDefResp.data.result?.[0];
          if (trigDef?.name) triggerName = str(trigDef.name);
          debug.trigger_def = { name: str(trigDef?.name), type: str(trigDef?.type) };
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Look up table label for display in label cache
  if (table && !tableLabel) {
    try {
      var labelResp = await client.get('/api/now/table/sys_db_object', {
        params: {
          sysparm_query: 'name=' + table,
          sysparm_fields: 'label',
          sysparm_display_value: 'true',
          sysparm_limit: 1
        }
      });
      tableLabel = str(labelResp.data.result?.[0]?.label) || '';
    } catch (_) {}
    if (!tableLabel) {
      tableLabel = table.charAt(0).toUpperCase() + table.slice(1).replace(/_/g, ' ');
    }
  }

  if (!triggerName) {
    return { dataPillBase: '', triggerName: '', table: table, tableLabel: tableLabel, tableRef: table, error: 'Could not determine trigger name from flow version payload or GraphQL', debug };
  }

  var dataPillBase = triggerName + '_1.current';
  return { dataPillBase, triggerName, table, tableLabel, tableRef: table, debug };
}

/**
 * Parse a ServiceNow encoded query into individual condition clauses.
 * Each clause has: prefix (^ or ^OR), field, operator, value.
 *
 * Example: "category=inquiry^priority!=1^ORshort_descriptionLIKEtest"
 * → [
 *     { prefix: '', field: 'category', operator: '=', value: 'inquiry' },
 *     { prefix: '^', field: 'priority', operator: '!=', value: '1' },
 *     { prefix: '^OR', field: 'short_description', operator: 'LIKE', value: 'test' }
 *   ]
 */
function parseEncodedQuery(query: string): { prefix: string; field: string; operator: string; value: string }[] {
  if (!query || query === '^EQ') return [];

  // Remove trailing ^EQ
  var q = query.replace(/\^EQ$/, '');
  if (!q) return [];

  // Split on ^OR and ^ while keeping the separators
  var clauses: { prefix: string; raw: string }[] = [];
  var parts = q.split(/(\^OR|\^NQ|\^)/);
  var currentPrefix = '';

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part === '^' || part === '^OR' || part === '^NQ') {
      currentPrefix = part;
    } else if (part.length > 0) {
      clauses.push({ prefix: currentPrefix, raw: part });
      currentPrefix = '';
    }
  }

  // Operators sorted by length descending to match longest first
  var operators = [
    'VALCHANGES', 'CHANGESFROM', 'CHANGESTO',
    'ISNOTEMPTY', 'ISEMPTY', 'EMPTYSTRING', 'ANYTHING',
    'NOT LIKE', 'NOT IN', 'NSAMEAS',
    'STARTSWITH', 'ENDSWITH', 'BETWEEN', 'INSTANCEOF',
    'DYNAMIC', 'SAMEAS',
    'LIKE', 'IN',
    '!=', '>=', '<=', '>', '<', '='
  ];

  var result: { prefix: string; field: string; operator: string; value: string }[] = [];
  for (var j = 0; j < clauses.length; j++) {
    var clause = clauses[j];
    var raw = clause.raw;
    var matched = false;

    for (var k = 0; k < operators.length; k++) {
      var op = operators[k];
      var opIdx = raw.indexOf(op);
      if (opIdx > 0) {
        result.push({
          prefix: clause.prefix,
          field: raw.substring(0, opIdx),
          operator: op,
          value: raw.substring(opIdx + op.length)
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Unrecognized format — keep as-is
      result.push({ prefix: clause.prefix, field: raw, operator: '', value: '' });
    }
  }

  return result;
}

/**
 * Check if a condition value looks like a standard ServiceNow encoded query.
 * Standard encoded queries use: field_name=value^field_name2!=value2
 *
 * Returns false for JavaScript expressions, scripts, fd_data references, etc.
 * which should be passed through as-is without data pill transformation.
 */
function isStandardEncodedQuery(condition: string): boolean {
  if (!condition) return false;
  // Parentheses indicate function calls or grouping expressions
  if (/[()]/.test(condition)) return false;
  // Method calls like .toString(, .replace(, .match(
  if (/\.\w+\(/.test(condition)) return false;
  // Regex patterns like /[
  if (/\/\[/.test(condition)) return false;
  // JS equality operators == or ===
  if (/===?/.test(condition)) return false;
  // JS modulo, logical AND/OR
  if (/%/.test(condition)) return false;
  if (/&&|\|\|/.test(condition)) return false;
  // Flow Designer internal variable references
  if (condition.startsWith('fd_data.')) return false;
  // Already contains data pill references (already transformed)
  if (condition.includes('{{')) return false;
  return true;
}

/**
 * Transform an encoded query condition into Flow Designer data pill format.
 *
 * Uses FIELD-LEVEL data pills — each field reference in the encoded query gets
 * wrapped with the data pill base:
 *   "category=software" → "{{Created or Updated_1.current.category}}=software"
 *   "category=software^priority=1" → "{{Created or Updated_1.current.category}}=software^{{Created or Updated_1.current.priority}}=1"
 *
 * The field-level pill tells Flow Designer exactly which field the condition applies to.
 */
function transformConditionToDataPills(conditionValue: string, dataPillBase: string): string {
  if (!conditionValue || !dataPillBase) return conditionValue;

  var clauses = parseEncodedQuery(conditionValue);
  if (clauses.length === 0) return conditionValue;

  var result = '';
  for (var i = 0; i < clauses.length; i++) {
    var clause = clauses[i];
    result += clause.prefix;
    result += '{{' + dataPillBase + '.' + clause.field + '}}';
    result += clause.operator;
    result += clause.value;
  }

  return result;
}

/**
 * Build labelCache INSERT entries for field-level data pills used in flow logic conditions.
 *
 * Returns an array of labelCache INSERT entries with full metadata, matching the UI's exact
 * mutation format (captured from Flow Designer network tab when editing a programmatic flow):
 *
 *   labelCache: { insert: [{
 *     name: "Created or Updated_1.current.category",
 *     label: "Trigger - Record Created or Updated➛Incident Record➛Category",
 *     reference: "", reference_display: "Category",
 *     type: "choice", base_type: "choice",
 *     parent_table_name: "incident", column_name: "category",
 *     usedInstances: [{uiUniqueIdentifier: "...", inputName: "condition"}],
 *     choices: {}
 *   }] }
 */
async function buildConditionLabelCache(
  client: any,
  conditionValue: string,
  dataPillBase: string,
  triggerName: string,
  table: string,
  tableLabel: string,
  logicUiId: string,
  explicitFields?: string[]
): Promise<any[]> {
  if (!dataPillBase) return [];

  // Collect unique field names — either from explicit list or by parsing encoded query
  if (!explicitFields) {
    var clauses = parseEncodedQuery(conditionValue);
    if (clauses.length === 0) return [];
    explicitFields = clauses.map(function (c) { return c.field; }).filter(function (f) { return !!f; });
  }
  if (explicitFields.length === 0) return [];

  // De-duplicate field names
  var uniqueFields: string[] = [];
  var seen: Record<string, boolean> = {};
  for (var i = 0; i < explicitFields.length; i++) {
    var field = explicitFields[i];
    if (field && !seen[field]) {
      seen[field] = true;
      uniqueFields.push(field);
    }
  }
  if (uniqueFields.length === 0) return [];

  // Batch-query sys_dictionary for field metadata (type, label, reference)
  var fieldMeta: Record<string, { type: string; label: string; reference: string }> = {};
  try {
    var dictResp = await client.get('/api/now/table/sys_dictionary', {
      params: {
        sysparm_query: 'name=' + table + '^elementIN' + uniqueFields.join(','),
        sysparm_fields: 'element,column_label,internal_type,reference',
        sysparm_display_value: 'false',
        sysparm_limit: uniqueFields.length + 5
      }
    });
    var dictResults = dictResp.data.result || [];
    for (var d = 0; d < dictResults.length; d++) {
      var rec = dictResults[d];
      var elName = str(rec.element);
      var intType = str(rec.internal_type?.value || rec.internal_type || 'string');
      var colLabel = str(rec.column_label);
      var refTable = str(rec.reference?.value || rec.reference || '');
      if (elName) fieldMeta[elName] = { type: intType, label: colLabel, reference: refTable };
    }
  } catch (_) {
    // Fallback: use "string" type and generated labels if dictionary lookup fails
  }

  // Build labelCache INSERT entries with full metadata for each field-level pill.
  // This matches the UI's mutation format when editing a programmatically-created flow.
  var inserts: any[] = [];

  for (var j = 0; j < uniqueFields.length; j++) {
    var f = uniqueFields[j];
    var pillName = dataPillBase + '.' + f;
    var meta = fieldMeta[f] || { type: 'string', label: f.replace(/_/g, ' ').replace(/\b\w/g, function (c: string) { return c.toUpperCase(); }), reference: '' };

    inserts.push({
      name: pillName,
      label: 'Trigger - Record ' + triggerName + '\u279b' + tableLabel + ' Record\u279b' + meta.label,
      reference: meta.reference,
      reference_display: meta.label,
      type: meta.type,
      base_type: meta.type,
      parent_table_name: table,
      column_name: f,
      usedInstances: [{ uiUniqueIdentifier: logicUiId, inputName: 'condition' }],
      choices: {}
    });
  }

  return inserts;
}

// ── DATA PILL SUPPORT FOR RECORD ACTIONS (Update/Create Record) ──────

/** Shorthands that users can pass for `record` to mean "the trigger's current record". */
const RECORD_PILL_SHORTHANDS = ['current', 'trigger.current', 'trigger_record', 'trigger record'];

/**
 * Post-process action inputs for record-modifying actions (Update Record, Create Record).
 *
 * These actions have 3 key inputs:
 * - `record`: reference to the record → needs data pill format {{TriggerName_1.current}}
 * - `table_name`: target table → needs displayValue (e.g. "Incident")
 * - `values`: packed field=value pairs → e.g. "priority=2^state=3"
 *
 * User-provided field-value pairs that don't match defined action parameters are
 * automatically packed into the `values` string.
 *
 * Returns the transformed inputs and labelCache entries.
 */
async function transformActionInputsForRecordAction(
  client: any,
  flowId: string,
  actionInputs: any[],
  resolvedInputs: Record<string, string>,
  actionParams: any[],
  uuid: string
): Promise<{ inputs: any[]; labelCacheUpdates: any[]; labelCacheInserts: any[]; steps: any }> {
  var steps: any = {};

  // Detect if this is a record action: must have both `record` and `table_name` parameters
  var definedParamNames = actionParams.map(function (p: any) { return str(p.element); });
  var hasRecord = definedParamNames.includes('record');
  var hasTableName = definedParamNames.includes('table_name');
  var hasValues = definedParamNames.includes('values');

  if (!hasRecord || !hasTableName) {
    steps.record_action = false;
    return { inputs: actionInputs, labelCacheUpdates: [], labelCacheInserts: [], steps };
  }
  steps.record_action = true;

  // Get trigger info for data pill construction
  var triggerInfo = await getFlowTriggerInfo(client, flowId);
  steps.trigger_info = {
    dataPillBase: triggerInfo.dataPillBase,
    triggerName: triggerInfo.triggerName,
    table: triggerInfo.table,
    tableLabel: triggerInfo.tableLabel,
    error: triggerInfo.error,
    debug: triggerInfo.debug
  };

  var dataPillBase = triggerInfo.dataPillBase; // e.g. "Created or Updated_1.current"
  var labelCacheEntries: any[] = [];
  var usedInstances: { uiUniqueIdentifier: string; inputName: string }[] = [];

  // ── 1. Transform `record` input to data pill ──────────────────────
  var recordInput = actionInputs.find(function (inp: any) { return inp.name === 'record'; });
  if (recordInput && dataPillBase) {
    var recordVal = recordInput.value?.value || '';
    var isShorthand = RECORD_PILL_SHORTHANDS.includes(recordVal.toLowerCase());
    var isAlreadyPill = recordVal.startsWith('{{');

    if (isShorthand || !recordVal) {
      // Auto-fill with trigger's current record data pill
      // UI only sends the pill in `value`; displayValue stays empty
      var pillRef = '{{' + dataPillBase + '}}';
      recordInput.value = { schemaless: false, schemalessValue: '', value: pillRef };
      recordInput.displayValue = { value: '' };
      usedInstances.push({ uiUniqueIdentifier: uuid, inputName: 'record' });
      steps.record_transform = { original: recordVal, pill: pillRef };
    } else if (isAlreadyPill) {
      // Check if the pill contains a shorthand that needs rewriting to the full dataPillBase
      var innerVal = recordVal.replace(/^\{\{/, '').replace(/\}\}$/, '').trim();
      if (RECORD_PILL_SHORTHANDS.includes(innerVal.toLowerCase())) {
        var pillRef2 = '{{' + dataPillBase + '}}';
        recordInput.value = { schemaless: false, schemalessValue: '', value: pillRef2 };
        steps.record_transform = { original: recordVal, pill: pillRef2 };
      }
      // UI keeps displayValue empty for pill references
      recordInput.displayValue = { value: '' };
      usedInstances.push({ uiUniqueIdentifier: uuid, inputName: 'record' });
    }
  }

  // ── 2. Transform `table_name` input with displayValue ─────────────
  var tableNameInput = actionInputs.find(function (inp: any) { return inp.name === 'table_name'; });
  if (tableNameInput) {
    var tableVal = tableNameInput.value?.value || '';
    // Also accept `table` as user key (maps to table_name)
    if (!tableVal && resolvedInputs['table']) {
      tableVal = resolvedInputs['table'];
    }
    // If still empty, use trigger's table
    if (!tableVal && triggerInfo.table) {
      tableVal = triggerInfo.table;
    }
    if (tableVal) {
      // Look up display name for the table
      var tableDisplayName = triggerInfo.tableLabel || '';
      if (tableVal !== triggerInfo.table || !tableDisplayName) {
        // Different table than trigger — look up its label
        try {
          var tblResp = await client.get('/api/now/table/sys_db_object', {
            params: { sysparm_query: 'name=' + tableVal, sysparm_fields: 'label', sysparm_display_value: 'true', sysparm_limit: 1 }
          });
          tableDisplayName = str(tblResp.data.result?.[0]?.label) || tableVal.charAt(0).toUpperCase() + tableVal.slice(1).replace(/_/g, ' ');
        } catch (_) {
          tableDisplayName = tableVal.charAt(0).toUpperCase() + tableVal.slice(1).replace(/_/g, ' ');
        }
      }
      tableNameInput.value = { schemaless: false, schemalessValue: '', value: tableVal };
      tableNameInput.displayValue = { schemaless: false, schemalessValue: '', value: tableDisplayName };
      steps.table_name_transform = { value: tableVal, displayValue: tableDisplayName };
    }
  }

  // ── 3. Pack non-parameter field values into `values` string ───────
  // Any user-provided key that is NOT a defined action parameter goes into the values string
  var valuesInput = actionInputs.find(function (inp: any) { return inp.name === 'values'; });
  if (valuesInput) {
    var fieldPairs: string[] = [];
    var existingValues = valuesInput.value?.value || '';

    // If user already passed a pre-built values string, use it
    if (existingValues && existingValues.includes('=')) {
      fieldPairs.push(existingValues);
    }

    // Find user-provided keys that are not defined action parameters
    for (var key of Object.keys(resolvedInputs)) {
      if (definedParamNames.includes(key)) continue;
      // Also skip table (alias for table_name) and record
      if (key === 'table' || key === 'record') continue;

      var val = resolvedInputs[key];

      // Check if value should be a data pill reference
      if (val && dataPillBase) {
        var valLower = val.toLowerCase();
        if (RECORD_PILL_SHORTHANDS.includes(valLower)) {
          // Shorthand → record-level data pill
          val = '{{' + dataPillBase + '}}';
          usedInstances.push({ uiUniqueIdentifier: uuid, inputName: key });
        } else if (valLower.startsWith('trigger.current.') || valLower.startsWith('current.')) {
          // Field-level data pill: "trigger.current.assigned_to" → {{dataPillBase.assigned_to}}
          var fieldName = valLower.startsWith('trigger.current.') ? val.substring(16) : val.substring(8);
          val = '{{' + dataPillBase + '.' + fieldName + '}}';
          usedInstances.push({ uiUniqueIdentifier: uuid, inputName: key });
        } else if (val.startsWith('{{')) {
          // Already a data pill
          usedInstances.push({ uiUniqueIdentifier: uuid, inputName: key });
        }
      }

      fieldPairs.push(key + '=' + val);
    }

    if (fieldPairs.length > 0) {
      var packedValues = fieldPairs.join('^');
      valuesInput.value = { schemaless: false, schemalessValue: '', value: packedValues };
      steps.values_transform = { packed: packedValues, fieldCount: fieldPairs.length };
    }
  }

  // ── 4. Build labelCache entries for data pills ────────────────────
  // Based on processflow XML analysis (labelCacheAsJsonString), the record-level pill
  // format is: { name, label, reference (table), reference_display (table label), type: "reference", base_type: "reference", attributes: {} }
  // Since our trigger is created via code (not UI), the labelCache entry may not exist yet.
  // We use INSERT for the record-level pill to ensure it exists.
  var labelCacheUpdates: any[] = [];
  var labelCacheInserts: any[] = [];

  if (dataPillBase && usedInstances.length > 0) {
    var tableRef = triggerInfo.tableRef || triggerInfo.table || '';
    var tblLabel = triggerInfo.tableLabel || '';

    // Record-level pill — INSERT with full metadata matching processflow XML format:
    // { name: "Created or Updated_1.current", type: "reference", reference: "incident", reference_display: "Incident", ... }
    labelCacheInserts.push({
      name: dataPillBase,
      label: 'Trigger - Record ' + triggerInfo.triggerName + '\u279b' + tblLabel + ' Record',
      reference: tableRef,
      reference_display: tblLabel,
      type: 'reference',
      base_type: 'reference',
      attributes: '',
      choices: {},
      usedInstances: usedInstances
    });

    // Field-level data pill entries for any field references in the `values` string → INSERT (new pills)
    var valuesStr = '';
    var valuesInp = actionInputs.find(function (inp: any) { return inp.name === 'values'; });
    if (valuesInp) valuesStr = valuesInp.value?.value || '';

    if (valuesStr && valuesStr.includes('{{')) {
      var pillRegex = /\{\{([^}]+)\}\}/g;
      var pillMatch;
      var seenPills: Record<string, boolean> = {};
      seenPills[dataPillBase] = true;

      while ((pillMatch = pillRegex.exec(valuesStr)) !== null) {
        var fullPillName = pillMatch[1];
        if (seenPills[fullPillName]) continue;
        seenPills[fullPillName] = true;

        var dotParts = fullPillName.split('.');
        var fieldCol = dotParts.length > 2 ? dotParts[dotParts.length - 1] : '';

        if (fieldCol) {
          var fMeta: { type: string; label: string } = { type: 'string', label: fieldCol.replace(/_/g, ' ').replace(/\b\w/g, function (c: string) { return c.toUpperCase(); }) };
          try {
            var dictResp = await client.get('/api/now/table/sys_dictionary', {
              params: {
                sysparm_query: 'name=' + tableRef + '^element=' + fieldCol,
                sysparm_fields: 'element,column_label,internal_type',
                sysparm_display_value: 'false',
                sysparm_limit: 1
              }
            });
            var dictRec = dictResp.data.result?.[0];
            if (dictRec) {
              fMeta.type = str(dictRec.internal_type?.value || dictRec.internal_type || 'string');
              fMeta.label = str(dictRec.column_label) || fMeta.label;
            }
          } catch (_) {}

          labelCacheInserts.push({
            name: fullPillName,
            label: 'Trigger - Record ' + triggerInfo.triggerName + '\u279b' + tblLabel + ' Record\u279b' + fMeta.label,
            reference: tableRef,
            reference_display: fMeta.label,
            type: fMeta.type,
            base_type: fMeta.type,
            parent_table_name: tableRef,
            column_name: fieldCol,
            attributes: '',
            usedInstances: [{ uiUniqueIdentifier: uuid, inputName: fieldCol }]
          });
        }
      }
    }

    steps.label_cache = {
      inserts: labelCacheInserts.map(function (e: any) { return e.name; }),
      usedInstances: usedInstances.length
    };
  }

  return { inputs: actionInputs, labelCacheUpdates, labelCacheInserts, steps };
}

// ── FLOW LOGIC (If/Else, For Each, etc.) ─────────────────────────────

async function addFlowLogicViaGraphQL(
  client: any,
  flowId: string,
  logicType: string,
  inputs?: Record<string, string>,
  order?: number,
  parentUiId?: string,
  connectedTo?: string
): Promise<{ success: boolean; logicId?: string; uiUniqueIdentifier?: string; steps?: any; error?: string }> {
  const steps: any = {};

  // Normalize common aliases to actual ServiceNow flow logic type values
  var LOGIC_TYPE_ALIASES: Record<string, string> = {
    'FOR_EACH': 'FOREACH',
    'DO_UNTIL': 'DOUNTIL',
    'ELSE_IF': 'ELSEIF',
    'SKIP_ITERATION': 'CONTINUE',
    'EXIT_LOOP': 'BREAK',
    'GO_BACK_TO': 'GOBACKTO',
    'DYNAMIC_FLOW': 'DYNAMICFLOW',
    'END_FLOW': 'END',
    'GET_FLOW_OUTPUT': 'GETFLOWOUTPUT',
    'GET_FLOW_OUTPUTS': 'GETFLOWOUTPUT',
    'SET_FLOW_VARIABLES': 'SETFLOWVARIABLES',
    'APPEND_FLOW_VARIABLES': 'APPENDFLOWVARIABLES',
  };
  var normalizedType = LOGIC_TYPE_ALIASES[logicType.toUpperCase()] || logicType;
  if (normalizedType !== logicType) {
    steps.type_normalized = { from: logicType, to: normalizedType };
    logicType = normalizedType;
  }

  // Dynamically look up flow logic definition in sys_hub_flow_logic_definition
  // Fetch extra fields needed for the flowLogicDefinition object in the mutation
  const defFields = 'sys_id,type,name,description,order,attributes,compilation_class,quiescence,visible,category,connected_to';
  let defId: string | null = null;
  let defName = '';
  let defType = logicType;
  let defRecord: any = {};
  // Try exact match on type (IF, ELSE, FOREACH, DOUNTIL, etc.), then name
  for (const field of ['type', 'name']) {
    if (defId) break;
    try {
      const resp = await client.get('/api/now/table/sys_hub_flow_logic_definition', {
        params: { sysparm_query: field + '=' + logicType, sysparm_fields: defFields, sysparm_limit: 1 }
      });
      const found = resp.data.result?.[0];
      if (found?.sys_id) {
        defId = found.sys_id;
        defName = found.name || logicType;
        defType = found.type || logicType;
        defRecord = found;
        steps.def_lookup = { id: found.sys_id, type: found.type, name: found.name, matched: field + '=' + logicType };
      }
    } catch (_) {}
  }
  // Fallback: LIKE search
  if (!defId) {
    try {
      const resp = await client.get('/api/now/table/sys_hub_flow_logic_definition', {
        params: {
          sysparm_query: 'typeLIKE' + logicType + '^ORnameLIKE' + logicType,
          sysparm_fields: defFields, sysparm_limit: 5
        }
      });
      const results = resp.data.result || [];
      steps.def_lookup_fallback_candidates = results.map((r: any) => ({ sys_id: r.sys_id, type: r.type, name: r.name }));
      if (results[0]?.sys_id) {
        defId = results[0].sys_id;
        defName = results[0].name || logicType;
        defType = results[0].type || logicType;
        defRecord = results[0];
        steps.def_lookup = { id: results[0].sys_id, type: results[0].type, name: results[0].name, matched: 'LIKE ' + logicType };
      }
    } catch (_) {}
  }
  if (!defId) return { success: false, error: 'Flow logic definition not found for: ' + logicType, steps };

  // ELSE/ELSEIF blocks MUST be connected to an If block via connectedTo (the If block's uiUniqueIdentifier)
  // Unlike other flow logic, Else is NOT a child (parent="") — it uses connectedTo to link to the If block.
  const upperType = defType.toUpperCase();
  if ((upperType === 'ELSE' || upperType === 'ELSEIF') && !connectedTo) {
    return { success: false, error: upperType + ' blocks require connected_to set to the If block\'s uiUniqueIdentifier (returned from the add_flow_logic response for the If block). Else is NOT a child of If — it uses connectedTo to link to it.', steps };
  }

  // Build full input objects with parameter definitions (matching UI format)
  const inputResult = await buildFlowLogicInputsForInsert(client, defId, defRecord, inputs);
  steps.available_inputs = inputResult.inputs.map((i: any) => ({ name: i.name, label: i.parameter?.label }));
  steps.resolved_inputs = inputResult.resolvedInputs;
  steps.input_query_stats = { defParamsFound: inputResult.defParamsCount, inputsBuilt: inputResult.inputs.length, error: inputResult.inputQueryError };

  // Validate mandatory fields (e.g. condition for IF/ELSEIF)
  if (inputResult.missingMandatory && inputResult.missingMandatory.length > 0) {
    steps.missing_mandatory = inputResult.missingMandatory;
    return { success: false, error: 'Missing required inputs for ' + logicType + ': ' + inputResult.missingMandatory.join(', ') + '. These fields are mandatory in Flow Designer.', steps };
  }

  // ── Detect condition that needs data pill transformation ────────────
  // Flow Designer sets conditions via a SEPARATE UPDATE after the element is created.
  // Three paths:
  // 1. Standard encoded query (category=software) → transform fields to {{dataPillBase.field}}
  // 2. Contains {{shorthand}} like {{trigger.current.X}} → rewrite to {{dataPillBase.X}} + labelCache
  // 3. Non-standard (JS expression, fd_data ref) → passthrough
  const uuid = generateUUID();
  var conditionInput = inputResult.inputs.find(function (inp: any) { return inp.name === 'condition'; });
  var rawCondition = conditionInput?.value?.value || '';
  var needsConditionUpdate = false;
  var conditionTriggerInfo: any = null;

  // Pre-process: detect dot notation conditions and convert to shorthand pill format.
  // Supports both symbol operators and word operators:
  //   "trigger.current.category = software"          → "{{trigger.current.category}}=software"
  //   "trigger.current.category == 'software'"       → "{{trigger.current.category}}=software"
  //   "trigger.current.category equals software"     → "{{trigger.current.category}}=software"
  //   "trigger.current.priority != 1"                → "{{trigger.current.priority}}!=1"
  //   "current.active is true"                       → "{{current.active}}=true"
  var WORD_OP_MAP: Record<string, string> = {
    'equals': '=', 'is': '=', 'eq': '=',
    'not_equals': '!=', 'is not': '!=', 'neq': '!=', 'not equals': '!=',
    'greater than': '>', 'gt': '>', 'less than': '<', 'lt': '<',
    'greater or equals': '>=', 'gte': '>=', 'less or equals': '<=', 'lte': '<=',
    'contains': 'LIKE', 'starts with': 'STARTSWITH', 'ends with': 'ENDSWITH',
    'not contains': 'NOT LIKE', 'is empty': 'ISEMPTY', 'is not empty': 'ISNOTEMPTY'
  };
  // First replace word operators with symbols so the regex can match uniformly
  var dotOriginal = rawCondition;
  var dotProcessed = rawCondition;
  var WORD_OPS_SORTED = Object.keys(WORD_OP_MAP).sort(function (a, b) { return b.length - a.length; }); // longest first
  for (var wi = 0; wi < WORD_OPS_SORTED.length; wi++) {
    var wordOp = WORD_OPS_SORTED[wi];
    // Only replace word operators that appear between a dot-notation field and a value
    var wordRe = new RegExp('((?:trigger\\.)?current\\.\\w+)\\s+' + wordOp.replace(/ /g, '\\s+') + '\\s+', 'gi');
    dotProcessed = dotProcessed.replace(wordRe, function (m: string, prefix: string) {
      return prefix + WORD_OP_MAP[wordOp];
    });
  }
  var DOT_NOTATION_RE = /((?:trigger\.)?current)\.(\w+)(===?|!==?|>=|<=|>|<|=|LIKE|STARTSWITH|ENDSWITH|NOT LIKE|ISEMPTY|ISNOTEMPTY)\s*(?:'([^']*)'|"([^"]*)"|(\S*))/g;
  if (DOT_NOTATION_RE.test(dotProcessed)) {
    DOT_NOTATION_RE.lastIndex = 0;
    rawCondition = dotProcessed.replace(DOT_NOTATION_RE, function (_m: string, prefix: string, field: string, op: string, qv1: string, qv2: string, uv: string) {
      var snOp = op;
      if (op === '==' || op === '===') snOp = '=';
      else if (op === '!=' || op === '!==') snOp = '!=';
      var val = qv1 !== undefined ? qv1 : (qv2 !== undefined ? qv2 : (uv || ''));
      return '{{' + prefix + '.' + field + '}}' + snOp + val;
    });
    // Replace JS && with ServiceNow ^ (AND separator)
    rawCondition = rawCondition.replace(/\s*&&\s*/g, '^');
    steps.dot_notation_rewrite = { original: dotOriginal, rewritten: rawCondition };
  }

  // Pre-process: convert word operators in pill-format conditions
  // e.g. "{{trigger.current.category}} equals software" → "{{trigger.current.category}}=software"
  if (rawCondition.includes('{{')) {
    var PILL_WORD_OPS: [RegExp, string][] = [
      [/(\}\})\s+not\s+equals\s+/gi, '$1!='],
      [/(\}\})\s+is\s+not\s+/gi, '$1!='],
      [/(\}\})\s+equals\s+/gi, '$1='],
      [/(\}\})\s+is\s+/gi, '$1='],
      [/(\}\})\s+contains\s+/gi, '$1LIKE'],
      [/(\}\})\s+starts\s+with\s+/gi, '$1STARTSWITH'],
      [/(\}\})\s+ends\s+with\s+/gi, '$1ENDSWITH'],
      [/(\}\})\s+greater\s+than\s+/gi, '$1>'],
      [/(\}\})\s+less\s+than\s+/gi, '$1<'],
      // Symbol operators: == / === / != / !== / >= / <= / > / < with optional spaces
      [/(\}\})\s*===?\s*/g, '$1='],
      [/(\}\})\s*!==?\s*/g, '$1!='],
      [/(\}\})\s*>=\s*/g, '$1>='],
      [/(\}\})\s*<=\s*/g, '$1<='],
      [/(\}\})\s*>\s*/g, '$1>'],
      [/(\}\})\s*<\s*/g, '$1<'],
    ];
    var pillWordOriginal = rawCondition;
    for (var pwi = 0; pwi < PILL_WORD_OPS.length; pwi++) {
      rawCondition = rawCondition.replace(PILL_WORD_OPS[pwi][0], PILL_WORD_OPS[pwi][1]);
    }
    if (rawCondition !== pillWordOriginal) {
      steps.pill_word_op_rewrite = { original: pillWordOriginal, rewritten: rawCondition };
    }
  }

  // Shorthand patterns that need rewriting to the real data pill base
  // e.g. {{trigger.current.category}} → {{Created or Updated_1.current.category}}
  var PILL_SHORTHANDS = ['trigger.current', 'current', 'trigger_record', 'trigger.record'];
  var hasShorthandPills = rawCondition.includes('{{') && PILL_SHORTHANDS.some(function (sh) {
    return rawCondition.includes('{{' + sh + '.') || rawCondition.includes('{{' + sh + '}}');
  });

  if (rawCondition && rawCondition !== '^EQ' && (isStandardEncodedQuery(rawCondition) || hasShorthandPills)) {
    conditionTriggerInfo = await getFlowTriggerInfo(client, flowId);
    steps.trigger_info = {
      dataPillBase: conditionTriggerInfo.dataPillBase, triggerName: conditionTriggerInfo.triggerName,
      table: conditionTriggerInfo.table, tableLabel: conditionTriggerInfo.tableLabel, error: conditionTriggerInfo.error,
      debug: conditionTriggerInfo.debug
    };
    if (conditionTriggerInfo.dataPillBase) {
      needsConditionUpdate = true;

      // If condition has shorthand pills, rewrite them to real data pill base first
      if (hasShorthandPills) {
        var pillBase = conditionTriggerInfo.dataPillBase;
        for (var si = 0; si < PILL_SHORTHANDS.length; si++) {
          var sh = PILL_SHORTHANDS[si];
          // Replace {{trigger.current.field}} → {{Created or Updated_1.current.field}}
          rawCondition = rawCondition.split('{{' + sh + '.').join('{{' + pillBase + '.');
          // Replace {{trigger.current}} → {{Created or Updated_1.current}}
          rawCondition = rawCondition.split('{{' + sh + '}}').join('{{' + pillBase + '}}');
        }
        steps.shorthand_rewrite = { original: conditionInput?.value?.value, rewritten: rawCondition };
      }

      // Clear condition in INSERT — it will be set via separate UPDATE with labelCache
      conditionInput.value = { schemaless: false, schemalessValue: '', value: '' };
      steps.condition_strategy = 'two_step';
    }
  } else if (rawCondition && rawCondition !== '^EQ') {
    // Non-standard condition (JS expression, fd_data ref, etc.) — pass through as-is
    steps.condition_strategy = 'passthrough';
    steps.condition_not_encoded_query = true;
  }

  // Calculate insertion order
  const resolvedOrder = await calculateInsertOrder(client, flowId, parentUiId, order);
  steps.insert_order = resolvedOrder;

  const logicResponseFields = 'flowLogics { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' +
    ' actions { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' +
    ' subflows { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }';

  // Build the insert object — include connectedTo when linking Else to an If block
  var insertObj: any = {
    order: String(resolvedOrder),
    uiUniqueIdentifier: uuid,
    parent: parentUiId || '',
    metadata: '{"predicates":[]}',
    flowSysId: flowId,
    generationSource: '',
    definitionId: defId,
    type: 'flowlogic',
    parentUiId: parentUiId || '',
    inputs: inputResult.inputs,
    outputsToAssign: [],
    flowLogicDefinition: inputResult.flowLogicDefinition
  };
  if (connectedTo) {
    insertObj.connectedTo = connectedTo;
  }

  var flowPatch: any = {
    flowId: flowId,
    flowLogics: {
      insert: [insertObj]
    }
  };

  // Add parent flow logic update signal (tells GraphQL the parent was modified)
  if (parentUiId) {
    flowPatch.flowLogics.update = [{ uiUniqueIdentifier: parentUiId, type: 'flowlogic' }];
  }

  try {
    // Step 1: INSERT the flow logic element (with empty condition if data pill transform is needed)
    const result = await executeFlowPatchMutation(client, flowPatch, logicResponseFields);
    const logicId = result?.flowLogics?.inserts?.[0]?.sysId;
    const returnedUuid = result?.flowLogics?.inserts?.[0]?.uiUniqueIdentifier || uuid;
    steps.insert = { success: !!logicId, logicId, uuid: returnedUuid };
    if (!logicId) return { success: false, steps, error: 'GraphQL flow logic INSERT returned no ID' };

    // Step 2: UPDATE condition with data pill + labelCache (separate mutation, matching UI behavior)
    // The Flow Designer UI always sets conditions in a separate UPDATE after creating the element.
    if (needsConditionUpdate && conditionTriggerInfo) {
      var dataPillBase = conditionTriggerInfo.dataPillBase;
      var transformedCondition: string;

      if (rawCondition.includes('{{')) {
        // Condition already contains data pill references (after shorthand rewrite)
        // Use as-is and extract field names from {{pill.field}} patterns for labelCache
        transformedCondition = rawCondition;
        var pillFields: string[] = [];
        var pillRx = /\{\{([^}]+)\}\}/g;
        var pm;
        while ((pm = pillRx.exec(rawCondition)) !== null) {
          var pParts = pm[1].split('.');
          if (pParts.length > 2) pillFields.push(pParts[pParts.length - 1]);
        }
        // Build labelCache using extracted field names
        var labelCacheResult = await buildConditionLabelCache(
          client, rawCondition, dataPillBase, conditionTriggerInfo.triggerName,
          conditionTriggerInfo.tableRef, conditionTriggerInfo.tableLabel, returnedUuid,
          pillFields
        );
      } else {
        // Plain encoded query — transform to data pill format
        transformedCondition = transformConditionToDataPills(rawCondition, dataPillBase);
        var labelCacheResult = await buildConditionLabelCache(
          client, rawCondition, dataPillBase, conditionTriggerInfo.triggerName,
          conditionTriggerInfo.tableRef, conditionTriggerInfo.tableLabel, returnedUuid
        );
      }

      steps.condition_transform = { original: rawCondition, transformed: transformedCondition };
      steps.label_cache = labelCacheResult.map(function (e: any) { return e.name; });

      try {
        // Match the UI's exact format for condition UPDATE (captured from clean Flow Designer network trace):
        // - labelCache.insert: field-level pills with FULL metadata (type, parent_table_name, etc.)
        // - Two inputs: condition_name (label) + condition (pill expression)
        // - No flowLogicDefinition, no displayValue on condition
        var updatePatch: any = {
          flowId: flowId,
          flowLogics: {
            update: [{
              uiUniqueIdentifier: returnedUuid,
              type: 'flowlogic',
              inputs: [
                {
                  name: 'condition_name',
                  value: { schemaless: false, schemalessValue: '', value: inputResult.resolvedInputs['condition_name'] || '' }
                },
                {
                  name: 'condition',
                  value: { schemaless: false, schemalessValue: '', value: transformedCondition }
                }
              ]
            }]
          }
        };
        if (labelCacheResult.length > 0) {
          updatePatch.labelCache = { insert: labelCacheResult };
        }
        // Log the exact GraphQL mutation for debugging
        steps.condition_update_mutation = jsToGraphQL(updatePatch);
        var updateResult = await executeFlowPatchMutation(client, updatePatch, logicResponseFields);
        steps.condition_update = { success: true, response: updateResult };
      } catch (ue: any) {
        steps.condition_update = { success: false, error: ue.message };
        // Element was created successfully — condition update failure is non-fatal
      }
    }

    return { success: true, logicId, uiUniqueIdentifier: returnedUuid, steps };
  } catch (e: any) {
    steps.insert = { success: false, error: e.message };
    return { success: false, steps, error: 'GraphQL flow logic INSERT failed: ' + e.message };
  }
}

// ── SUBFLOW CALL (invoke a subflow as a step) ────────────────────────

async function addSubflowCallViaGraphQL(
  client: any,
  flowId: string,
  subflowId: string,
  inputs?: Record<string, string>,
  order?: number,
  parentUiId?: string
): Promise<{ success: boolean; callId?: string; steps?: any; error?: string }> {
  const steps: any = {};

  // Resolve subflow: look up by sys_id, name, or internal_name in sys_hub_flow
  let subflowSysId = isSysId(subflowId) ? subflowId : null;
  let subflowName = '';
  if (!subflowSysId) {
    for (const field of ['name', 'internal_name']) {
      if (subflowSysId) break;
      try {
        const resp = await client.get('/api/now/table/sys_hub_flow', {
          params: {
            sysparm_query: field + '=' + subflowId + '^type=subflow',
            sysparm_fields: 'sys_id,name,internal_name',
            sysparm_limit: 1
          }
        });
        const found = resp.data.result?.[0];
        if (found?.sys_id) {
          subflowSysId = found.sys_id;
          subflowName = found.name || subflowId;
          steps.subflow_lookup = { id: found.sys_id, name: found.name, internal_name: found.internal_name, matched: field + '=' + subflowId };
        }
      } catch (_) {}
    }
    // LIKE fallback
    if (!subflowSysId) {
      try {
        const resp = await client.get('/api/now/table/sys_hub_flow', {
          params: {
            sysparm_query: 'nameLIKE' + subflowId + '^type=subflow',
            sysparm_fields: 'sys_id,name,internal_name',
            sysparm_limit: 5
          }
        });
        const results = resp.data.result || [];
        steps.subflow_lookup_candidates = results.map((r: any) => ({ sys_id: r.sys_id, name: r.name, internal_name: r.internal_name }));
        if (results[0]?.sys_id) {
          subflowSysId = results[0].sys_id;
          subflowName = results[0].name || subflowId;
          steps.subflow_lookup = { id: results[0].sys_id, name: results[0].name, matched: 'LIKE ' + subflowId };
        }
      } catch (_) {}
    }
  }
  if (!subflowSysId) return { success: false, error: 'Subflow not found: ' + subflowId, steps };

  if (!subflowName) subflowName = subflowId;

  // Calculate insertion order
  const resolvedOrder = await calculateInsertOrder(client, flowId, parentUiId, order);
  steps.insert_order = resolvedOrder;

  const uuid = generateUUID();
  const subflowResponseFields = 'subflows { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' +
    ' flowLogics { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' +
    ' actions { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }';

  // Build subflow input objects for INSERT
  var subInputObjects: any[] = [];
  if (inputs && Object.keys(inputs).length > 0) {
    subInputObjects = Object.entries(inputs).map(function ([name, value]) {
      return { name: name, value: { schemaless: false, schemalessValue: '', value: String(value) } };
    });
  }

  const subPatch: any = {
    flowId: flowId,
    subflows: {
      insert: [{
        metadata: '{"predicates":[]}',
        flowSysId: flowId,
        generationSource: '',
        name: subflowName,
        order: String(resolvedOrder),
        parent: parentUiId || '',
        subflowSysId: subflowSysId,
        uiUniqueIdentifier: uuid,
        type: 'subflow',
        parentUiId: parentUiId || '',
        inputs: subInputObjects
      }]
    }
  };

  // Add parent flow logic update signal
  if (parentUiId) {
    subPatch.flowLogics = { update: [{ uiUniqueIdentifier: parentUiId, type: 'flowlogic' }] };
  }

  try {
    const result = await executeFlowPatchMutation(client, subPatch, subflowResponseFields);
    const callId = result?.subflows?.inserts?.[0]?.sysId;
    steps.insert = { success: !!callId, callId, uuid };
    if (!callId) return { success: false, steps, error: 'GraphQL subflow INSERT returned no ID' };
    return { success: true, callId, steps };
  } catch (e: any) {
    steps.insert = { success: false, error: e.message };
    return { success: false, steps, error: 'GraphQL subflow INSERT failed: ' + e.message };
  }
}

// ── GENERIC UPDATE/DELETE for any flow element ───────────────────────

const elementGraphQLMap: Record<string, { key: string; type: string; responseFields: string }> = {
  action:     { key: 'actions',           type: 'action',    responseFields: 'actions { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' },
  trigger:    { key: 'triggerInstances',  type: 'trigger',   responseFields: 'triggerInstances { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' },
  flowlogic:  { key: 'flowLogics',        type: 'flowlogic', responseFields: 'flowLogics { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' },
  subflow:    { key: 'subflows',          type: 'subflow',   responseFields: 'subflows { inserts { sysId uiUniqueIdentifier __typename } updates deletes __typename }' },
};

async function updateElementViaGraphQL(
  client: any,
  flowId: string,
  elementType: string,
  elementId: string,
  inputs: Record<string, string>
): Promise<{ success: boolean; steps?: any; error?: string }> {
  const config = elementGraphQLMap[elementType];
  if (!config) return { success: false, error: 'Unknown element type: ' + elementType };

  const updateInputs = Object.entries(inputs).map(([name, value]) => ({
    name,
    value: { schemaless: false, schemalessValue: '', value: String(value) }
  }));

  try {
    await executeFlowPatchMutation(client, {
      flowId,
      [config.key]: { update: [{ uiUniqueIdentifier: elementId, type: config.type, inputs: updateInputs }] }
    }, config.responseFields);
    return { success: true, steps: { element: elementId, type: elementType, inputs: updateInputs.map(i => i.name) } };
  } catch (e: any) {
    return { success: false, error: e.message, steps: { element: elementId, type: elementType } };
  }
}

async function deleteElementViaGraphQL(
  client: any,
  flowId: string,
  elementType: string,
  elementIds: string[]
): Promise<{ success: boolean; steps?: any; error?: string }> {
  const config = elementGraphQLMap[elementType];
  if (!config) return { success: false, error: 'Unknown element type: ' + elementType };

  try {
    await executeFlowPatchMutation(client, {
      flowId,
      [config.key]: { delete: elementIds }
    }, config.responseFields);
    return { success: true, steps: { deleted: elementIds, type: elementType } };
  } catch (e: any) {
    return { success: false, error: e.message, steps: { elementIds, type: elementType } };
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
  description: 'Complete Flow Designer lifecycle: create flows/subflows, add/update triggers and actions, list, get details, update, activate, deactivate, delete and publish. Use update_trigger to change an existing trigger (e.g. switch from record_created to record_create_or_update) without deleting the flow.',
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
        enum: [
          'create', 'create_subflow', 'list', 'get', 'update', 'activate', 'deactivate', 'delete', 'publish',
          'add_trigger', 'update_trigger', 'delete_trigger',
          'add_action', 'update_action', 'delete_action',
          'add_flow_logic', 'update_flow_logic', 'delete_flow_logic',
          'add_subflow', 'update_subflow', 'delete_subflow',
          'open_flow', 'close_flow'
        ],
        description: 'Action to perform. EDITING WORKFLOW: create_flow keeps the editing lock open — you can immediately call add_action, add_flow_logic, etc. without open_flow. For editing EXISTING flows: call open_flow first to acquire the lock. Always call close_flow as the LAST step to release the lock so users can edit in the UI. ' +
          'add_*/update_*/delete_* for triggers, actions, flow_logic, subflows. update_trigger replaces the trigger type. delete_* removes elements by element_id.'
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
        description: 'Trigger type - looked up dynamically in sys_hub_trigger_definition. Common values: record_create, record_update, record_create_or_update, scheduled, manual (default: manual)',
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
              description: 'Action type - looked up dynamically in sys_hub_action_type_snapshot by internal_name or name. Common values: log, create_record, update_record, send_notification, script, field_update, wait, create_approval'
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
      logic_type: {
        type: 'string',
        description: 'Flow logic type for add_flow_logic. Looked up dynamically in sys_hub_flow_logic_definition. ' +
          'Common aliases (FOR_EACH, DO_UNTIL, etc.) are auto-normalized to ServiceNow types. Available types: ' +
          'IF, ELSEIF, ELSE — conditional branching. Use ELSEIF (not nested ELSE+IF) for else-if branches. ELSE and ELSEIF require connected_to set to the If block\'s uiUniqueIdentifier. ' +
          'FOREACH (or FOR_EACH), DOUNTIL (or DO_UNTIL) — loops. CONTINUE (skip iteration) and BREAK (exit loop) can be used inside loops. ' +
          'PARALLEL — execute branches in parallel. ' +
          'DECISION — switch/decision table. ' +
          'TRY — error handling (try/catch). ' +
          'END — End Flow (stops execution). Always add END as the last element when the flow should terminate cleanly. ' +
          'TIMER — Wait for a duration of time. ' +
          'GOBACKTO (or GO_BACK_TO) — jump back to a previous step. ' +
          'SETFLOWVARIABLES, APPENDFLOWVARIABLES, GETFLOWOUTPUT — flow variable management. ' +
          'WORKFLOW — call a legacy workflow. DYNAMICFLOW — dynamically invoke a flow. ' +
          'Best practice: add an END element at the end of your flow for clean termination.'
      },
      logic_inputs: {
        type: 'object',
        description: 'Input values for the flow logic block (e.g. {condition: "expression", condition_name: "My Condition"})'
      },
      parent_ui_id: {
        type: 'string',
        description: 'Parent UI unique identifier for nesting elements inside flow logic blocks. REQUIRED for placing actions/subflows inside an If/Else block — set to the If/Else block\'s uiUniqueIdentifier from its add_flow_logic response.'
      },
      connected_to: {
        type: 'string',
        description: 'REQUIRED for ELSE blocks: the uiUniqueIdentifier of the If block this Else is connected to. Unlike parent_ui_id (which nests elements inside a block), connected_to links sibling blocks like Else to their If. Get this value from the add_flow_logic response for the If block.'
      },
      subflow_id: {
        type: 'string',
        description: 'Subflow sys_id or name to call as a step (for add_subflow action). Looked up in sys_hub_flow where type=subflow.'
      },
      element_id: {
        type: 'string',
        description: 'Element sys_id or uiUniqueIdentifier for update_*/delete_* actions. For delete_* this can also be a comma-separated list of IDs.'
      },
      order: {
        type: 'number',
        description: 'GLOBAL position/order of the element in the flow (for add_* actions). Flow Designer uses global sequential ordering across ALL elements (1, 2, 3...). For nested elements (e.g. action inside If block), the order must be global — not relative to the parent. Example: If block at order 2, first child should be order 3, second child order 4, etc. Each add_* response includes insert_order — use the previous insert_order + 1 for the next element.'
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
        description: 'Action type to add (for add_action). Looked up dynamically by internal_name or name in sys_hub_action_type_snapshot and sys_hub_action_type_definition. Common short names: log, script, create_record, update_record, notification, field_update, wait, approval. You can also use the exact ServiceNow internal name (e.g. "sn_fd.script_step", "global.update_record") or display name (e.g. "Run Script", "Update Record").',
        default: 'log'
      },
      action_name: {
        type: 'string',
        description: 'Display name for the action (for add_action)'
      },
      spoke: {
        type: 'string',
        description: 'Spoke/scope filter for action lookup (for add_action). Use to disambiguate when multiple spokes have actions with the same name (e.g. "global" for core actions, "spoke-specific" for spoke-specific Spoke actions). Matched against sys_scope and sys_package fields.'
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
              var pfActResult = await addActionViaGraphQL(client, flowSysId, pfAct.type || 'log', pfAct.name || ('Action ' + (pfai + 1)), pfAct.inputs, undefined, pfai + 1);
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
              var taActResult = await addActionViaGraphQL(client, flowSysId, activity.type || 'log', activity.name || ('Action ' + (ai + 1)), activity.inputs, undefined, ai + 1);
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

        // NOTE: Do NOT release the editing lock here. The agent may need to add more elements
        // (flow logic, actions, etc.) after creation. The agent must call close_flow when done.

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
      // UPDATE_TRIGGER — replace existing trigger(s) with a new one
      // ────────────────────────────────────────────────────────────────
      case 'update_trigger': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for update_trigger');
        }
        var updTrigFlowId = await resolveFlowId(client, args.flow_id);
        var updTrigType = args.trigger_type || 'record_create_or_update';
        var updTrigTable = args.table || '';
        var updTrigCondition = args.trigger_condition || '';
        var updTrigSteps: any = {};

        // Step 1: Find existing trigger instances on this flow
        try {
          var existingTriggers = await client.get('/api/now/table/sys_hub_trigger_instance', {
            params: {
              sysparm_query: 'flow=' + updTrigFlowId,
              sysparm_fields: 'sys_id,name,type',
              sysparm_limit: 10
            }
          });
          var trigInstances = existingTriggers.data.result || [];
          updTrigSteps.existing_triggers = trigInstances.map((t: any) => ({ sys_id: t.sys_id, name: t.name, type: t.type }));

          // Step 2: Delete existing triggers via GraphQL
          if (trigInstances.length > 0) {
            var deleteIds = trigInstances.map((t: any) => t.sys_id);
            try {
              await executeFlowPatchMutation(client, {
                flowId: updTrigFlowId,
                triggerInstances: { delete: deleteIds }
              }, 'triggerInstances { deletes __typename }');
              updTrigSteps.deleted = deleteIds;
            } catch (e: any) {
              updTrigSteps.delete_error = e.message;
            }
          }
        } catch (_) {
          updTrigSteps.lookup_error = 'Could not query existing triggers';
        }

        // Step 3: Add the new trigger
        var updTrigResult = await addTriggerViaGraphQL(client, updTrigFlowId, updTrigType, updTrigTable, updTrigCondition);
        updTrigSteps.new_trigger = updTrigResult;

        var updTrigSummary = summary();
        if (updTrigResult.success) {
          updTrigSummary
            .success('Trigger updated via GraphQL')
            .field('Flow', updTrigFlowId)
            .field('New Type', updTrigType)
            .field('Trigger ID', updTrigResult.triggerId || 'unknown');
          if (updTrigTable) updTrigSummary.field('Table', updTrigTable);
        } else {
          updTrigSummary.error('Failed to update trigger: ' + (updTrigResult.error || 'unknown'));
        }

        return updTrigResult.success
          ? createSuccessResult({ action: 'update_trigger', steps: updTrigSteps }, {}, updTrigSummary.build())
          : createErrorResult(updTrigResult.error || 'Failed to update trigger');
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

        var addActResult = await addActionViaGraphQL(client, addActFlowId, addActType, addActName, addActInputs, args.parent_ui_id, args.order, args.spoke);

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

      // ────────────────────────────────────────────────────────────────
      // ADD_FLOW_LOGIC — add If/Else, For Each, Do Until, Switch blocks
      // ────────────────────────────────────────────────────────────────
      case 'add_flow_logic': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for add_flow_logic');
        }
        if (!args.logic_type) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'logic_type is required for add_flow_logic (e.g. IF, ELSEIF, ELSE, FOR_EACH, DO_UNTIL, PARALLEL, DECISION, TRY, END, TIMER, SET_FLOW_VARIABLES)');
        }
        var addLogicFlowId = await resolveFlowId(client, args.flow_id);
        var addLogicType = args.logic_type;
        var addLogicInputs = args.logic_inputs || {};
        var addLogicOrder = args.order;
        var addLogicParentUiId = args.parent_ui_id || '';
        var addLogicConnectedTo = args.connected_to || '';

        var addLogicResult = await addFlowLogicViaGraphQL(client, addLogicFlowId, addLogicType, addLogicInputs, addLogicOrder, addLogicParentUiId, addLogicConnectedTo);

        var addLogicSummary = summary();
        if (addLogicResult.success) {
          addLogicSummary
            .success('Flow logic added via GraphQL')
            .field('Flow', addLogicFlowId)
            .field('Type', addLogicType)
            .field('Logic ID', addLogicResult.logicId || 'unknown')
            .field('uiUniqueIdentifier', addLogicResult.uiUniqueIdentifier || 'unknown');
        } else {
          addLogicSummary.error('Failed to add flow logic: ' + (addLogicResult.error || 'unknown'));
        }

        return addLogicResult.success
          ? createSuccessResult({ action: 'add_flow_logic', ...addLogicResult }, {}, addLogicSummary.build())
          : createErrorResult(addLogicResult.error || 'Failed to add flow logic');
      }

      // ────────────────────────────────────────────────────────────────
      // ADD_SUBFLOW — call an existing subflow as a step in the flow
      // ────────────────────────────────────────────────────────────────
      case 'add_subflow': {
        if (!args.flow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for add_subflow');
        }
        if (!args.subflow_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'subflow_id is required for add_subflow (sys_id or name of the subflow to call)');
        }
        var addSubFlowId = await resolveFlowId(client, args.flow_id);
        var addSubSubflowId = args.subflow_id;
        var addSubInputs = args.action_inputs || args.inputs || {};
        var addSubOrder = args.order;
        var addSubParentUiId = args.parent_ui_id || '';

        var addSubResult = await addSubflowCallViaGraphQL(client, addSubFlowId, addSubSubflowId, addSubInputs, addSubOrder, addSubParentUiId);

        var addSubSummary = summary();
        if (addSubResult.success) {
          addSubSummary
            .success('Subflow call added via GraphQL')
            .field('Flow', addSubFlowId)
            .field('Subflow', addSubSubflowId)
            .field('Call ID', addSubResult.callId || 'unknown');
        } else {
          addSubSummary.error('Failed to add subflow call: ' + (addSubResult.error || 'unknown'));
        }

        return addSubResult.success
          ? createSuccessResult({ action: 'add_subflow', ...addSubResult }, {}, addSubSummary.build())
          : createErrorResult(addSubResult.error || 'Failed to add subflow call');
      }

      // ────────────────────────────────────────────────────────────────
      // UPDATE_ACTION / UPDATE_FLOW_LOGIC / UPDATE_SUBFLOW
      // ────────────────────────────────────────────────────────────────
      case 'update_action':
      case 'update_flow_logic':
      case 'update_subflow': {
        if (!args.flow_id) throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required');
        if (!args.element_id) throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'element_id is required (sys_id or uiUniqueIdentifier of the element)');
        var updElemFlowId = await resolveFlowId(client, args.flow_id);
        var updElemType = action === 'update_action' ? 'action' : action === 'update_flow_logic' ? 'flowlogic' : 'subflow';
        var updElemInputs = args.action_inputs || args.logic_inputs || args.inputs || {};

        var updElemResult = await updateElementViaGraphQL(client, updElemFlowId, updElemType, args.element_id, updElemInputs);

        var updElemSummary = summary();
        if (updElemResult.success) {
          updElemSummary.success('Element updated').field('Type', updElemType).field('Element', args.element_id);
        } else {
          updElemSummary.error('Failed to update element: ' + (updElemResult.error || 'unknown'));
        }
        return updElemResult.success
          ? createSuccessResult({ action, ...updElemResult }, {}, updElemSummary.build())
          : createErrorResult(updElemResult.error || 'Failed to update element');
      }

      // ────────────────────────────────────────────────────────────────
      // DELETE_ACTION / DELETE_FLOW_LOGIC / DELETE_SUBFLOW / DELETE_TRIGGER
      // ────────────────────────────────────────────────────────────────
      case 'delete_action':
      case 'delete_flow_logic':
      case 'delete_subflow':
      case 'delete_trigger': {
        if (!args.flow_id) throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required');
        if (!args.element_id) throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'element_id is required (sys_id(s) to delete, comma-separated for multiple)');
        var delElemFlowId = await resolveFlowId(client, args.flow_id);
        var delElemType = action === 'delete_action' ? 'action'
          : action === 'delete_flow_logic' ? 'flowlogic'
          : action === 'delete_subflow' ? 'subflow'
          : 'trigger';
        var delElemIds = String(args.element_id).split(',').map((id: string) => id.trim());

        // Map 'trigger' to the correct GraphQL key
        var delGraphQLType = delElemType === 'trigger' ? 'trigger' : delElemType;
        var delResult = await deleteElementViaGraphQL(client, delElemFlowId, delGraphQLType, delElemIds);

        var delSummary = summary();
        if (delResult.success) {
          delSummary.success('Element(s) deleted').field('Type', delElemType).field('Deleted', delElemIds.join(', '));
        } else {
          delSummary.error('Failed to delete element: ' + (delResult.error || 'unknown'));
        }
        return delResult.success
          ? createSuccessResult({ action, ...delResult }, {}, delSummary.build())
          : createErrorResult(delResult.error || 'Failed to delete element');
      }

      // ────────────────────────────────────────────────────────────────
      // OPEN_FLOW — acquire Flow Designer editing lock (safeEdit create)
      // ────────────────────────────────────────────────────────────────
      case 'open_flow': {
        if (!args.flow_id) throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for open_flow');
        var openFlowId = await resolveFlowId(client, args.flow_id);
        var openSummary = summary();

        // Step 1: Load flow data via processflow GET (same as UI)
        try {
          await client.get('/api/now/processflow/flow/' + openFlowId);
        } catch (_) { /* best-effort — flow data load is not critical for lock acquisition */ }

        // Step 2: Acquire editing lock via safeEdit create mutation (required for GraphQL mutations)
        var lockResult = await acquireFlowEditingLock(client, openFlowId);
        if (lockResult.success) {
          openSummary.success('Flow opened for editing (lock acquired)').field('Flow', openFlowId)
            .line('You can now use add_action, add_flow_logic, etc. Call close_flow when done.');
          return createSuccessResult({ action: 'open_flow', flow_id: openFlowId, editing_session: true }, {}, openSummary.build());
        } else {
          openSummary.error('Cannot open flow: ' + (lockResult.error || 'lock acquisition failed')).field('Flow', openFlowId);
          return createErrorResult('Cannot open flow for editing: ' + (lockResult.error || 'lock acquisition failed'));
        }
      }

      // ────────────────────────────────────────────────────────────────
      // CLOSE_FLOW — release Flow Designer editing lock (safeEdit)
      // ────────────────────────────────────────────────────────────────
      case 'close_flow': {
        if (!args.flow_id) throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'flow_id is required for close_flow');
        var closeFlowId = await resolveFlowId(client, args.flow_id);
        var closed = await releaseFlowEditingLock(client, closeFlowId);
        var closeSummary = summary();
        if (closed) {
          closeSummary.success('Flow editing lock released').field('Flow', closeFlowId);
        } else {
          closeSummary.warning('Lock release returned false (flow may not have been locked)').field('Flow', closeFlowId);
        }
        return createSuccessResult({ action: 'close_flow', flow_id: closeFlowId, lock_released: closed }, {}, closeSummary.build());
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
