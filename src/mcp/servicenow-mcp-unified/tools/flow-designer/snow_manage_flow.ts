/**
 * snow_manage_flow - Unified Flow Designer Management via Direct Table API
 *
 * ⚠️ EXPERIMENTAL: Manages flows by directly manipulating Flow Designer tables.
 * This approach is NOT officially supported by ServiceNow but enables programmatic flow management.
 *
 * Supported Actions:
 * - create: Create a new flow with triggers, actions, conditions, loops, variables
 * - update: Update an existing flow's properties
 * - delete: Delete a flow and all related records
 * - clone: Clone an existing flow
 * - activate: Activate a flow
 * - deactivate: Deactivate a flow
 * - add_action: Add an action to an existing flow
 * - remove_action: Remove an action from a flow
 * - add_condition: Add a conditional logic block (if/then/else)
 * - add_loop: Add a loop construct (for_each/do_until)
 * - get_details: Get detailed flow structure including decompressed values
 *
 * Features:
 * - Xanadu+ compression support (GlideCompressionUtil compatible)
 * - Nested actions within conditions and loops
 * - Parent-child relationship management
 * - Version detection for table compatibility
 *
 * Flow Designer Table Structure:
 * - sys_hub_flow: Main flow record
 * - sys_hub_flow_snapshot: Flow version/snapshot
 * - sys_hub_trigger_instance_v2: Trigger configuration
 * - sys_hub_action_instance_v2: Action instances (with compressed values)
 * - sys_hub_flow_logic_instance_v2: Conditions, loops (with parent_logic_instance)
 * - sys_hub_flow_variable: Input/output variables
 * - sys_hub_sub_flow_instance: Subflow references
 *
 * @version 2.0.0-experimental
 * @author Snow-Flow v8.3.0 - Flow Designer Direct Table API
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';
import * as crypto from 'crypto';
import * as zlib from 'zlib';

// ==================== CONSTANTS ====================

const COMPRESSED_HEADER = 'COMPRESSED:';

/**
 * Flow Designer Table Structure
 *
 * CREATE ORDER (parent → children):
 * 1. sys_hub_flow           - Main flow record
 * 2. sys_hub_trigger_*      - Triggers (ref: flow)
 * 3. sys_hub_flow_variable  - Variables (ref: flow)
 * 4. sys_hub_flow_logic_*   - Conditions/Loops (ref: flow, parent_logic_instance)
 * 5. sys_hub_action_*       - Actions (ref: flow, parent_logic_instance, branch)
 * 6. sys_hub_sub_flow_*     - Subflow calls (ref: flow, parent_logic_instance)
 * 7. sys_hub_flow_snapshot  - Snapshots (ref: flow)
 *
 * DELETE ORDER (children → parent, hierarchical):
 * 1. Actions               - Children of logic
 * 2. Subflow instances     - Can be nested in logic
 * 3. Logic instances       - Deepest children first, then parents
 * 4. Triggers
 * 5. Variables
 * 6. Snapshots
 * 7. Flow                  - Main record last
 *
 * VERSION HISTORY:
 * - Pre-Washington DC: V1 tables (no _v2 suffix)
 * - Washington DC+:    V2 tables (with _v2 suffix)
 * - Xanadu+:           V2 tables + compressed values (GZIP + Base64)
 */
const FLOW_TABLES = {
  // === CORE TABLES ===
  FLOW: 'sys_hub_flow',                           // Main flow/subflow records
  SNAPSHOT: 'sys_hub_flow_snapshot',              // Version snapshots
  VARIABLE: 'sys_hub_flow_variable',              // Input/output/scratch variables

  // === V2 TABLES (Washington DC+) ===
  TRIGGER_V2: 'sys_hub_trigger_instance_v2',      // Trigger instances
  ACTION_V2: 'sys_hub_action_instance_v2',        // Action instances (compressed values in Xanadu+)
  LOGIC_V2: 'sys_hub_flow_logic_instance_v2',     // Conditions, loops (supports nesting)

  // === SUBFLOW TABLES ===
  SUBFLOW: 'sys_hub_sub_flow_instance',           // Subflow call instances

  // === LEGACY V1 TABLES (Pre-Washington DC) ===
  TRIGGER_V1: 'sys_hub_trigger_instance',
  ACTION_V1: 'sys_hub_action_instance',
  LOGIC_V1: 'sys_hub_flow_logic_instance',

  // === DEFINITION TABLES (Read-only, for lookups) ===
  TRIGGER_TYPE: 'sys_hub_trigger_type',           // Available trigger types
  ACTION_TYPE: 'sys_hub_action_type_base',        // Available action types

  // === ADDITIONAL TABLES (May be needed for complex flows) ===
  STEP_INSTANCE: 'sys_hub_step_instance',         // Step configurations
  FLOW_INPUT: 'sys_hub_flow_input',               // Flow inputs (legacy?)
  FLOW_OUTPUT: 'sys_hub_flow_output',             // Flow outputs (legacy?)
  FLOW_STAGE: 'sys_hub_flow_stage'                // Flow stages
};

// ==================== TYPE DEFINITIONS ====================

type ManageFlowAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'clone'
  | 'activate'
  | 'deactivate'
  | 'add_action'
  | 'remove_action'
  | 'add_condition'
  | 'add_loop'
  | 'add_variable'
  | 'get_details'
  | 'publish';

interface FlowConfig {
  name: string;
  internal_name?: string;
  description?: string;
  active?: boolean;
  application_scope?: string;
  run_as?: 'system' | 'user_who_triggers' | 'specific_user';
  run_as_user?: string;
}

interface TriggerConfig {
  /**
   * Trigger type - use specific types like 'record_created' instead of generic 'record'
   *
   * Record triggers:
   * - record_created: Triggers when a record is created
   * - record_updated: Triggers when a record is updated
   * - record_deleted: Triggers when a record is deleted
   * - record_created_or_updated: Triggers on create or update
   *
   * Other triggers:
   * - scheduled: Time-based trigger
   * - api: REST API trigger
   * - inbound_email: Email trigger
   * - service_catalog: Catalog item trigger
   *
   * Legacy: 'record' type still supported but deprecated (use record_created/updated/etc)
   */
  type: 'record_created' | 'record_updated' | 'record_deleted' | 'record_created_or_updated'
      | 'scheduled' | 'api' | 'inbound_email' | 'service_catalog'
      | 'record'; // Legacy - use with 'when' parameter
  table?: string;
  condition?: string;
  /** @deprecated Use specific trigger types like 'record_created' instead */
  when?: 'created' | 'updated' | 'deleted' | 'created_or_updated';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    time?: string;
    days?: number[];
    cron?: string;
  };
}

interface ActionConfig {
  type: string;
  name?: string;
  description?: string;
  order?: number;
  inputs?: Record<string, any>;
  // For nested actions
  parent_logic_instance?: string;
  branch?: 'then' | 'else';
}

interface ConditionConfig {
  name?: string;
  condition: string;
  order?: number;
  then_actions?: ActionConfig[];
  else_actions?: ActionConfig[];
  // For nested conditions
  parent_logic_instance?: string;
}

interface LoopConfig {
  name?: string;
  type: 'for_each' | 'do_until';
  data_source?: string;
  condition?: string;
  max_iterations?: number;
  order?: number;
  actions?: ActionConfig[];
  parent_logic_instance?: string;
}

interface VariableConfig {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'reference' | 'object' | 'array' | 'glide_date_time';
  direction: 'input' | 'output' | 'scratch';
  label?: string;
  description?: string;
  mandatory?: boolean;
  default_value?: string;
  reference_table?: string;
}

interface ManageFlowArgs {
  action: ManageFlowAction;

  // For create action
  flow?: FlowConfig;
  trigger?: TriggerConfig;
  actions?: ActionConfig[];
  conditions?: ConditionConfig[];
  loops?: LoopConfig[];
  variables?: VariableConfig[];

  // For update/delete/clone/activate/deactivate/get_details
  flow_id?: string;
  flow_name?: string;

  // For update action
  updates?: Partial<FlowConfig>;

  // For clone action
  new_name?: string;

  // For add_action
  action_config?: ActionConfig;

  // For add_condition
  condition_config?: ConditionConfig;

  // For add_loop
  loop_config?: LoopConfig;

  // For add_variable
  variable_config?: VariableConfig;

  // For remove_action
  action_id?: string;

  // Options
  auto_activate?: boolean;
  create_snapshot?: boolean;
  use_compression?: boolean;
  validate_only?: boolean;
}

interface VersionInfo {
  useV2Tables: boolean;
  useCompression: boolean;
  version: string;
}

