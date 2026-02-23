/**
 * snow_schedule_script_job - Schedule server-side script execution
 *
 * ⚠️ IMPORTANT: This tool does NOT execute scripts directly!
 * It creates a Scheduled Script Job (sysauto_script) and attempts to trigger it.
 *
 * How it works:
 * 1. Creates a scheduled job in sysauto_script table
 * 2. Attempts to create a sys_trigger to run it immediately
 * 3. Polls for results via sys_properties (max 30 seconds)
 * 4. If trigger fails or scheduler is slow, returns executed=false
 *
 * When executed=false is returned:
 * - The script job WAS created successfully
 * - You need to manually run it: System Scheduler > Scheduled Jobs
 * - Or wait for the scheduler to pick it up
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from "../../shared/error-handler.js"
import crypto from "crypto"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_schedule_script_job",
  description:
    "⚠️ SCHEDULES (not executes directly) server-side JavaScript via Scheduled Script Job. Creates sysauto_script + sys_trigger. Returns executed=false if scheduler doesn't pick it up within 30s - check System Scheduler > Scheduled Jobs to run manually. ES5 only!",
  // Metadata for tool discovery (not sent to LLM)
  category: "automation",
  subcategory: "scheduled-jobs",
  use_cases: ["automation", "scripts", "scheduled-jobs", "debugging", "verification"],
  complexity: "advanced",
  frequency: "high",

  // Permission enforcement
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      script: {
        type: "string",
        description: "🚨 ES5 ONLY! JavaScript code to execute (no const/let/arrows/templates - Rhino engine)",
      },
      description: {
        type: "string",
        description: "Clear description of what the script does (required if requireConfirmation=true)",
      },
      scope: {
        type: "string",
        description: "Scope to execute in",
        default: "global",
        enum: ["global", "rhino"],
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds for polling execution results",
        default: 30000,
      },
      validate_es5: {
        type: "boolean",
        description: "Validate ES5 syntax before execution",
        default: true,
      },
      requireConfirmation: {
        type: "boolean",
        description: "Require user confirmation before execution (shows security analysis)",
        default: false,
      },
      autoConfirm: {
        type: "boolean",
        description: "⚠️ DANGEROUS: Skip user confirmation even if requireConfirmation would normally be required",
        default: false,
      },
      allowDataModification: {
        type: "boolean",
        description: "Whether script is allowed to modify data (for security analysis)",
        default: false,
      },
      runAsUser: {
        type: "string",
        description: "User to execute script as (optional, defaults to current user)",
      },
    },
    required: ["script"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    script,
    description = "Script scheduled via snow_schedule_script_job",
    scope = "global",
    timeout = 30000,
    validate_es5 = true,
    requireConfirmation = false,
    autoConfirm = false,
    allowDataModification = false,
    runAsUser,
  } = args

  // ES5 validation (warning only, does not block execution)
  const es5Warnings: string[] = []

  try {
    if (validate_es5) {
      const es5Validation = validateES5(script)
      if (!es5Validation.valid) {
        es5Warnings.push(
          `Script contains ES6+ syntax (${es5Validation.violations.map((v: any) => v.type).join(", ")}). This may cause runtime errors in ServiceNow's Rhino engine. Consider using ES5 syntax.`,
        )
      }
    }

    // Security analysis
    const securityAnalysis = analyzeScriptSecurity(script)

    // Check if confirmation is needed
    if (requireConfirmation && !autoConfirm) {
      // Return confirmation request
      const confirmationPrompt = generateConfirmationPrompt({
        script,
        description,
        runAsUser,
        allowDataModification,
        securityAnalysis,
      })

      return createSuccessResult(
        {
          requires_confirmation: true,
          confirmation_prompt: confirmationPrompt,
          script_to_execute: script,
          execution_context: {
            runAsUser: runAsUser || "current",
            allowDataModification,
            securityLevel: securityAnalysis.riskLevel,
          },
          next_step: "Call snow_confirm_script_execution with userConfirmed=true to execute",
        },
        {
          action_required: "User must approve script execution via snow_confirm_script_execution",
        },
      )
    }

    // Execute the script
    return await executeScript(
      {
        script,
        description,
        timeout,
        securityAnalysis,
        autoConfirm,
        es5Warnings,
      },
      context,
    )
  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message, { originalError: error }),
    )
  }
}

async function executeScript(
  params: {
    script: string
    description: string
    timeout: number
    securityAnalysis: any
    autoConfirm: boolean
    es5Warnings: string[]
  },
  context: ServiceNowContext,
): Promise<ToolResult> {
  const { script, description, timeout, securityAnalysis, autoConfirm, es5Warnings } = params

  const client = await getAuthenticatedClient(context)

  // SECURITY: Proper string escaping - escape backslashes first, then quotes
  const escapeForJS = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")

  // Create unique execution ID for tracking
  const executionId = `exec_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`
  const outputMarker = `SNOW_FLOW_EXEC_${executionId}`

  // Wrap script with comprehensive output capture
  const wrappedScript = `
// Snow-Flow Script Execution - ID: ${executionId}
// Description: ${escapeForJS(description)}
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
  gs.info('Description: ${escapeForJS(description)}');

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
`

  // Step 1: Create Scheduled Script Job (sysauto_script)
  const jobName = `Snow-Flow Exec - ${executionId}`

  const createResponse = await client.post("/api/now/table/sysauto_script", {
    name: jobName,
    script: wrappedScript,
    active: true,
    run_type: "on_demand",
    conditional: false,
  })

  if (!createResponse.data?.result?.sys_id) {
    throw new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, "Failed to create scheduled script job", {
      details: createResponse.data,
    })
  }

  const jobSysId = createResponse.data.result.sys_id

  // Step 2: Create sys_trigger to execute immediately
  const now = new Date()
  const triggerTime = new Date(now.getTime() + 2000) // 2 seconds from now
  const triggerTimeStr = triggerTime.toISOString().replace("T", " ").substring(0, 19)

  try {
    await client.post("/api/now/table/sys_trigger", {
      name: jobName,
      next_action: triggerTimeStr,
      trigger_type: 0, // Run Once
      state: 0, // Ready
      document: "sysauto_script",
      document_key: jobSysId,
      claimed_by: "",
      system_id: "snow-flow",
    })
  } catch (triggerError) {
    // If trigger creation fails, job won't auto-execute
    // Continue anyway - we'll check results
  }

  // Step 3: Poll for execution results
  const startTime = Date.now()
  let result: any = null
  let attempts = 0
  const maxAttempts = Math.ceil(timeout / 2000)

  while (Date.now() - startTime < timeout && attempts < maxAttempts) {
    attempts++
    await new Promise((resolve) => setTimeout(resolve, 2000))

    try {
      // Check sys_properties for output marker
      const propResponse = await client.get("/api/now/table/sys_properties", {
        params: {
          sysparm_query: `name=${outputMarker}`,
          sysparm_fields: "value,sys_id",
          sysparm_limit: 1,
        },
      })

      if (propResponse.data?.result?.[0]?.value) {
        try {
          result = JSON.parse(propResponse.data.result[0].value)

          // Delete the property after reading
          const propSysId = propResponse.data.result[0].sys_id
          if (propSysId) {
            await client.delete(`/api/now/table/sys_properties/${propSysId}`).catch(() => {})
          }
          break
        } catch (parseErr) {
          // Continue polling
        }
      }
    } catch (pollError) {
      // Continue polling
    }
  }

  // Step 4: Format and return results
  if (result) {
    // Execution was confirmed - cleanup the job
    try {
      await client.delete(`/api/now/table/sysauto_script/${jobSysId}`)
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    // Organize output by level
    const organized = {
      print: result.output.filter((o: any) => o.level === "print").map((o: any) => o.message),
      info: result.output.filter((o: any) => o.level === "info").map((o: any) => o.message),
      warn: result.output.filter((o: any) => o.level === "warn").map((o: any) => o.message),
      error: result.output.filter((o: any) => o.level === "error").map((o: any) => o.message),
      success: result.success,
    }

    const successData: any = {
      executed: true,
      success: result.success,
      result: result.result,
      error: result.error,
      output: organized,
      raw_output: result.output,
      execution_time_ms: result.executionTimeMs,
      execution_id: executionId,
      auto_confirmed: autoConfirm,
      security_analysis: securityAnalysis,
    }

    // Add ES5 warnings if any (non-blocking, informational only)
    if (es5Warnings.length > 0) {
      successData.warnings = es5Warnings
    }

    return createSuccessResult(successData, {
      script_length: params.script.length,
      method: "sysauto_script_with_trigger",
      description,
    })
  } else {
    // Script was saved but execution couldn't be confirmed
    // DO NOT delete the job - user may want to trigger it manually
    const pendingData: any = {
      executed: false,
      execution_id: executionId,
      scheduled_job_sys_id: jobSysId,
      job_name: jobName,
      auto_confirmed: autoConfirm,
      security_analysis: securityAnalysis,
      message:
        "Script was saved as scheduled job but automatic execution could not be confirmed. The sys_trigger may not have been created (permissions) or the scheduler has not yet picked it up.",
      action_required: `Navigate to System Scheduler > Scheduled Jobs and run: ${jobName}`,
      manual_url: `${context.instanceUrl}/sysauto_script.do?sys_id=${jobSysId}`,
    }

    // Add ES5 warnings if any (non-blocking, informational only)
    if (es5Warnings.length > 0) {
      pendingData.warnings = es5Warnings
    }

    return createSuccessResult(pendingData, {
      script_length: params.script.length,
      method: "scheduled_job_pending",
      description,
    })
  }
}

function validateES5(code: string): { valid: boolean; violations: any[] } {
  const violations: any[] = []

  const patterns = [
    { regex: /\b(const|let)\s+/g, type: "const/let", fix: "Use 'var'" },
    { regex: /\([^)]*\)\s*=>/g, type: "arrow_function", fix: "Use function() {}" },
    { regex: /`[^`]*`/g, type: "template_literal", fix: "Use string concatenation" },
    { regex: /\{[^}]+\}\s*=\s*/g, type: "destructuring", fix: "Use explicit properties" },
    { regex: /for\s*\([^)]*\s+of\s+/g, type: "for_of", fix: "Use traditional for loop" },
    { regex: /class\s+\w+/g, type: "class", fix: "Use function constructor" },
  ]

  patterns.forEach(({ regex, type, fix }) => {
    let match
    while ((match = regex.exec(code)) !== null) {
      violations.push({
        type,
        line: code.substring(0, match.index).split("\n").length,
        code: match[0],
        fix,
      })
    }
  })

  return { valid: violations.length === 0, violations }
}

