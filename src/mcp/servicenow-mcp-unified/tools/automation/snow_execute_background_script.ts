/**
 * snow_execute_background_script - Execute background scripts with user confirmation
 *
 * Executes JavaScript background scripts in ServiceNow using Fix Scripts.
 * Includes security analysis and user confirmation (unless autoConfirm=true).
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_execute_background_script',
  description: '🚨 REQUIRES USER CONFIRMATION (unless autoConfirm=true): Execute background script using Fix Scripts (ES5 only)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'script-execution',
  use_cases: ['automation', 'scripts', 'execution'],
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
        description: '🚨 ES5 ONLY! JavaScript code (no const/let/arrows/templates - Rhino engine)'
      },
      description: {
        type: 'string',
        description: 'Clear description of what the script does (shown to user for approval)'
      },
      runAsUser: {
        type: 'string',
        description: 'User to execute script as (optional, defaults to current user)'
      },
      allowDataModification: {
        type: 'boolean',
        description: 'Whether script is allowed to modify data',
        default: false
      },
      autoConfirm: {
        type: 'boolean',
        description: '⚠️ DANGEROUS: Skip user confirmation and execute immediately',
        default: false
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds for polling execution results',
        default: 30000
      }
    },
    required: ['script', 'description']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { script, description, runAsUser, allowDataModification = false, autoConfirm = false, timeout = 30000 } = args;

  try {
    // ES5 validation
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

    // Security analysis
    const securityAnalysis = analyzeScriptSecurity(script);

    // Auto-confirm mode - execute immediately using Fix Scripts
    if (autoConfirm === true) {
      const executionId = `bg_auto_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const outputMarker = `SNOW_FLOW_BG_${executionId}`;

      const client = await getAuthenticatedClient(context);

      // Wrap script with output capture
      const wrappedScript = `
// Snow-Flow Background Script - ID: ${executionId}
// Description: ${description}
// Auto-confirmed execution
var __bgOutput = [];
var __bgStartTime = new GlideDateTime();
var __bgResult = null;
var __bgError = null;

// Capture gs methods
var __bgOrigPrint = gs.print;
var __bgOrigInfo = gs.info;
var __bgOrigWarn = gs.warn;
var __bgOrigError = gs.error;

gs.print = function(msg) { __bgOutput.push({level: 'print', msg: String(msg)}); __bgOrigPrint(msg); };
gs.info = function(msg) { __bgOutput.push({level: 'info', msg: String(msg)}); __bgOrigInfo(msg); };
gs.warn = function(msg) { __bgOutput.push({level: 'warn', msg: String(msg)}); __bgOrigWarn(msg); };
gs.error = function(msg) { __bgOutput.push({level: 'error', msg: String(msg)}); __bgOrigError(msg); };

try {
  gs.info('=== Snow-Flow Background Script Started ===');
  gs.info('Description: ${description.replace(/'/g, "\\'")}');

  __bgResult = (function() {
    ${script}
  })();

  gs.info('=== Snow-Flow Background Script Completed ===');
} catch(e) {
  __bgError = e.toString();
  gs.error('Background Script Error: ' + e.toString());
}

// Restore gs methods
gs.print = __bgOrigPrint;
gs.info = __bgOrigInfo;
gs.warn = __bgOrigWarn;
gs.error = __bgOrigError;

// Store result
var __bgEndTime = new GlideDateTime();
var __bgExecTime = Math.abs(GlideDateTime.subtract(__bgStartTime, __bgEndTime).getNumericValue());

var __bgResultObj = {
  executionId: '${executionId}',
  success: __bgError === null,
  result: __bgResult,
  error: __bgError,
  output: __bgOutput,
  executionTimeMs: __bgExecTime,
  description: '${description.replace(/'/g, "\\'")}'
};

gs.setProperty('${outputMarker}', JSON.stringify(__bgResultObj));
gs.info('${outputMarker}:COMPLETE');
`;

      // Create Scheduled Script Job
      const jobName = `Snow-Flow BG Script - ${executionId}`;

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
          'Failed to create scheduled script job for background execution',
          { details: createResponse.data }
        );
      }

      const jobSysId = createResponse.data.result.sys_id;

      // Create sys_trigger to execute immediately
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

      // Poll for execution results
      const startTime = Date.now();
      let result: any = null;
      let attempts = 0;
      const maxAttempts = Math.ceil(timeout / 2000);

      while (Date.now() - startTime < timeout && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
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

              // Cleanup property
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

      // Cleanup scheduled job
      try {
        await client.delete(`/api/now/table/sysauto_script/${jobSysId}`);
      } catch (cleanupError) {
        // Ignore
      }

      if (result) {
        return createSuccessResult({
          executed: true,
          execution_id: executionId,
          success: result.success,
          result: result.result,
          error: result.error,
          output: result.output,
          execution_time_ms: result.executionTimeMs,
          auto_confirmed: true,
          security_analysis: securityAnalysis
        }, {
          method: 'sysauto_script_with_trigger',
          description
        });
      } else {
        return createSuccessResult({
          executed: false,
          execution_id: executionId,
          scheduled_job_sys_id: jobSysId,
          auto_confirmed: true,
          security_analysis: securityAnalysis,
          message: 'Script was saved as scheduled job but automatic execution could not be confirmed. The sys_trigger may not have been created (permissions) or the scheduler has not yet picked it up.',
          action_required: `Navigate to System Scheduler > Scheduled Jobs and run: ${jobName}`
        }, {
          method: 'scheduled_job_pending',
          description
        });
      }
    }

    // Standard mode - return confirmation request
    const confirmationPrompt = generateConfirmationPrompt({
      script,
      description,
      runAsUser,
      allowDataModification,
      securityAnalysis
    });

    return createSuccessResult({
      requires_confirmation: true,
      confirmation_prompt: confirmationPrompt,
      script_to_execute: script,
      execution_context: {
        runAsUser: runAsUser || 'current',
        allowDataModification,
        securityLevel: securityAnalysis.riskLevel
      }
    }, {
      action_required: 'User must approve script execution via snow_confirm_script_execution'
    });

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

function analyzeScriptSecurity(script: string): any {
  const analysis = {
    riskLevel: 'LOW',
    warnings: [] as string[],
    dataOperations: [] as string[],
    systemAccess: [] as string[]
  };

  const dataModificationPatterns = [
    /\.insert\(\)/gi,
    /\.update\(\)/gi,
    /\.deleteRecord\(\)/gi,
    /\.setValue\(/gi
  ];

  const systemAccessPatterns = [
    /gs\.getUser\(\)/gi,
    /gs\.getUserID\(\)/gi,
    /gs\.hasRole\(/gi,
    /gs\.executeNow\(/gi
  ];

  const dangerousPatterns = [
    /eval\(/gi,
    /new Function\(/gi,
    /\.setWorkflow\(/gi
  ];

  dataModificationPatterns.forEach(pattern => {
    const matches = script.match(pattern);
    if (matches) {
      analysis.dataOperations.push(...matches);
      if (analysis.riskLevel === 'LOW') analysis.riskLevel = 'MEDIUM';
    }
  });

  systemAccessPatterns.forEach(pattern => {
    const matches = script.match(pattern);
    if (matches) {
      analysis.systemAccess.push(...matches);
    }
  });

  dangerousPatterns.forEach(pattern => {
    const matches = script.match(pattern);
    if (matches) {
      analysis.warnings.push(`Potentially dangerous operation detected: ${matches[0]}`);
      analysis.riskLevel = 'HIGH';
    }
  });

  if (script.includes('while') && (script.includes('.next()') || script.includes('.hasNext()'))) {
    analysis.warnings.push('Script contains loops that may process many records');
    if (analysis.riskLevel === 'LOW') analysis.riskLevel = 'MEDIUM';
  }

  return analysis;
}

function generateConfirmationPrompt(context: any): string {
  const { script, description, runAsUser, allowDataModification, securityAnalysis } = context;

  const riskEmoji = {
    'LOW': '🟢',
    'MEDIUM': '🟡',
    'HIGH': '🔴'
  }[securityAnalysis.riskLevel] || '⚪';

  return `
🚨 BACKGROUND SCRIPT EXECUTION REQUEST

📋 **Description:** ${description}

${riskEmoji} **Security Risk Level:** ${securityAnalysis.riskLevel}

👤 **Run as User:** ${runAsUser || 'Current User'}
📝 **Data Modification:** ${allowDataModification ? '✅ ALLOWED' : '❌ READ-ONLY'}

🔍 **Script Analysis:**
${securityAnalysis.dataOperations.length > 0 ?
  `📊 Data Operations Detected: ${securityAnalysis.dataOperations.join(', ')}` : ''}
${securityAnalysis.systemAccess.length > 0 ?
  `🔧 System Access: ${securityAnalysis.systemAccess.join(', ')}` : ''}
${securityAnalysis.warnings.length > 0 ?
  `⚠️ Warnings: ${securityAnalysis.warnings.join(', ')}` : ''}

📜 **Script to Execute:**
\`\`\`javascript
${script}
\`\`\`

⚡ **Impact:** This script will run in ServiceNow's server-side JavaScript context with full API access.

❓ **Do you want to proceed with executing this script?**

Reply with:
- ✅ **YES** - Execute the script
- ❌ **NO** - Cancel execution
- 📝 **MODIFY** - Make changes before execution

⚠️ Only proceed if you understand what this script does and trust its source!
`.trim();
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
