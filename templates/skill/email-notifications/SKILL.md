---
name: "email-notifications"
description: "Comprehensive guide for ServiceNow email notifications (sysevent_email_action), email templates, and inbound email actions. Use when creating, managing, or troubleshooting email notifications, configuring notification triggers, setting up recipients, or working with email templates."
license: "MIT"
compatibility: "Snow-Flow 3.4+, ServiceNow Quebec+"
triggers:
  - "email notification"
  - "notification"
  - "sysevent_email_action"
  - "email template"
  - "send email"
  - "notify"
  - "alert"
  - "inbound email"
  - "recipient"
  - "mail"
  - "digest"
  - "subscription"
priority: 85
metadata:
  author: "Snow-Flow Team"
  version: "1.0.0"
  category: "notifications"
  servicenow_tables:
    - "sysevent_email_action"
    - "sysevent_email_template"
    - "sys_email"
    - "cmn_notif_message"
    - "cmn_notif_device"
allowed-tools: "snow_email_notification_manage snow_create_email_template snow_send_email snow_inbound_email_action snow_query_table"
---

# Email Notifications Skill

This skill provides comprehensive guidance for managing ServiceNow email notifications, templates, and inbound email actions.

---

## 1. Email Notification Fundamentals

### Understanding sysevent_email_action

Email notifications in ServiceNow are stored in the `sysevent_email_action` table. They define:
- **WHEN** to send (triggers, conditions)
- **WHO** receives it (recipients)
- **WHAT** to send (content, template)
- **HOW** to send it (type, options)

### Notification Types

| Type | Description | Use Case |
|------|-------------|----------|
| `email` | Standard email notification | Most common, formal communications |
| `sms` | SMS text message | Urgent alerts, on-call notifications |
| `push` | Mobile push notification | Real-time alerts for mobile users |

---

## 2. Creating Email Notifications

### Using the MCP Tool

```javascript
// Create a notification that triggers on incident assignment
await snow_email_notification_manage({
  action: "create",
  name: "INC - Incident Assigned (Assignee)",
  table: "incident",

  // Trigger conditions
  action_update: true,  // Trigger on UPDATE
  condition: "assigned_toCHANGES^assigned_toISNOTEMPTY",

  // Recipients
  recipient_fields: ["assigned_to"],

  // Email content
  subject: "Incident ${number} has been assigned to you",
  message_html: `
    <p>Hello ${assigned_to.name},</p>
    <p>Incident <b>${number}</b> has been assigned to you.</p>
    <p><b>Short Description:</b> ${short_description}</p>
    <p><b>Priority:</b> ${priority}</p>
    <p><a href="${URI_REF}">View Incident</a></p>
  `,
  content_type: "text/html",

  // Settings
  active: true
});
```

### Trigger Options

| Trigger | Field | Description |
|---------|-------|-------------|
| **On Insert** | `action_insert: true` | When record is created |
| **On Update** | `action_update: true` | When record is modified |
| **On Event** | `event_name: "incident.assigned"` | When specific event fires |
| **Condition** | `condition: "priority=1"` | Encoded query filter |
| **Advanced** | `advanced_condition: "script"` | JavaScript condition (ES5!) |

### Recipient Options

| Recipient Type | Field | Example |
|----------------|-------|---------|
| **Field Reference** | `recipient_fields` | `["assigned_to", "caller_id"]` |
| **Groups** | `recipient_groups` | `["IT Support", "Network Team"]` |
| **Users** | `recipient_users` | `["admin", "john.doe"]` |
| **Event Parameter** | `event_parm_1: true` | Uses event.parm1 as recipient |
| **Send to Self** | `send_self: true` | Include user who triggered |

---

## 3. Email Templates

### When to Use Templates

- **Reusability**: Same content across multiple notifications
- **Consistency**: Standardized branding and layout
- **Maintenance**: Update once, applies everywhere
- **Complex HTML**: Professional email designs

### Creating Email Templates

