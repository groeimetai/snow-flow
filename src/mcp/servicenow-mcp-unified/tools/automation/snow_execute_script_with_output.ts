/**
 * snow_execute_script_with_output - Execute scripts with full output capture
 *
 * Execute server-side JavaScript in ServiceNow with comprehensive output capture
 * using Fix Scripts. Captures gs.print, gs.info, gs.warn, gs.error.
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_execute_script_with_output',
  description: 'Execute server-side JavaScript with full output capture using Fix Scripts (ES5 only)',
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
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds for polling execution results',
        default: 30000
      }
    },
    required: ['script']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { script, scope = 'global', validate_es5 = true, timeout = 30000 } = args;

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

    // Create unique execution ID for tracking
    const executionId = `output_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const outputMarker = `SNOW_FLOW_EXEC_${executionId}`;

    // Wrap script with comprehensive output capture
    const wrappedScript = `
// Snow-Flow Script Execution with Output Capture - ID: ${executionId}
var __sfOutput = [];
var __sfStartTime = new GlideDateTime();
var __sfResult = null;
var __sfError = null;

// Store original gs methods
var __sfOrigPrint = gs.print;
var __sfOrigInfo = gs.info;
var __sfOrigWarn = gs.warn;
var __sfOrigError = gs.error;

// Override gs methods to capture output
gs.print = function(msg) {
  var m = String(msg);
  __sfOutput.push({level: 'print', message: m, timestamp: new GlideDateTime().getDisplayValue()});
  __sfOrigPrint(m);
};

gs.info = function(msg) {
  var m = String(msg);
  __sfOutput.push({level: 'info', message: m, timestamp: new GlideDateTime().getDisplayValue()});
  __sfOrigInfo(m);
};

gs.warn = function(msg) {
  var m = String(msg);
  __sfOutput.push({level: 'warn', message: m, timestamp: new GlideDateTime().getDisplayValue()});
  __sfOrigWarn(m);
};

gs.error = function(msg) {
  var m = String(msg);
  __sfOutput.push({level: 'error', message: m, timestamp: new GlideDateTime().getDisplayValue()});
  __sfOrigError(m);
};

// Execute the user script
try {
  gs.info('=== Snow-Flow Script Execution Started ===');

  __sfResult = (function() {
    ${script}
  })();

  gs.info('=== Snow-Flow Script Execution Completed ===');

  if (__sfResult !== undefined && __sfResult !== null) {
    gs.info('Script returned: ' + (typeof __sfResult === 'object' ? JSON.stringify(__sfResult) : String(__sfResult)));
  }

} catch(e) {
  __sfError = e.toString();
  gs.error('=== Snow-Flow Script Execution Failed ===');
  gs.error('Error: ' + e.toString());
  if (e.stack) {
    gs.error('Stack: ' + e.stack);
  }
}

// Restore original gs methods
gs.print = __sfOrigPrint;
gs.info = __sfOrigInfo;
gs.warn = __sfOrigWarn;
gs.error = __sfOrigError;

// Calculate execution time
var __sfEndTime = new GlideDateTime();
var __sfExecTimeMs = Math.abs(GlideDateTime.subtract(__sfStartTime, __sfEndTime).getNumericValue());

// Build result object
var __sfResultObj = {
  executionId: '${executionId}',
  success: __sfError === null,
  result: __sfResult,
  error: __sfError,
  output: __sfOutput,
  executionTimeMs: __sfExecTimeMs,
  completedAt: __sfEndTime.getDisplayValue()
};

// Store result in system property for retrieval
gs.setProperty('${outputMarker}', JSON.stringify(__sfResultObj));
gs.info('${outputMarker}:DONE');
`;

    // Step 1: Create Scheduled Script Job (sysauto_script)
    const jobName = `Snow-Flow Output Capture - ${executionId}`;

    const createResponse = await client.post('/api/now/table/sysauto_script', {
      name: jobName,
      script: wrappedScript,
      active: true,
      run_type: 'on_demand',
      conditional: false
    });

    if (!createResponse.data?.result?.sys_id) {
      throw new SnowFlowError(
        ErrorType.SERVICENOW_API_ERROR,
        'Failed to create scheduled script job',
        { details: createResponse.data }
      );
    }

    const jobSysId = createResponse.data.result.sys_id;

    // Step 2: Create sys_trigger to execute immediately
    const now = new Date();
    const triggerTime = new Date(now.getTime() + 2000); // 2 seconds from now
    const triggerTimeStr = triggerTime.toISOString().replace('T', ' ').substring(0, 19);

    try {
      await client.post('/api/now/table/sys_trigger', {
        name: jobName,
        next_action: triggerTimeStr,
        trigger_type: 0,  // Run Once
        state: 0,         // Ready
        document: 'sysauto_script',
        document_key: jobSysId,
        claimed_by: '',
        system_id: 'snow-flow'
      });
    } catch (triggerError) {
      // If trigger creation fails, job won't auto-execute
    }

    // Step 3: Poll for execution results
    const startTime = Date.now();
    let result: any = null;
    let attempts = 0;
    const maxAttempts = Math.ceil(timeout / 2000);

    while (Date.now() - startTime < timeout && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Check sys_properties for output marker
        const propResponse = await client.get('/api/now/table/sys_properties', {
          params: {
            sysparm_query: `name=${outputMarker}`,
            sysparm_fields: 'value,sys_id',
            sysparm_limit: 1
          }
        });

        if (propResponse.data?.result?.[0]?.value) {
          try {
            result = JSON.parse(propResponse.data.result[0].value);

            // Delete the property after reading
            const propSysId = propResponse.data.result[0].sys_id;
            if (propSysId) {
              await client.delete(`/api/now/table/sys_properties/${propSysId}`).catch(() => {});
            }
            break;
          } catch (parseErr) {
            // Continue polling
          }
        }
      } catch (pollError) {
        // Continue polling
      }
    }

    // Step 4: Cleanup - delete the scheduled job
    try {
      await client.delete(`/api/now/table/sysauto_script/${jobSysId}`);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    // Step 5: Format and return results
    if (result) {
      // Organize output by level
      const organized = {
        print: result.output.filter((o: any) => o.level === 'print').map((o: any) => o.message),
        info: result.output.filter((o: any) => o.level === 'info').map((o: any) => o.message),
        warn: result.output.filter((o: any) => o.level === 'warn').map((o: any) => o.message),
        error: result.output.filter((o: any) => o.level === 'error').map((o: any) => o.message),
        success: result.success
      };

      return createSuccessResult({
        success: result.success,
        result: result.result,
        error: result.error,
        output: organized,
        raw_output: result.output,
        execution_time_ms: result.executionTimeMs,
        execution_id: executionId
      }, {
        script_length: script.length,
        scope,
        es5_validated: validate_es5,
        method: 'sysauto_script_with_trigger'
      });
    } else {
      // Script was saved but execution couldn't be confirmed
      return createSuccessResult({
        success: true,
        execution_id: executionId,
        message: 'Script was saved as scheduled job but automatic execution could not be confirmed. The sys_trigger may not have been created (permissions) or the scheduler has not yet picked it up.',
        scheduled_job_sys_id: jobSysId,
        action_required: 'Navigate to System Scheduler > Scheduled Jobs and run the script manually',
        script_name: jobName
      }, {
        script_length: script.length,
        scope,
        es5_validated: validate_es5,
        method: 'scheduled_job_pending'
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
