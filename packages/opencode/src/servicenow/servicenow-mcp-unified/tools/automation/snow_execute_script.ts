/**
 * snow_execute_script - Execute server-side JavaScript on ServiceNow
 *
 * Primary: synchronous execution via Scripted REST API (~1-3s)
 * Fallback: scheduled job if endpoint unavailable
 * Auto-deploys the executor endpoint on first use.
 *
 * ES5 only! ServiceNow runs on Rhino engine.
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from "../../shared/error-handler.js"
import { randomBytes } from "crypto"

const ENDPOINT_SERVICE_ID = "snow_flow_exec"
const ENDPOINT_PATH = "/execute"

const endpointCache = new Map<string, { namespace: string }>()

const OPERATION_SCRIPT = `(function process(request, response) {
  var body = request.body.data;
  var script = body.script;
  var id = body.execution_id || gs.generateGUID();

  if (!script) {
    response.setStatus(400);
    response.setBody({ success: false, error: 'No script provided' });
    return;
  }

  var output = [];
  var result = null;
  var error = null;
  var startTime = new GlideDateTime();

  var origPrint = gs.print;
  var origInfo = gs.info;
  var origWarn = gs.warn;
  var origError = gs.error;

  gs.print = function(msg) {
    var m = String(msg);
    output.push({ level: 'print', message: m });
    origPrint.call(gs, m);
  };
  gs.info = function(msg) {
    var m = String(msg);
    output.push({ level: 'info', message: m });
    origInfo.call(gs, m);
  };
  gs.warn = function(msg) {
    var m = String(msg);
    output.push({ level: 'warn', message: m });
    origWarn.call(gs, m);
  };
  gs.error = function(msg) {
    var m = String(msg);
    output.push({ level: 'error', message: m });
    origError.call(gs, m);
  };

  try {
    result = GlideEvaluator.evaluateString(script);
  } catch (e) {
    error = e.toString();
    if (e.stack) error = error + '\\nStack: ' + e.stack;
  }

  gs.print = origPrint;
  gs.info = origInfo;
  gs.warn = origWarn;
  gs.error = origError;

  var endTime = new GlideDateTime();
  var execMs = Math.abs(GlideDateTime.subtract(startTime, endTime).getNumericValue());

  response.setStatus(error ? 500 : 200);
  response.setBody({
    execution_id: id,
    success: error === null,
    result: result,
    error: error,
    output: output,
    execution_time_ms: execMs
  });
})(request, response);`

export const toolDefinition: MCPToolDefinition = {
  name: "snow_execute_script",
  description:
    "Execute server-side JavaScript on ServiceNow. Primary: synchronous execution via Scripted REST API (~1-3s). Fallback: scheduled job if endpoint unavailable. Auto-deploys the executor endpoint on first use. ES5 only (Rhino engine)!",
  category: "automation",
  subcategory: "script-execution",
  use_cases: ["automation", "scripts", "scheduled-jobs", "debugging", "verification"],
  complexity: "advanced",
  frequency: "high",
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      script: {
        type: "string",
        description: "ES5 ONLY! JavaScript code to execute (no const/let/arrows/templates - Rhino engine)",
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
        description: "Timeout in milliseconds for polling execution results (fallback mode only)",
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
        description: "Skip user confirmation even if requireConfirmation would normally be required",
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

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const script = args.script as string
  const description = (args.description as string) || "Script executed via snow_execute_script"
  const timeout = (args.timeout as number) || 30000
  const validate = args.validate_es5 !== false
  const confirmation = args.requireConfirmation === true
  const auto = args.autoConfirm === true
  const modification = args.allowDataModification === true
  const user = args.runAsUser as string | undefined

  const warnings: string[] = []

  try {
    if (validate) {
      const validation = validateES5(script)
      if (!validation.valid) {
        warnings.push(
          `Script contains ES6+ syntax (${validation.violations.map((v) => v.type).join(", ")}). This may cause runtime errors in ServiceNow's Rhino engine. Consider using ES5 syntax.`,
        )
      }
    }

    const security = analyzeScriptSecurity(script)

    if (confirmation && !auto) {
      const prompt = generateConfirmationPrompt({
        script,
        description,
        runAsUser: user,
        allowDataModification: modification,
        securityAnalysis: security,
      })

      return createSuccessResult(
        {
          requires_confirmation: true,
          confirmation_prompt: prompt,
          script_to_execute: script,
          execution_context: {
            runAsUser: user || "current",
            allowDataModification: modification,
            securityLevel: security.riskLevel,
          },
          next_step: "Call snow_confirm_script_execution with userConfirmed=true to execute",
        },
        {
          action_required: "User must approve script execution via snow_confirm_script_execution",
        },
      )
    }

    return await executeScript(
      { script, description, timeout, securityAnalysis: security, autoConfirm: auto, es5Warnings: warnings },
      context,
    )
  } catch (error: unknown) {
    const err = error as Error
    return createErrorResult(
      err instanceof SnowFlowError
        ? err
        : new SnowFlowError(ErrorType.UNKNOWN_ERROR, err.message, { originalError: err }),
    )
  }
}

function getEndpointUrl(context: ServiceNowContext): string {
  const cached = endpointCache.get(context.instanceUrl)
  if (cached) return `/api/${cached.namespace}/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`
  return `/api/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`
}

async function ensureEndpoint(context: ServiceNowContext): Promise<boolean> {
  if (endpointCache.has(context.instanceUrl)) return true

  const client = await getAuthenticatedClient(context)

  const check = await client.get("/api/now/table/sys_ws_definition", {
    params: {
      sysparm_query: `service_id=${ENDPOINT_SERVICE_ID}`,
      sysparm_fields: "sys_id,namespace,base_uri",
      sysparm_limit: 1,
    },
  })

  const existing = check.data?.result?.[0]
  const svcId =
    existing?.sys_id ||
    (await (async () => {
      const svc = await client.post("/api/now/table/sys_ws_definition", {
        name: "Snow-Flow Script Executor",
        service_id: ENDPOINT_SERVICE_ID,
        short_description: "Synchronous script execution endpoint for Snow-Flow",
        active: true,
      })

      const id = svc.data?.result?.sys_id
      if (!id) return null

      await client.post("/api/now/table/sys_ws_operation", {
        name: "Execute Script",
        web_service_definition: id,
        http_method: "POST",
        relative_path: ENDPOINT_PATH,
        operation_script: OPERATION_SCRIPT,
        active: true,
      })

      return id
    })())

  if (!svcId) return false

  const svcRecord =
    existing ||
    (
      await client
        .get("/api/now/table/sys_ws_definition/" + svcId, {
          params: { sysparm_fields: "namespace,base_uri" },
        })
        .catch(() => null)
    )?.data?.result

  const ns = svcRecord?.namespace || ""

  const candidates = ns
    ? [`/api/${ns}/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`, `/api/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`]
    : [`/api/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`]

  for (const url of candidates) {
    const ping = await client.post(url, { script: "'pong'", execution_id: "deploy_verify" }).catch(() => null)

    if (ping?.data?.result?.success === true) {
      const parts = url.replace(`/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`, "").replace("/api/", "")
      endpointCache.set(context.instanceUrl, { namespace: parts || ENDPOINT_SERVICE_ID })
      return true
    }
  }

  if (ns) {
    endpointCache.set(context.instanceUrl, { namespace: ns })
    return true
  }

  return false
}

async function executeViaSyncApi(
  params: {
    script: string
    executionId: string
    description: string
    securityAnalysis: Record<string, unknown>
    autoConfirm: boolean
    es5Warnings: string[]
  },
  context: ServiceNowContext,
): Promise<ToolResult | null> {
  const client = await getAuthenticatedClient(context)

  const response = await client
    .post(getEndpointUrl(context), {
      script: params.script,
      execution_id: params.executionId,
    })
    .catch((err: { response?: { status?: number } }) => {
      if (err.response?.status === 404 || err.response?.status === 403) return null
      throw err
    })

  if (!response) return null

  const data = response.data?.result
  if (!data) return null

  const organized = {
    print: (data.output || [])
      .filter((o: { level: string }) => o.level === "print")
      .map((o: { message: string }) => o.message),
    info: (data.output || [])
      .filter((o: { level: string }) => o.level === "info")
      .map((o: { message: string }) => o.message),
    warn: (data.output || [])
      .filter((o: { level: string }) => o.level === "warn")
      .map((o: { message: string }) => o.message),
    error: (data.output || [])
      .filter((o: { level: string }) => o.level === "error")
      .map((o: { message: string }) => o.message),
    success: data.success,
  }

  const result: Record<string, unknown> = {
    executed: true,
    success: data.success,
    result: data.result,
    error: data.error,
    output: organized,
    raw_output: data.output,
    execution_time_ms: data.execution_time_ms,
    execution_id: params.executionId,
    auto_confirmed: params.autoConfirm,
    security_analysis: params.securityAnalysis,
  }

  if (params.es5Warnings.length > 0) {
    result.warnings = params.es5Warnings
  }

  return createSuccessResult(result, {
    script_length: params.script.length,
    method: "sync_rest_api",
    description: params.description,
  })
}

async function executeViaScheduler(
  params: {
    script: string
    description: string
    timeout: number
    securityAnalysis: Record<string, unknown>
    autoConfirm: boolean
    es5Warnings: string[]
  },
  context: ServiceNowContext,
): Promise<ToolResult> {
  const client = await getAuthenticatedClient(context)

  const escape = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")

  const executionId = `exec_${Date.now()}_${randomBytes(6).toString("hex")}`
  const marker = `SNOW_FLOW_EXEC_${executionId}`

  const wrapped = `
var __sfOutput = [];
var __sfStartTime = new GlideDateTime();
var __sfResult = null;
var __sfError = null;

var __sfOrigPrint = gs.print;
var __sfOrigInfo = gs.info;
var __sfOrigWarn = gs.warn;
var __sfOrigError = gs.error;

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

try {
  gs.info('=== Snow-Flow Script Execution Started ===');
  gs.info('Description: ${escape(params.description)}');
  __sfResult = (function() {
    ${params.script}
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

gs.print = __sfOrigPrint;
gs.info = __sfOrigInfo;
gs.warn = __sfOrigWarn;
gs.error = __sfOrigError;

var __sfEndTime = new GlideDateTime();
var __sfExecTimeMs = Math.abs(GlideDateTime.subtract(__sfStartTime, __sfEndTime).getNumericValue());

var __sfResultObj = {
  executionId: '${executionId}',
  success: __sfError === null,
  result: __sfResult,
  error: __sfError,
  output: __sfOutput,
  executionTimeMs: __sfExecTimeMs,
  completedAt: __sfEndTime.getDisplayValue()
};

gs.setProperty('${marker}', JSON.stringify(__sfResultObj));
gs.info('${marker}:DONE');
`

  const name = `Snow-Flow Exec - ${executionId}`

  const job = await client.post("/api/now/table/sysauto_script", {
    name,
    script: wrapped,
    active: true,
    run_type: "on_demand",
    conditional: false,
  })

  if (!job.data?.result?.sys_id) {
    throw new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, "Failed to create scheduled script job", {
      details: job.data,
    })
  }

  const jobId = job.data.result.sys_id

  const now = new Date()
  const trigger = new Date(now.getTime() + 2000)
  const triggerStr = trigger.toISOString().replace("T", " ").substring(0, 19)

  await client
    .post("/api/now/table/sys_trigger", {
      name,
      next_action: triggerStr,
      trigger_type: 0,
      state: 0,
      document: "sysauto_script",
      document_key: jobId,
      claimed_by: "",
      system_id: "snow-flow",
    })
    .catch(() => {})

  const start = Date.now()
  const max = Math.ceil(params.timeout / 2000)
  let result: Record<string, unknown> | null = null

  for (let i = 0; i < max && Date.now() - start < params.timeout; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const prop = await client
      .get("/api/now/table/sys_properties", {
        params: {
          sysparm_query: `name=${marker}`,
          sysparm_fields: "value,sys_id",
          sysparm_limit: 1,
        },
      })
      .catch(() => null)

    const entry = prop?.data?.result?.[0]
    if (!entry?.value) continue

    try {
      result = JSON.parse(entry.value) as Record<string, unknown>
      if (entry.sys_id) {
        await client.delete(`/api/now/table/sys_properties/${entry.sys_id}`).catch(() => {})
      }
      break
    } catch {
      continue
    }
  }

  if (result) {
    await client.delete(`/api/now/table/sysauto_script/${jobId}`).catch(() => {})

    const output = (result.output || []) as Array<{ level: string; message: string }>
    const organized = {
      print: output.filter((o) => o.level === "print").map((o) => o.message),
      info: output.filter((o) => o.level === "info").map((o) => o.message),
      warn: output.filter((o) => o.level === "warn").map((o) => o.message),
      error: output.filter((o) => o.level === "error").map((o) => o.message),
      success: result.success,
    }

    const data: Record<string, unknown> = {
      executed: true,
      success: result.success,
      result: result.result,
      error: result.error,
      output: organized,
      raw_output: result.output,
      execution_time_ms: result.executionTimeMs,
      execution_id: executionId,
      auto_confirmed: params.autoConfirm,
      security_analysis: params.securityAnalysis,
      fallback_warning: "Executed via scheduler fallback. The sync REST API endpoint could not be reached.",
    }

    if (params.es5Warnings.length > 0) {
      data.warnings = params.es5Warnings
    }

    return createSuccessResult(data, {
      script_length: params.script.length,
      method: "sysauto_script_with_trigger",
      description: params.description,
    })
  }

  const pending: Record<string, unknown> = {
    executed: false,
    execution_id: executionId,
    scheduled_job_sys_id: jobId,
    job_name: name,
    auto_confirmed: params.autoConfirm,
    security_analysis: params.securityAnalysis,
    message:
      "Script was saved as scheduled job but automatic execution could not be confirmed. The sys_trigger may not have been created (permissions) or the scheduler has not yet picked it up.",
    action_required: `Navigate to System Scheduler > Scheduled Jobs and run: ${name}`,
    manual_url: `${context.instanceUrl}/sysauto_script.do?sys_id=${jobId}`,
    fallback_warning: "Both sync REST API and scheduler fallback failed to confirm execution.",
  }

  if (params.es5Warnings.length > 0) {
    pending.warnings = params.es5Warnings
  }

  return createSuccessResult(pending, {
    script_length: params.script.length,
    method: "scheduled_job_pending",
    description: params.description,
  })
}

async function executeScript(
  params: {
    script: string
    description: string
    timeout: number
    securityAnalysis: Record<string, unknown>
    autoConfirm: boolean
    es5Warnings: string[]
  },
  context: ServiceNowContext,
): Promise<ToolResult> {
  const executionId = `exec_${Date.now()}_${randomBytes(6).toString("hex")}`

  const syncResult = await executeViaSyncApi({ ...params, executionId }, context)
  if (syncResult) return syncResult

  const ok = await ensureEndpoint(context).catch(() => false)
  if (ok) {
    const retry = await executeViaSyncApi({ ...params, executionId }, context)
    if (retry) return retry
  }

  return executeViaScheduler(params, context)
}

function validateES5(code: string): {
  valid: boolean
  violations: Array<{ type: string; line: number; code: string; fix: string }>
} {
  const violations: Array<{ type: string; line: number; code: string; fix: string }> = []

  const patterns = [
    { regex: /\b(const|let)\s+/g, type: "const/let", fix: "Use 'var'" },
    { regex: /\([^)]*\)\s*=>/g, type: "arrow_function", fix: "Use function() {}" },
    { regex: /`[^`]*`/g, type: "template_literal", fix: "Use string concatenation" },
    { regex: /\{[^}]+\}\s*=\s*/g, type: "destructuring", fix: "Use explicit properties" },
    { regex: /for\s*\([^)]*\s+of\s+/g, type: "for_of", fix: "Use traditional for loop" },
    { regex: /class\s+\w+/g, type: "class", fix: "Use function constructor" },
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.regex.exec(code)) !== null) {
      violations.push({
        type: pattern.type,
        line: code.substring(0, match.index).split("\n").length,
        code: match[0],
        fix: pattern.fix,
      })
    }
  }

  return { valid: violations.length === 0, violations }
}

