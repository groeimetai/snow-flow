# Business Rule Builder

Create production-ready ServiceNow Business Rules with proper conditions, error handling, and performance optimization.

## When to use this skill

Use when asked to:
- "Create a business rule"
- "Add server-side validation"
- "Auto-populate fields on insert/update"
- "Trigger actions when records change"
- "Implement cascade updates"

## What this skill does

Creates complete Business Rules with:
- Proper timing (before/after, insert/update/delete/query)
- Condition builder integration
- ES5-compliant server scripts
- Error handling and logging
- Performance optimization
- Role-based execution control

## Step-by-step Workflow

### 0. 🚨 CREATE UPDATE SET FIRST (MANDATORY!)

**BEFORE creating anything, create an Update Set:**

```javascript
// STEP 0: Create Update Set
const updateSet = await snow_update_set_manage({
  action: 'create',
  name: "Feature: Business Rule - [Name]",
  description: "Create business rule for [purpose]",
  application: "global"
});

// Verify it's active
const current = await snow_update_set_query({ action: 'current' });
console.log('Active Update Set:', current.name);
```

**✅ Now all development will be tracked in this Update Set!**

### 1. Gather Requirements

Ask user:
- Which table should this rule apply to?
- When should it trigger? (insert, update, delete, query)
- Before or after database operation?
- What conditions must be met?
- What actions should it perform?
- Should it run for specific roles only?

### 2. Determine Business Rule Type

**Before Rules** (data validation, auto-population):
- Validate data before saving
- Auto-populate fields
- Prevent invalid operations
- Modify current record

**After Rules** (cascading updates, notifications):
- Update related records
- Send notifications
- Create child records
- Trigger workflows

**Async Rules** (non-blocking operations):
- Send emails
- Call external APIs
- Heavy processing that doesn't affect current transaction

### 3. Create Business Rule

```javascript
// Use snow_create_business_rule
{
  name: 'Auto Assign Priority Incidents',
  table: 'incident',
  when: 'before',  // before, after, async, display
  insert: true,
  update: true,
  active: true,

  // Condition (optional - runs when condition is true)
  condition: 'current.priority <= 2 && current.assigned_to.nil()',

  // Script (ES5 ONLY!)
  script: `
    (function executeRule(current, previous /*null when async*/) {

      // For Priority 1 and 2 incidents without assignment
      if (current.priority <= 2 && current.assigned_to.nil()) {

        // Find available on-call engineer
        var engineerGr = new GlideRecord('sys_user');
        engineerGr.addQuery('active', true);
        engineerGr.addQuery('u_on_call', true);
        engineerGr.addQuery('u_role', 'incident_manager');
        engineerGr.orderBy('u_current_workload');
        engineerGr.setLimit(1);
        engineerGr.query();

        if (engineerGr.next()) {
          current.assigned_to = engineerGr.getValue('sys_id');
          current.assignment_group = engineerGr.getValue('u_group');

          gs.info('Auto-assigned P' + current.priority + ' incident ' +
                  current.number + ' to ' + engineerGr.getDisplayValue());
        } else {
          gs.warn('No available on-call engineer for incident ' + current.number);
        }
      }

    })(current, previous);
  `
}
```

### 4. Add Advanced Features

#### Filter Conditions

Instead of condition scripts, use filter conditions for better performance:

```javascript
{
  name: 'Update Related Tasks',
  table: 'incident',
  when: 'after',
  update: true,

  // Use filter condition instead of script condition
  filter_condition: 'state=6^ORstate=7',  // Resolved or Closed

  script: `
    (function executeRule(current, previous) {
      // Close all related tasks
      var taskGr = new GlideRecord('task');
      taskGr.addQuery('parent', current.sys_id);
      taskGr.addQuery('state', '!=', 3);  // Not closed
      taskGr.query();

      var count = 0;
      while (taskGr.next()) {
        taskGr.state = 3;  // Closed
        taskGr.update();
        count++;
      }

      if (count > 0) {
        gs.info('Closed ' + count + ' tasks for incident ' + current.number);
      }
    })(current, previous);
  `
}
```