// ==================== TOOL DEFINITION ====================

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_manage_flow',
  description: `Unified Flow Designer management via Direct Table API (EXPERIMENTAL).

⚠️ WARNING: This tool manipulates Flow Designer tables directly.
This is NOT officially supported by ServiceNow.

Actions:
- create: Create a new flow with all components
- update: Update flow properties
- delete: Delete a flow and all related records
- clone: Clone an existing flow
- activate/deactivate: Change flow state
- add_action: Add an action to a flow
- remove_action: Remove an action
- add_condition: Add if/then/else logic
- add_loop: Add for_each/do_until loop
- add_variable: Add flow variable
- get_details: Get flow structure with decompressed values
- publish: Publish flow changes

Features:
- Xanadu+ compression support
- Nested actions in conditions/loops
- Parent-child relationship management
- Automatic version detection`,

  category: 'automation',
  subcategory: 'flow-designer',
  use_cases: ['flow-management', 'automation', 'workflow'],
  complexity: 'advanced',
  frequency: 'medium',

  permission: 'write',
  allowedRoles: ['developer', 'admin'],

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'update', 'delete', 'clone', 'activate', 'deactivate',
               'add_action', 'remove_action', 'add_condition', 'add_loop',
               'add_variable', 'get_details', 'publish'],
        description: 'Management action to perform'
      },
      flow: {
        type: 'object',
        description: '[create] Flow configuration',
        properties: {
          name: { type: 'string' },
          internal_name: { type: 'string' },
          description: { type: 'string' },
          active: { type: 'boolean', default: false },
          application_scope: { type: 'string' },
          run_as: { type: 'string', enum: ['system', 'user_who_triggers', 'specific_user'] },
          run_as_user: { type: 'string' }
        }
      },
      trigger: {
        type: 'object',
        description: `[create] Trigger configuration. Use specific trigger types:
- record_created: Triggers when a record is created on the specified table
- record_updated: Triggers when a record is updated
- record_deleted: Triggers when a record is deleted
- record_created_or_updated: Triggers on both create and update
- scheduled: Time-based trigger (requires schedule config)
- api: REST API trigger
- inbound_email: Email trigger
- service_catalog: Catalog item trigger`,
        properties: {
          type: {
            type: 'string',
            enum: ['record_created', 'record_updated', 'record_deleted', 'record_created_or_updated',
                   'scheduled', 'api', 'inbound_email', 'service_catalog'],
            description: 'Trigger type - use record_created/record_updated instead of generic record'
          },
          table: {
            type: 'string',
            description: 'Table name for record triggers (e.g., incident, task, sys_user)'
          },
          condition: {
            type: 'string',
            description: 'Filter condition (encoded query) for when the trigger should fire'
          }
        }
      },
      actions: {
        type: 'array',
        description: '[create] Actions to add',
        items: { type: 'object' }
      },
      conditions: {
        type: 'array',
        description: '[create] Conditional logic blocks',
        items: { type: 'object' }
      },
      loops: {
        type: 'array',
        description: '[create] Loop constructs',
        items: { type: 'object' }
      },
      variables: {
        type: 'array',
        description: '[create] Flow variables',
        items: { type: 'object' }
      },
      flow_id: {
        type: 'string',
        description: '[update/delete/clone/activate/deactivate/get_details/add_*] Flow sys_id'
      },
      flow_name: {
        type: 'string',
        description: '[update/delete/clone/activate/deactivate/get_details/add_*] Flow name (alternative to flow_id)'
      },
      updates: {
        type: 'object',
        description: '[update] Properties to update'
      },
      new_name: {
        type: 'string',
        description: '[clone] Name for cloned flow'
      },
      action_config: {
        type: 'object',
        description: '[add_action] Action to add'
      },
      condition_config: {
        type: 'object',
        description: '[add_condition] Condition to add'
      },
      loop_config: {
        type: 'object',
        description: '[add_loop] Loop to add'
      },
      variable_config: {
        type: 'object',
        description: '[add_variable] Variable to add'
      },
      action_id: {
        type: 'string',
        description: '[remove_action] Action sys_id to remove'
      },
      auto_activate: {
        type: 'boolean',
        description: 'Activate after create/update',
        default: false
      },
      create_snapshot: {
        type: 'boolean',
        description: 'Create snapshot after changes',
        default: true
      },
      use_compression: {
        type: 'boolean',
        description: 'Use compression for values (auto-detected if not specified)'
      },
      validate_only: {
        type: 'boolean',
        description: 'Validate without making changes',
        default: false
      }
    },
    required: ['action']
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate ServiceNow-compatible sys_id
 */
function generateSysId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate internal name from display name
 */
function generateInternalName(name: string, prefix: string = 'x_snfl'): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 40);
  return `${prefix}_${sanitized}`;
}

/**
 * Compress value for Xanadu+ versions
 * Uses gzip compression + base64 encoding with COMPRESSED: header
 */
function compressValue(value: string | object): string {
  const jsonStr = typeof value === 'object' ? JSON.stringify(value) : value;

  try {
    // Compress with gzip
    const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));
    // Encode as base64
    const encoded = compressed.toString('base64');
    // Add header
    return COMPRESSED_HEADER + encoded;
  } catch (error) {
    console.error('Compression failed, returning uncompressed:', error);
    return jsonStr;
  }
}

/**
 * Decompress value from Xanadu+ format
 */
function decompressValue(value: string): string {
  if (!value || !value.startsWith(COMPRESSED_HEADER)) {
    return value;
  }

  try {
    // Remove header
    const encoded = value.substring(COMPRESSED_HEADER.length);
    // Decode base64
    const compressed = Buffer.from(encoded, 'base64');
    // Decompress gzip
    const decompressed = zlib.gunzipSync(compressed);
    return decompressed.toString('utf-8');
  } catch (error) {
    console.error('Decompression failed:', error);
    return value;
  }
}

/**
 * Check if value is compressed
 */
function isCompressed(value: string): boolean {
  return value && value.startsWith(COMPRESSED_HEADER);
}

/**
 * Detect ServiceNow version and capabilities
 */
async function detectVersion(client: any): Promise<VersionInfo> {
  try {
    // Check if V2 tables exist by querying them
    const v2Response = await client.get('/api/now/table/sys_hub_action_instance_v2', {
      params: { sysparm_limit: 1 }
    });

    // Check if values are compressed by looking at a sample
    let useCompression = false;
    if (v2Response.data.result && v2Response.data.result.length > 0) {
      const sample = v2Response.data.result[0];
      if (sample.values && isCompressed(sample.values)) {
        useCompression = true;
      }
    }

    return {
      useV2Tables: true,
      useCompression,
      version: useCompression ? 'Xanadu+' : 'Washington DC+'
    };
  } catch (error) {
    // V2 tables don't exist, use V1
    return {
      useV2Tables: false,
      useCompression: false,
      version: 'Pre-Washington DC'
    };
  }
}

/**
 * Data Pill Types for Flow Designer
 */
interface DataPill {
  value: string;
  displayValue?: string;
  valueType?: string;
  referenceName?: string;
  referenceQualifier?: string;
}

interface ActionInputValue {
  value: string | DataPill | any;
  displayValue?: string;
  valueType?: string;
  children?: ActionInputValue[];
  parameter?: {
    type: string;
    label: string;
    mandatory: boolean;
    reference?: string;
  };
}

/**
 * Detect if a value is a data pill reference
 * Data pills use {{action_name.field}} or {{trigger.field}} syntax
 */
function isDataPill(value: any): boolean {
  if (typeof value !== 'string') return false;
  return /^\{\{[\w.]+\}\}$/.test(value) || /^\$\{[\w.]+\}$/.test(value);
}

/**
 * Build a data pill reference
 */
function buildDataPill(reference: string, displayValue?: string): ActionInputValue {
  return {
    value: reference,
    displayValue: displayValue || reference,
    valueType: 'pill'
  };
}

/**
 * Build a reference field value
 */
function buildReferenceValue(sysId: string, displayValue: string, table: string): ActionInputValue {
  return {
    value: sysId,
    displayValue: displayValue,
    valueType: 'reference',
    parameter: {
      type: 'reference',
      label: displayValue,
      mandatory: false,
      reference: table
    }
  };
}

/**
 * Build a script value (for Run Script action)
 */
function buildScriptValue(script: string): ActionInputValue {
  return {
    value: script,
    valueType: 'script'
  };
}

/**
 * Build a condition value (for If/Loop conditions)
 */
function buildConditionValue(condition: string): ActionInputValue {
  return {
    value: condition,
    valueType: 'condition'
  };
}

/**
 * Build a glide list value (multi-select)
 */
function buildGlideListValue(values: string[]): ActionInputValue {
  return {
    value: values.join(','),
    valueType: 'glide_list'
  };
}

/**
 * Build values JSON for action instance - ENHANCED VERSION
 * Supports: data pills, references, arrays, scripts, conditions, transforms
 */
function buildActionValues(inputs: Record<string, any> | undefined, useCompression: boolean): string {
  if (!inputs || Object.keys(inputs).length === 0) {
    const emptyValue = '{}';
    return useCompression ? compressValue(emptyValue) : emptyValue;
  }

  const values: Record<string, any> = {};

  for (const [key, value] of Object.entries(inputs)) {
    // Already in Flow Designer format
    if (typeof value === 'object' && value !== null && 'value' in value && 'valueType' in value) {
      values[key] = value;
      continue;
    }

    // Data pill reference ({{...}} or ${...})
    if (isDataPill(value)) {
      values[key] = {
        value: value,
        displayValue: value,
        valueType: 'pill'
      };
      continue;
    }

    // Reference object with sys_id and display
    if (typeof value === 'object' && value !== null && 'sys_id' in value) {
      values[key] = {
        value: value.sys_id,
        displayValue: value.display_value || value.name || value.sys_id,
        valueType: 'reference',
        referenceName: value.table || ''
      };
      continue;
    }

    // Array value (e.g., for multi-select or list inputs)
    if (Array.isArray(value)) {
      if (value.every(v => typeof v === 'string')) {
        // String array - join as comma-separated
        values[key] = {
          value: value.join(','),
          valueType: 'glide_list'
        };
      } else if (value.every(v => typeof v === 'object' && 'sys_id' in v)) {
        // Array of references
        values[key] = {
          value: value.map(v => v.sys_id).join(','),
          displayValue: value.map(v => v.display_value || v.name || v.sys_id).join(', '),
          valueType: 'reference_list'
        };
      } else {
        // Complex array - serialize
        values[key] = {
          value: JSON.stringify(value),
          valueType: 'array'
        };
      }
      continue;
    }

    // Object with special type hints
    if (typeof value === 'object' && value !== null) {
      if ('_type' in value) {
        // Handle special types
        switch (value._type) {
          case 'pill':
          case 'data_pill':
            values[key] = buildDataPill(value.reference, value.display);
            break;
          case 'reference':
            values[key] = buildReferenceValue(value.sys_id, value.display || value.sys_id, value.table);
            break;
          case 'script':
            values[key] = buildScriptValue(value.script || value.value);
            break;
          case 'condition':
            values[key] = buildConditionValue(value.condition || value.value);
            break;
          case 'glide_list':
            values[key] = buildGlideListValue(value.values || []);
            break;
          case 'transform':
            // Transform function applied to a value
            values[key] = {
              value: value.source,
              displayValue: value.display || value.source,
              valueType: 'transform',
              transform: {
                function: value.function,
                params: value.params || []
              }
            };
            break;
          default:
            values[key] = {
              value: JSON.stringify(value),
              valueType: 'object'
            };
        }
        continue;
      }

      // Generic object
      values[key] = {
        value: JSON.stringify(value),
        valueType: 'object'
      };
      continue;
    }

    // Boolean value
    if (typeof value === 'boolean') {
      values[key] = {
        value: String(value),
        valueType: 'boolean'
      };
      continue;
    }

    // Number value
    if (typeof value === 'number') {
      values[key] = {
        value: String(value),
        valueType: Number.isInteger(value) ? 'integer' : 'decimal'
      };
      continue;
    }

    // String value (check for special patterns)
    if (typeof value === 'string') {
      // Check if it looks like a date/time
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        values[key] = {
          value: value,
          valueType: value.includes('T') ? 'glide_date_time' : 'glide_date'
        };
        continue;
      }

      // Check if it looks like a duration (e.g., "1d 2h 30m")
      if (/^\d+[dhms]\s*/.test(value)) {
        values[key] = {
          value: value,
          valueType: 'duration'
        };
        continue;
      }

      // Regular string
      values[key] = {
        value: value,
        valueType: 'string'
      };
      continue;
    }

    // Fallback - convert to string
    values[key] = {
      value: String(value),
      valueType: 'string'
    };
  }

  const jsonStr = JSON.stringify(values);
  return useCompression ? compressValue(jsonStr) : jsonStr;
}

