# Email Notifications Quick Reference

## Common Trigger Conditions

### By Action
```
action_insert: true          # On record creation
action_update: true          # On record modification
event_name: "incident.assigned"  # On specific event
```

### Encoded Query Examples
```
priority=1                           # Priority is 1
assigned_toCHANGES                   # Assigned to changed
assigned_toISNOTEMPTY               # Has assignee
stateCHANGES                        # State changed
stateCHANGESTO6                     # State changed TO Resolved
priorityCHANGESFROM2TO1            # Priority changed FROM 2 TO 1
caller_id.vip=true                  # VIP caller
active=true^priority=1              # Multiple conditions (AND)
```

## Recipient Field Examples

```javascript
// Common recipient field combinations
recipient_fields: ["assigned_to"]                    // Single field
recipient_fields: ["assigned_to", "caller_id"]      // Multiple fields
recipient_fields: ["assignment_group.manager"]       // Dot-walked field
recipient_fields: ["opened_by", "resolved_by"]      // Activity users

// Groups and Users
recipient_groups: ["IT Support", "Network Team"]     // By group name
recipient_users: ["admin", "john.doe"]              // By username
```

## Variable Substitution

### Record Fields
```
${number}                    → INC0012345
${short_description}         → Server down
${priority}                  → 1 - Critical
${state}                     → New
```

### Reference Fields (Dot-Walking)
```
${assigned_to.name}          → John Doe
${assigned_to.email}         → john.doe@company.com
${caller_id.manager.name}    → Jane Smith
${assignment_group.name}     → IT Support
```

### System Variables
```
${URI_REF}                   → Full URL to record
${URI}                       → Relative URL
${instance_name}             → dev12345
${event.parm1}              → Event parameter 1
${event.parm2}              → Event parameter 2
```

## Common Notification Patterns

### 1. Simple Assignment
```javascript
{
  name: "INC - Assigned",
  table: "incident",
  action_update: true,
  condition: "assigned_toCHANGES^assigned_toISNOTEMPTY",
  recipient_fields: ["assigned_to"]
}
```

### 2. State Change to Caller
```javascript
{
  name: "INC - Status Update",
  table: "incident",
  action_update: true,
  condition: "stateCHANGES",
  recipient_fields: ["caller_id"],
  send_self: false
}
```

### 3. High Priority Alert
```javascript
{
  name: "INC - P1 Alert",
  table: "incident",
  action_insert: true,
  condition: "priority=1",
  recipient_groups: ["IT Managers"],
  importance: "high",
  force_delivery: true
}
```

### 4. SLA Warning (Event-Based)
```javascript
{
  name: "INC - SLA Breach",
  table: "incident",
  event_name: "sla.breach",
  recipient_fields: ["assigned_to", "assignment_group.manager"],
  importance: "high"
}
```

## Tool Actions Reference

| Action | Required Fields | Description |
|--------|-----------------|-------------|
| `list` | - | List notifications (optional: table, active_only) |
| `get` | notification_id | Get full notification details |
| `create` | name, table | Create new notification |
| `update` | notification_id | Update existing notification |
| `delete` | notification_id | Delete notification |
| `enable` | notification_id | Activate notification |
| `disable` | notification_id | Deactivate notification |
| `test` | notification_id | Get test instructions |
| `clone` | notification_id, new_name | Clone notification |

## Notification Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Notification name |
| `table` | string | Target table (collection) |
| `active` | boolean | Is notification active |
| `action_insert` | boolean | Trigger on INSERT |
| `action_update` | boolean | Trigger on UPDATE |
| `event_name` | string | Event to trigger on |
| `condition` | string | Encoded query condition |
| `advanced_condition` | string | JavaScript condition (ES5!) |
| `recipient_fields` | array | Fields containing recipients |
| `recipient_groups` | array | Groups to notify |
| `recipient_users` | array | Users to notify |
| `send_self` | boolean | Include triggering user |
| `exclude_delegates` | boolean | Exclude delegates |
| `subject` | string | Email subject |
| `message_html` | string | HTML email body |
| `message_text` | string | Plain text body |
| `template` | string | Email template reference |
| `content_type` | string | text/html or text/plain |
| `from` | string | Custom from address |
| `reply_to` | string | Reply-to address |
| `importance` | string | low, normal, high |
| `type` | string | email, sms, push |
| `weight` | number | Priority weight |
| `order` | number | Execution order |
| `include_attachments` | boolean | Attach files |
| `force_delivery` | boolean | Bypass preferences |
| `mandatory` | boolean | Cannot unsubscribe |
| `digestable` | boolean | Can be digested |
