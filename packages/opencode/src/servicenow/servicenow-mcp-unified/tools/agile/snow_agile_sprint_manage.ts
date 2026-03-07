/**
 * snow_agile_sprint_manage - Create, start, and close sprints
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_agile_sprint_manage",
  description:
    "Manage Agile sprints: create new sprints, start/close sprints, update sprint details. Works with ServiceNow Agile 2.0 (rm_sprint table).",
  category: "standard",
  subcategory: "agile",
  use_cases: ["agile", "scrum", "sprint", "planning"],
  complexity: "intermediate",
  frequency: "high",
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "start", "close", "update"],
        description: "Action to perform on the sprint",
      },
      sys_id: {
        type: "string",
        description: "Sprint sys_id (required for start/close/update)",
      },
      name: {
        type: "string",
        description: "Sprint name (for create)",
      },
      start_date: {
        type: "string",
        description: "Sprint start date (YYYY-MM-DD)",
      },
      end_date: {
        type: "string",
        description: "Sprint end date (YYYY-MM-DD)",
      },
      team: {
        type: "string",
        description: "Scrum team name or sys_id",
      },
      story_points: {
        type: "number",
        description: "Sprint story point capacity",
      },
      goal: {
        type: "string",
        description: "Sprint goal description",
      },
    },
    required: ["action"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { action, sys_id, name, start_date, end_date, team, story_points, goal } = args
  try {
    const client = await getAuthenticatedClient(context)

    if (action === "create") {
      if (!name) return createErrorResult("name is required for create action")
      const body: Record<string, any> = { short_description: name }
      if (start_date) body.start_date = start_date
      if (end_date) body.end_date = end_date
      if (story_points) body.story_points = story_points
      if (goal) body.goal = goal

      if (team) {
        const teamResp = await client.get("/api/now/table/rm_team", {
          params: { sysparm_query: "name=" + team + "^ORsys_id=" + team, sysparm_limit: 1, sysparm_fields: "sys_id" },
        })
        const teams = teamResp.data.result || []
        if (teams.length > 0) body.group = teams[0].sys_id
      }

      const response = await client.post("/api/now/table/rm_sprint", body)
      return createSuccessResult({
        action: "created",
        sprint: response.data.result,
      })
    }

    if (!sys_id) return createErrorResult("sys_id is required for " + action + " action")

    if (action === "start") {
      const response = await client.patch("/api/now/table/rm_sprint/" + sys_id, { state: "2" })
      return createSuccessResult({ action: "started", sprint: response.data.result })
    }

    if (action === "close") {
      const response = await client.patch("/api/now/table/rm_sprint/" + sys_id, { state: "3" })
      return createSuccessResult({ action: "closed", sprint: response.data.result })
    }

    if (action === "update") {
      const updates: Record<string, any> = {}
      if (name) updates.short_description = name
      if (start_date) updates.start_date = start_date
      if (end_date) updates.end_date = end_date
      if (story_points) updates.story_points = story_points
      if (goal) updates.goal = goal
      const response = await client.patch("/api/now/table/rm_sprint/" + sys_id, updates)
      return createSuccessResult({ action: "updated", sprint: response.data.result })
    }

    return createErrorResult("Unknown action: " + action)
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "1.0.0"
