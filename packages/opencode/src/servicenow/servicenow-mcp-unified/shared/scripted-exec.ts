/**
 * Shared server-side script execution.
 *
 * Runs ES5 JavaScript on ServiceNow via a Scripted REST endpoint that we
 * deploy on first use. Falls back to a sysauto_script job if the endpoint
 * can't be reached. Used by snow_execute_script (user-facing) and by
 * write tools that need to bypass Table-API limitations — notably
 * sys_ui_policy_action, where the ui_policy reference field is silently
 * dropped by the Table API but accepts writes through GlideRecord.
 */

import { randomBytes } from "crypto"
import type { AxiosInstance } from "axios"
import type { ServiceNowContext } from "./types"
import { getAuthenticatedClient } from "./auth"

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

export interface ScriptExecutionResult {
  success: boolean
  result?: unknown
  error?: string
  output?: Array<{ level: string; message: string }>
  executionTimeMs?: number
  method: "sync_rest_api" | "sysauto_script_with_trigger" | "scheduled_job_pending"
  executionId: string
  scheduledJobSysId?: string
  actionRequired?: string
  manualUrl?: string
  fallbackWarning?: string
}

function getEndpointUrl(context: ServiceNowContext): string {
  const cached = endpointCache.get(context.instanceUrl)
  if (cached) return `/api/${cached.namespace}/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`
  return `/api/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`
}

/**
 * Clear the in-memory endpoint cache for a specific instance. Useful when
 * callers suspect the scripted REST endpoint was deleted or renamed on the
 * server — forces the next `ensureEndpoint()` to re-verify and re-deploy.
 */
export function resetEndpointCache(instanceUrl?: string): void {
  if (instanceUrl) endpointCache.delete(instanceUrl)
  else endpointCache.clear()
}

async function pingEndpoint(client: AxiosInstance, url: string): Promise<boolean> {
  const ping = await client
    .post(url, { script: "'pong'", execution_id: "deploy_verify" })
    .catch(() => null)
  return ping?.data?.result?.success === true
}

async function tryPingWithRetries(
  client: AxiosInstance,
  url: string,
  attempts: number,
  delayMs: number,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await pingEndpoint(client, url)) return true
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return false
}

export async function ensureEndpoint(context: ServiceNowContext): Promise<boolean> {
  if (endpointCache.has(context.instanceUrl)) return true

  const client = await getAuthenticatedClient(context)

  // Look up an existing definition first — if it's there, skip creation.
  const check = await client
    .get("/api/now/table/sys_ws_definition", {
      params: {
        sysparm_query: `service_id=${ENDPOINT_SERVICE_ID}`,
        sysparm_fields: "sys_id,namespace,base_uri",
        sysparm_limit: 1,
      },
    })
    .catch(() => null)

  let existing = check?.data?.result?.[0] as { sys_id?: string; namespace?: string } | undefined
  let needsOperationCreate = false

  if (!existing) {
    // Create sys_ws_definition. If the caller lacks web_service_admin /
    // admin rights, this will 403 — catch it and return false so callers
    // can fall through to the scheduler path.
    const svc = await client
      .post("/api/now/table/sys_ws_definition", {
        name: "Snow-Flow Script Executor",
        service_id: ENDPOINT_SERVICE_ID,
        short_description: "Synchronous script execution endpoint for Snow-Flow",
        active: true,
      })
      .catch(() => null)

    const newId = svc?.data?.result?.sys_id
    if (!newId) return false
    existing = { sys_id: String(newId), namespace: svc.data.result.namespace }
    needsOperationCreate = true
  }

  const svcId = existing.sys_id
  if (!svcId) return false

  // Make sure the operation exists for this service definition. If the
  // definition was found but the operation was deleted (or the definition
  // is fresh), create it now.
  if (!needsOperationCreate) {
    const opCheck = await client
      .get("/api/now/table/sys_ws_operation", {
        params: {
          sysparm_query: `web_service_definition=${svcId}^relative_path=${ENDPOINT_PATH}`,
          sysparm_fields: "sys_id",
          sysparm_limit: 1,
        },
      })
      .catch(() => null)
    if (!opCheck?.data?.result?.[0]) needsOperationCreate = true
  }

  if (needsOperationCreate) {
    const opCreate = await client
      .post("/api/now/table/sys_ws_operation", {
        name: "Execute Script",
        web_service_definition: svcId,
        http_method: "POST",
        relative_path: ENDPOINT_PATH,
        operation_script: OPERATION_SCRIPT,
        active: true,
      })
      .catch(() => null)
    if (!opCreate?.data?.result?.sys_id) return false
  }

  // Fetch namespace if we don't have it yet.
  let ns = existing.namespace || ""
  if (!ns) {
    const svcRecord = await client
      .get("/api/now/table/sys_ws_definition/" + svcId, {
        params: { sysparm_fields: "namespace,base_uri" },
      })
      .catch(() => null)
    ns = svcRecord?.data?.result?.namespace || ""
  }

  // Ping with retries — a freshly-created Scripted REST can take a few
  // seconds to become routable.
  const candidates = ns
    ? [`/api/${ns}/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`, `/api/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`]
    : [`/api/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`]

  const pingAttempts = needsOperationCreate ? 5 : 2
  const pingDelay = 1500

  for (const url of candidates) {
    if (await tryPingWithRetries(client, url, pingAttempts, pingDelay)) {
      const parts = url.replace(`/${ENDPOINT_SERVICE_ID}${ENDPOINT_PATH}`, "").replace("/api/", "")
      endpointCache.set(context.instanceUrl, { namespace: parts || ENDPOINT_SERVICE_ID })
      return true
    }
  }

  return false
}

