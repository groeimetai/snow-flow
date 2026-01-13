---
name: update-set-workflow
description: This skill should be used when the user asks to "create something", "deploy", "make changes", "develop", "build a feature", or any ServiceNow development that requires change tracking.
version: 1.0.0
tools:
  - snow_update_set_create
  - snow_update_set_current
  - snow_update_set_switch
  - snow_update_set_complete
  - snow_ensure_active_update_set
---

# Update Set Workflow for ServiceNow

Update Sets are MANDATORY for tracking changes in ServiceNow development. Without an Update Set, changes are not tracked and cannot be deployed to other instances.

## Before ANY Development

ALWAYS create or ensure an Update Set is active before making changes:

```javascript
// Step 1: Check current Update Set
var current = await snow_update_set_current();

// Step 2: If no Update Set or using Default, create one
if (!current || current.name === 'Default') {
  await snow_update_set_create({
    name: "Feature: [Descriptive Name]",
    description: "What and why this change is being made"
  });
}

// Step 3: Now safe to make changes
// All changes will be tracked!

// Step 4: When done, complete the Update Set
await snow_update_set_complete({
  update_set_id: current.sys_id
});
```

## Update Set Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| Feature | `Feature: [Name]` | `Feature: Incident Auto-Assignment` |
| Bug Fix | `Fix: [Issue]` | `Fix: Approval Email Not Sending` |
| Enhancement | `Enhancement: [Name]` | `Enhancement: Dashboard Performance` |
| Hotfix | `Hotfix: [Issue]` | `Hotfix: Critical Login Bug` |

## Update Set Lifecycle

1. **In Progress** - Active, receiving changes
2. **Complete** - Ready for export/promotion
3. **Ignore** - Changes won't be promoted (use for experiments)

## What Gets Tracked

Update Sets automatically capture changes to:
- Tables and columns
- Business Rules
- Script Includes
- Client Scripts
- UI Policies and Actions
- Workflows and Flow Designer flows
- Service Portal widgets and pages
- ACLs and Security Rules
- System Properties
- Scheduled Jobs
- And more...

## What Does NOT Get Tracked

- Data records (use Import Sets for data)
- Attachments on records
- User session information
- Some system tables (sys_user, etc.)

## MCP Tools for Update Sets

```javascript
// Create new Update Set
snow_update_set_create({
  name: "Feature: My Feature",
  description: "Description of changes"
});

// Switch to existing Update Set
snow_update_set_switch({
  update_set_id: "sys_id_here"
});

// Get current Update Set
snow_update_set_current();

// Complete Update Set
snow_update_set_complete({
  update_set_id: "sys_id_here"
});

// Export Update Set as XML
snow_update_set_export({
  update_set_id: "sys_id_here"
});
```

## Best Practices

1. **One feature per Update Set** - Don't mix unrelated changes
2. **Descriptive names** - Make it clear what the Update Set contains
3. **Complete when done** - Don't leave Update Sets open indefinitely
4. **Test before completing** - Verify all changes work correctly
5. **Never use Default** - Always create a named Update Set