/**
 * Remap sys_ids in values JSON when cloning
 * Updates data pill references from old flow to new flow
 */
function remapValuesForClone(
  valuesJson: string,
  sysIdMap: Map<string, string>,
  oldFlowId: string,
  newFlowId: string
): string {
  if (!valuesJson) return valuesJson;

  let values: any;
  try {
    values = JSON.parse(valuesJson);
  } catch (e) {
    return valuesJson;
  }

  // Recursively update sys_ids and references
  const updateRefs = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => updateRefs(item));
    }

    const updated: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Check if it's a sys_id that needs remapping
        if (sysIdMap.has(value)) {
          updated[key] = sysIdMap.get(value);
        }
        // Check if it's a data pill reference
        else if (value.includes(oldFlowId)) {
          updated[key] = value.replace(oldFlowId, newFlowId);
        }
        else {
          updated[key] = value;
        }
      } else if (typeof value === 'object') {
        updated[key] = updateRefs(value);
      } else {
        updated[key] = value;
      }
    }
    return updated;
  };

  const remapped = updateRefs(values);
  return JSON.stringify(remapped);
}

/**
 * Get trigger type sys_id from name
 */
async function getTriggerTypeSysId(client: any, triggerType: string, when?: string): Promise<string | null> {
  const triggerMap: Record<string, string> = {
    'record_created': 'Created',
    'record_updated': 'Updated',
    'record_deleted': 'Deleted',
    'record_created_or_updated': 'Created or Updated',
    'scheduled': 'Scheduled',
    'api': 'REST API',
    'inbound_email': 'Inbound Email',
    'service_catalog': 'Service Catalog'
  };

  let searchName = triggerType;
  if (triggerType === 'record' && when) {
    searchName = triggerMap[`record_${when}`] || when;
  } else if (triggerMap[triggerType]) {
    searchName = triggerMap[triggerType];
  }

  try {
    const response = await client.get('/api/now/table/sys_hub_trigger_type', {
      params: {
        sysparm_query: `nameLIKE${searchName}^ORlabelLIKE${searchName}`,
        sysparm_limit: 1,
        sysparm_fields: 'sys_id,name,label'
      }
    });

    if (response.data.result && response.data.result.length > 0) {
      return response.data.result[0].sys_id;
    }
  } catch (error) {
    console.error('Failed to get trigger type:', error);
  }

  return null;
}

/**
 * Get action type sys_id from name
 */
async function getActionTypeSysId(client: any, actionType: string): Promise<{ sys_id: string; name: string } | null> {
  if (/^[0-9a-f]{32}$/i.test(actionType)) {
    return { sys_id: actionType, name: actionType };
  }

  try {
    const response = await client.get('/api/now/table/sys_hub_action_type_base', {
      params: {
        sysparm_query: `nameLIKE${actionType}^ORlabelLIKE${actionType}^active=true`,
        sysparm_limit: 1,
        sysparm_fields: 'sys_id,name,label'
      }
    });

    if (response.data.result && response.data.result.length > 0) {
      const result = response.data.result[0];
      return { sys_id: result.sys_id, name: result.name || result.label };
    }
  } catch (error) {
    console.error('Failed to get action type:', error);
  }

  return null;
}

/**
 * Find flow by ID or name
 */
async function findFlow(client: any, flowId?: string, flowName?: string): Promise<any | null> {
  if (!flowId && !flowName) {
    return null;
  }

  try {
    let query = '';
    if (flowId) {
      query = `sys_id=${flowId}`;
    } else if (flowName) {
      query = `name=${flowName}^ORinternal_name=${flowName}`;
    }

    const response = await client.get('/api/now/table/sys_hub_flow', {
      params: {
        sysparm_query: query,
        sysparm_limit: 1
      }
    });

    if (response.data.result && response.data.result.length > 0) {
      return response.data.result[0];
    }
  } catch (error) {
    console.error('Failed to find flow:', error);
  }

  return null;
}

/**
 * Get maximum order number for actions/logic in a flow
 */
async function getMaxOrder(client: any, flowId: string, table: string): Promise<number> {
  try {
    const response = await client.get(`/api/now/table/${table}`, {
      params: {
        sysparm_query: `flow=${flowId}`,
        sysparm_fields: 'order',
        sysparm_orderby: 'DESCorder',
        sysparm_limit: 1
      }
    });

    if (response.data.result && response.data.result.length > 0) {
      return parseInt(response.data.result[0].order || '0', 10);
    }
  } catch (error) {
    console.error('Failed to get max order:', error);
  }

  return 0;
}

// ==================== ACTION HANDLERS ====================

/**
 * Create a new flow
 */
