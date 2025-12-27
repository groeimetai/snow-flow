# Automation

Script execution, scheduled jobs, and event management

**Total Tools:** 57 | **Read:** 24 | **Write:** 33

---

## snow_add_schedule_entry

Add entry to schedule

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_add_schedule_entry
const result = await snow_add_schedule_entry({
});
```

---

## snow_callback_handler

Create callback handler for async operations

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_callback_handler
const result = await snow_callback_handler({
});
```

---

## snow_collect_metric

Collect metric data

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_collect_metric
const result = await snow_collect_metric({
});
```

---

## snow_confirm_script_execution

⚡ Confirms and schedules script after user approval (use after snow_schedule_script_job with requireConfirmation=true). Note: Uses same scheduled job approach.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_confirm_script_execution
const result = await snow_confirm_script_execution({
});
```

---

## snow_create_alert

Create system alert for monitoring

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_alert
const result = await snow_create_alert({
});
```

---

## snow_create_alert_rule

Create alert rules for automated monitoring and notifications

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_alert_rule
const result = await snow_create_alert_rule({
});
```

---

## snow_create_email_template

Create email notification template

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_email_template
const result = await snow_create_email_template({
});
```

---

## snow_create_escalation_rule

Creates escalation rules for time-based actions. Defines escalation timing, conditions, and automated responses.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_escalation_rule
const result = await snow_create_escalation_rule({
});
```

---

## snow_create_event

Create system event for event management

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_event
const result = await snow_create_event({
});
```

---

## snow_create_event_rule

Creates event-driven automation rules. Triggers scripts based on system events with conditional logic.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_event_rule
const result = await snow_create_event_rule({
});
```

---

## snow_create_notification

Create automated notification

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_notification
const result = await snow_create_notification({
});
```

---

## snow_create_notification_template

Create reusable notification template with multi-channel support

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_notification_template
const result = await snow_create_notification_template({
});
```

---

## snow_create_schedule

Create work schedule

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_schedule
const result = await snow_create_schedule({
});
```

---

## snow_create_sla_definition

Creates Service Level Agreement definitions. Sets duration targets, business schedules, and breach conditions.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_sla_definition
const result = await snow_create_sla_definition({
});
```

---

## snow_create_va_topic

Create Virtual Agent conversation topic

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_va_topic
const result = await snow_create_va_topic({
});
```

---

## snow_create_va_topic_block

Creates a conversation block within a Virtual Agent topic. Blocks define conversation steps and responses.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_va_topic_block
const result = await snow_create_va_topic_block({
});
```

---

## snow_create_workflow

⚠️ LEGACY: Create workflow definition (deprecated - ServiceNow recommends Flow Designer). Use for backwards compatibility only. For new automations, consider Flow Designer and ask Snow-Flow to generate a specification document.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_workflow
const result = await snow_create_workflow({
});
```

---

## snow_create_workflow_activity

⚠️ LEGACY: Create workflow activity (deprecated - ServiceNow recommends Flow Designer). Configures activity types, conditions, and execution order.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_workflow_activity
const result = await snow_create_workflow_activity({
});
```

---

## snow_create_workflow_activity

⚠️ LEGACY: Create workflow activity/stage (deprecated - ServiceNow recommends Flow Designer)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_workflow_activity
const result = await snow_create_workflow_activity({
});
```

---

## snow_discover_automation_jobs

Discovers automation jobs (scheduled scripts, executions) in the instance.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_automation_jobs
const result = await snow_discover_automation_jobs({
});
```

---

## snow_discover_events

Discovers system events registered in the instance.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_events
const result = await snow_discover_events({
});
```

---

## snow_discover_schedules

Discovers schedules (business hours, maintenance windows) in the instance.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_schedules
const result = await snow_discover_schedules({
});
```

---

## snow_email_notification_manage

Manage email notifications: list, get, create, update, delete, enable/disable

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_email_notification_manage
const result = await snow_email_notification_manage({
});
```

---

## snow_emergency_broadcast

Send emergency broadcast notification to all users or specific groups

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_emergency_broadcast
const result = await snow_emergency_broadcast({
});
```

---

## snow_event_handler

Create event handler

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_event_handler
const result = await snow_event_handler({
});
```

---

## snow_get_email_logs

Retrieve sent/received email logs from sys_email table for monitoring and debugging

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_email_logs
const result = await snow_get_email_logs({
});
```

---

## snow_get_event_queue

Get event queue status and pending events

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_event_queue
const result = await snow_get_event_queue({
});
```

---

## snow_get_flow_execution_logs

Retrieve Flow Designer execution logs for monitoring flow runs, debugging failures, and analyzing performance

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_flow_execution_logs
const result = await snow_get_flow_execution_logs({
});
```

---

## snow_get_inbound_http_logs

Retrieve inbound REST API transaction logs for monitoring API usage and debugging incoming requests

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_inbound_http_logs
const result = await snow_get_inbound_http_logs({
});
```

---

## snow_get_logs

Retrieve ServiceNow system logs with filtering by level, source, and time range

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_logs
const result = await snow_get_logs({
});
```

---

