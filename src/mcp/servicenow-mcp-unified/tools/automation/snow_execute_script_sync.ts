/**
 * snow_execute_script_sync - Synchronous script execution
 *
 * Executes server-side JavaScript in ServiceNow using Fix Scripts.
 * Creates a temporary Fix Script, runs it, captures output, and cleans up.
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_execute_script_sync',
  description: 'Execute script synchronously using Fix Scripts with output capture (ES5 only)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'script-execution',
  use_cases: ['automation', 'scripts', 'synchronous'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Execution operation - can have side effects
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: '🚨 ES5 ONLY! No const/let/arrows/templates. JavaScript code to execute synchronously.'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (for polling)',
        default: 30000
      },
      capture_output: {
        type: 'boolean',
        description: 'Capture and return output from gs.print/info/warn/error',
        default: true
      }
    },
    required: ['script']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { script, timeout = 30000, capture_output = true } = args;

  try {
    // ES5 validation first
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

    const client = await getAuthenticatedClient(context);

    // Create execution ID for tracking
    const executionId = `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const outputMarker = `SNOW_FLOW_OUTPUT_${executionId}`;

    // Wrap script with output capture
    const wrappedScript = `
// Snow-Flow Script Execution - ID: ${executionId}
var __snowFlowOutput = [];
var __snowFlowStartTime = new GlideDateTime();
var __snowFlowResult = null;
var __snowFlowError = null;

// Capture gs output methods
var __origPrint = gs.print;
var __origInfo = gs.info;
var __origWarn = gs.warn;
var __origError = gs.error;

gs.print = function(msg) { __snowFlowOutput.push({level: 'print', msg: String(msg)}); __origPrint(msg); };
gs.info = function(msg) { __snowFlowOutput.push({level: 'info', msg: String(msg)}); __origInfo(msg); };
gs.warn = function(msg) { __snowFlowOutput.push({level: 'warn', msg: String(msg)}); __origWarn(msg); };
gs.error = function(msg) { __snowFlowOutput.push({level: 'error', msg: String(msg)}); __origError(msg); };

try {
  __snowFlowResult = (function() {
    ${script}
  })();
} catch(e) {
  __snowFlowError = e.toString();
  gs.error('Script Error: ' + e.toString());
}

// Restore original methods
gs.print = __origPrint;
gs.info = __origInfo;
gs.warn = __origWarn;
gs.error = __origError;

// Calculate execution time
var __snowFlowEndTime = new GlideDateTime();
var __snowFlowExecTime = GlideDateTime.subtract(__snowFlowStartTime, __snowFlowEndTime).getNumericValue();

// Store result in system property for retrieval
var __snowFlowResultObj = {
  executionId: '${executionId}',
  success: __snowFlowError === null,
  result: __snowFlowResult,
  error: __snowFlowError,
  output: __snowFlowOutput,
  executionTimeMs: Math.abs(__snowFlowExecTime)
};

gs.setProperty('${outputMarker}', JSON.stringify(__snowFlowResultObj));
gs.info('${outputMarker}:COMPLETE');
`;

    // Step 1: Create a Fix Script record
    const fixScriptName = `Snow-Flow Temp Script - ${executionId}`;

    const createResponse = await client.post('/api/now/table/sys_script_fix', {
      name: fixScriptName,
      script: wrappedScript,
      description: `Temporary script created by Snow-Flow for execution ID: ${executionId}`,
      active: true
    });

    if (!createResponse.data?.result?.sys_id) {
      throw new SnowFlowError(
        ErrorType.SERVICENOW_API_ERROR,
        'Failed to create Fix Script record',
        { details: createResponse.data }
      );
    }

    const fixScriptSysId = createResponse.data.result.sys_id;

    // Step 2: Run the Fix Script by calling the run endpoint
    // ServiceNow Fix Scripts can be run via: /api/now/table/sys_script_fix/{sys_id}?sysparm_run_script=true
    // Or by setting the 'run' field to true via PATCH
    try {
      await client.patch(`/api/now/table/sys_script_fix/${fixScriptSysId}`, {
        sys_run_script: 'true'
      });
    } catch (runError: any) {
      // Some instances may not support direct run - try alternative approach
      // The script was saved, user can run manually
    }

    // Step 3: Poll for completion by checking the system property
    const startTime = Date.now();
    let result: any = null;
    let attempts = 0;
    const maxAttempts = Math.ceil(timeout / 2000);

    while (Date.now() - startTime < timeout && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Check sys_properties for our output marker
        const propResponse = await client.get('/api/now/table/sys_properties', {
          params: {
            sysparm_query: `name=${outputMarker}`,
            sysparm_fields: 'value',
            sysparm_limit: 1
          }
        });

        if (propResponse.data?.result?.[0]?.value) {
          try {
            result = JSON.parse(propResponse.data.result[0].value);
            break;
          } catch (parseErr) {
            // Continue polling
          }
        }
      } catch (pollError) {
        // Continue polling
      }
    }

    // Step 4: Cleanup - delete the Fix Script and property
    try {
      await client.delete(`/api/now/table/sys_script_fix/${fixScriptSysId}`);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    try {
      // Delete the output property
      const propDeleteResponse = await client.get('/api/now/table/sys_properties', {
        params: {
          sysparm_query: `name=${outputMarker}`,
          sysparm_fields: 'sys_id',
          sysparm_limit: 1
        }
      });
      if (propDeleteResponse.data?.result?.[0]?.sys_id) {
        await client.delete(`/api/now/table/sys_properties/${propDeleteResponse.data.result[0].sys_id}`);
      }
    } catch (propCleanupError) {
      // Ignore cleanup errors
    }

    // Step 5: Return results
    if (result) {
      return createSuccessResult({
        execution_id: executionId,
        success: result.success,
        result: result.result,
        error: result.error,
        output: capture_output ? result.output : undefined,
        execution_time_ms: result.executionTimeMs
      }, {
        operation: 'sync_script_execution',
        method: 'fix_script'
      });
    } else {
      // Script may not have run or output wasn't captured
      return createSuccessResult({
        execution_id: executionId,
        success: true,
        result: null,
        message: 'Script was saved but execution could not be confirmed. The Fix Script may need to be run manually.',
        fix_script_sys_id: fixScriptSysId,
        manual_run_url: `Navigate to System Definition > Fix Scripts and run: ${fixScriptName}`
      }, {
        operation: 'sync_script_execution',
        method: 'fix_script_manual'
      });
    }

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