```javascript
// Create a reusable email template
await snow_create_email_template({
  name: "Incident Assignment Template",
  subject: "Incident ${number} - ${short_description}",
  message_html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .header { background: #0073e6; color: white; padding: 20px; }
        .content { padding: 20px; }
        .footer { background: #f5f5f5; padding: 10px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>IT Service Desk</h1>
      </div>
      <div class="content">
        <p>Hello ${assigned_to.name},</p>
        <p>The following incident has been assigned to you:</p>
        <table>
          <tr><td><b>Number:</b></td><td>${number}</td></tr>
          <tr><td><b>Description:</b></td><td>${short_description}</td></tr>
          <tr><td><b>Priority:</b></td><td>${priority}</td></tr>
          <tr><td><b>Category:</b></td><td>${category}</td></tr>
        </table>
        <p><a href="${URI_REF}">View Incident</a></p>
      </div>
      <div class="footer">
        <p>This is an automated message from ServiceNow.</p>
      </div>
    </body>
    </html>
  `,
  table: "incident"
});
```

### Linking Template to Notification

```javascript
// Create notification that uses the template
await snow_email_notification_manage({
  action: "create",
  name: "INC - Assignment (Template)",
  table: "incident",
  action_update: true,
  condition: "assigned_toCHANGES",
  recipient_fields: ["assigned_to"],
  template: "Incident Assignment Template",  // Reference by name
  active: true
});
```

---

## 4. Variable Substitution

### Standard Variables

Variables are substituted using `${field_name}` syntax:

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `${number}` | Record number | INC0012345 |
| `${short_description}` | Short description | Server down |
| `${assigned_to}` | sys_id | abc123... |
| `${assigned_to.name}` | Display value | John Doe |
| `${URI_REF}` | Record URL | https://instance.service-now.com/incident.do?... |
| `${URI}` | Relative URL | incident.do?sys_id=... |
| `${instance_name}` | Instance name | dev12345 |

### Reference Field Dot-Walking

Access related record fields:
```
${caller_id.email}           → Caller's email
${assigned_to.manager.name}  → Assignee's manager name
${assignment_group.manager}  → Group manager
```

### Date Formatting

```
${sys_created_on}                    → 2026-01-12 15:30:00
${GlideDateTime:sys_created_on}      → January 12, 2026
```

---

## 5. Advanced Notification Features

### Digest Notifications

Combine multiple notifications into a single email:

```javascript
await snow_email_notification_manage({
  action: "create",
  name: "Daily Incident Summary",
  table: "incident",
  action_insert: true,

  // Enable digest
  digestable: true,
  default_digest: true,
  digest_type: "digest",

  recipient_fields: ["assigned_to"],
  subject: "Daily Incident Summary",
  active: true
});
```

### Force Delivery

Bypass user notification preferences:

```javascript
await snow_email_notification_manage({
  action: "update",
  notification_id: "INC - Critical Alert",
  force_delivery: true,  // Always send, even if user disabled notifications
  mandatory: true        // Cannot be unsubscribed
});
```

### Include Attachments

```javascript
await snow_email_notification_manage({
  action: "create",
  name: "INC - With Attachments",
  table: "incident",
  include_attachments: true,  // Attach record's files
  // ...
});
```

---

## 6. Notification Conditions

### Encoded Query Conditions

Common patterns for the `condition` field:

| Scenario | Encoded Query |
|----------|---------------|
| **Priority 1 only** | `priority=1` |
| **Assignment changed** | `assigned_toCHANGES` |
| **Assigned to someone** | `assigned_toISNOTEMPTY` |
| **State changed to Resolved** | `stateCHANGESTO6` |
| **VIP caller** | `caller_id.vip=true` |
| **Multiple conditions** | `priority=1^assigned_toCHANGES` |

### Advanced Condition Scripts (ES5!)

```javascript
// Advanced condition (JavaScript - ES5 ONLY!)
// Returns true to send, false to skip

// Example: Only send during business hours
var now = new GlideDateTime();
var hour = now.getLocalTime().getHour();
if (hour >= 9 && hour <= 17) {
    return true;  // Send notification
}
return false;  // Skip notification

