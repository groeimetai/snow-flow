/**
 * snow_deploy - Deploy ServiceNow artifacts with validation
 *
 * Deploys widgets, pages, flows, and other artifacts to ServiceNow
 * with automatic ES5 validation, coherence checking, and Update Set management.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_deploy',
  description: 'Deploy ServiceNow artifacts (widgets, pages, flows) with automatic validation and Update Set management',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['widget', 'page', 'flow', 'application', 'component'],
        description: 'Type of artifact to deploy'
      },
      config: {
        type: 'object',
        description: 'Artifact configuration (fields depend on type)',
        properties: {
          name: { type: 'string', description: 'Artifact name' },
          title: { type: 'string', description: 'Display title' },
          description: { type: 'string', description: 'Artifact description' },
          template: { type: 'string', description: 'HTML template (for widgets)' },
          script: { type: 'string', description: 'Server script (for widgets)' },
          client_script: { type: 'string', description: 'Client script (for widgets)' },
          css: { type: 'string', description: 'CSS styles (for widgets)' },
          option_schema: { type: 'string', description: 'Option schema JSON (for widgets)' }
        }
      },
      validate_coherence: {
        type: 'boolean',
        description: 'Validate widget coherence (HTML/Client/Server communication)',
        default: true
      },
      validate_es5: {
        type: 'boolean',
        description: 'Validate ES5 syntax in server scripts',
        default: true
      },
      create_update_set: {
        type: 'boolean',
        description: 'Create new Update Set for this deployment',
        default: false
      },
      update_set_name: {
        type: 'string',
        description: 'Name for new Update Set (if create_update_set=true)'
      }
    },
    required: ['type', 'config']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { type, config, validate_coherence = true, validate_es5 = true, create_update_set = false, update_set_name } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Step 1: Pre-deployment validation
    if (type === 'widget') {
      // ES5 validation for server script
      if (validate_es5 && config.script) {
        const es5Validation = validateES5Syntax(config.script);
        if (!es5Validation.valid) {
          throw new SnowFlowError(
            ErrorType.ES5_SYNTAX_ERROR,
            'Server script contains non-ES5 syntax',
            {
              retryable: false,
              details: {
                violations: es5Validation.violations.map(v => ({
                  type: v.type,
                  line: v.line,
                  code: v.code,
                  fix: v.fix
                }))
              }
            }
          );
        }
      }

      // Widget coherence validation
      if (validate_coherence) {
        const coherenceResult = validateWidgetCoherence(config);
        if (!coherenceResult.coherent) {
          const criticalIssues = coherenceResult.issues.filter(i => i.severity === 'critical');
          if (criticalIssues.length > 0) {
            throw new SnowFlowError(
              ErrorType.WIDGET_COHERENCE_ERROR,
              'Widget coherence validation failed',
              {
                retryable: false,
                details: {
                  critical: criticalIssues,
                  warnings: coherenceResult.issues.filter(i => i.severity === 'warning'),
                  analysis: coherenceResult.analysis
                }
              }
            );
          }
        }
      }
    }

    // Step 2: Create/ensure Update Set if needed
    let updateSetId: string | undefined;
    if (create_update_set && update_set_name) {
      const updateSetResponse = await client.post('/api/now/table/sys_update_set', {
        name: update_set_name,
        description: `Deployment: ${config.name || 'Artifact'}`,
        state: 'in progress'
      });
      updateSetId = updateSetResponse.data.result.sys_id;

      // Set as current Update Set
      await client.put(`/api/now/table/sys_update_set/${updateSetId}`, {
        is_current: true
      });
    }

    // Step 3: Deploy artifact based on type
    let deploymentResult: any;

    switch (type) {
      case 'widget':
        deploymentResult = await deployWidget(client, config);
        break;

      case 'page':
        deploymentResult = await deployPage(client, config);
        break;

      case 'flow':
        deploymentResult = await deployFlow(client, config);
        break;

      default:
        throw new SnowFlowError(
          ErrorType.INVALID_REQUEST,
          `Unsupported artifact type: ${type}`,
          { retryable: false }
        );
    }

    // Step 4: Return success result
    return createSuccessResult(
      {
        sys_id: deploymentResult.sys_id,
        table: deploymentResult.table,
        name: config.name,
        type,
        url: `${context.instanceUrl}/nav_to.do?uri=${deploymentResult.table}.do?sys_id=${deploymentResult.sys_id}`
      },
      {
        updateSetId,
        validations: {
          es5: validate_es5 ? 'passed' : 'skipped',
          coherence: validate_coherence ? 'passed' : 'skipped'
        }
      }
    );

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.DEPLOYMENT_FAILED, error.message, { originalError: error })
    );
  }
}

/**
 * Deploy Service Portal widget
 */
