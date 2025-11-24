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
  description: 'Create ServiceNow artifacts (Service Portal widgets, UI pages, scripts, etc.) with a unified interface',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'deployment',
  use_cases: ['deployment', 'creation', 'artifacts', 'widgets'],
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

      // Validation options
      validate_es5: {
        type: 'boolean',
        description: 'Validate ES5 syntax for server scripts',
        default: true
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
    script,
    api_name,
    table,
    when,
    insert,
    update,
    delete: deleteOp,
    query: queryOp,
    active = true,
    validate_es5 = true
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

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
          option_schema: option_schema || ''
        });
        tableName = 'sp_widget';
        break;

      case 'sp_page':
        result = await createServicePortalPage(client, {
          id: name,
          title: title || name,
          description
        });
        tableName = 'sp_page';
        break;

      case 'sys_ux_page':
        result = await createUIBuilderPage(client, {
          name,
          title: title || name,
          description
        });
        tableName = 'sys_ux_page';
        break;

      case 'script_include':
        result = await createScriptInclude(client, {
          name,
          api_name: api_name || name,
          script: script || '',
          description,
          active
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
          active
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
          active
        });
        tableName = 'sys_script_client';
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
  const widgetData = {
    id: config.id,
    name: config.name,
    description: config.description || '',
    template: config.template || '',
    script: config.script || '',
    client_script: config.client_script || '',
    css: config.css || '',
    option_schema: config.option_schema || ''
  };

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
  const pageData = {
    id: config.id,
    title: config.title,
    description: config.description || ''
  };

  const response = await client.post('/api/now/table/sp_page', pageData);
  return response.data.result;
}

/**
 * Create UI Builder page
 */
async function createUIBuilderPage(client: any, config: any) {
  const pageData = {
    name: config.name,
    title: config.title,
    description: config.description || ''
  };

  const response = await client.post('/api/now/table/sys_ux_page', pageData);
  return response.data.result;
}

/**
 * Create Script Include
 */
async function createScriptInclude(client: any, config: any) {
  const scriptData = {
    name: config.name,
    api_name: config.api_name,
    script: config.script,
    description: config.description || '',
    active: config.active
  };

  const response = await client.post('/api/now/table/sys_script_include', scriptData);
  return response.data.result;
}

/**
 * Create Business Rule
 */
async function createBusinessRule(client: any, config: any) {
  const ruleData = {
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

  const response = await client.post('/api/now/table/sys_script', ruleData);
  return response.data.result;
}

/**
 * Create Client Script
 */
async function createClientScript(client: any, config: any) {
  const scriptData = {
    name: config.name,
    table: config.table,
    script: config.script,
    description: config.description || '',
    active: config.active
  };

  const response = await client.post('/api/now/table/sys_script_client', scriptData);
  return response.data.result;
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