function analyzeScriptSecurity(script: string): any {
  const analysis = {
    riskLevel: "LOW",
    warnings: [] as string[],
    dataOperations: [] as string[],
    systemAccess: [] as string[],
  }

  const dataModificationPatterns = [/\.insert\(\)/gi, /\.update\(\)/gi, /\.deleteRecord\(\)/gi, /\.setValue\(/gi]

  const systemAccessPatterns = [/gs\.getUser\(\)/gi, /gs\.getUserID\(\)/gi, /gs\.hasRole\(/gi, /gs\.executeNow\(/gi]

  const dangerousPatterns = [/eval\(/gi, /new Function\(/gi, /\.setWorkflow\(/gi]

  dataModificationPatterns.forEach((pattern) => {
    const matches = script.match(pattern)
    if (matches) {
      analysis.dataOperations.push(...matches)
      if (analysis.riskLevel === "LOW") analysis.riskLevel = "MEDIUM"
    }
  })

  systemAccessPatterns.forEach((pattern) => {
    const matches = script.match(pattern)
    if (matches) {
      analysis.systemAccess.push(...matches)
    }
  })

  dangerousPatterns.forEach((pattern) => {
    const matches = script.match(pattern)
    if (matches) {
      analysis.warnings.push(`Potentially dangerous operation detected: ${matches[0]}`)
      analysis.riskLevel = "HIGH"
    }
  })

  if (script.includes("while") && (script.includes(".next()") || script.includes(".hasNext()"))) {
    analysis.warnings.push("Script contains loops that may process many records")
    if (analysis.riskLevel === "LOW") analysis.riskLevel = "MEDIUM"
  }

  return analysis
}

function generateConfirmationPrompt(context: any): string {
  const { script, description, runAsUser, allowDataModification, securityAnalysis } = context

  const riskEmoji =
    {
      LOW: "🟢",
      MEDIUM: "🟡",
      HIGH: "🔴",
    }[securityAnalysis.riskLevel] || "⚪"

  return `
🚨 SCRIPT EXECUTION REQUEST

📋 **Description:** ${description}

${riskEmoji} **Security Risk Level:** ${securityAnalysis.riskLevel}

👤 **Run as User:** ${runAsUser || "Current User"}
📝 **Data Modification:** ${allowDataModification ? "✅ ALLOWED" : "❌ READ-ONLY"}

🔍 **Script Analysis:**
${
  securityAnalysis.dataOperations.length > 0
    ? `📊 Data Operations Detected: ${securityAnalysis.dataOperations.join(", ")}`
    : ""
}
${securityAnalysis.systemAccess.length > 0 ? `🔧 System Access: ${securityAnalysis.systemAccess.join(", ")}` : ""}
${securityAnalysis.warnings.length > 0 ? `⚠️ Warnings: ${securityAnalysis.warnings.join(", ")}` : ""}

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
`.trim()
}

export const version = "2.0.0"
export const author = "Snow-Flow SDK"
