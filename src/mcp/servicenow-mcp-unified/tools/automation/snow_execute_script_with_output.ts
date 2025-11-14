/**
 * snow_execute_script_with_output - Execute background scripts
 *
 * Execute server-side JavaScript in ServiceNow background scripts with
 * full output capture (gs.print, gs.info, gs.warn, gs.error).
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_execute_script_with_output',
  description: 'Execute server-side JavaScript with output capture (ES5 only - no const/let/arrow functions)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'script-execution',
  use_cases: ['automation', 'scripts', 'output-capture'],
  complexity: 'advanced',
  frequency: 'high',

  // Permission enforcement
  // Classification: WRITE - Execution operation - can have side effects
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'JavaScript code to execute (MUST be ES5 - no const/let/arrow functions/template literals)'
      },
      scope: {
        type: 'string',
        description: 'Scope to execute in (global or application scope)',
        default: 'global',
        enum: ['global', 'rhino']
      },
      validate_es5: {
        type: 'boolean',
        description: 'Validate ES5 syntax before execution',
        default: true
      }
    },
    required: ['script']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { script, scope = 'global', validate_es5 = true } = args;

  try {
    // ES5 validation
    if (validate_es5) {
      const es5Validation = validateES5(script);
      if (!es5Validation.valid) {
        throw new SnowFlowError(
          ErrorType.ES5_SYNTAX_ERROR,
          'Script contains non-ES5 syntax',
          {
            retryable: false,
            details: {
              violations: es5Validation.violations,
              message: 'ServiceNow uses Rhino engine - ES6+ syntax will fail'
            }
          }
        );
      }
    }

    const client = await getAuthenticatedClient(context);

    // Wrap script to capture all output
    const wrappedScript = `
var __output = [];
var __originalPrint = gs.print;
var __originalInfo = gs.info;
var __originalWarn = gs.warn;
var __originalError = gs.error;

gs.print = function(msg) { __output.push({level: 'print', message: String(msg)}); };
gs.info = function(msg) { __output.push({level: 'info', message: String(msg)}); __originalInfo(msg); };
gs.warn = function(msg) { __output.push({level: 'warn', message: String(msg)}); __originalWarn(msg); };
gs.error = function(msg) { __output.push({level: 'error', message: String(msg)}); __originalError(msg); };

try {
  ${script}
  __output.push({level: 'success', message: 'Script executed successfully'});
} catch (e) {
  __output.push({level: 'error', message: 'ERROR: ' + e.message});
  __output.push({level: 'error', message: 'Stack: ' + e.stack});
}

gs.print = __originalPrint;
gs.info = __originalInfo;
gs.warn = __originalWarn;
gs.error = __originalError;

JSON.stringify(__output);
`;

    // ServiceNow script execution via scheduled job (sysauto_script)
    // This creates a one-time job that executes immediately
    const scriptName = `Snow_Flow_Exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Modify the wrapped script to use gs.print for final output
    const executableScript = `
var __output = [];
var __originalPrint = gs.print;
var __originalInfo = gs.info;
var __originalWarn = gs.warn;
var __originalError = gs.error;

gs.print = function(msg) { __output.push({level: 'print', message: String(msg)}); };
gs.info = function(msg) { __output.push({level: 'info', message: String(msg)}); __originalInfo(msg); };
gs.warn = function(msg) { __output.push({level: 'warn', message: String(msg)}); __originalWarn(msg); };
gs.error = function(msg) { __output.push({level: 'error', message: String(msg)}); __originalError(msg); };

try {
  ${script}
  __output.push({level: 'success', message: 'Script executed successfully'});
} catch (e) {
  __output.push({level: 'error', message: 'ERROR: ' + e.message});
}

gs.print = __originalPrint;
gs.info = __originalInfo;
gs.warn = __originalWarn;
gs.error = __originalError;

// Output to system log for retrieval
gs.info('SNOW_FLOW_OUTPUT:' + JSON.stringify(__output));
`;

    // Create scheduled script job that runs once immediately
    const now = new Date();
    const jobResponse = await client.post('/api/now/table/sysauto_script', {
      name: scriptName,
      script: executableScript,
      active: true,
      run_type: 'once',  // Run once at specified time
      run_start: now.toISOString(),
      run_dayofweek: '1,2,3,4,5,6,7'  // All days (for compatibility)
    });

    const jobId = jobResponse.data.result.sys_id;

    // Wait for execution - scheduled jobs execute asynchronously
    // Give the ServiceNow scheduler time to pick up and execute the job
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Retrieve output from sys_log (only logs from the last 10 seconds)
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString().replace('T', ' ').substring(0, 19);
    const logResponse = await client.get('/api/now/table/sys_log', {
      params: {
        sysparm_query: `messageLIKESNOW_FLOW_OUTPUT^sys_created_on>${tenSecondsAgo}^ORDERBYDESCsys_created_on`,
        sysparm_limit: 10,
        sysparm_fields: 'message,sys_created_on'
      }
    });

    // Clean up job
    try {
      await client.delete(`/api/now/table/sysauto_script/${jobId}`);
    } catch (cleanupError) {
      console.warn('Failed to cleanup scheduled job');
    }

    // Parse output
    let output: any[] = [];
    const logs = logResponse.data.result || [];

    for (const log of logs) {
      const message = log.message || '';
      if (message.includes('SNOW_FLOW_OUTPUT:')) {
        const jsonStart = message.indexOf('[');
        if (jsonStart !== -1) {
          try {
            output = JSON.parse(message.substring(jsonStart));
            break;
          } catch (e) {
            console.warn('Failed to parse output JSON');
          }
        }
      }
    }

    if (output.length === 0) {
      // Fallback - script may not have executed
      throw new SnowFlowError(
        ErrorType.UNKNOWN_ERROR,
        'Script execution completed but no output was captured. The script may not have run or ServiceNow may not support on-demand execution via API.',
        {
          details: {
            message: 'Try running the script manually in ServiceNow Background Scripts module',
            job_id: jobId,
            logs_checked: logs.length
          }
        }
      );
    }

    // Organize output by level
    const organized = {
      print: output.filter(o => o.level === 'print').map(o => o.message),
      info: output.filter(o => o.level === 'info').map(o => o.message),
      warn: output.filter(o => o.level === 'warn').map(o => o.message),
      error: output.filter(o => o.level === 'error').map(o => o.message),
      success: output.some(o => o.level === 'success')
    };

    return createSuccessResult(
      {
        success: organized.error.length === 0,
        output: organized,
        raw_output: output
      },
      {
        script_length: script.length,
        scope,
        es5_validated: validate_es5
      }
    );

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message, { originalError: error })
    );
  }
}

function validateES5(code: string): { valid: boolean; violations: any[] } {
  const violations: any[] = [];

  const patterns = [
    { regex: /\b(const|let)\s+/g, type: 'const/let', fix: "Use 'var'" },
    { regex: /\([^)]*\)\s*=>/g, type: 'arrow_function', fix: 'Use function() {}' },
    { regex: /`[^`]*`/g, type: 'template_literal', fix: 'Use string concatenation' },
    { regex: /\{[^}]+\}\s*=\s*/g, type: 'destructuring', fix: 'Use explicit properties' },
    { regex: /for\s*\([^)]*\s+of\s+/g, type: 'for_of', fix: 'Use traditional for loop' },
    { regex: /class\s+\w+/g, type: 'class', fix: 'Use function constructor' }
  ];

  patterns.forEach(({ regex, type, fix }) => {
    let match;
    while ((match = regex.exec(code)) !== null) {
      violations.push({
        type,
        line: code.substring(0, match.index).split('\n').length,
        code: match[0],
        fix
      });
    }
  });

  return { valid: violations.length === 0, violations };
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
