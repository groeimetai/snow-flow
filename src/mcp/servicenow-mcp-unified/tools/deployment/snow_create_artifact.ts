/**
 * snow_create_artifact - Universal artifact creation for ServiceNow
 *
 * Create any ServiceNow artifact (widgets, pages, scripts, etc.) with a unified interface.
 * Replaces the deprecated snow_deploy tool with a more flexible approach.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_artifact',
  description: `Create ServiceNow artifacts (Service Portal widgets, UI pages, scripts, tables, fields, etc.) with a unified interface.

🗃️ TABLE & FIELD CREATION:
- type='table': Create custom tables (sys_db_object)
  - extends_table: Extend from task, cmdb_ci, core_company, etc.
  - create_module: Auto-create navigation module (default: true)
  - create_access_controls: Auto-create read/write/create/delete ACLs
- type='field': Add fields to existing tables (sys_dictionary)
  - internal_type: string, integer, boolean, reference, choice, etc.
  - choice_options: For choice fields, provide [{label, value}] array
  - reference_table: Required for reference type fields

📦 APPLICATION SCOPE:
- By default, artifacts are created in the CURRENT application scope
- Use application_scope parameter to explicitly specify a scope
- Use "global" for global scope artifacts
- Artifacts created in a scoped application will only be visible/accessible within that scope`,
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'deployment',
  use_cases: ['deployment', 'creation', 'artifacts', 'widgets', 'tables', 'fields', 'schema'],
  complexity: 'intermediate',
  frequency: 'high',

  // Permission enforcement
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Artifact type to create',
        enum: [
          'sp_widget',           // Service Portal widget
          'sp_page',             // Service Portal page
          'sys_ux_page',         // UI Builder page
          'script_include',      // Script Include
          'business_rule',       // Business Rule
          'client_script',       // Client Script
          'ui_policy',           // UI Policy
          'ui_action',           // UI Action
          'rest_message',        // REST Message
          'scheduled_job',       // Scheduled Job
          'transform_map',       // Transform Map
          'fix_script',          // Fix Script
          'table',               // Custom table
          'field'                // Custom field
        ]
      },
      // Widget-specific fields
      name: { type: 'string', description: 'Artifact name/ID (required)' },
      title: { type: 'string', description: 'Display title (for widgets/pages)' },
      description: { type: 'string', description: 'Artifact description' },

      // Widget/Page scripts
      template: { type: 'string', description: 'HTML template (for widgets/pages)' },
      server_script: { type: 'string', description: 'Server-side script (ES5 only!)' },
      client_script: { type: 'string', description: 'Client-side script' },
      css: { type: 'string', description: 'CSS stylesheet (for widgets)' },
      option_schema: { type: 'string', description: 'Option schema JSON (for widgets)' },
      data_table_enabled: { type: 'boolean', description: 'Enable widget preview/data table mode (for widgets). Default: true', default: true },

      // Script Include fields
      script: { type: 'string', description: 'Script content (for script includes, business rules, etc.)' },
      api_name: { type: 'string', description: 'API name (for script includes)' },

      // Business Rule fields
      table: { type: 'string', description: 'Table name (for business rules, client scripts, etc.)' },
      when: { type: 'string', enum: ['before', 'after', 'async', 'display'], description: 'When to execute (business rules)' },
      insert: { type: 'boolean', description: 'Run on insert (business rules)' },
      update: { type: 'boolean', description: 'Run on update (business rules)' },
      delete: { type: 'boolean', description: 'Run on delete (business rules)' },
      query: { type: 'boolean', description: 'Run on query (business rules)' },
      active: { type: 'boolean', description: 'Activate immediately', default: true },

      // REST Message fields
      rest_endpoint: { type: 'string', description: 'Base REST endpoint URL (for REST messages)' },
      authentication_type: {
        type: 'string',
        enum: ['no_authentication', 'basic', 'oauth2'],
        description: 'Authentication type (for REST messages)'
      },
      http_method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        description: 'HTTP method for REST message functions'
      },

      // Scheduled Job fields
      run_as: { type: 'string', description: 'User to run scheduled job as (sys_id)' },
      run_start: { type: 'string', description: 'Start date/time for scheduled job (ISO format)' },
      repeat_interval: { type: 'string', description: 'Repeat interval (e.g., "0 0 * * *" for daily)' },

      // Transform Map fields
      source_table: { type: 'string', description: 'Source table for transform map' },
      target_table: { type: 'string', description: 'Target table for transform map' },

      // UI Action fields
      form_action: { type: 'boolean', description: 'Show as form button (UI actions)' },
      form_style: { type: 'string', description: 'Button style (UI actions)' },
      list_action: { type: 'boolean', description: 'Show in list context menu (UI actions)' },
      order: { type: 'number', description: 'Display order' },
      condition: { type: 'string', description: 'Condition for when to show/execute' },

      // UI Policy fields
      on_load: { type: 'boolean', description: 'Run on form load (UI policies)' },
      reverse_if_false: { type: 'boolean', description: 'Reverse actions if condition false (UI policies)' },

      // Table creation fields
      label: { type: 'string', description: 'Table label (for tables) or field label (for fields)' },
      extends_table: { type: 'string', description: 'Parent table to extend (for tables). Common options: task, cmdb_ci, core_company' },
      is_extendable: { type: 'boolean', description: 'Whether the table can be extended (for tables)', default: true },
      create_module: { type: 'boolean', description: 'Create navigation module for the table', default: true },
      create_access_controls: { type: 'boolean', description: 'Create default ACLs for the table', default: false },

      // Field creation fields (when type='field')
      column_name: { type: 'string', description: 'Column/field name (for fields)' },
      column_label: { type: 'string', description: 'Column/field display label (for fields)' },
      internal_type: {
        type: 'string',
        description: 'Field type (for fields)',
        enum: ['string', 'integer', 'boolean', 'reference', 'glide_date', 'glide_date_time',
               'decimal', 'float', 'choice', 'journal', 'journal_input', 'html', 'url',
               'email', 'phone_number_e164', 'currency', 'price', 'sys_class_name', 'document_id']
      },
      reference_table: { type: 'string', description: 'Reference table name (required for reference fields)' },
      max_length: { type: 'number', description: 'Maximum length for string fields', default: 255 },
      mandatory: { type: 'boolean', description: 'Whether the field is mandatory', default: false },
      default_value: { type: 'string', description: 'Default value for the field' },
      choice_options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: 'string' }
          }
        },
        description: 'Choice options for choice fields (array of {label, value} objects)'
      },

      // Validation options
      validate_es5: {
        type: 'boolean',
        description: 'Validate ES5 syntax for server scripts',
        default: true
      },

      // Application scope
      application_scope: {
        type: 'string',
        description: 'Application scope for the artifact. Use "global" for global scope, or provide application sys_id/scope name. If not specified, uses the current active scope.'
      }
    },
    required: ['type', 'name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    type,
    name,
    title,
    description = '',
    template,
    server_script,
    client_script,
    css,
    option_schema,
    data_table_enabled = true,
    script,
    api_name,
    table,
    when,
    insert,
    update,
    delete: deleteOp,
    query: queryOp,
    active = true,
    validate_es5 = true,
    application_scope,
    // REST Message fields
    rest_endpoint,
    authentication_type,
    http_method,
    // Scheduled Job fields
    run_as,
    run_start,
    repeat_interval,
    // Transform Map fields
    source_table,
    target_table,
    // UI Action fields
    form_action,
    form_style,
    list_action,
    order,
    condition,
    // UI Policy fields
    on_load,
    reverse_if_false,
    // Table creation fields
    label,
    extends_table,
    is_extendable = true,
    create_module = true,
    create_access_controls = false,
    // Field creation fields
    column_name,
    column_label,
    internal_type,
    reference_table,
    max_length = 255,
    mandatory = false,
    default_value,
    choice_options
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Resolve application scope
    let resolvedScopeId: string | null = null;
    let resolvedScopeName: string = 'Current Scope';
    let resolvedScopePrefix: string = '';

    if (application_scope) {
      if (application_scope === 'global') {
        resolvedScopeId = 'global';
        resolvedScopeName = 'Global';
        resolvedScopePrefix = 'global';
      } else {
        // Try to find by sys_id first
        let appResponse = await client.get('/api/now/table/sys_app', {
          params: {
            sysparm_query: `sys_id=${application_scope}`,
            sysparm_fields: 'sys_id,name,scope',
            sysparm_limit: 1
          }
        });

        // Try by scope name
        if (!appResponse.data.result || appResponse.data.result.length === 0) {
          appResponse = await client.get('/api/now/table/sys_app', {
            params: {
              sysparm_query: `scope=${application_scope}`,
              sysparm_fields: 'sys_id,name,scope',
              sysparm_limit: 1
            }
          });
        }

        // Try by name
        if (!appResponse.data.result || appResponse.data.result.length === 0) {
          appResponse = await client.get('/api/now/table/sys_app', {
            params: {
              sysparm_query: `name=${application_scope}`,
              sysparm_fields: 'sys_id,name,scope',
              sysparm_limit: 1
            }
          });
        }

        if (appResponse.data.result && appResponse.data.result.length > 0) {
          const app = appResponse.data.result[0];
          resolvedScopeId = app.sys_id;
          resolvedScopeName = app.name;
          resolvedScopePrefix = app.scope;
        } else {
          throw new Error(`Application not found: "${application_scope}". Use "global" for global scope, or provide a valid application sys_id, scope name, or application name.`);
        }
      }
    }

    // ES5 validation for server scripts
    if (validate_es5 && server_script) {
      const es5Validation = validateES5Syntax(server_script);
      if (!es5Validation.valid) {
        throw new SnowFlowError(
          ErrorType.ES5_SYNTAX_ERROR,
          'Server script contains non-ES5 syntax',
          {
            retryable: false,
            details: {
              violations: es5Validation.violations
            }
          }
        );
      }
    }

    // ES5 validation for regular scripts
    if (validate_es5 && script) {
      const es5Validation = validateES5Syntax(script);
      if (!es5Validation.valid) {
        throw new SnowFlowError(
          ErrorType.ES5_SYNTAX_ERROR,
          'Script contains non-ES5 syntax',
          {
            retryable: false,
            details: {
              violations: es5Validation.violations
            }
          }
        );
      }
    }

    let result: any;
    let tableName: string;

    // Create artifact based on type
    switch (type) {
      case 'sp_widget':
        result = await createServicePortalWidget(client, {
          id: name,
          name: title || name,
          description,
          template: template || '',
          script: server_script || '',
          client_script: client_script || '',
          css: css || '',
          option_schema: option_schema || '',
          data_table_enabled,
          sys_scope: resolvedScopeId
        });
        tableName = 'sp_widget';
        break;

      case 'sp_page':
        result = await createServicePortalPage(client, {
          id: name,
          title: title || name,
          description,
          sys_scope: resolvedScopeId
        });
        tableName = 'sp_page';
        break;

      case 'sys_ux_page':
        result = await createUIBuilderPage(client, {
          name,
          title: title || name,
          description,
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_ux_page';
        break;

      case 'script_include':
        result = await createScriptInclude(client, {
          name,
          api_name: api_name || name,
          script: script || '',
          description,
          active,
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_script_include';
        break;

      case 'business_rule':
        if (!table) {
          throw new Error('table parameter required for business rules');
        }
        result = await createBusinessRule(client, {
          name,
          table,
          script: script || '',
          description,
          when: when || 'before',
          insert: insert || false,
          update: update || false,
          delete: deleteOp || false,
          query: queryOp || false,
          active,
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_script';
        break;

      case 'client_script':
        if (!table) {
          throw new Error('table parameter required for client scripts');
        }
        result = await createClientScript(client, {
          name,
          table,
          script: script || '',
          description,
          active,
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_script_client';
        break;

      case 'ui_policy':
        if (!table) {
          throw new Error('table parameter required for UI policies');
        }
        result = await createUIPolicy(client, {
          name,
          table,
          script_true: script || '',
          description,
          condition: condition || '',
          on_load: on_load || true,
          reverse_if_false: reverse_if_false || false,
          active,
          order: order || 100,
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_ui_policy';
        break;

      case 'ui_action':
        if (!table) {
          throw new Error('table parameter required for UI actions');
        }
        result = await createUIAction(client, {
          name,
          table,
          script: script || '',
          description,
          condition: condition || '',
          form_action: form_action !== false,
          form_style: form_style || '',
          list_action: list_action || false,
          order: order || 100,
          active,
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_ui_action';
        break;

      case 'rest_message':
        result = await createRESTMessage(client, {
          name,
          description,
          rest_endpoint: rest_endpoint || '',
          authentication_type: authentication_type || 'no_authentication',
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_rest_message';
        break;

      case 'scheduled_job':
        result = await createScheduledJob(client, {
          name,
          script: script || '',
          description,
          run_as,
          run_start,
          repeat_interval,
          active,
          sys_scope: resolvedScopeId
        });
        tableName = 'sysauto_script';
        break;

      case 'transform_map':
        if (!source_table || !target_table) {
          throw new Error('source_table and target_table parameters required for transform maps');
        }
        result = await createTransformMap(client, {
          name,
          source_table,
          target_table,
          script: script || '',
          description,
          active,
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_transform_map';
        break;

      case 'fix_script':
        result = await createFixScript(client, {
          name,
          script: script || '',
          description,
          sys_scope: resolvedScopeId
        });
        tableName = 'sys_script_fix';
        break;

      case 'table':
        if (!label) {
          throw new Error('label parameter required for table creation');
        }
        result = await createTable(client, {
          name,
          label,
          extends_table,
          is_extendable,
          create_module,
          create_access_controls,
          sys_scope: resolvedScopeId
        }, context);
        tableName = 'sys_db_object';
        break;

      case 'field':
        if (!table) {
          throw new Error('table parameter required for field creation');
        }
        if (!internal_type) {
          throw new Error('internal_type parameter required for field creation');
        }
        result = await createField(client, {
          table,
          column_name: column_name || name,
          column_label: column_label || label || name,
          internal_type,
          reference_table,
          max_length,
          mandatory,
          default_value,
          choice_options,
          sys_scope: resolvedScopeId
        }, context);
        tableName = 'sys_dictionary';
        break;

      default:
        throw new Error(`Unsupported artifact type: ${type}`);
    }

    return createSuccessResult({
      created: true,
      sys_id: result.sys_id,
      name: result.name || name,
      type,
      table: tableName,
      application_scope: resolvedScopeId ? {
        sys_id: resolvedScopeId,
        name: resolvedScopeName,
        scope: resolvedScopePrefix
      } : null,
      url: `${context.instanceUrl}/nav_to.do?uri=${tableName}.do?sys_id=${result.sys_id}`
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.DEPLOYMENT_FAILED, error.message, { originalError: error })
    );
  }
}

/**
 * Create Service Portal widget
 */