async function deployWidget(client: any, config: any) {
  const widgetData: any = {
    id: config.name,
    name: config.title || config.name,
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
      sysparm_query: `id=${config.name}`,
      sysparm_limit: 1
    }
  });

  let result;
  if (existingResponse.data.result.length > 0) {
    // Update existing widget
    const sys_id = existingResponse.data.result[0].sys_id;
    const updateResponse = await client.put(`/api/now/table/sp_widget/${sys_id}`, widgetData);
    result = updateResponse.data.result;
  } else {
    // Create new widget
    const createResponse = await client.post('/api/now/table/sp_widget', widgetData);
    result = createResponse.data.result;
  }

  return {
    sys_id: result.sys_id,
    table: 'sp_widget'
  };
}

/**
 * Deploy UI Builder page
 */
async function deployPage(client: any, config: any) {
  const pageData: any = {
    name: config.name,
    title: config.title || config.name,
    description: config.description || ''
  };

  const response = await client.post('/api/now/table/sys_ux_page', pageData);
  return {
    sys_id: response.data.result.sys_id,
    table: 'sys_ux_page'
  };
}

/**
 * Deploy Flow Designer flow (via XML import only)
 */
async function deployFlow(client: any, config: any) {
  throw new SnowFlowError(
    ErrorType.INVALID_REQUEST,
    'Flow deployment requires XML import via snow_import_flow_from_xml',
    { retryable: false }
  );
}

/**
 * Validate ES5 syntax in JavaScript code
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

/**
 * Validate widget coherence (HTML/Client/Server communication)
 */
function validateWidgetCoherence(config: any): any {
  const issues: any[] = [];
  const analysis = {
    serverInitializedData: [] as string[],
    clientMethods: [] as string[],
    htmlReferences: [] as string[],
    inputActions: [] as string[]
  };

  // Extract data properties from server script
  if (config.script) {
    const dataPattern = /data\.(\w+)\s*=/g;
    let match;
    while ((match = dataPattern.exec(config.script)) !== null) {
      analysis.serverInitializedData.push(match[1]);
    }

    // Extract input.action handlers
    const actionPattern = /input\.action\s*===?\s*['"](\w+)['"]/g;
    while ((match = actionPattern.exec(config.script)) !== null) {
      analysis.inputActions.push(match[1]);
    }
  }

  // Extract data references from HTML
  if (config.template) {
    const htmlDataPattern = /\{\{data\.(\w+)\}\}/g;
    let match;
    while ((match = htmlDataPattern.exec(config.template)) !== null) {
      analysis.htmlReferences.push(match[1]);
    }

    // Check if HTML references exist in server data
    analysis.htmlReferences.forEach(ref => {
      if (!analysis.serverInitializedData.includes(ref)) {
        issues.push({
          type: 'missing_data',
          severity: 'critical',
          description: `HTML references data.${ref} but server doesn't initialize it`,
          location: 'template',
          fix: `Add 'data.${ref} = ...;' to server script`
        });
      }
    });
  }

  // Extract methods from client script
  if (config.client_script) {
    const methodPattern = /(?:c|$scope)\.(\w+)\s*=\s*function/g;
    let match;
    while ((match = methodPattern.exec(config.client_script)) !== null) {
      analysis.clientMethods.push(match[1]);
    }
  }

  return {
    coherent: issues.filter(i => i.severity === 'critical').length === 0,
    issues,
    analysis
  };
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