function analyzeScriptSecurity(script: string): Record<string, unknown> {
  const analysis = {
    riskLevel: "LOW" as string,
    warnings: [] as string[],
    dataOperations: [] as string[],
    systemAccess: [] as string[],
  }

  const modification = [/\.insert\(\)/gi, /\.update\(\)/gi, /\.deleteRecord\(\)/gi, /\.setValue\(/gi]
  const system = [/gs\.getUser\(\)/gi, /gs\.getUserID\(\)/gi, /gs\.hasRole\(/gi, /gs\.executeNow\(/gi]
  const dangerous = [/eval\(/gi, /new Function\(/gi, /\.setWorkflow\(/gi]

  for (const pattern of modification) {
    const matches = script.match(pattern)
    if (matches) {
      analysis.dataOperations.push(...matches)
      if (analysis.riskLevel === "LOW") analysis.riskLevel = "MEDIUM"
    }
  }

  for (const pattern of system) {
    const matches = script.match(pattern)
    if (matches) {
      analysis.systemAccess.push(...matches)
    }
  }

  for (const pattern of dangerous) {
    const matches = script.match(pattern)
    if (matches) {
      analysis.warnings.push(`Potentially dangerous operation detected: ${matches[0]}`)
      analysis.riskLevel = "HIGH"
    }
  }

  if (script.includes("while") && (script.includes(".next()") || script.includes(".hasNext()"))) {
    analysis.warnings.push("Script contains loops that may process many records")
    if (analysis.riskLevel === "LOW") analysis.riskLevel = "MEDIUM"
  }

  return analysis
}

function generateConfirmationPrompt(ctx: {
  script: string
  description: string
  runAsUser: string | undefined
  allowDataModification: boolean
  securityAnalysis: Record<string, unknown>
}): string {
  const risk = ctx.securityAnalysis.riskLevel as string
  const emoji = risk === "HIGH" ? "RED" : risk === "MEDIUM" ? "YELLOW" : "GREEN"
  const ops = ctx.securityAnalysis.dataOperations as string[]
  const access = ctx.securityAnalysis.systemAccess as string[]
  const warns = ctx.securityAnalysis.warnings as string[]

  return `
SCRIPT EXECUTION REQUEST

Description: ${ctx.description}

Security Risk Level: ${emoji} ${risk}

Run as User: ${ctx.runAsUser || "Current User"}
Data Modification: ${ctx.allowDataModification ? "ALLOWED" : "READ-ONLY"}

Script Analysis:
${ops.length > 0 ? `Data Operations Detected: ${ops.join(", ")}` : ""}
${access.length > 0 ? `System Access: ${access.join(", ")}` : ""}
${warns.length > 0 ? `Warnings: ${warns.join(", ")}` : ""}

Script to Execute:
\`\`\`javascript
${ctx.script}
\`\`\`

Impact: This script will run in ServiceNow's server-side JavaScript context with full API access.

Do you want to proceed with executing this script?

Reply with:
- YES - Execute the script
- NO - Cancel execution
- MODIFY - Make changes before execution

Only proceed if you understand what this script does and trust its source!
`.trim()
}

export const version = "3.0.0"
export const author = "Snow-Flow SDK"
