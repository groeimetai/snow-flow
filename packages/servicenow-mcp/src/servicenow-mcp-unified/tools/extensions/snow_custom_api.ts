/**
 * snow_custom_api
 */

import { type MCPToolDefinition, type ServiceNowContext, type ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"
import { isInstancePath } from "../../shared/instance-path.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_custom_api",
  description: "Make an arbitrary REST call to any ServiceNow endpoint with the chosen method (GET/POST/PUT/PATCH/DELETE), path, query params, and JSON body. Escape hatch for endpoints that don't have a first-class tool yet.",
  // Metadata for tool discovery (not sent to LLM)
  category: "integration",
  subcategory: "api",
  use_cases: ["custom-api", "rest", "integration"],
  complexity: "advanced",
  frequency: "medium",

  // Permission enforcement
  // Classification: READ - Query/analysis operation
  permission: "read",
  allowedRoles: ["developer", "stakeholder", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], default: "GET" },
      path: { type: "string", description: "API path on the instance, starting with / (e.g. /api/now/table/incident). Full URLs are refused." },
      body: { type: "object", description: "Request body" },
      params: { type: "object", description: "Query parameters" },
    },
    required: ["path"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { method = "GET", path, body, params } = args
  if (!isInstancePath(path)) {
    return createErrorResult(
      'path must be a path on the instance starting with a single "/", such as /api/now/table/incident — not a full URL. The request carries the instance credentials, so it is never sent anywhere else.',
    )
  }
  try {
    const client = await getAuthenticatedClient(context)
    // Second lock behind isInstancePath: even an absolute URL is joined onto
    // the instance's baseURL instead of replacing it.
    const config: any = { params, allowAbsoluteUrls: false }

    let response
    if (method === "GET") {
      response = await client.get(path, config)
    } else if (method === "POST") {
      response = await client.post(path, body, config)
    } else if (method === "PUT") {
      response = await client.put(path, body, config)
    } else if (method === "PATCH") {
      response = await client.patch(path, body, config)
    } else if (method === "DELETE") {
      response = await client.delete(path, config)
    }

    return createSuccessResult({
      success: true,
      method,
      path,
      status: response?.status,
      data: response?.data,
    })
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "1.0.0"
export const author = "Serac SDK Migration"