#### Role-Based Execution

```javascript
{
  name: 'Prevent Unauthorized Changes',
  table: 'change_request',
  when: 'before',
  update: true,

  // Only run for non-admins
  role_conditions: '!gs.hasRole("admin")',

  script: `
    (function executeRule(current, previous) {
      // Prevent changing state from Approved to anything else
      // unless user is change_manager

      if (previous.state == 'approved' &&
          current.state != 'approved' &&
          !gs.hasRole('change_manager')) {

        gs.addErrorMessage('Only Change Managers can modify approved changes');
        current.setAbortAction(true);
      }

    })(current, previous);
  `
}
```

### 5. Implement Common Patterns

#### Pattern A: Cascade Updates

```javascript
{
  name: 'Cascade Priority to Child Tasks',
  table: 'incident',
  when: 'after',
  update: true,

  script: `
    (function executeRule(current, previous) {
      // Only cascade if priority actually changed
      if (current.priority.changes()) {

        var taskGr = new GlideRecord('task');
        taskGr.addQuery('parent', current.sys_id);
        taskGr.query();

        while (taskGr.next()) {
          taskGr.priority = current.priority;
          taskGr.update();
        }
      }

    })(current, previous);
  `
}
```

#### Pattern B: Data Validation

```javascript
{
  name: 'Validate Assignment Group',
  table: 'incident',
  when: 'before',
  insert: true,
  update: true,

  script: `
    (function executeRule(current, previous) {
      // Ensure assignment group matches assigned user's group

      if (!current.assigned_to.nil() && !current.assignment_group.nil()) {
        var userGr = new GlideRecord('sys_user');
        if (userGr.get(current.assigned_to)) {

          // Check if user is member of assignment group
          var isMember = new GlideRecord('sys_user_grmember');
          isMember.addQuery('user', userGr.sys_id);
          isMember.addQuery('group', current.assignment_group);
          isMember.query();

          if (!isMember.hasNext()) {
            gs.addErrorMessage(
              userGr.getDisplayValue() +
              ' is not a member of the selected assignment group'
            );
            current.setAbortAction(true);
          }
        }
      }

    })(current, previous);
  `
}
```

#### Pattern C: Auto-Calculate Fields

```javascript
{
  name: 'Calculate SLA Due Date',
  table: 'incident',
  when: 'before',
  insert: true,
  update: true,

  script: `
    (function executeRule(current, previous) {
      // Recalculate SLA when priority or category changes

      if (current.priority.changes() || current.category.changes()) {

        // Get SLA hours based on priority
        var slaHours = 24;  // Default
        if (current.priority == 1) slaHours = 4;
        else if (current.priority == 2) slaHours = 8;
        else if (current.priority == 3) slaHours = 24;
        else slaHours = 72;

        // Calculate due date from now
        var now = new GlideDateTime();
        var schedule = new GlideSchedule();
        schedule.load(current.u_sla_schedule);

        var dueDate = schedule.add(now, slaHours * 60 * 60 * 1000);
        current.sla_due = dueDate;

        gs.info('Set SLA due to ' + dueDate.getDisplayValue() +
                ' (' + slaHours + ' hours) for incident ' + current.number);
      }

    })(current, previous);
  `
}
```

### 6. Add Error Handling

```javascript
{
  name: 'Create Related Records with Error Handling',
  table: 'incident',
  when: 'after',
  insert: true,

  script: `
    (function executeRule(current, previous) {

      try {
        // Create initial task for new high-priority incidents
        if (current.priority <= 2) {

          var taskGr = new GlideRecord('task');
          taskGr.initialize();
          taskGr.parent = current.sys_id;
          taskGr.short_description = 'Initial investigation for ' + current.number;
          taskGr.assignment_group = current.assignment_group;
          taskGr.assigned_to = current.assigned_to;
          taskGr.priority = current.priority;

          var taskSysId = taskGr.insert();

          if (taskSysId) {
            gs.info('Created investigation task ' + taskGr.number +
                    ' for incident ' + current.number);
          } else {
            gs.error('Failed to create task for incident ' + current.number);
          }
        }

      } catch (e) {
        gs.error('Error in business rule: ' + e.message);
        gs.error('Stack trace: ' + e.stack);
      }

    })(current, previous);
  `
}
```