async function createServicePortalWidget(client: any, config: any) {
  const widgetData: any = {
    id: config.id,
    name: config.name,
    description: config.description || '',
    template: config.template || '',
    script: config.script || '',
    client_script: config.client_script || '',
    css: config.css || '',
    option_schema: config.option_schema || '',
    data_table: config.data_table_enabled !== false // Default to true - ServiceNow field is 'data_table'
  };

  // Add scope if specified
  if (config.sys_scope) {
    widgetData.sys_scope = config.sys_scope;
  }

  // Check if widget exists
  const existingResponse = await client.get('/api/now/table/sp_widget', {
    params: {
      sysparm_query: `id=${config.id}`,
      sysparm_limit: 1
    }
  });

  if (existingResponse.data.result.length > 0) {
    throw new Error(`Widget '${config.id}' already exists. Use snow_update to modify it, or snow_pull_artifact + snow_push_artifact for local development.`);
  }

  // Create new widget
  const createResponse = await client.post('/api/now/table/sp_widget', widgetData);
  return createResponse.data.result;
}

/**
 * Create Service Portal page
 */
async function createServicePortalPage(client: any, config: any) {
  const pageData: any = {
    id: config.id,
    title: config.title,
    description: config.description || ''
  };

  // Add scope if specified
  if (config.sys_scope) {
    pageData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sp_page', pageData);
  return response.data.result;
}

/**
 * Create UI Builder page
 */
async function createUIBuilderPage(client: any, config: any) {
  const pageData: any = {
    name: config.name,
    title: config.title,
    description: config.description || ''
  };

  // Add scope if specified
  if (config.sys_scope) {
    pageData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_ux_page', pageData);
  return response.data.result;
}

/**
 * Create Script Include
 */
async function createScriptInclude(client: any, config: any) {
  const scriptData: any = {
    name: config.name,
    api_name: config.api_name,
    script: config.script,
    description: config.description || '',
    active: config.active
  };

  // Add scope if specified
  if (config.sys_scope) {
    scriptData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_script_include', scriptData);
  return response.data.result;
}

/**
 * Create Business Rule
 */
async function createBusinessRule(client: any, config: any) {
  const ruleData: any = {
    name: config.name,
    collection: config.table,
    script: config.script,
    description: config.description || '',
    when: config.when,
    insert: config.insert,
    update: config.update,
    delete: config.delete,
    query: config.query,
    active: config.active
  };

  // Add scope if specified
  if (config.sys_scope) {
    ruleData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_script', ruleData);
  return response.data.result;
}

/**
 * Create Client Script
 */
async function createClientScript(client: any, config: any) {
  const scriptData: any = {
    name: config.name,
    table: config.table,
    script: config.script,
    description: config.description || '',
    active: config.active
  };

  // Add scope if specified
  if (config.sys_scope) {
    scriptData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_script_client', scriptData);
  return response.data.result;
}

/**
 * Create UI Policy
 */
async function createUIPolicy(client: any, config: any) {
  const policyData: any = {
    short_description: config.name,
    table: config.table,
    script_true: config.script_true || '',
    description: config.description || '',
    conditions: config.condition || '',
    on_load: config.on_load,
    reverse_if_false: config.reverse_if_false,
    active: config.active,
    order: config.order
  };

  // Add scope if specified
  if (config.sys_scope) {
    policyData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_ui_policy', policyData);
  return response.data.result;
}

/**
 * Create UI Action
 */
async function createUIAction(client: any, config: any) {
  const actionData: any = {
    name: config.name,
    table: config.table,
    script: config.script,
    comments: config.description || '',
    condition: config.condition || '',
    form_action: config.form_action,
    form_style: config.form_style || '',
    list_action: config.list_action,
    order: config.order,
    active: config.active
  };

  // Add scope if specified
  if (config.sys_scope) {
    actionData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_ui_action', actionData);
  return response.data.result;
}

/**
 * Create REST Message
 */
async function createRESTMessage(client: any, config: any) {
  const messageData: any = {
    name: config.name,
    description: config.description || '',
    rest_endpoint: config.rest_endpoint || '',
    authentication_type: config.authentication_type || 'no_authentication'
  };

  // Add scope if specified
  if (config.sys_scope) {
    messageData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_rest_message', messageData);
  return response.data.result;
}

/**
 * Create Scheduled Job
 */
async function createScheduledJob(client: any, config: any) {
  const jobData: any = {
    name: config.name,
    script: config.script,
    comments: config.description || '',
    active: config.active
  };

  // Add run_as if specified
  if (config.run_as) {
    jobData.run_as = config.run_as;
  }

  // Add run_start if specified
  if (config.run_start) {
    jobData.run_start = config.run_start;
  }

  // Add repeat_interval if specified
  if (config.repeat_interval) {
    jobData.repeat_interval = config.repeat_interval;
  }

  // Add scope if specified
  if (config.sys_scope) {
    jobData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sysauto_script', jobData);
  return response.data.result;
}

/**
 * Create Transform Map
 */
async function createTransformMap(client: any, config: any) {
  const mapData: any = {
    name: config.name,
    source_table: config.source_table,
    target_table: config.target_table,
    script: config.script || '',
    description: config.description || '',
    active: config.active
  };

  // Add scope if specified
  if (config.sys_scope) {
    mapData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_transform_map', mapData);
  return response.data.result;
}

/**
 * Create Fix Script
 */
async function createFixScript(client: any, config: any) {
  const scriptData: any = {
    name: config.name,
    script: config.script,
    description: config.description || ''
  };

  // Add scope if specified
  if (config.sys_scope) {
    scriptData.sys_scope = config.sys_scope;
  }

  const response = await client.post('/api/now/table/sys_script_fix', scriptData);
  return response.data.result;
}

/**
 * Create Table (sys_db_object)
 */
async function createTable(client: any, config: any, context: any) {
  // Build table data
  const tableData: any = {
    name: config.name,
    label: config.label,
    is_extendable: config.is_extendable !== false
  };

  // Set parent table if extending
  if (config.extends_table) {
    // Look up the parent table sys_id
    const parentResponse = await client.get('/api/now/table/sys_db_object', {
      params: {
        sysparm_query: `name=${config.extends_table}`,
        sysparm_fields: 'sys_id,name,label',
        sysparm_limit: 1
      }
    });

    if (parentResponse.data.result && parentResponse.data.result.length > 0) {
      tableData.super_class = parentResponse.data.result[0].sys_id;
    } else {
      throw new Error(`Parent table '${config.extends_table}' not found. Cannot extend a non-existent table.`);
    }
  }

  // Add scope if specified
  if (config.sys_scope && config.sys_scope !== 'global') {
    tableData.sys_scope = config.sys_scope;
  }

  // Check if table already exists
  const existingResponse = await client.get('/api/now/table/sys_db_object', {
    params: {
      sysparm_query: `name=${config.name}`,
      sysparm_limit: 1
    }
  });

  if (existingResponse.data.result && existingResponse.data.result.length > 0) {
    throw new Error(`Table '${config.name}' already exists. Use snow_update to modify it.`);
  }

  // Create the table
  const createResponse = await client.post('/api/now/table/sys_db_object', tableData);
  const createdTable = createResponse.data.result;

  const additionalInfo: any = {};

  // Create navigation module if requested
  if (config.create_module) {
    try {
      const moduleData = {
        title: config.label,
        name: config.name,
        table_name: config.name,
        view_name: 'default',
        order: 100,
        active: true
      };

      const moduleResponse = await client.post('/api/now/table/sys_app_module', moduleData);
      additionalInfo.module = {
        sys_id: moduleResponse.data.result.sys_id,
        title: config.label
      };
    } catch (moduleError: any) {
      additionalInfo.module_error = `Could not create module: ${moduleError.message}`;
    }
  }

  // Create default ACLs if requested
  if (config.create_access_controls) {
    try {
      const acls = [];

      // Read ACL
      const readAcl = await client.post('/api/now/table/sys_security_acl', {
        name: config.name,
        operation: 'read',
        type: 'record',
        admin_overrides: true,
        active: true
      });
      acls.push({ type: 'read', sys_id: readAcl.data.result.sys_id });

      // Write ACL
      const writeAcl = await client.post('/api/now/table/sys_security_acl', {
        name: config.name,
        operation: 'write',
        type: 'record',
        admin_overrides: true,
        active: true
      });
      acls.push({ type: 'write', sys_id: writeAcl.data.result.sys_id });

      // Create ACL
      const createAcl = await client.post('/api/now/table/sys_security_acl', {
        name: config.name,
        operation: 'create',
        type: 'record',
        admin_overrides: true,
        active: true
      });
      acls.push({ type: 'create', sys_id: createAcl.data.result.sys_id });

      // Delete ACL
      const deleteAcl = await client.post('/api/now/table/sys_security_acl', {
        name: config.name,
        operation: 'delete',
        type: 'record',
        admin_overrides: true,
        active: true
      });
      acls.push({ type: 'delete', sys_id: deleteAcl.data.result.sys_id });

      additionalInfo.access_controls = acls;
    } catch (aclError: any) {
      additionalInfo.acl_error = `Could not create ACLs: ${aclError.message}`;
    }
  }

  return {
    ...createdTable,
    ...additionalInfo
  };
}

/**
 * Create Field (sys_dictionary)
 */
async function createField(client: any, config: any, context: any) {
  // Build field data
  const fieldData: any = {
    name: config.table,
    element: config.column_name,
    column_label: config.column_label || config.column_name,
    internal_type: config.internal_type,
    mandatory: config.mandatory || false
  };

  // Add reference table for reference fields
  if (config.internal_type === 'reference' && config.reference_table) {
    fieldData.reference = config.reference_table;
  }

  // Add max_length for string fields
  if (['string', 'url', 'email', 'phone_number_e164'].includes(config.internal_type)) {
    fieldData.max_length = config.max_length || 255;
  }

  // Add default value if specified
  if (config.default_value !== undefined) {
    fieldData.default_value = config.default_value;
  }

  // Add scope if specified
  if (config.sys_scope && config.sys_scope !== 'global') {
    fieldData.sys_scope = config.sys_scope;
  }

  // Check if field already exists
  const existingResponse = await client.get('/api/now/table/sys_dictionary', {
    params: {
      sysparm_query: `name=${config.table}^element=${config.column_name}`,
      sysparm_limit: 1
    }
  });

  if (existingResponse.data.result && existingResponse.data.result.length > 0) {
    throw new Error(`Field '${config.column_name}' already exists on table '${config.table}'. Use snow_update to modify it.`);
  }

  // Create the field
  const createResponse = await client.post('/api/now/table/sys_dictionary', fieldData);
  const createdField = createResponse.data.result;

  // Create choice options if specified for choice fields
  if (config.internal_type === 'choice' && config.choice_options && config.choice_options.length > 0) {
    const choices: any[] = [];

    for (let i = 0; i < config.choice_options.length; i++) {
      const option = config.choice_options[i];
      try {
        const choiceData: any = {
          name: config.table,
          element: config.column_name,
          label: option.label,
          value: option.value,
          sequence: (i + 1) * 10, // 10, 20, 30...
          inactive: false
        };

        if (config.sys_scope && config.sys_scope !== 'global') {
          choiceData.sys_scope = config.sys_scope;
        }

        const choiceResponse = await client.post('/api/now/table/sys_choice', choiceData);
        choices.push({
          sys_id: choiceResponse.data.result.sys_id,
          label: option.label,
          value: option.value
        });
      } catch (choiceError: any) {
        // Continue with other choices even if one fails
        choices.push({
          error: `Failed to create choice '${option.label}': ${choiceError.message}`
        });
      }
    }

    createdField.choices = choices;
  }

  return createdField;
}

/**
 * Validate ES5 syntax
 */
function validateES5Syntax(code: string): { valid: boolean; violations: any[] } {
  const violations: any[] = [];

  // Check for const/let
  const constLetPattern = /\b(const|let)\s+/g;
  let match;
  while ((match = constLetPattern.exec(code)) !== null) {
    violations.push({
      type: match[1] === 'const' ? 'const' : 'let',
      line: code.substring(0, match.index).split('\n').length,
      code: match[0],
      fix: `Use 'var' instead of '${match[1]}'`
    });
  }

  // Check for arrow functions
  const arrowPattern = /\([^)]*\)\s*=>/g;
  while ((match = arrowPattern.exec(code)) !== null) {
    violations.push({
      type: 'arrow_function',
      line: code.substring(0, match.index).split('\n').length,
      code: match[0],
      fix: 'Use function() {} instead of arrow function'
    });
  }

  // Check for template literals
  const templatePattern = /`[^`]*`/g;
  while ((match = templatePattern.exec(code)) !== null) {
    violations.push({
      type: 'template_literal',
      line: code.substring(0, match.index).split('\n').length,
      code: match[0],
      fix: 'Use string concatenation with + instead of template literals'
    });
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

export const version = '1.0.0';
export const author = 'Snow-Flow Team';
