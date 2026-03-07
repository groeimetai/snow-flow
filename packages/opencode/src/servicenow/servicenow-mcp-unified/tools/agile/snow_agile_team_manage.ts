/**
 * snow_agile_team_manage - Manage scrum teams and members
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_agile_team_manage",
  description:
    "Manage Scrum teams: create teams, add/remove members with roles (Scrum Master, Product Owner, Developer), list team composition.",
  category: "standard",
  subcategory: "agile",
  use_cases: ["agile", "scrum", "team", "management"],
  complexity: "intermediate",
  frequency: "medium",
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "update", "list_members", "add_member", "remove_member"],
        description: "Action to perform",
      },
      sys_id: {
        type: "string",
        description: "Team sys_id (required for update/list_members/add_member/remove_member)",
      },
      name: {
        type: "string",
        description: "Team name (for create/update)",
      },
      description: {
        type: "string",
        description: "Team description",
      },
      velocity: {
        type: "number",
        description: "Default velocity (story points per sprint)",
      },
      member: {
        type: "string",
        description: "User sys_id or username (for add_member/remove_member)",
      },
      role: {
        type: "string",
        enum: ["scrum_master", "product_owner", "developer"],
        description: "Member role (for add_member)",
      },
    },
    required: ["action"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { action, sys_id, name, description, velocity, member, role } = args
  try {
    const client = await getAuthenticatedClient(context)

    if (action === "create") {
      if (!name) return createErrorResult("name is required for create action")
      const body: Record<string, any> = { name }
      if (description) body.description = description
      if (velocity) body.velocity = velocity
      const response = await client.post("/api/now/table/rm_team", body)
      return createSuccessResult({ action: "created", team: response.data.result })
    }

    if (!sys_id) return createErrorResult("sys_id is required for " + action + " action")

    if (action === "update") {
      const body: Record<string, any> = {}
      if (name) body.name = name
      if (description) body.description = description
      if (velocity) body.velocity = velocity
      const response = await client.patch("/api/now/table/rm_team/" + sys_id, body)
      return createSuccessResult({ action: "updated", team: response.data.result })
    }

    if (action === "list_members") {
      const membersResp = await client.get("/api/now/table/rm_team_member", {
        params: {
          sysparm_query: "team=" + sys_id,
          sysparm_fields: "sys_id,user,role,allocation",
          sysparm_display_value: "true",
        },
      })
      const members = membersResp.data.result || []

      // Also get the team details
      const teamResp = await client.get("/api/now/table/rm_team/" + sys_id, {
        params: { sysparm_display_value: "true" },
      })

      return createSuccessResult({
        team: teamResp.data.result,
        members,
        member_count: members.length,
      })
    }

    if (action === "add_member") {
      if (!member) return createErrorResult("member is required for add_member action")

      // Resolve user
      var userId = member
      if (member.indexOf("SYS") !== 0 && member.length !== 32) {
        const userLookup = await client.get("/api/now/table/sys_user", {
          params: {
            sysparm_query: "user_name=" + member + "^ORsys_id=" + member,
            sysparm_limit: 1,
            sysparm_fields: "sys_id,user_name,name",
          },
        })
        const users = userLookup.data.result || []
        if (users.length === 0) return createErrorResult("User not found: " + member)
        userId = users[0].sys_id
      }

      const body: Record<string, any> = { team: sys_id, user: userId }
      if (role) body.role = role
      const response = await client.post("/api/now/table/rm_team_member", body)
      return createSuccessResult({ action: "member_added", member: response.data.result })
    }

    if (action === "remove_member") {
      if (!member) return createErrorResult("member is required for remove_member action")

      // Find the team_member record
      const memberLookup = await client.get("/api/now/table/rm_team_member", {
        params: {
          sysparm_query: "team=" + sys_id + "^user=" + member + "^ORuser.user_name=" + member,
          sysparm_limit: 1,
          sysparm_fields: "sys_id",
        },
      })
      const found = memberLookup.data.result || []
      if (found.length === 0) return createErrorResult("Team member not found")

      await client.delete("/api/now/table/rm_team_member/" + found[0].sys_id)
      return createSuccessResult({ action: "member_removed", member_sys_id: found[0].sys_id })
    }

    return createErrorResult("Unknown action: " + action)
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "1.0.0"