// Example: Only send for specific categories
var validCategories = ['network', 'hardware', 'software'];
var category = current.getValue('category');
for (var i = 0; i < validCategories.length; i++) {
    if (category === validCategories[i]) {
        return true;
    }
}
return false;
```

---

## 7. Common Notification Patterns

### Pattern 1: Assignment Notification

```javascript
await snow_email_notification_manage({
  action: "create",
  name: "INC - Assigned to User",
  table: "incident",
  action_update: true,
  condition: "assigned_toCHANGES^assigned_toISNOTEMPTY",
  recipient_fields: ["assigned_to"],
  subject: "Incident ${number} assigned to you",
  message_html: "<p>Incident ${number} has been assigned to you.</p>",
  active: true
});
```

### Pattern 2: SLA Breach Warning

```javascript
await snow_email_notification_manage({
  action: "create",
  name: "INC - SLA Breach Warning",
  table: "incident",
  event_name: "sla.breach.warning",
  event_parm_1: true,  // Use event.parm1 (the SLA record)
  recipient_fields: ["assigned_to"],
  recipient_groups: ["IT Managers"],
  subject: "SLA Breach Warning: ${number}",
  importance: "high",
  force_delivery: true,
  active: true
});
```

### Pattern 3: Caller Update Notification

```javascript
await snow_email_notification_manage({
  action: "create",
  name: "INC - Status Update for Caller",
  table: "incident",
  action_update: true,
  condition: "stateCHANGES^caller_idISNOTEMPTY",
  recipient_fields: ["caller_id"],
  send_self: false,  // Don't send to person making update
  subject: "Update on your incident ${number}",
  message_html: `
    <p>Your incident has been updated:</p>
    <p><b>Status:</b> ${state}</p>
    <p><b>Comments:</b> ${work_notes.getDisplayValue()}</p>
  `,
  active: true
});
```

### Pattern 4: Group Manager Escalation

```javascript
await snow_email_notification_manage({
  action: "create",
  name: "INC - Escalation to Manager",
  table: "incident",
  action_update: true,
  condition: "priorityCHANGESTO1",  // Escalated to P1
  recipient_fields: ["assignment_group.manager"],
  recipient_groups: ["IT Directors"],
  subject: "P1 Escalation: ${number}",
  importance: "high",
  force_delivery: true,
  active: true
});
```

---

## 8. Managing Notifications

### List All Notifications for a Table

```javascript
await snow_email_notification_manage({
  action: "list",
  table: "incident",
  active_only: true,
  limit: 100
});
```

### Get Notification Details

```javascript
await snow_email_notification_manage({
  action: "get",
  notification_id: "INC - Assigned to User"  // By name
});
```

### Enable/Disable Notifications

```javascript
// Disable a notification
await snow_email_notification_manage({
  action: "disable",
  notification_id: "INC - Assigned to User"
});

// Enable a notification
await snow_email_notification_manage({
  action: "enable",
  notification_id: "INC - Assigned to User"
});
```

### Clone a Notification

```javascript
await snow_email_notification_manage({
  action: "clone",
  notification_id: "INC - Assigned to User",
  new_name: "CHG - Assigned to User",
  active: false  // Clone as inactive
});

// Then update for the new table
await snow_email_notification_manage({
  action: "update",
  notification_id: "CHG - Assigned to User",
  table: "change_request"
});
```

---

## 9. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Notification not sending** | Notification inactive | `action: "enable"` |
| **Notification not sending** | Condition not met | Check encoded query |
| **Wrong recipients** | Recipient field empty | Add fallback recipients |
| **Missing variables** | Invalid field reference | Check field names and dot-walking |
| **HTML not rendering** | Wrong content_type | Set `content_type: "text/html"` |

### Check Email Logs

```javascript
// Query email logs for a specific record
await snow_query_table({
  table: "sys_email",
  query: "instance=incident.abc123def",
  fields: "sys_id,recipients,subject,mailbox,type,state",
  limit: 10
});
```

### Test a Notification

```javascript
await snow_email_notification_manage({
  action: "test",
  notification_id: "INC - Assigned to User"
});
// Returns test instructions and tips
```

---

## 10. Best Practices

### Naming Convention

Use consistent naming for notifications:

```
[TABLE PREFIX] - [Action/Trigger] ([Recipient])

Examples:
INC - Created (Caller)
INC - Assigned (Assignee)
INC - Resolved (Caller)
INC - SLA Breach (Manager)
CHG - Approval Required (Approver)
```

### Performance Considerations

1. **Use conditions wisely** - Don't send notifications for every update
2. **Limit recipients** - Avoid sending to large groups unnecessarily
3. **Use digests** - Combine frequent notifications
4. **Avoid heavy scripts** - Keep advanced conditions simple (ES5!)

### Security

1. **Sensitive data** - Don't include passwords or tokens in emails
2. **External recipients** - Validate email addresses
3. **PII** - Be careful with personal information

---

## Summary

**Key Tools:**
- `snow_email_notification_manage` - CRUD for notifications
- `snow_create_email_template` - Create reusable templates
- `snow_send_email` - Send ad-hoc emails

**Remember:**
1. Always set `action_insert` OR `action_update` OR `event_name` for triggers
2. Define recipients via `recipient_fields`, `recipient_groups`, or `recipient_users`
3. Use templates for complex, reusable email designs
4. Advanced conditions must use ES5 JavaScript
5. Test notifications before activating in production