## snow_get_outbound_http_logs

Retrieve outbound HTTP request logs for monitoring REST/SOAP integrations and external API calls

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_outbound_http_logs
const result = await snow_get_outbound_http_logs({
});
```

---

## snow_get_scheduled_job_logs

Retrieve scheduled job execution history and logs for monitoring automation, identifying failures, and tracking performance

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_scheduled_job_logs
const result = await snow_get_scheduled_job_logs({
});
```

---

## snow_get_script_output

Retrieve output from previously executed script using execution ID

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_script_output
const result = await snow_get_script_output({
});
```

---

## snow_get_slow_queries

Retrieve slow database query logs for identifying performance issues, optimizing GlideRecord queries, and improving system responsiveness

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_slow_queries
const result = await snow_get_slow_queries({
});
```

---

## snow_get_va_conversation

Retrieves Virtual Agent conversation history and context for a specific session.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_va_conversation
const result = await snow_get_va_conversation({
});
```

---

## snow_handoff_to_agent

Initiates handoff from Virtual Agent to a live agent when automated assistance is insufficient.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_handoff_to_agent
const result = await snow_handoff_to_agent({
});
```

---

## snow_inbound_email_action

Manage inbound email actions: list, get, create, update, delete, enable/disable

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_inbound_email_action
const result = await snow_inbound_email_action({
});
```

---

## snow_monitor_metrics

Monitor system metrics and performance indicators

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_monitor_metrics
const result = await snow_monitor_metrics({
});
```

---

## snow_notification_analytics

Analyze notification delivery rates, engagement, and effectiveness

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_notification_analytics
const result = await snow_notification_analytics({
});
```

---

## snow_notification_preferences

Manage user notification preferences and routing rules

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_notification_preferences
const result = await snow_notification_preferences({
});
```

---

## snow_property_manager

Enhanced property management with get, set, and validation in one tool

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_property_manager
const result = await snow_property_manager({
});
```

---

## snow_rest_message_test_suite

Comprehensive testing suite for REST messages including authentication, endpoints, headers, and response validation.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_rest_message_test_suite
const result = await snow_rest_message_test_suite({
});
```

---

## snow_schedule_job

Create scheduled job with cron expression or repeat interval

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_schedule_job
const result = await snow_schedule_job({
});
```

---

## snow_schedule_notification

Schedule future notification delivery with advanced scheduling options

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_schedule_notification
const result = await snow_schedule_notification({
});
```

---

## snow_schedule_script_job

⚠️ SCHEDULES (not executes directly) server-side JavaScript via Scheduled Script Job. Creates sysauto_script + sys_trigger. Returns executed=false if scheduler doesn\

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_schedule_script_job
const result = await snow_schedule_script_job({
});
```

---

## snow_scheduled_job_manage

Manage scheduled jobs: list, get details, create, update, delete, enable/disable, run now, get history

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_scheduled_job_manage
const result = await snow_scheduled_job_manage({
});
```

---

## snow_send_email

Send email notification via sys_email table (supports username, email, or sys_id)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_send_email
const result = await snow_send_email({
});
```

---

## snow_send_notification

Send email/SMS notification

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_send_notification
const result = await snow_send_notification({
});
```

---

## snow_send_push

Send mobile push notification

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_send_push
const result = await snow_send_push({
});
```

---

## snow_send_push_notification

Sends a push notification to mobile devices. Can target specific users, groups, or all users.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_send_push_notification
const result = await snow_send_push_notification({
});
```

---

## snow_send_va_message

Sends a message to Virtual Agent and gets the response. Simulates user interaction with the chatbot.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_send_va_message
const result = await snow_send_va_message({
});
```

---

## snow_start_workflow

⚠️ LEGACY: Start a workflow on a record (deprecated - ServiceNow recommends Flow Designer). Workflows run asynchronously.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_start_workflow
const result = await snow_start_workflow({
});
```

---

## snow_trace_execution

Set up execution tracing configuration. Creates a trace session that scripts can write to. Use snow_get_script_output to retrieve trace data later.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_trace_execution
const result = await snow_trace_execution({
});
```

---

## snow_train_va_nlu

Train Virtual Agent NLU model

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_train_va_nlu
const result = await snow_train_va_nlu({
});
```

---

## snow_trigger_scheduled_job

⚠️ TRIGGERS (not executes directly) an existing scheduled job via sys_trigger. Job runs asynchronously when scheduler picks it up.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_trigger_scheduled_job
const result = await snow_trigger_scheduled_job({
});
```

---

## snow_workflow_manage

⚠️ LEGACY: Manage legacy workflows (deprecated - ServiceNow recommends Flow Designer). Use for backwards compatibility only. For new automations, consider Flow Designer (not programmable via Snow-Flow, but specs can be generated). Actions: list, get, stop, retry, clone, enable/disable

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_workflow_manage
const result = await snow_workflow_manage({
});
```

---

## snow_workflow_transition

⚠️ LEGACY: Manage workflow transitions (deprecated - ServiceNow recommends Flow Designer). Actions: create, update, delete, list

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_workflow_transition
const result = await snow_workflow_transition({
});
```

---

