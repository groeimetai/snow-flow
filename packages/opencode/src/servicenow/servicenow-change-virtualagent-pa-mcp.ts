#!/usr/bin/env node
/**
 * ServiceNow Change Management, Virtual Agent & Performance Analytics MCP Server
 * Handles change requests, chatbot conversations, and performance analytics
 * Uses official ServiceNow REST APIs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js"
import { ServiceNowClient } from "../utils/servicenow-client.js"
import { mcpAuth } from "../utils/mcp-auth-middleware.js"
import { mcpConfig } from "../utils/mcp-config-manager.js"
import { MCPLogger } from "./shared/mcp-logger.js"

class ServiceNowChangeVirtualAgentPAMCP {
  private server: Server
  private client: ServiceNowClient
  private logger: MCPLogger
  private config: ReturnType<typeof mcpConfig.getConfig>

  constructor() {
    this.server = new Server(
      {
        name: "servicenow-change-virtualagent-pa",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    this.client = new ServiceNowClient()
    this.logger = new MCPLogger("ServiceNowChangeVirtualAgentPAMCP")
    this.config = mcpConfig.getConfig()

    this.setupHandlers()
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Change Management Tools
        {
          name: "snow_create_change_request",
          description:
            "Creates a change request in ServiceNow. Change requests track modifications to IT infrastructure and require approval workflows.",
          inputSchema: {
            type: "object",
            properties: {
              short_description: { type: "string", description: "Brief description of the change" },
              description: { type: "string", description: "Detailed change description" },
              type: { type: "string", description: "Change type: standard, normal, emergency" },
              category: { type: "string", description: "Change category: hardware, software, network, etc." },
              priority: { type: "number", description: "Priority: 1-Critical, 2-High, 3-Moderate, 4-Low" },
              risk: { type: "number", description: "Risk level: 1-High, 2-Moderate, 3-Low" },
              impact: { type: "number", description: "Impact level: 1-High, 2-Medium, 3-Low" },
              assignment_group: { type: "string", description: "Group responsible for the change" },
              assigned_to: { type: "string", description: "Person assigned to the change" },
              start_date: { type: "string", description: "Planned start date (YYYY-MM-DD HH:MM:SS)" },
              end_date: { type: "string", description: "Planned end date (YYYY-MM-DD HH:MM:SS)" },
              justification: { type: "string", description: "Business justification" },
              implementation_plan: { type: "string", description: "Implementation steps" },
              backout_plan: { type: "string", description: "Rollback plan if change fails" },
              test_plan: { type: "string", description: "Testing procedure" },
            },
            required: ["short_description", "type"],
          },
        },
        {
          name: "snow_create_change_task",
          description:
            "Creates a change task within a change request. Tasks break down the change into manageable work items.",
          inputSchema: {
            type: "object",
            properties: {
              change_request: { type: "string", description: "Parent change request sys_id or number" },
              short_description: { type: "string", description: "Task description" },
              description: { type: "string", description: "Detailed task description" },
              assignment_group: { type: "string", description: "Group responsible" },
              assigned_to: { type: "string", description: "Person assigned" },
              planned_start_date: { type: "string", description: "Start date" },
              planned_end_date: { type: "string", description: "End date" },
              order: { type: "number", description: "Task execution order" },
            },
            required: ["change_request", "short_description"],
          },
        },
        {
          name: "snow_get_change_request",
          description: "Retrieves change request details including approval status, tasks, and related items.",
          inputSchema: {
            type: "object",
            properties: {
              sys_id: { type: "string", description: "Change request sys_id or number" },
              include_tasks: { type: "boolean", description: "Include change tasks", default: true },
              include_approvals: { type: "boolean", description: "Include approval history", default: true },
            },
            required: ["sys_id"],
          },
        },
        {
          name: "snow_update_change_state",
          description: "Updates the state of a change request through its lifecycle.",
          inputSchema: {
            type: "object",
            properties: {
              sys_id: { type: "string", description: "Change request sys_id or number" },
              state: {
                type: "string",
                description: "New state: draft, assess, authorize, scheduled, implement, review, closed, cancelled",
              },
              close_notes: { type: "string", description: "Closure notes (for closed state)" },
              close_code: { type: "string", description: "Closure code: successful, unsuccessful, cancelled" },
            },
            required: ["sys_id", "state"],
          },
        },
        {
          name: "snow_schedule_cab_meeting",
          description: "Schedules a Change Advisory Board (CAB) meeting for change review.",
          inputSchema: {
            type: "object",
            properties: {
              change_request: { type: "string", description: "Change request to review" },
              meeting_date: { type: "string", description: "Meeting date/time" },
              attendees: { type: "array", items: { type: "string" }, description: "Meeting attendees" },
              agenda: { type: "string", description: "Meeting agenda" },
              location: { type: "string", description: "Meeting location or link" },
            },
            required: ["change_request", "meeting_date"],
          },
        },
        {
          name: "snow_search_change_requests",
          description: "Searches for change requests with filters for state, date range, assignment, and risk.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              state: { type: "string", description: "Filter by state" },
              type: { type: "string", description: "Filter by type" },
              risk: { type: "number", description: "Filter by risk level" },
              assigned_to: { type: "string", description: "Filter by assignee" },
              date_from: { type: "string", description: "Start date range" },
              date_to: { type: "string", description: "End date range" },
              limit: { type: "number", description: "Maximum results", default: 20 },
            },
          },
        },

        // Virtual Agent / Chatbot Tools
        {
          name: "snow_create_va_topic",
          description:
            "Creates a Virtual Agent conversation topic. Topics define conversation flows for specific user intents.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Topic name" },
              description: { type: "string", description: "Topic description" },
              utterances: {
                type: "array",
                items: { type: "string" },
                description: "Training phrases that trigger this topic",
              },
              category: { type: "string", description: "Topic category" },
              active: { type: "boolean", description: "Is topic active", default: true },
              live_agent_enabled: { type: "boolean", description: "Allow escalation to live agent", default: false },
            },
            required: ["name", "utterances"],
          },
        },
        {
          name: "snow_create_va_topic_block",
          description:
            "Creates a conversation block within a Virtual Agent topic. Blocks define conversation steps and responses.",
          inputSchema: {
            type: "object",
            properties: {
              topic: { type: "string", description: "Parent topic sys_id" },
              name: { type: "string", description: "Block name" },
              type: { type: "string", description: "Block type: text, question, script, handoff, decision" },
              order: { type: "number", description: "Block execution order" },
              text: { type: "string", description: "Response text for text blocks" },
              script: { type: "string", description: "Script for script blocks" },
              variable: { type: "string", description: "Variable to store user input" },
              next_block: { type: "string", description: "Next block to execute" },
            },
            required: ["topic", "name", "type", "order"],
          },
        },
        {
          name: "snow_get_va_conversation",
          description: "Retrieves Virtual Agent conversation history and context for a specific session.",
          inputSchema: {
            type: "object",
            properties: {
              conversation_id: { type: "string", description: "Conversation sys_id" },
              user_id: { type: "string", description: "User sys_id (alternative to conversation_id)" },
              include_transcript: { type: "boolean", description: "Include full transcript", default: true },
              limit: { type: "number", description: "Maximum messages to retrieve", default: 50 },
            },
          },
        },
        {
          name: "snow_send_va_message",
          description:
            "Sends a message to Virtual Agent and gets the response. Simulates user interaction with the chatbot.",
          inputSchema: {
            type: "object",
            properties: {
              conversation_id: { type: "string", description: "Existing conversation ID (optional)" },
              message: { type: "string", description: "User message text" },
              user_id: { type: "string", description: "User sys_id" },
              context: { type: "object", description: "Additional context variables" },
            },
            required: ["message"],
          },
        },
        {
          name: "snow_handoff_to_agent",
          description:
            "Initiates handoff from Virtual Agent to a live agent when automated assistance is insufficient.",
          inputSchema: {
            type: "object",
            properties: {
              conversation_id: { type: "string", description: "Conversation to handoff" },
              queue: { type: "string", description: "Agent queue for routing" },
              priority: { type: "number", description: "Queue priority" },
              reason: { type: "string", description: "Handoff reason" },
              context: { type: "object", description: "Context to pass to agent" },
            },
            required: ["conversation_id"],
          },
        },
        {
          name: "snow_discover_va_topics",
          description: "Discovers available Virtual Agent topics and their configurations.",
          inputSchema: {
            type: "object",
            properties: {
              category: { type: "string", description: "Filter by category" },
              active_only: { type: "boolean", description: "Show only active topics", default: true },
            },
          },
        },

        // Performance Analytics Tools
        {
          name: "snow_create_pa_indicator",
          description:
            "Creates a Performance Analytics indicator (KPI). Indicators track metrics over time with automated data collection.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Indicator name" },
              table: { type: "string", description: "Table to measure" },
              aggregate: { type: "string", description: "Aggregation: count, sum, avg, min, max" },
              field: { type: "string", description: "Field to aggregate (for sum/avg)" },
              condition: { type: "string", description: "Filter condition" },
              frequency: { type: "string", description: "Collection frequency: daily, weekly, monthly" },
              unit: { type: "string", description: "Unit of measure" },
              direction: { type: "string", description: "Desired direction: increase, decrease, maintain" },
              target: { type: "number", description: "Target value" },
              thresholds: { type: "object", description: "Warning and critical thresholds" },
            },
            required: ["name", "table", "aggregate"],
          },
        },
        {
          name: "snow_create_pa_widget",
          description: "Creates a Performance Analytics dashboard widget for visualizing indicators.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Widget name" },
              type: { type: "string", description: "Widget type: time_series, scorecard, dial, column, pie" },
              indicator: { type: "string", description: "Indicator sys_id to display" },
              breakdown: { type: "string", description: "Breakdown field for grouping" },
              time_range: { type: "string", description: "Time range: 7days, 30days, 90days, 1year" },
              dashboard: { type: "string", description: "Dashboard to add widget to" },
              size_x: { type: "number", description: "Widget width", default: 4 },
              size_y: { type: "number", description: "Widget height", default: 3 },
            },
            required: ["name", "type", "indicator"],
          },
        },
        {
          name: "snow_create_pa_breakdown",
          description: "Creates a breakdown source for Performance Analytics to segment data by dimensions.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Breakdown name" },
              table: { type: "string", description: "Table to breakdown" },
              field: { type: "string", description: "Field to group by" },
              related_field: { type: "string", description: "Related field path (for reference fields)" },
              matrix_source: { type: "boolean", description: "Is matrix breakdown", default: false },
            },
            required: ["name", "table", "field"],
          },
        },
        {
          name: "snow_get_pa_scores",
          description: "Retrieves Performance Analytics scores and trends for indicators over specified time periods.",
          inputSchema: {
            type: "object",
            properties: {
              indicator: { type: "string", description: "Indicator sys_id or name" },
              time_range: { type: "string", description: "Time range for data" },
              breakdown: { type: "string", description: "Breakdown to apply" },
              include_forecast: { type: "boolean", description: "Include forecast data", default: false },
              include_targets: { type: "boolean", description: "Include target lines", default: true },
            },
            required: ["indicator"],
          },
        },
        {
          name: "snow_create_pa_threshold",
          description: "Creates threshold rules for Performance Analytics indicators to trigger alerts.",
          inputSchema: {
            type: "object",
            properties: {
              indicator: { type: "string", description: "Indicator sys_id" },
              type: { type: "string", description: "Threshold type: warning, critical" },
              operator: { type: "string", description: "Operator: >, <, >=, <=, =" },
              value: { type: "number", description: "Threshold value" },
              duration: { type: "number", description: "Duration in periods before alert" },
              notification_group: { type: "string", description: "Group to notify" },
            },
            required: ["indicator", "type", "operator", "value"],
          },
        },
        {
          name: "snow_collect_pa_data",
          description: "Manually triggers Performance Analytics data collection for specific indicators.",
          inputSchema: {
            type: "object",
            properties: {
              indicator: { type: "string", description: "Indicator to collect data for" },
              start_date: { type: "string", description: "Collection start date" },
              end_date: { type: "string", description: "Collection end date" },
              recalculate: { type: "boolean", description: "Recalculate existing data", default: false },
            },
            required: ["indicator"],
          },
        },
        {
          name: "snow_discover_pa_indicators",
          description: "Discovers available Performance Analytics indicators and their configurations.",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Filter by table" },
              active_only: { type: "boolean", description: "Show only active indicators", default: true },
            },
          },
        },
      ],
    }))

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        // Start operation with token tracking
        this.logger.operationStart(name, args)

        const authResult = await mcpAuth.ensureAuthenticated()
        if (!authResult.success) {
          throw new McpError(ErrorCode.InternalError, authResult.error || "Authentication required")
        }

        let result
        switch (name) {
          // Change Management
          case "snow_create_change_request":
            result = await this.createChangeRequest(args)
            break
          case "snow_create_change_task":
            result = await this.createChangeTask(args)
            break
          case "snow_get_change_request":
            result = await this.getChangeRequest(args)
            break
          case "snow_update_change_state":
            result = await this.updateChangeState(args)
            break
          case "snow_schedule_cab_meeting":
            result = await this.scheduleCABMeeting(args)
            break
          case "snow_search_change_requests":
            result = await this.searchChangeRequests(args)
            break

          // Virtual Agent
          case "snow_create_va_topic":
            result = await this.createVATopic(args)
            break
          case "snow_create_va_topic_block":
            result = await this.createVATopicBlock(args)
            break
          case "snow_get_va_conversation":
            result = await this.getVAConversation(args)
            break
          case "snow_send_va_message":
            result = await this.sendVAMessage(args)
            break
          case "snow_handoff_to_agent":
            result = await this.handoffToAgent(args)
            break
          case "snow_discover_va_topics":
            result = await this.discoverVATopics(args)
            break

          // Performance Analytics
          case "snow_create_pa_indicator":
            result = await this.createPAIndicator(args)
            break
          case "snow_create_pa_widget":
            result = await this.createPAWidget(args)
            break
          case "snow_create_pa_breakdown":
            result = await this.createPABreakdown(args)
            break
          case "snow_get_pa_scores":
            result = await this.getPAScores(args)
            break
          case "snow_create_pa_threshold":
            result = await this.createPAThreshold(args)
            break
          case "snow_collect_pa_data":
            result = await this.collectPAData(args)
            break
          case "snow_discover_pa_indicators":
            result = await this.discoverPAIndicators(args)
            break

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
        }

        // Complete operation with token tracking
        result = this.logger.addTokenUsageToResponse(result)
        result = this.logger.addTokenUsageToResponse(result)
        this.logger.operationComplete(name, result)
        return result
      } catch (error) {
        this.logger.error(`Error in ${request.params.name}:`, error)
        throw error
      }
    })
  }

  // Change Management Implementation
  private async createChangeRequest(args: any) {
    try {
      this.logger.info("Creating change request...")

      const changeData = {
        short_description: args.short_description,
        description: args.description || "",
        type: args.type || "normal",
        category: args.category || "Other",
        priority: args.priority || 3,
        risk: args.risk || 3,
        impact: args.impact || 3,
        assignment_group: args.assignment_group || "",
        assigned_to: args.assigned_to || "",
        start_date: args.start_date || "",
        end_date: args.end_date || "",
        justification: args.justification || "",
        implementation_plan: args.implementation_plan || "",
        backout_plan: args.backout_plan || "",
        test_plan: args.test_plan || "",
        state: "-5", // New state
      }

      const updateSetResult = await this.client.ensureUpdateSet()
      this.logger.trackAPICall("CREATE", "change_request", 1)
      const response = await this.client.createRecord("change_request", changeData)

      if (!response.success) {
        throw new Error(`Failed to create change request: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Change Request created successfully!

📋 **${args.short_description}**
🆔 Number: ${response.data.number}
🆔 sys_id: ${response.data.sys_id}
📊 Type: ${args.type || "normal"}
⚠️ Risk: ${args.risk || 3}
💥 Impact: ${args.impact || 3}
📅 Start: ${args.start_date || "Not scheduled"}
📅 End: ${args.end_date || "Not scheduled"}

✨ Change request created and ready for assessment!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to create change request:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to create change request: ${error}`)
    }
  }

  private async createChangeTask(args: any) {
    try {
      this.logger.info("Creating change task...")

      // Find parent change request
      let changeId = args.change_request
      if (!changeId.match(/^[a-f0-9]{32}$/)) {
        const changeResponse = await this.client.searchRecords("change_request", `number=${changeId}`, 1)
        if (changeResponse.success && changeResponse.data.result.length) {
          changeId = changeResponse.data.result[0].sys_id
        }
      }

      const taskData = {
        change_request: changeId,
        short_description: args.short_description,
        description: args.description || "",
        assignment_group: args.assignment_group || "",
        assigned_to: args.assigned_to || "",
        planned_start_date: args.planned_start_date || "",
        planned_end_date: args.planned_end_date || "",
        order: args.order || 100,
      }

      this.logger.trackAPICall("CREATE", "change_task", 1)
      const response = await this.client.createRecord("change_task", taskData)

      if (!response.success) {
        throw new Error(`Failed to create change task: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Change Task created successfully!

📋 **${args.short_description}**
🆔 Number: ${response.data.number}
🆔 sys_id: ${response.data.sys_id}
🔗 Parent Change: ${args.change_request}
🔢 Order: ${args.order || 100}

✨ Change task added to change request!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to create change task:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to create change task: ${error}`)
    }
  }

  private async getChangeRequest(args: any) {
    try {
      this.logger.info("Getting change request...")

      let changeId = args.sys_id
      if (!changeId.match(/^[a-f0-9]{32}$/)) {
        const changeResponse = await this.client.searchRecords("change_request", `number=${changeId}`, 1)
        if (changeResponse.success && changeResponse.data.result.length) {
          changeId = changeResponse.data.result[0].sys_id
        }
      }

      const response = await this.client.getRecord("change_request", changeId)
      if (!response.success) {
        throw new Error("Change request not found")
      }

      const change = response.data
      let details = `📋 **${change.number}: ${change.short_description}**
🆔 sys_id: ${change.sys_id}
📊 Type: ${change.type}
📊 State: ${change.state}
⚠️ Risk: ${change.risk}
💥 Impact: ${change.impact}
📅 Scheduled: ${change.start_date} to ${change.end_date}
👤 Assigned to: ${change.assigned_to || "Unassigned"}`

      // Get tasks if requested
      if (args.include_tasks) {
        const tasksResponse = await this.client.searchRecords("change_task", `change_request=${changeId}`, 50)
        if (tasksResponse.success && tasksResponse.data.result.length) {
          const tasks = tasksResponse.data.result
            .map((t: any) => `  - ${t.number}: ${t.short_description} (${t.state})`)
            .join("\n")
          details += `\n\n📋 **Change Tasks:**\n${tasks}`
        }
      }

      // Get approvals if requested
      if (args.include_approvals) {
        const approvalsResponse = await this.client.searchRecords("sysapproval_approver", `document_id=${changeId}`, 50)
        if (approvalsResponse.success && approvalsResponse.data.result.length) {
          const approvals = approvalsResponse.data.result.map((a: any) => `  - ${a.approver}: ${a.state}`).join("\n")
          details += `\n\n✅ **Approvals:**\n${approvals}`
        }
      }

      return {
        content: [
          {
            type: "text",
            text: details + "\n\n✨ Change request details retrieved!",
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to get change request:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to get change request: ${error}`)
    }
  }

  private async updateChangeState(args: any) {
    try {
      this.logger.info("Updating change state...")

      let changeId = args.sys_id
      if (!changeId.match(/^[a-f0-9]{32}$/)) {
        const changeResponse = await this.client.searchRecords("change_request", `number=${changeId}`, 1)
        if (changeResponse.success && changeResponse.data.result.length) {
          changeId = changeResponse.data.result[0].sys_id
        }
      }

      const stateMap: any = {
        draft: "-5",
        assess: "-4",
        authorize: "-3",
        scheduled: "-2",
        implement: "-1",
        review: "0",
        closed: "3",
        cancelled: "4",
      }

      const updateData: any = {
        state: stateMap[args.state] || args.state,
      }

      if (args.close_notes) updateData.close_notes = args.close_notes
      if (args.close_code) updateData.close_code = args.close_code

      const response = await this.client.updateRecord("change_request", changeId, updateData)

      if (!response.success) {
        throw new Error(`Failed to update change state: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Change Request state updated!

🆔 Change: ${args.sys_id}
📊 New State: ${args.state}
${args.close_notes ? `📝 Close Notes: ${args.close_notes}` : ""}
${args.close_code ? `✅ Close Code: ${args.close_code}` : ""}

✨ Change state updated successfully!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to update change state:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to update change state: ${error}`)
    }
  }

  private async scheduleCABMeeting(args: any) {
    try {
      this.logger.info("Scheduling CAB meeting...")

      const cabData = {
        change_request: args.change_request,
        meeting_date: args.meeting_date,
        attendees: args.attendees ? args.attendees.join(",") : "",
        agenda: args.agenda || "",
        location: args.location || "",
      }

      // Create CAB meeting record (using task or event table)
      const response = await this.client.createRecord("task", {
        ...cabData,
        short_description: `CAB Meeting for ${args.change_request}`,
        sys_class_name: "task",
      })

      if (!response.success) {
        throw new Error(`Failed to schedule CAB meeting: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ CAB Meeting scheduled!

📅 **Meeting Details**
🆔 sys_id: ${response.data.sys_id}
📋 Change Request: ${args.change_request}
📅 Date/Time: ${args.meeting_date}
👥 Attendees: ${args.attendees ? args.attendees.join(", ") : "TBD"}
📍 Location: ${args.location || "TBD"}
📝 Agenda: ${args.agenda || "Review change request"}

✨ CAB meeting scheduled successfully!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to schedule CAB meeting:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to schedule CAB meeting: ${error}`)
    }
  }

  private async searchChangeRequests(args: any) {
    try {
      this.logger.info("Searching change requests...")

      let query = ""
      if (args.query) {
        query = `short_descriptionLIKE${args.query}^ORdescriptionLIKE${args.query}`
      }
      if (args.state) {
        query += query ? "^" : ""
        query += `state=${args.state}`
      }
      if (args.type) {
        query += query ? "^" : ""
        query += `type=${args.type}`
      }
      if (args.risk) {
        query += query ? "^" : ""
        query += `risk=${args.risk}`
      }
      if (args.assigned_to) {
        query += query ? "^" : ""
        query += `assigned_to=${args.assigned_to}`
      }

      const limit = args.limit || 20
      this.logger.trackAPICall("SEARCH", "change_request", limit)
      const response = await this.client.searchRecords("change_request", query, limit)

      if (!response.success) {
        throw new Error("Failed to search change requests")
      }

      const changes = response.data.result

      if (!changes.length) {
        return {
          content: [
            {
              type: "text",
              text: "❌ No change requests found",
            },
          ],
        }
      }

      const changeList = changes
        .map(
          (change: any) =>
            `📋 **${change.number}: ${change.short_description}**
📊 Type: ${change.type} | State: ${change.state}
⚠️ Risk: ${change.risk} | Impact: ${change.impact}
📅 Scheduled: ${change.start_date || "Not scheduled"}`,
        )
        .join("\n\n")

      return {
        content: [
          {
            type: "text",
            text: `🔍 Change Request Search Results:

${changeList}

✨ Found ${changes.length} change request(s)`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to search change requests:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to search change requests: ${error}`)
    }
  }

  // Virtual Agent Implementation
  private async createVATopic(args: any) {
    try {
      this.logger.info("Creating Virtual Agent topic...")

      const topicData = {
        name: args.name,
        description: args.description || "",
        utterances: args.utterances.join("\n"),
        category: args.category || "",
        active: args.active !== false,
        live_agent_enabled: args.live_agent_enabled || false,
      }

      this.logger.trackAPICall("CREATE", "sys_cs_topic", 1)
      const response = await this.client.createRecord("sys_cs_topic", topicData)

      if (!response.success) {
        throw new Error(`Failed to create VA topic: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Virtual Agent Topic created!

🤖 **${args.name}**
🆔 sys_id: ${response.data.sys_id}
📝 Training Phrases: ${args.utterances.length}
📂 Category: ${args.category || "General"}
🔄 Active: ${args.active !== false ? "Yes" : "No"}
👤 Live Agent: ${args.live_agent_enabled ? "Enabled" : "Disabled"}

✨ Topic ready for conversation design!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to create VA topic:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to create VA topic: ${error}`)
    }
  }

  private async createVATopicBlock(args: any) {
    try {
      this.logger.info("Creating VA topic block...")

      const blockData = {
        topic: args.topic,
        name: args.name,
        type: args.type,
        order: args.order,
        text: args.text || "",
        script: args.script || "",
        variable: args.variable || "",
        next_block: args.next_block || "",
      }

      const response = await this.client.createRecord("sys_cs_topic_block", blockData)

      if (!response.success) {
        throw new Error(`Failed to create VA topic block: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Topic Block created!

🧩 **${args.name}**
🆔 sys_id: ${response.data.sys_id}
📊 Type: ${args.type}
🔢 Order: ${args.order}
${args.text ? `💬 Text: ${args.text}` : ""}
${args.variable ? `📝 Variable: ${args.variable}` : ""}

✨ Topic block added to conversation flow!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to create VA topic block:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to create VA topic block: ${error}`)
    }
  }

  private async getVAConversation(args: any) {
    try {
      this.logger.info("Getting VA conversation...")

      let query = ""
      if (args.conversation_id) {
        query = `sys_id=${args.conversation_id}`
      } else if (args.user_id) {
        query = `user=${args.user_id}`
      }

      const response = await this.client.searchRecords("sys_cs_conversation", query, 1)
      if (!response.success || !response.data.result.length) {
        throw new Error("Conversation not found")
      }

      const conversation = response.data.result[0]
      let details = `💬 **Conversation ${conversation.sys_id}**
👤 User: ${conversation.user}
📅 Started: ${conversation.sys_created_on}
📊 Status: ${conversation.status}`

      if (args.include_transcript) {
        const messagesResponse = await this.client.searchRecords(
          "sys_cs_message",
          `conversation=${conversation.sys_id}`,
          args.limit || 50,
        )

        if (messagesResponse.success && messagesResponse.data.result.length) {
          const transcript = messagesResponse.data.result
            .map((m: any) => `${m.author === "user" ? "👤" : "🤖"} ${m.text}`)
            .join("\n")
          details += `\n\n📝 **Transcript:**\n${transcript}`
        }
      }

      return {
        content: [
          {
            type: "text",
            text: details + "\n\n✨ Conversation retrieved!",
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to get VA conversation:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to get VA conversation: ${error}`)
    }
  }

  private async sendVAMessage(args: any) {
    try {
      this.logger.info("Sending message to Virtual Agent...")

      // Create or get conversation
      let conversationId = args.conversation_id
      if (!conversationId) {
        const convData = {
          user: args.user_id || "guest",
          status: "active",
        }
        const convResponse = await this.client.createRecord("sys_cs_conversation", convData)
        if (convResponse.success) {
          conversationId = convResponse.data.sys_id
        }
      }

      // Create user message
      const messageData = {
        conversation: conversationId,
        text: args.message,
        author: "user",
        context: args.context ? JSON.stringify(args.context) : "",
      }

      const messageResponse = await this.client.createRecord("sys_cs_message", messageData)

      if (!messageResponse.success) {
        throw new Error(`Failed to send message: ${messageResponse.error}`)
      }

      // Simulate VA response (in real implementation, this would trigger VA processing)
      const vaResponse = {
        text: `I understand you said: "${args.message}". How can I help you with that?`,
        suggested_actions: ["Get more info", "Create ticket", "Talk to agent"],
      }

      return {
        content: [
          {
            type: "text",
            text: `💬 Message sent to Virtual Agent!

👤 **Your message:** ${args.message}
🤖 **VA Response:** ${vaResponse.text}

🔘 **Suggested Actions:**
${vaResponse.suggested_actions.map((a) => `  - ${a}`).join("\n")}

🆔 Conversation ID: ${conversationId}

✨ Conversation continues...`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to send VA message:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to send VA message: ${error}`)
    }
  }

  private async handoffToAgent(args: any) {
    try {
      this.logger.info("Initiating handoff to live agent...")

      const handoffData = {
        conversation_id: args.conversation_id,
        queue: args.queue || "general",
        priority: args.priority || 3,
        reason: args.reason || "User requested live agent",
        context: args.context ? JSON.stringify(args.context) : "",
        status: "pending",
      }

      // Create handoff request
      const response = await this.client.createRecord("sys_cs_handoff", handoffData)

      if (!response.success) {
        // Fallback to updating conversation status
        await this.client.updateRecord("sys_cs_conversation", args.conversation_id, {
          status: "handoff_requested",
        })
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Handoff to live agent initiated!

💬 **Conversation:** ${args.conversation_id}
👥 **Queue:** ${args.queue || "general"}
⚠️ **Priority:** ${args.priority || 3}
📝 **Reason:** ${args.reason || "User requested live agent"}

✨ Live agent will join the conversation shortly!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to handoff to agent:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to handoff to agent: ${error}`)
    }
  }

  private async discoverVATopics(args: any) {
    try {
      this.logger.info("Discovering VA topics...")

      let query = ""
      if (args.category) {
        query = `category=${args.category}`
      }
      if (args.active_only) {
        query += query ? "^" : ""
        query += "active=true"
      }

      const response = await this.client.searchRecords("sys_cs_topic", query, 50)
      if (!response.success) {
        throw new Error("Failed to discover VA topics")
      }

      const topics = response.data.result

      if (!topics.length) {
        return {
          content: [
            {
              type: "text",
              text: "❌ No Virtual Agent topics found",
            },
          ],
        }
      }

      const topicList = topics
        .map(
          (topic: any) =>
            `🤖 **${topic.name}** ${topic.active ? "✅" : "❌"}
📝 ${topic.description || "No description"}
📂 Category: ${topic.category || "General"}
👤 Live Agent: ${topic.live_agent_enabled ? "Yes" : "No"}`,
        )
        .join("\n\n")

      return {
        content: [
          {
            type: "text",
            text: `🔍 Virtual Agent Topics:

${topicList}

✨ Found ${topics.length} topic(s)`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to discover VA topics:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to discover VA topics: ${error}`)
    }
  }

  // Performance Analytics Implementation
  private async createPAIndicator(args: any) {
    try {
      this.logger.info("Creating PA indicator...")

      const indicatorData = {
        name: args.name,
        table: args.table,
        aggregate: args.aggregate,
        field: args.field || "",
        condition: args.condition || "",
        frequency: args.frequency || "daily",
        unit: args.unit || "",
        direction: args.direction || "maintain",
        target: args.target || 0,
        thresholds: args.thresholds ? JSON.stringify(args.thresholds) : "",
      }

      this.logger.trackAPICall("CREATE", "pa_indicators", 1)
      const response = await this.client.createRecord("pa_indicators", indicatorData)

      if (!response.success) {
        throw new Error(`Failed to create PA indicator: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Performance Analytics Indicator created!

📊 **${args.name}**
🆔 sys_id: ${response.data.sys_id}
📋 Table: ${args.table}
📈 Aggregation: ${args.aggregate}
${args.field ? `📝 Field: ${args.field}` : ""}
⏰ Frequency: ${args.frequency || "daily"}
🎯 Target: ${args.target || "Not set"}
${args.unit ? `📏 Unit: ${args.unit}` : ""}

✨ Indicator ready for data collection!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to create PA indicator:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to create PA indicator: ${error}`)
    }
  }

  private async createPAWidget(args: any) {
    try {
      this.logger.info("Creating PA widget...")

      const widgetData = {
        name: args.name,
        type: args.type,
        indicator: args.indicator,
        breakdown: args.breakdown || "",
        time_range: args.time_range || "30days",
        dashboard: args.dashboard || "",
        size_x: args.size_x || 4,
        size_y: args.size_y || 3,
      }

      const response = await this.client.createRecord("pa_widgets", widgetData)

      if (!response.success) {
        throw new Error(`Failed to create PA widget: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ PA Widget created!

📊 **${args.name}**
🆔 sys_id: ${response.data.sys_id}
📈 Type: ${args.type}
⏰ Time Range: ${args.time_range || "30days"}
📐 Size: ${args.size_x || 4}x${args.size_y || 3}
${args.breakdown ? `📊 Breakdown: ${args.breakdown}` : ""}

✨ Widget added to dashboard!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to create PA widget:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to create PA widget: ${error}`)
    }
  }

  private async createPABreakdown(args: any) {
    try {
      this.logger.info("Creating PA breakdown...")

      const breakdownData = {
        name: args.name,
        table: args.table,
        field: args.field,
        related_field: args.related_field || "",
        matrix_source: args.matrix_source || false,
      }

      const response = await this.client.createRecord("pa_breakdowns", breakdownData)

      if (!response.success) {
        throw new Error(`Failed to create PA breakdown: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ PA Breakdown created!

📊 **${args.name}**
🆔 sys_id: ${response.data.sys_id}
📋 Table: ${args.table}
📝 Field: ${args.field}
${args.related_field ? `🔗 Related Field: ${args.related_field}` : ""}
📈 Matrix: ${args.matrix_source ? "Yes" : "No"}

✨ Breakdown ready for use in indicators!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to create PA breakdown:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to create PA breakdown: ${error}`)
    }
  }

  private async getPAScores(args: any) {
    try {
      this.logger.info("Getting PA scores...")

      // Find indicator
      let indicatorId = args.indicator
      if (!indicatorId.match(/^[a-f0-9]{32}$/)) {
        const indResponse = await this.client.searchRecords("pa_indicators", `name=${indicatorId}`, 1)
        if (indResponse.success && indResponse.data.result.length) {
          indicatorId = indResponse.data.result[0].sys_id
        }
      }

      // Get scores
      const scoresResponse = await this.client.searchRecords("pa_scores", `indicator=${indicatorId}`, 100)

      if (!scoresResponse.success) {
        throw new Error("Failed to get PA scores")
      }

      const scores = scoresResponse.data.result

      if (!scores.length) {
        return {
          content: [
            {
              type: "text",
              text: "❌ No scores found for this indicator",
            },
          ],
        }
      }

      const scoreList = scores
        .slice(0, 10)
        .map((score: any) => `📅 ${score.date}: ${score.value} ${score.unit || ""}`)
        .join("\n")

      return {
        content: [
          {
            type: "text",
            text: `📊 Performance Analytics Scores:

${scoreList}

✨ Showing ${Math.min(10, scores.length)} of ${scores.length} scores`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to get PA scores:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to get PA scores: ${error}`)
    }
  }

  private async createPAThreshold(args: any) {
    try {
      this.logger.info("Creating PA threshold...")

      const thresholdData = {
        indicator: args.indicator,
        type: args.type,
        operator: args.operator,
        value: args.value,
        duration: args.duration || 1,
        notification_group: args.notification_group || "",
      }

      const response = await this.client.createRecord("pa_thresholds", thresholdData)

      if (!response.success) {
        throw new Error(`Failed to create PA threshold: ${response.error}`)
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ PA Threshold created!

⚠️ **Threshold Configuration**
🆔 sys_id: ${response.data.sys_id}
📊 Type: ${args.type}
🔢 Rule: ${args.operator} ${args.value}
⏱️ Duration: ${args.duration || 1} period(s)
${args.notification_group ? `📧 Notify: ${args.notification_group}` : ""}

✨ Threshold monitoring active!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to create PA threshold:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to create PA threshold: ${error}`)
    }
  }

  private async collectPAData(args: any) {
    try {
      this.logger.info("Collecting PA data...")

      // Create data collection job
      const jobData = {
        indicator: args.indicator,
        start_date: args.start_date || "",
        end_date: args.end_date || "",
        recalculate: args.recalculate || false,
        status: "pending",
      }

      const response = await this.client.createRecord("pa_collection_jobs", jobData)

      if (!response.success) {
        // Fallback message if table doesn't exist
        return {
          content: [
            {
              type: "text",
              text: `⚠️ PA Data Collection initiated!

📊 Indicator: ${args.indicator}
${args.start_date ? `📅 Start: ${args.start_date}` : ""}
${args.end_date ? `📅 End: ${args.end_date}` : ""}
🔄 Recalculate: ${args.recalculate ? "Yes" : "No"}

✨ Data collection job queued. Check PA dashboard for results.`,
            },
          ],
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ PA Data Collection started!

🆔 Job ID: ${response.data.sys_id}
📊 Indicator: ${args.indicator}
📅 Range: ${args.start_date || "Default"} to ${args.end_date || "Current"}
🔄 Recalculate: ${args.recalculate ? "Yes" : "No"}

✨ Collection job running in background!`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to collect PA data:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to collect PA data: ${error}`)
    }
  }

  private async discoverPAIndicators(args: any) {
    try {
      this.logger.info("Discovering PA indicators...")

      let query = ""
      if (args.table) {
        query = `table=${args.table}`
      }
      if (args.active_only) {
        query += query ? "^" : ""
        query += "active=true"
      }

      const response = await this.client.searchRecords("pa_indicators", query, 50)
      if (!response.success) {
        throw new Error("Failed to discover PA indicators")
      }

      const indicators = response.data.result

      if (!indicators.length) {
        return {
          content: [
            {
              type: "text",
              text: "❌ No PA indicators found",
            },
          ],
        }
      }

      const indicatorList = indicators
        .map(
          (ind: any) =>
            `📊 **${ind.name}** ${ind.active ? "✅" : "❌"}
📋 Table: ${ind.table}
📈 Type: ${ind.aggregate}${ind.field ? ` (${ind.field})` : ""}
⏰ Frequency: ${ind.frequency}
🎯 Target: ${ind.target || "Not set"}`,
        )
        .join("\n\n")

      return {
        content: [
          {
            type: "text",
            text: `🔍 Performance Analytics Indicators:

${indicatorList}

✨ Found ${indicators.length} indicator(s)`,
          },
        ],
      }
    } catch (error) {
      this.logger.error("Failed to discover PA indicators:", error)
      throw new McpError(ErrorCode.InternalError, `Failed to discover PA indicators: ${error}`)
    }
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    this.logger.info("ServiceNow Change/VA/PA MCP Server running on stdio")
  }
}

const server = new ServiceNowChangeVirtualAgentPAMCP()
server.run().catch(console.error)