### 7. Optimize Performance

**Use setWorkflow(false) for bulk updates:**

```javascript
{
  name: 'Bulk Update Child Records',
  table: 'change_request',
  when: 'after',
  update: true,

  script: `
    (function executeRule(current, previous) {

      if (current.state.changes()) {

        var taskGr = new GlideRecord('change_task');
        taskGr.addQuery('change_request', current.sys_id);
        taskGr.query();

        // Disable workflow to prevent recursive business rules
        taskGr.setWorkflow(false);

        while (taskGr.next()) {
          taskGr.state = current.state;
          taskGr.update();
        }
      }

    })(current, previous);
  `
}
```

**Use autoSysFields(false) when only updating specific fields:**

```javascript
{
  name: 'Update Without Changing Timestamps',
  table: 'incident',
  when: 'after',
  update: true,

  script: `
    (function executeRule(current, previous) {

      // Update counter without changing sys_updated_on
      var gr = new GlideRecord('incident');
      if (gr.get(current.sys_id)) {
        gr.setWorkflow(false);
        gr.autoSysFields(false);  // Don't update sys fields
        gr.u_view_count = parseInt(gr.u_view_count) + 1;
        gr.update();
      }

    })(current, previous);
  `
}
```

## Business Rule Best Practices

### Performance Optimization
- Use filter conditions instead of script conditions when possible
- Avoid queries in loops (GlideAggregate for counts)
- Use setWorkflow(false) for bulk updates
- Use autoSysFields(false) when appropriate
- Limit query results with setLimit()

### Error Handling
- Wrap risky operations in try-catch
- Log errors with gs.error()
- Provide user feedback with gs.addErrorMessage()
- Use current.setAbortAction(true) to prevent save

### Code Quality
- **ES5 ONLY** - No const/let/arrows/template literals
- Keep scripts focused and single-purpose
- Add meaningful logging with gs.info()
- Document complex logic with comments
- Test with various data scenarios

### Avoid Common Pitfalls
- Don't create infinite loops (rule updates same table)
- Don't query large datasets without limits
- Don't run heavy processing in "before" rules
- Don't update current record in "after" rules (use "before")
- Don't forget to check for null/undefined values

## Troubleshooting

**Rule doesn't trigger:**
- Check condition script/filter condition
- Verify table name is correct
- Confirm insert/update/delete checkboxes
- Check if role conditions exclude current user
- Verify rule is active

**Rule triggers too often:**
- Add more specific conditions
- Use .changes() to detect actual changes
- Add role conditions to limit execution

**Performance issues:**
- Move heavy processing to async rules
- Optimize queries (add indexes, use filters)
- Use GlideAggregate instead of counting with GlideRecord
- Avoid nested loops with queries

**Infinite loops:**
- Use setWorkflow(false) when updating same table
- Check for .changes() before cascading updates
- Add conditions to prevent recursive execution

## Success Criteria

Business Rule is complete when:
1. ✅ Triggers at correct time (before/after/async)
2. ✅ Conditions properly filter execution
3. ✅ Script is ES5-compliant
4. ✅ Error handling implemented
5. ✅ Logging added for troubleshooting
6. ✅ Performance optimized
7. ✅ Tested with various scenarios
8. ✅ No infinite loops or recursion


### Final Step: Complete Update Set

```javascript
// After business rule creation, complete the Update Set
await snow_update_set_manage({
  action: "complete",
  update_set_id: updateSet.sys_id,
  state: "complete"
});

console.log("✅ Business Rule complete and tracked in Update Set!");
```