async function executeViaSyncApi(
  client: AxiosInstance,
  context: ServiceNowContext,
  script: string,
  executionId: string,
): Promise<ScriptExecutionResult | null> {
  const response = await client
    .post(getEndpointUrl(context), {
      script,
      execution_id: executionId,
    })
    .catch((err: { response?: { status?: number } }) => {
      if (err.response?.status === 404 || err.response?.status === 403) return null
      throw err
    })

  if (!response) return null

  const data = response.data?.result
  if (!data) return null

  return {
    success: !!data.success,
    result: data.result,
    error: data.error,
    output: data.output,
    executionTimeMs: data.execution_time_ms,
    method: "sync_rest_api",
    executionId,
  }
}

async function executeViaScheduler(
  client: AxiosInstance,
  context: ServiceNowContext,
  script: string,
  executionId: string,
  timeout: number,
  description: string,
): Promise<ScriptExecutionResult> {
  const escape = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")

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
  gs.info('Description: ${escape(description)}');
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

  const jobId = job.data?.result?.sys_id
  if (!jobId) {
    return {
      success: false,
      error: "Failed to create scheduled script job",
      method: "scheduled_job_pending",
      executionId,
    }
  }

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
  const max = Math.ceil(timeout / 2000)
  let result: Record<string, unknown> | null = null

  for (let i = 0; i < max && Date.now() - start < timeout; i++) {
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

    return {
      success: !!result.success,
      result: result.result,
      error: result.error as string | undefined,
      output: result.output as Array<{ level: string; message: string }> | undefined,
      executionTimeMs: result.executionTimeMs as number | undefined,
      method: "sysauto_script_with_trigger",
      executionId,
      fallbackWarning: "Executed via scheduler fallback. The sync REST API endpoint could not be reached.",
    }
  }

  return {
    success: false,
    method: "scheduled_job_pending",
    executionId,
    scheduledJobSysId: jobId,
    actionRequired: `Navigate to System Scheduler > Scheduled Jobs and run: ${name}`,
    manualUrl: `${context.instanceUrl}/sysauto_script.do?sys_id=${jobId}`,
    fallbackWarning: "Both sync REST API and scheduler fallback failed to confirm execution.",
  }
}

/**
 * Execute a server-side ES5 script on ServiceNow.
 *
 * Tries the Scripted REST endpoint first (deploys it on first use). Falls
 * back to a sysauto_script job if the endpoint is unavailable (e.g. caller
 * lacks permission to deploy Scripted REST APIs).
 */
export async function executeServerScript(
  context: ServiceNowContext,
  script: string,
  options: {
    timeout?: number
    executionId?: string
    description?: string
  } = {},
): Promise<ScriptExecutionResult> {
  const executionId = options.executionId || `exec_${Date.now()}_${randomBytes(6).toString("hex")}`
  const timeout = options.timeout ?? 30000
  const description = options.description || "Snow-Flow server-side execution"

  const client = await getAuthenticatedClient(context)

  const sync = await executeViaSyncApi(client, context, script, executionId)
  if (sync) return sync

  const ok = await ensureEndpoint(context).catch(() => false)
  if (ok) {
    const retry = await executeViaSyncApi(client, context, script, executionId)
    if (retry) return retry
  }

  return executeViaScheduler(client, context, script, executionId, timeout, description)
}