async function handleCreate(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const {
    flow: flowConfig,
    trigger: triggerConfig,
    actions: actionConfigs = [],
    conditions = [],
    loops = [],
    variables = [],
    auto_activate = false,
    create_snapshot = true,
    use_compression,
    validate_only = false
  } = args;

  if (!flowConfig?.name) {
    return createErrorResult('flow.name is required for create action');
  }

  const useCompression = use_compression ?? versionInfo.useCompression;
  const flowSysId = generateSysId();
  const snapshotSysId = generateSysId();
  const triggerSysId = generateSysId();
  const internalName = flowConfig.internal_name || generateInternalName(flowConfig.name);
  const timestamp = new Date().toISOString();

  if (validate_only) {
    return createSuccessResult({
      valid: true,
      would_create: {
        flow: { sys_id: flowSysId, name: flowConfig.name, internal_name: internalName },
        snapshot: create_snapshot ? { sys_id: snapshotSysId } : null,
        trigger: triggerConfig ? { sys_id: triggerSysId, type: triggerConfig.type } : null,
        actions: actionConfigs.length,
        conditions: conditions.length,
        loops: loops.length,
        variables: variables.length
      },
      version_info: versionInfo,
      compression: useCompression
    });
  }

  const createdRecords: any[] = [];
  const errors: string[] = [];

  // 1. CREATE FLOW RECORD
  console.log(`Creating flow: ${flowConfig.name}`);
  const flowData: Record<string, any> = {
    sys_id: flowSysId,
    name: flowConfig.name,
    internal_name: internalName,
    description: flowConfig.description || '',
    active: false,
    sys_class_name: 'sys_hub_flow',
    type: 'flow',
    flow_type: 'flow',
    status: 'draft',
    source_ui: 'flow_designer',
    access: 'public',
    run_as: flowConfig.run_as || 'system'
  };

  if (flowConfig.application_scope && flowConfig.application_scope !== 'global') {
    flowData.sys_scope = flowConfig.application_scope;
  }
  if (flowConfig.run_as_user) {
    flowData.run_as_user = flowConfig.run_as_user;
  }

  try {
    const flowResponse = await client.post(`/api/now/table/${FLOW_TABLES.FLOW}`, flowData);
    createdRecords.push({ table: FLOW_TABLES.FLOW, sys_id: flowSysId, name: flowConfig.name });
    console.log(`✅ Created flow: ${flowSysId}`);
  } catch (error: any) {
    return createErrorResult(`Failed to create flow: ${error.response?.data?.error?.message || error.message}`);
  }

  // 2. CREATE TRIGGER
  if (triggerConfig) {
    console.log(`Creating trigger: ${triggerConfig.type}`);
    const triggerTypeSysId = await getTriggerTypeSysId(client, triggerConfig.type, triggerConfig.when);

    if (!triggerTypeSysId) {
      errors.push(`Trigger type not found: ${triggerConfig.type}`);
    } else {
      const triggerTable = versionInfo.useV2Tables ? FLOW_TABLES.TRIGGER_V2 : FLOW_TABLES.TRIGGER_V1;
      const triggerData: Record<string, any> = {
        sys_id: triggerSysId,
        flow: flowSysId,
        trigger_type: triggerTypeSysId,
        active: true,
        order: 0
      };

      // Handle record triggers (both legacy 'record' type and new specific types)
      const isRecordTrigger = triggerConfig.type === 'record' ||
        triggerConfig.type === 'record_created' ||
        triggerConfig.type === 'record_updated' ||
        triggerConfig.type === 'record_deleted' ||
        triggerConfig.type === 'record_created_or_updated';

      if (isRecordTrigger) {
        if (triggerConfig.table) triggerData.table = triggerConfig.table;
        if (triggerConfig.condition) {
          const conditionValue = { filter_condition: { value: triggerConfig.condition } };
          triggerData.values = useCompression ? compressValue(conditionValue) : JSON.stringify(conditionValue);
        }
      }

      if (triggerConfig.type === 'scheduled' && triggerConfig.schedule) {
        const scheduleValues: Record<string, any> = {};
        if (triggerConfig.schedule.frequency) scheduleValues.frequency = { value: triggerConfig.schedule.frequency };
        if (triggerConfig.schedule.time) scheduleValues.time_of_day = { value: triggerConfig.schedule.time };
        if (triggerConfig.schedule.cron) scheduleValues.cron_expression = { value: triggerConfig.schedule.cron };
        triggerData.values = useCompression ? compressValue(scheduleValues) : JSON.stringify(scheduleValues);
      }

      try {
        await client.post(`/api/now/table/${triggerTable}`, triggerData);
        createdRecords.push({ table: triggerTable, sys_id: triggerSysId, type: triggerConfig.type });
        console.log(`✅ Created trigger: ${triggerSysId}`);
      } catch (error: any) {
        errors.push(`Failed to create trigger: ${error.response?.data?.error?.message || error.message}`);
      }
    }
  }

  // 3. CREATE VARIABLES
  for (let i = 0; i < variables.length; i++) {
    const variable = variables[i];
    const variableSysId = generateSysId();
    console.log(`Creating variable: ${variable.name}`);

    const typeMap: Record<string, string> = {
      'string': 'string', 'integer': 'integer', 'boolean': 'boolean',
      'reference': 'reference', 'object': 'object', 'array': 'array',
      'glide_date_time': 'glide_date_time'
    };

    const variableData: Record<string, any> = {
      sys_id: variableSysId,
      flow: flowSysId,
      name: variable.name,
      label: variable.label || variable.name,
      description: variable.description || '',
      type: typeMap[variable.type] || 'string',
      direction: variable.direction,
      mandatory: variable.mandatory || false,
      order: i * 100
    };

    if (variable.default_value) variableData.default_value = variable.default_value;
    if (variable.reference_table) variableData.reference_table = variable.reference_table;

    try {
      await client.post(`/api/now/table/${FLOW_TABLES.VARIABLE}`, variableData);
      createdRecords.push({ table: FLOW_TABLES.VARIABLE, sys_id: variableSysId, name: variable.name });
      console.log(`✅ Created variable: ${variable.name}`);
    } catch (error: any) {
      errors.push(`Failed to create variable ${variable.name}: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 4. CREATE CONDITIONS (with nested actions)
  const logicTable = versionInfo.useV2Tables ? FLOW_TABLES.LOGIC_V2 : FLOW_TABLES.LOGIC_V1;
  const actionTable = versionInfo.useV2Tables ? FLOW_TABLES.ACTION_V2 : FLOW_TABLES.ACTION_V1;
  let currentOrder = 100;

  for (const condition of conditions) {
    const conditionSysId = generateSysId();
    console.log(`Creating condition: ${condition.name || 'Condition'}`);

    const conditionData: Record<string, any> = {
      sys_id: conditionSysId,
      flow: flowSysId,
      name: condition.name || 'If',
      logic_type: 'if',
      order: condition.order ?? currentOrder,
      active: true
    };

    // Build condition values
    const conditionValues = {
      condition: { value: condition.condition, valueType: 'string' }
    };
    conditionData.values = useCompression ? compressValue(conditionValues) : JSON.stringify(conditionValues);

    if (condition.parent_logic_instance) {
      conditionData.parent_logic_instance = condition.parent_logic_instance;
    }

    try {
      await client.post(`/api/now/table/${logicTable}`, conditionData);
      createdRecords.push({ table: logicTable, sys_id: conditionSysId, name: condition.name || 'If', type: 'condition' });
      console.log(`✅ Created condition: ${conditionSysId}`);

      // Create THEN branch actions
      if (condition.then_actions && condition.then_actions.length > 0) {
        let thenOrder = 100;
        for (const thenAction of condition.then_actions) {
          const actionSysId = generateSysId();
          const actionType = await getActionTypeSysId(client, thenAction.type);

          if (actionType) {
            const actionData: Record<string, any> = {
              sys_id: actionSysId,
              flow: flowSysId,
              action_type: actionType.sys_id,
              name: thenAction.name || actionType.name,
              description: thenAction.description || '',
              order: thenOrder,
              active: true,
              parent_logic_instance: conditionSysId,
              branch: 'then'
            };

            if (thenAction.inputs) {
              actionData.values = buildActionValues(thenAction.inputs, useCompression);
            }

            try {
              await client.post(`/api/now/table/${actionTable}`, actionData);
              createdRecords.push({
                table: actionTable,
                sys_id: actionSysId,
                name: thenAction.name || actionType.name,
                parent: conditionSysId,
                branch: 'then'
              });
              console.log(`✅ Created then-action: ${actionSysId}`);
            } catch (error: any) {
              errors.push(`Failed to create then-action: ${error.response?.data?.error?.message || error.message}`);
            }
          }
          thenOrder += 100;
        }
      }

      // Create ELSE branch actions
      if (condition.else_actions && condition.else_actions.length > 0) {
        let elseOrder = 100;
        for (const elseAction of condition.else_actions) {
          const actionSysId = generateSysId();
          const actionType = await getActionTypeSysId(client, elseAction.type);

          if (actionType) {
            const actionData: Record<string, any> = {
              sys_id: actionSysId,
              flow: flowSysId,
              action_type: actionType.sys_id,
              name: elseAction.name || actionType.name,
              description: elseAction.description || '',
              order: elseOrder,
              active: true,
              parent_logic_instance: conditionSysId,
              branch: 'else'
            };

            if (elseAction.inputs) {
              actionData.values = buildActionValues(elseAction.inputs, useCompression);
            }

            try {
              await client.post(`/api/now/table/${actionTable}`, actionData);
              createdRecords.push({
                table: actionTable,
                sys_id: actionSysId,
                name: elseAction.name || actionType.name,
                parent: conditionSysId,
                branch: 'else'
              });
              console.log(`✅ Created else-action: ${actionSysId}`);
            } catch (error: any) {
              errors.push(`Failed to create else-action: ${error.response?.data?.error?.message || error.message}`);
            }
          }
          elseOrder += 100;
        }
      }

    } catch (error: any) {
      errors.push(`Failed to create condition: ${error.response?.data?.error?.message || error.message}`);
    }
    currentOrder += 100;
  }

  // 5. CREATE LOOPS (with nested actions)
  for (const loop of loops) {
    const loopSysId = generateSysId();
    console.log(`Creating loop: ${loop.name || loop.type}`);

    const loopData: Record<string, any> = {
      sys_id: loopSysId,
      flow: flowSysId,
      name: loop.name || (loop.type === 'for_each' ? 'For Each' : 'Do Until'),
      logic_type: loop.type,
      order: loop.order ?? currentOrder,
      active: true
    };

    // Build loop values
    const loopValues: Record<string, any> = {};
    if (loop.data_source) loopValues.data_source = { value: loop.data_source, valueType: 'reference' };
    if (loop.condition) loopValues.condition = { value: loop.condition, valueType: 'string' };
    if (loop.max_iterations) loopValues.max_iterations = { value: String(loop.max_iterations), valueType: 'integer' };

    if (Object.keys(loopValues).length > 0) {
      loopData.values = useCompression ? compressValue(loopValues) : JSON.stringify(loopValues);
    }

    if (loop.parent_logic_instance) {
      loopData.parent_logic_instance = loop.parent_logic_instance;
    }

    try {
      await client.post(`/api/now/table/${logicTable}`, loopData);
      createdRecords.push({ table: logicTable, sys_id: loopSysId, name: loop.name || loop.type, type: 'loop' });
      console.log(`✅ Created loop: ${loopSysId}`);

      // Create nested actions within loop
      if (loop.actions && loop.actions.length > 0) {
        let loopActionOrder = 100;
        for (const loopAction of loop.actions) {
          const actionSysId = generateSysId();
          const actionType = await getActionTypeSysId(client, loopAction.type);

          if (actionType) {
            const actionData: Record<string, any> = {
              sys_id: actionSysId,
              flow: flowSysId,
              action_type: actionType.sys_id,
              name: loopAction.name || actionType.name,
              description: loopAction.description || '',
              order: loopActionOrder,
              active: true,
              parent_logic_instance: loopSysId
            };

            if (loopAction.inputs) {
              actionData.values = buildActionValues(loopAction.inputs, useCompression);
            }

            try {
              await client.post(`/api/now/table/${actionTable}`, actionData);
              createdRecords.push({
                table: actionTable,
                sys_id: actionSysId,
                name: loopAction.name || actionType.name,
                parent: loopSysId
              });
              console.log(`✅ Created loop-action: ${actionSysId}`);
            } catch (error: any) {
              errors.push(`Failed to create loop-action: ${error.response?.data?.error?.message || error.message}`);
            }
          }
          loopActionOrder += 100;
        }
      }

    } catch (error: any) {
      errors.push(`Failed to create loop: ${error.response?.data?.error?.message || error.message}`);
    }
    currentOrder += 100;
  }

  // 6. CREATE TOP-LEVEL ACTIONS (not nested in conditions/loops)
  for (let i = 0; i < actionConfigs.length; i++) {
    const actionConfig = actionConfigs[i];

    // Skip if this action is meant to be nested (has parent)
    if (actionConfig.parent_logic_instance) continue;

    const actionSysId = generateSysId();
    console.log(`Creating action: ${actionConfig.type}`);

    const actionType = await getActionTypeSysId(client, actionConfig.type);
    if (!actionType) {
      errors.push(`Action type not found: ${actionConfig.type}`);
      continue;
    }

    const actionData: Record<string, any> = {
      sys_id: actionSysId,
      flow: flowSysId,
      action_type: actionType.sys_id,
      name: actionConfig.name || actionType.name,
      description: actionConfig.description || '',
      order: actionConfig.order ?? currentOrder,
      active: true
    };

    if (actionConfig.inputs) {
      actionData.values = buildActionValues(actionConfig.inputs, useCompression);
    }

    try {
      await client.post(`/api/now/table/${actionTable}`, actionData);
      createdRecords.push({ table: actionTable, sys_id: actionSysId, name: actionConfig.name || actionType.name });
      console.log(`✅ Created action: ${actionSysId}`);
    } catch (error: any) {
      errors.push(`Failed to create action ${actionConfig.type}: ${error.response?.data?.error?.message || error.message}`);
    }
    currentOrder += 100;
  }

  // 7. CREATE SNAPSHOT
  if (create_snapshot) {
    console.log('Creating snapshot...');
    const snapshotData: Record<string, any> = {
      sys_id: snapshotSysId,
      flow: flowSysId,
      name: `${flowConfig.name} - Initial`,
      version: '1.0.0',
      active: true,
      published: false
    };

    try {
      await client.post(`/api/now/table/${FLOW_TABLES.SNAPSHOT}`, snapshotData);
      createdRecords.push({ table: FLOW_TABLES.SNAPSHOT, sys_id: snapshotSysId, name: `${flowConfig.name} - Initial` });
      console.log(`✅ Created snapshot: ${snapshotSysId}`);
    } catch (error: any) {
      errors.push(`Failed to create snapshot: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 8. ACTIVATE IF REQUESTED
  if (auto_activate && errors.length === 0) {
    console.log('Activating flow...');
    try {
      await client.patch(`/api/now/table/${FLOW_TABLES.FLOW}/${flowSysId}`, {
        active: true,
        status: 'published'
      });
      console.log(`✅ Flow activated`);
    } catch (error: any) {
      errors.push(`Failed to activate: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  const instanceUrl = (client.defaults?.baseURL || '').replace('/api/now', '');

  return createSuccessResult({
    action: 'create',
    flow: {
      sys_id: flowSysId,
      name: flowConfig.name,
      internal_name: internalName,
      active: auto_activate && errors.length === 0,
      url: `${instanceUrl}/sys_hub_flow.do?sys_id=${flowSysId}`,
      flow_designer_url: `${instanceUrl}/nav_to.do?uri=/$flow-designer.do#/flow/${flowSysId}`
    },
    created_records: createdRecords,
    version_info: versionInfo,
    compression_used: useCompression,
    errors: errors.length > 0 ? errors : undefined
  });
}

/**
 * Update an existing flow
 */
async function handleUpdate(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { flow_id, flow_name, updates } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  if (!updates || Object.keys(updates).length === 0) {
    return createErrorResult('No updates provided');
  }

  try {
    await client.patch(`/api/now/table/${FLOW_TABLES.FLOW}/${flow.sys_id}`, updates);

    return createSuccessResult({
      action: 'update',
      flow_id: flow.sys_id,
      updated_fields: Object.keys(updates)
    });
  } catch (error: any) {
    return createErrorResult(`Failed to update flow: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Delete a flow and all related records
 *
 * IMPORTANT: Delete order respects parent-child hierarchy:
 * 1. Actions (children of logic)
 * 2. Subflow instances (can be nested in logic)
 * 3. Logic instances - hierarchically (children before parents)
 * 4. Triggers
 * 5. Variables
 * 6. Snapshots
 * 7. Flow record (last)
 */
async function handleDelete(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { flow_id, flow_name } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  const deletedRecords: any[] = [];
  const errors: string[] = [];

  const actionTable = versionInfo.useV2Tables ? FLOW_TABLES.ACTION_V2 : FLOW_TABLES.ACTION_V1;
  const logicTable = versionInfo.useV2Tables ? FLOW_TABLES.LOGIC_V2 : FLOW_TABLES.LOGIC_V1;
  const triggerTable = versionInfo.useV2Tables ? FLOW_TABLES.TRIGGER_V2 : FLOW_TABLES.TRIGGER_V1;

  // Helper function to delete records from a table
  const deleteFromTable = async (table: string, query: string): Promise<void> => {
    try {
      const response = await client.get(`/api/now/table/${table}`, {
        params: { sysparm_query: query, sysparm_fields: 'sys_id' }
      });

      if (response.data.result) {
        for (const record of response.data.result) {
          try {
            await client.delete(`/api/now/table/${table}/${record.sys_id}`);
            deletedRecords.push({ table, sys_id: record.sys_id });
          } catch (e: any) {
            errors.push(`Failed to delete ${table}/${record.sys_id}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      // Table might not exist or be empty - this is OK
    }
  };

  console.log(`Deleting flow: ${flow.name} (${flow.sys_id})`);

  // 1. DELETE ACTIONS (children of logic instances)
  console.log('Deleting actions...');
  await deleteFromTable(actionTable, `flow=${flow.sys_id}`);

  // 2. DELETE SUBFLOW INSTANCES (can be nested in logic)
  console.log('Deleting subflow instances...');
  await deleteFromTable(FLOW_TABLES.SUBFLOW, `flow=${flow.sys_id}`);

  // 3. DELETE LOGIC INSTANCES - HIERARCHICALLY
  // First delete children (items WITH parent_logic_instance), then parents
  console.log('Deleting logic instances (hierarchically)...');
  try {
    const logicResponse = await client.get(`/api/now/table/${logicTable}`, {
      params: {
        sysparm_query: `flow=${flow.sys_id}`,
        sysparm_fields: 'sys_id,parent_logic_instance'
      }
    });

    if (logicResponse.data.result) {
      const logicItems = logicResponse.data.result;

      // Separate into children (with parent) and parents (without parent)
      const children = logicItems.filter((item: any) => item.parent_logic_instance);
      const parents = logicItems.filter((item: any) => !item.parent_logic_instance);

      // Build hierarchy depth map for proper ordering
      const depthMap = new Map<string, number>();
      const getDepth = (item: any, visited = new Set<string>()): number => {
        if (!item.parent_logic_instance) return 0;
        if (visited.has(item.sys_id)) return 0; // Prevent infinite loops
        visited.add(item.sys_id);

        const parent = logicItems.find((p: any) => p.sys_id === item.parent_logic_instance);
        if (!parent) return 1;
        return 1 + getDepth(parent, visited);
      };

      // Calculate depth for each item
      for (const item of logicItems) {
        depthMap.set(item.sys_id, getDepth(item));
      }

      // Sort by depth descending (deepest children first)
      const sortedLogic = [...logicItems].sort((a: any, b: any) => {
        const depthA = depthMap.get(a.sys_id) || 0;
        const depthB = depthMap.get(b.sys_id) || 0;
        return depthB - depthA; // Deepest first
      });

      // Delete in sorted order (deepest children first)
      for (const logic of sortedLogic) {
        try {
          await client.delete(`/api/now/table/${logicTable}/${logic.sys_id}`);
          deletedRecords.push({ table: logicTable, sys_id: logic.sys_id });
        } catch (e: any) {
          errors.push(`Failed to delete logic ${logic.sys_id}: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    errors.push(`Failed to fetch logic instances: ${e.message}`);
  }

  // 4. DELETE TRIGGERS
  console.log('Deleting triggers...');
  await deleteFromTable(triggerTable, `flow=${flow.sys_id}`);

  // 5. DELETE VARIABLES
  console.log('Deleting variables...');
  await deleteFromTable(FLOW_TABLES.VARIABLE, `flow=${flow.sys_id}`);

  // 6. DELETE SNAPSHOTS
  console.log('Deleting snapshots...');
  await deleteFromTable(FLOW_TABLES.SNAPSHOT, `flow=${flow.sys_id}`);

  // 7. DELETE FLOW RECORD (last)
  console.log('Deleting flow record...');
  try {
    await client.delete(`/api/now/table/${FLOW_TABLES.FLOW}/${flow.sys_id}`);
    deletedRecords.push({ table: FLOW_TABLES.FLOW, sys_id: flow.sys_id });
    console.log(`✅ Flow deleted: ${flow.sys_id}`);
  } catch (error: any) {
    return createErrorResult(`Failed to delete flow: ${error.response?.data?.error?.message || error.message}`);
  }

  return createSuccessResult({
    action: 'delete',
    flow_id: flow.sys_id,
    flow_name: flow.name,
    deleted_records: deletedRecords,
    delete_order: [
      'actions',
      'subflow_instances',
      'logic_instances (hierarchical)',
      'triggers',
      'variables',
      'snapshots',
      'flow'
    ],
    errors: errors.length > 0 ? errors : undefined
  });
}

/**
 * Clone a flow - FULL IMPLEMENTATION
 * Copies ALL components: flow, triggers, actions, logic, variables, subflows
 * Maintains parent-child relationships and remaps sys_ids
 */
async function handleClone(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { flow_id, flow_name, new_name, use_compression, create_snapshot = true } = args;

  const sourceFlow = await findFlow(client, flow_id, flow_name);
  if (!sourceFlow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  if (!new_name) {
    return createErrorResult('new_name is required for clone action');
  }

  const useCompression = use_compression ?? versionInfo.useCompression;
  const triggerTable = versionInfo.useV2Tables ? FLOW_TABLES.TRIGGER_V2 : FLOW_TABLES.TRIGGER_V1;
  const actionTable = versionInfo.useV2Tables ? FLOW_TABLES.ACTION_V2 : FLOW_TABLES.ACTION_V1;
  const logicTable = versionInfo.useV2Tables ? FLOW_TABLES.LOGIC_V2 : FLOW_TABLES.LOGIC_V1;

  // Map old sys_ids to new sys_ids for remapping references
  const sysIdMap = new Map<string, string>();
  const createdRecords: any[] = [];
  const errors: string[] = [];

  // Generate new IDs
  const newFlowId = generateSysId();
  const newInternalName = generateInternalName(new_name);
  sysIdMap.set(sourceFlow.sys_id, newFlowId);

  console.log(`Cloning flow: ${sourceFlow.name} -> ${new_name}`);

  // ==================== 1. CLONE FLOW RECORD ====================
  const newFlowData: Record<string, any> = {
    sys_id: newFlowId,
    name: new_name,
    internal_name: newInternalName,
    description: `Cloned from: ${sourceFlow.name}\n\n${sourceFlow.description || ''}`,
    active: false,
    sys_class_name: 'sys_hub_flow',
    type: sourceFlow.type || 'flow',
    flow_type: sourceFlow.flow_type || 'flow',
    status: 'draft',
    source_ui: 'flow_designer',
    access: sourceFlow.access || 'public',
    run_as: sourceFlow.run_as || 'system'
  };

  if (sourceFlow.sys_scope) {
    newFlowData.sys_scope = sourceFlow.sys_scope;
  }
  if (sourceFlow.run_as_user) {
    newFlowData.run_as_user = sourceFlow.run_as_user;
  }

  try {
    await client.post(`/api/now/table/${FLOW_TABLES.FLOW}`, newFlowData);
    createdRecords.push({ table: FLOW_TABLES.FLOW, sys_id: newFlowId, name: new_name, type: 'flow' });
    console.log(`✅ Cloned flow record: ${newFlowId}`);
  } catch (error: any) {
    return createErrorResult(`Failed to create cloned flow: ${error.response?.data?.error?.message || error.message}`);
  }

  // ==================== 2. CLONE VARIABLES ====================
  try {
    const variablesResponse = await client.get(`/api/now/table/${FLOW_TABLES.VARIABLE}`, {
      params: { sysparm_query: `flow=${sourceFlow.sys_id}`, sysparm_orderby: 'order' }
    });

    if (variablesResponse.data.result) {
      for (const variable of variablesResponse.data.result) {
        const newVariableId = generateSysId();
        sysIdMap.set(variable.sys_id, newVariableId);

        const newVariable: Record<string, any> = {
          sys_id: newVariableId,
          flow: newFlowId,
          name: variable.name,
          label: variable.label,
          description: variable.description,
          type: variable.type,
          direction: variable.direction,
          mandatory: variable.mandatory,
          order: variable.order,
          default_value: variable.default_value,
          reference_table: variable.reference_table
        };

        try {
          await client.post(`/api/now/table/${FLOW_TABLES.VARIABLE}`, newVariable);
          createdRecords.push({
            table: FLOW_TABLES.VARIABLE,
            sys_id: newVariableId,
            name: variable.name,
            type: 'variable'
          });
          console.log(`✅ Cloned variable: ${variable.name}`);
        } catch (e: any) {
          errors.push(`Failed to clone variable ${variable.name}: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    errors.push(`Failed to fetch variables: ${e.message}`);
  }

  // ==================== 3. CLONE TRIGGERS ====================
  try {
    const triggersResponse = await client.get(`/api/now/table/${triggerTable}`, {
      params: { sysparm_query: `flow=${sourceFlow.sys_id}` }
    });

    if (triggersResponse.data.result) {
      for (const trigger of triggersResponse.data.result) {
        const newTriggerId = generateSysId();
        sysIdMap.set(trigger.sys_id, newTriggerId);

        // Decompress and remap values if needed
        let newValues = trigger.values;
        if (newValues) {
          if (isCompressed(newValues)) {
            const decompressed = decompressValue(newValues);
            const remapped = remapValuesForClone(decompressed, sysIdMap, sourceFlow.sys_id, newFlowId);
            newValues = useCompression ? compressValue(remapped) : remapped;
          } else {
            newValues = remapValuesForClone(newValues, sysIdMap, sourceFlow.sys_id, newFlowId);
            if (useCompression) newValues = compressValue(newValues);
          }
        }

        const newTrigger: Record<string, any> = {
          sys_id: newTriggerId,
          flow: newFlowId,
          trigger_type: trigger.trigger_type,
          table: trigger.table,
          active: trigger.active,
          order: trigger.order,
          values: newValues
        };

        try {
          await client.post(`/api/now/table/${triggerTable}`, newTrigger);
          createdRecords.push({
            table: triggerTable,
            sys_id: newTriggerId,
            type: 'trigger',
            trigger_type: trigger.trigger_type
          });
          console.log(`✅ Cloned trigger: ${newTriggerId}`);
        } catch (e: any) {
          errors.push(`Failed to clone trigger: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    errors.push(`Failed to fetch triggers: ${e.message}`);
  }

  // ==================== 4. CLONE LOGIC (CONDITIONS/LOOPS) ====================
  // First pass: create all logic instances and map sys_ids
  const logicItems: any[] = [];
  try {
    const logicResponse = await client.get(`/api/now/table/${logicTable}`, {
      params: { sysparm_query: `flow=${sourceFlow.sys_id}`, sysparm_orderby: 'order' }
    });

    if (logicResponse.data.result) {
      // First pass: generate new IDs for all logic items
      for (const logic of logicResponse.data.result) {
        const newLogicId = generateSysId();
        sysIdMap.set(logic.sys_id, newLogicId);
        logicItems.push({ ...logic, newSysId: newLogicId });
      }

      // Second pass: create logic items with remapped parent references
      for (const logic of logicItems) {
        // Decompress and remap values
        let newValues = logic.values;
        if (newValues) {
          if (isCompressed(newValues)) {
            const decompressed = decompressValue(newValues);
            const remapped = remapValuesForClone(decompressed, sysIdMap, sourceFlow.sys_id, newFlowId);
            newValues = useCompression ? compressValue(remapped) : remapped;
          } else {
            newValues = remapValuesForClone(newValues, sysIdMap, sourceFlow.sys_id, newFlowId);
            if (useCompression) newValues = compressValue(newValues);
          }
        }

        // Remap parent_logic_instance if it exists
        let newParentLogic = null;
        if (logic.parent_logic_instance) {
          newParentLogic = sysIdMap.get(logic.parent_logic_instance) || logic.parent_logic_instance;
        }

        const newLogic: Record<string, any> = {
          sys_id: logic.newSysId,
          flow: newFlowId,
          name: logic.name,
          logic_type: logic.logic_type,
          order: logic.order,
          active: logic.active,
          values: newValues,
          condition: logic.condition
        };

        if (newParentLogic) {
          newLogic.parent_logic_instance = newParentLogic;
        }
        if (logic.branch) {
          newLogic.branch = logic.branch;
        }

        try {
          await client.post(`/api/now/table/${logicTable}`, newLogic);
          createdRecords.push({
            table: logicTable,
            sys_id: logic.newSysId,
            name: logic.name,
            type: 'logic',
            logic_type: logic.logic_type
          });
          console.log(`✅ Cloned logic: ${logic.name} (${logic.logic_type})`);
        } catch (e: any) {
          errors.push(`Failed to clone logic ${logic.name}: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    errors.push(`Failed to fetch logic: ${e.message}`);
  }

  // ==================== 5. CLONE ACTIONS ====================
  try {
    const actionsResponse = await client.get(`/api/now/table/${actionTable}`, {
      params: { sysparm_query: `flow=${sourceFlow.sys_id}`, sysparm_orderby: 'order' }
    });

    if (actionsResponse.data.result) {
      // First pass: generate new IDs
      const actionItems: any[] = [];
      for (const action of actionsResponse.data.result) {
        const newActionId = generateSysId();
        sysIdMap.set(action.sys_id, newActionId);
        actionItems.push({ ...action, newSysId: newActionId });
      }

      // Second pass: create actions with remapped references
      for (const action of actionItems) {
        // Decompress and remap values
        let newValues = action.values;
        if (newValues) {
          if (isCompressed(newValues)) {
            const decompressed = decompressValue(newValues);
            const remapped = remapValuesForClone(decompressed, sysIdMap, sourceFlow.sys_id, newFlowId);
            newValues = useCompression ? compressValue(remapped) : remapped;
          } else {
            newValues = remapValuesForClone(newValues, sysIdMap, sourceFlow.sys_id, newFlowId);
            if (useCompression) newValues = compressValue(newValues);
          }
        }

        // Remap parent_logic_instance if it exists
        let newParentLogic = null;
        if (action.parent_logic_instance) {
          newParentLogic = sysIdMap.get(action.parent_logic_instance) || action.parent_logic_instance;
        }

        const newAction: Record<string, any> = {
          sys_id: action.newSysId,
          flow: newFlowId,
          action_type: action.action_type,
          name: action.name,
          description: action.description,
          order: action.order,
          active: action.active,
          values: newValues
        };

        if (newParentLogic) {
          newAction.parent_logic_instance = newParentLogic;
        }
        if (action.branch) {
          newAction.branch = action.branch;
        }

        try {
          await client.post(`/api/now/table/${actionTable}`, newAction);
          createdRecords.push({
            table: actionTable,
            sys_id: action.newSysId,
            name: action.name,
            type: 'action',
            action_type: action.action_type
          });
          console.log(`✅ Cloned action: ${action.name}`);
        } catch (e: any) {
          errors.push(`Failed to clone action ${action.name}: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    errors.push(`Failed to fetch actions: ${e.message}`);
  }

  // ==================== 6. CLONE SUBFLOW INSTANCES ====================
  try {
    const subflowsResponse = await client.get(`/api/now/table/${FLOW_TABLES.SUBFLOW}`, {
      params: { sysparm_query: `flow=${sourceFlow.sys_id}` }
    });

    if (subflowsResponse.data.result) {
      for (const subflow of subflowsResponse.data.result) {
        const newSubflowId = generateSysId();
        sysIdMap.set(subflow.sys_id, newSubflowId);

        // Decompress and remap values
        let newValues = subflow.values;
        if (newValues) {
          if (isCompressed(newValues)) {
            const decompressed = decompressValue(newValues);
            const remapped = remapValuesForClone(decompressed, sysIdMap, sourceFlow.sys_id, newFlowId);
            newValues = useCompression ? compressValue(remapped) : remapped;
          } else {
            newValues = remapValuesForClone(newValues, sysIdMap, sourceFlow.sys_id, newFlowId);
            if (useCompression) newValues = compressValue(newValues);
          }
        }

        // Remap parent_logic_instance if it exists
        let newParentLogic = null;
        if (subflow.parent_logic_instance) {
          newParentLogic = sysIdMap.get(subflow.parent_logic_instance) || subflow.parent_logic_instance;
        }

        const newSubflow: Record<string, any> = {
          sys_id: newSubflowId,
          flow: newFlowId,
          sub_flow: subflow.sub_flow, // Reference to the actual subflow definition
          name: subflow.name,
          description: subflow.description,
          order: subflow.order,
          active: subflow.active,
          values: newValues
        };

        if (newParentLogic) {
          newSubflow.parent_logic_instance = newParentLogic;
        }
        if (subflow.branch) {
          newSubflow.branch = subflow.branch;
        }

        try {
          await client.post(`/api/now/table/${FLOW_TABLES.SUBFLOW}`, newSubflow);
          createdRecords.push({
            table: FLOW_TABLES.SUBFLOW,
            sys_id: newSubflowId,
            name: subflow.name,
            type: 'subflow_instance',
            sub_flow: subflow.sub_flow
          });
          console.log(`✅ Cloned subflow instance: ${subflow.name}`);
        } catch (e: any) {
          errors.push(`Failed to clone subflow instance ${subflow.name}: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    // Subflow table might not exist or be empty
  }

  // ==================== 7. CREATE SNAPSHOT ====================
  if (create_snapshot) {
    const snapshotId = generateSysId();
    const snapshotData: Record<string, any> = {
      sys_id: snapshotId,
      flow: newFlowId,
      name: `${new_name} - Initial (Cloned)`,
      version: '1.0.0',
      active: true,
      published: false
    };

    try {
      await client.post(`/api/now/table/${FLOW_TABLES.SNAPSHOT}`, snapshotData);
      createdRecords.push({
        table: FLOW_TABLES.SNAPSHOT,
        sys_id: snapshotId,
        name: snapshotData.name,
        type: 'snapshot'
      });
      console.log(`✅ Created snapshot: ${snapshotId}`);
    } catch (e: any) {
      errors.push(`Failed to create snapshot: ${e.message}`);
    }
  }

  // ==================== BUILD RESULT ====================
  const instanceUrl = (client.defaults?.baseURL || '').replace('/api/now', '');

  // Summary statistics
  const summary = {
    flow: 1,
    variables: createdRecords.filter(r => r.type === 'variable').length,
    triggers: createdRecords.filter(r => r.type === 'trigger').length,
    logic: createdRecords.filter(r => r.type === 'logic').length,
    actions: createdRecords.filter(r => r.type === 'action').length,
    subflow_instances: createdRecords.filter(r => r.type === 'subflow_instance').length,
    snapshots: createdRecords.filter(r => r.type === 'snapshot').length,
    total: createdRecords.length
  };

  return createSuccessResult({
    action: 'clone',
    source_flow: {
      sys_id: sourceFlow.sys_id,
      name: sourceFlow.name
    },
    cloned_flow: {
      sys_id: newFlowId,
      name: new_name,
      internal_name: newInternalName,
      active: false,
      url: `${instanceUrl}/sys_hub_flow.do?sys_id=${newFlowId}`,
      flow_designer_url: `${instanceUrl}/nav_to.do?uri=/$flow-designer.do#/flow/${newFlowId}`
    },
    summary,
    created_records: createdRecords,
    sys_id_mapping: Object.fromEntries(sysIdMap),
    version_info: versionInfo,
    compression_used: useCompression,
    errors: errors.length > 0 ? errors : undefined
  });
}

/**
 * Activate a flow
 */
async function handleActivate(args: ManageFlowArgs, client: any): Promise<ToolResult> {
  const { flow_id, flow_name } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  try {
    await client.patch(`/api/now/table/${FLOW_TABLES.FLOW}/${flow.sys_id}`, {
      active: true,
      status: 'published'
    });

    return createSuccessResult({
      action: 'activate',
      flow_id: flow.sys_id,
      flow_name: flow.name,
      active: true
    });
  } catch (error: any) {
    return createErrorResult(`Failed to activate: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Deactivate a flow
 */
async function handleDeactivate(args: ManageFlowArgs, client: any): Promise<ToolResult> {
  const { flow_id, flow_name } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  try {
    await client.patch(`/api/now/table/${FLOW_TABLES.FLOW}/${flow.sys_id}`, {
      active: false
    });

    return createSuccessResult({
      action: 'deactivate',
      flow_id: flow.sys_id,
      flow_name: flow.name,
      active: false
    });
  } catch (error: any) {
    return createErrorResult(`Failed to deactivate: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Add an action to an existing flow
 */
async function handleAddAction(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { flow_id, flow_name, action_config, use_compression } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  if (!action_config?.type) {
    return createErrorResult('action_config.type is required');
  }

  const useCompression = use_compression ?? versionInfo.useCompression;
  const actionTable = versionInfo.useV2Tables ? FLOW_TABLES.ACTION_V2 : FLOW_TABLES.ACTION_V1;
  const actionSysId = generateSysId();

  const actionType = await getActionTypeSysId(client, action_config.type);
  if (!actionType) {
    return createErrorResult(`Action type not found: ${action_config.type}`);
  }

  const maxOrder = await getMaxOrder(client, flow.sys_id, actionTable);

  const actionData: Record<string, any> = {
    sys_id: actionSysId,
    flow: flow.sys_id,
    action_type: actionType.sys_id,
    name: action_config.name || actionType.name,
    description: action_config.description || '',
    order: action_config.order ?? (maxOrder + 100),
    active: true
  };

  if (action_config.parent_logic_instance) {
    actionData.parent_logic_instance = action_config.parent_logic_instance;
  }
  if (action_config.branch) {
    actionData.branch = action_config.branch;
  }
  if (action_config.inputs) {
    actionData.values = buildActionValues(action_config.inputs, useCompression);
  }

  try {
    await client.post(`/api/now/table/${actionTable}`, actionData);

    return createSuccessResult({
      action: 'add_action',
      flow_id: flow.sys_id,
      added_action: {
        sys_id: actionSysId,
        name: action_config.name || actionType.name,
        type: action_config.type,
        order: actionData.order
      }
    });
  } catch (error: any) {
    return createErrorResult(`Failed to add action: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Remove an action from a flow
 */
async function handleRemoveAction(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { action_id } = args;

  if (!action_id) {
    return createErrorResult('action_id is required');
  }

  const actionTable = versionInfo.useV2Tables ? FLOW_TABLES.ACTION_V2 : FLOW_TABLES.ACTION_V1;

  try {
    await client.delete(`/api/now/table/${actionTable}/${action_id}`);

    return createSuccessResult({
      action: 'remove_action',
      action_id,
      removed: true
    });
  } catch (error: any) {
    return createErrorResult(`Failed to remove action: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Add a condition to an existing flow
 */
async function handleAddCondition(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { flow_id, flow_name, condition_config, use_compression } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  if (!condition_config?.condition) {
    return createErrorResult('condition_config.condition is required');
  }

  const useCompression = use_compression ?? versionInfo.useCompression;
  const logicTable = versionInfo.useV2Tables ? FLOW_TABLES.LOGIC_V2 : FLOW_TABLES.LOGIC_V1;
  const conditionSysId = generateSysId();
  const maxOrder = await getMaxOrder(client, flow.sys_id, logicTable);

  const conditionData: Record<string, any> = {
    sys_id: conditionSysId,
    flow: flow.sys_id,
    name: condition_config.name || 'If',
    logic_type: 'if',
    order: condition_config.order ?? (maxOrder + 100),
    active: true
  };

  const conditionValues = { condition: { value: condition_config.condition, valueType: 'string' } };
  conditionData.values = useCompression ? compressValue(conditionValues) : JSON.stringify(conditionValues);

  if (condition_config.parent_logic_instance) {
    conditionData.parent_logic_instance = condition_config.parent_logic_instance;
  }

  try {
    await client.post(`/api/now/table/${logicTable}`, conditionData);

    return createSuccessResult({
      action: 'add_condition',
      flow_id: flow.sys_id,
      condition: {
        sys_id: conditionSysId,
        name: condition_config.name || 'If',
        order: conditionData.order
      }
    });
  } catch (error: any) {
    return createErrorResult(`Failed to add condition: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Add a loop to an existing flow
 */
async function handleAddLoop(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { flow_id, flow_name, loop_config, use_compression } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  if (!loop_config?.type) {
    return createErrorResult('loop_config.type is required');
  }

  const useCompression = use_compression ?? versionInfo.useCompression;
  const logicTable = versionInfo.useV2Tables ? FLOW_TABLES.LOGIC_V2 : FLOW_TABLES.LOGIC_V1;
  const loopSysId = generateSysId();
  const maxOrder = await getMaxOrder(client, flow.sys_id, logicTable);

  const loopData: Record<string, any> = {
    sys_id: loopSysId,
    flow: flow.sys_id,
    name: loop_config.name || (loop_config.type === 'for_each' ? 'For Each' : 'Do Until'),
    logic_type: loop_config.type,
    order: loop_config.order ?? (maxOrder + 100),
    active: true
  };

  const loopValues: Record<string, any> = {};
  if (loop_config.data_source) loopValues.data_source = { value: loop_config.data_source, valueType: 'reference' };
  if (loop_config.condition) loopValues.condition = { value: loop_config.condition, valueType: 'string' };
  if (loop_config.max_iterations) loopValues.max_iterations = { value: String(loop_config.max_iterations), valueType: 'integer' };

  if (Object.keys(loopValues).length > 0) {
    loopData.values = useCompression ? compressValue(loopValues) : JSON.stringify(loopValues);
  }

  if (loop_config.parent_logic_instance) {
    loopData.parent_logic_instance = loop_config.parent_logic_instance;
  }

  try {
    await client.post(`/api/now/table/${logicTable}`, loopData);

    return createSuccessResult({
      action: 'add_loop',
      flow_id: flow.sys_id,
      loop: {
        sys_id: loopSysId,
        name: loopData.name,
        type: loop_config.type,
        order: loopData.order
      }
    });
  } catch (error: any) {
    return createErrorResult(`Failed to add loop: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Add a variable to an existing flow
 */
async function handleAddVariable(args: ManageFlowArgs, client: any): Promise<ToolResult> {
  const { flow_id, flow_name, variable_config } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  if (!variable_config?.name || !variable_config?.type || !variable_config?.direction) {
    return createErrorResult('variable_config requires name, type, and direction');
  }

  const variableSysId = generateSysId();

  // Get max order for variables
  let maxOrder = 0;
  try {
    const response = await client.get(`/api/now/table/${FLOW_TABLES.VARIABLE}`, {
      params: {
        sysparm_query: `flow=${flow.sys_id}`,
        sysparm_fields: 'order',
        sysparm_orderby: 'DESCorder',
        sysparm_limit: 1
      }
    });
    if (response.data.result && response.data.result.length > 0) {
      maxOrder = parseInt(response.data.result[0].order || '0', 10);
    }
  } catch (e) {}

  const variableData: Record<string, any> = {
    sys_id: variableSysId,
    flow: flow.sys_id,
    name: variable_config.name,
    label: variable_config.label || variable_config.name,
    description: variable_config.description || '',
    type: variable_config.type,
    direction: variable_config.direction,
    mandatory: variable_config.mandatory || false,
    order: maxOrder + 100
  };

  if (variable_config.default_value) variableData.default_value = variable_config.default_value;
  if (variable_config.reference_table) variableData.reference_table = variable_config.reference_table;

  try {
    await client.post(`/api/now/table/${FLOW_TABLES.VARIABLE}`, variableData);

    return createSuccessResult({
      action: 'add_variable',
      flow_id: flow.sys_id,
      variable: {
        sys_id: variableSysId,
        name: variable_config.name,
        type: variable_config.type,
        direction: variable_config.direction
      }
    });
  } catch (error: any) {
    return createErrorResult(`Failed to add variable: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Get detailed flow structure with decompressed values
 */
async function handleGetDetails(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { flow_id, flow_name } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  const details: any = {
    flow: flow,
    trigger: null,
    actions: [],
    logic: [],
    variables: [],
    snapshots: []
  };

  // Get trigger
  const triggerTable = versionInfo.useV2Tables ? FLOW_TABLES.TRIGGER_V2 : FLOW_TABLES.TRIGGER_V1;
  try {
    const response = await client.get(`/api/now/table/${triggerTable}`, {
      params: { sysparm_query: `flow=${flow.sys_id}` }
    });
    if (response.data.result && response.data.result.length > 0) {
      const trigger = response.data.result[0];
      if (trigger.values && isCompressed(trigger.values)) {
        trigger.values_decompressed = JSON.parse(decompressValue(trigger.values));
      } else if (trigger.values) {
        try {
          trigger.values_parsed = JSON.parse(trigger.values);
        } catch (e) {}
      }
      details.trigger = trigger;
    }
  } catch (e) {}

  // Get actions
  const actionTable = versionInfo.useV2Tables ? FLOW_TABLES.ACTION_V2 : FLOW_TABLES.ACTION_V1;
  try {
    const response = await client.get(`/api/now/table/${actionTable}`, {
      params: { sysparm_query: `flow=${flow.sys_id}`, sysparm_orderby: 'order' }
    });
    if (response.data.result) {
      details.actions = response.data.result.map((action: any) => {
        if (action.values && isCompressed(action.values)) {
          action.values_decompressed = JSON.parse(decompressValue(action.values));
        } else if (action.values) {
          try {
            action.values_parsed = JSON.parse(action.values);
          } catch (e) {}
        }
        return action;
      });
    }
  } catch (e) {}

  // Get logic (conditions, loops)
  const logicTable = versionInfo.useV2Tables ? FLOW_TABLES.LOGIC_V2 : FLOW_TABLES.LOGIC_V1;
  try {
    const response = await client.get(`/api/now/table/${logicTable}`, {
      params: { sysparm_query: `flow=${flow.sys_id}`, sysparm_orderby: 'order' }
    });
    if (response.data.result) {
      details.logic = response.data.result.map((logic: any) => {
        if (logic.values && isCompressed(logic.values)) {
          logic.values_decompressed = JSON.parse(decompressValue(logic.values));
        } else if (logic.values) {
          try {
            logic.values_parsed = JSON.parse(logic.values);
          } catch (e) {}
        }
        return logic;
      });
    }
  } catch (e) {}

  // Get variables
  try {
    const response = await client.get(`/api/now/table/${FLOW_TABLES.VARIABLE}`, {
      params: { sysparm_query: `flow=${flow.sys_id}`, sysparm_orderby: 'order' }
    });
    if (response.data.result) {
      details.variables = response.data.result;
    }
  } catch (e) {}

  // Get snapshots
  try {
    const response = await client.get(`/api/now/table/${FLOW_TABLES.SNAPSHOT}`, {
      params: { sysparm_query: `flow=${flow.sys_id}`, sysparm_orderby: 'DESCsys_created_on', sysparm_limit: 5 }
    });
    if (response.data.result) {
      details.snapshots = response.data.result;
    }
  } catch (e) {}

  // Build tree structure for nested actions
  const buildTree = () => {
    const tree: any[] = [];
    const itemMap = new Map<string, any>();

    // Index all items
    for (const action of details.actions) {
      itemMap.set(action.sys_id, { ...action, _type: 'action', _children: [] });
    }
    for (const logic of details.logic) {
      itemMap.set(logic.sys_id, { ...logic, _type: 'logic', _children: [] });
    }

    // Build hierarchy
    itemMap.forEach((item, id) => {
      if (item.parent_logic_instance) {
        const parent = itemMap.get(item.parent_logic_instance);
        if (parent) {
          parent._children.push(item);
        } else {
          tree.push(item);
        }
      } else {
        tree.push(item);
      }
    });

    // Sort by order
    const sortByOrder = (items: any[]) => {
      items.sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const item of items) {
        if (item._children && item._children.length > 0) {
          sortByOrder(item._children);
        }
      }
    };
    sortByOrder(tree);

    return tree;
  };

  details.tree_structure = buildTree();
  details.version_info = versionInfo;

  return createSuccessResult({
    action: 'get_details',
    ...details
  });
}

/**
 * Publish flow changes (create new snapshot and activate)
 */
async function handlePublish(args: ManageFlowArgs, client: any, versionInfo: VersionInfo): Promise<ToolResult> {
  const { flow_id, flow_name } = args;

  const flow = await findFlow(client, flow_id, flow_name);
  if (!flow) {
    return createErrorResult(`Flow not found: ${flow_id || flow_name}`);
  }

  const snapshotSysId = generateSysId();

  // Create new snapshot
  const snapshotData: Record<string, any> = {
    sys_id: snapshotSysId,
    flow: flow.sys_id,
    name: `${flow.name} - Published ${new Date().toISOString()}`,
    version: '1.0.0',
    active: true,
    published: true
  };

  try {
    await client.post(`/api/now/table/${FLOW_TABLES.SNAPSHOT}`, snapshotData);
  } catch (error: any) {
    return createErrorResult(`Failed to create snapshot: ${error.response?.data?.error?.message || error.message}`);
  }

  // Activate flow
  try {
    await client.patch(`/api/now/table/${FLOW_TABLES.FLOW}/${flow.sys_id}`, {
      active: true,
      status: 'published'
    });
  } catch (error: any) {
    return createErrorResult(`Failed to activate flow: ${error.response?.data?.error?.message || error.message}`);
  }

  return createSuccessResult({
    action: 'publish',
    flow_id: flow.sys_id,
    flow_name: flow.name,
    snapshot_id: snapshotSysId,
    active: true
  });
}

// ==================== MAIN EXECUTOR ====================

export async function execute(args: ManageFlowArgs, context: ServiceNowContext): Promise<ToolResult> {
  const { action } = args;

  if (!action) {
    return createErrorResult('action is required');
  }

  try {
    const client = await getAuthenticatedClient(context);
    const versionInfo = await detectVersion(client);

    console.log(`Executing flow management action: ${action}`);
    console.log(`Detected version: ${versionInfo.version}, compression: ${versionInfo.useCompression}`);

    switch (action) {
      case 'create':
        return handleCreate(args, client, versionInfo);
      case 'update':
        return handleUpdate(args, client, versionInfo);
      case 'delete':
        return handleDelete(args, client, versionInfo);
      case 'clone':
        return handleClone(args, client, versionInfo);
      case 'activate':
        return handleActivate(args, client);
      case 'deactivate':
        return handleDeactivate(args, client);
      case 'add_action':
        return handleAddAction(args, client, versionInfo);
      case 'remove_action':
        return handleRemoveAction(args, client, versionInfo);
      case 'add_condition':
        return handleAddCondition(args, client, versionInfo);
      case 'add_loop':
        return handleAddLoop(args, client, versionInfo);
      case 'add_variable':
        return handleAddVariable(args, client);
      case 'get_details':
        return handleGetDetails(args, client, versionInfo);
      case 'publish':
        return handlePublish(args, client, versionInfo);
      default:
        return createErrorResult(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return createErrorResult(`Flow management failed: ${error.message}`);
  }
}

export const version = '2.1.0-experimental';
export const author = 'Snow-Flow v8.41.17 - Flow Designer Management';
