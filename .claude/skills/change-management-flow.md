# Change Management Flow Builder

Build complete change management workflows with approval processes, risk assessment, and implementation tracking.

## When to use this skill

Use when asked to:
- "Create change management workflow"
- "Build CAB approval process"
- "Implement change lifecycle"
- "Add change request automation"
- "Create emergency change process"

## What this skill does

Creates comprehensive change management workflows with:
- Multi-level approval workflows
- Risk assessment automation
- CAB meeting scheduling
- Implementation planning
- Rollback procedures
- Post-implementation review

## Change Management Lifecycle

**States:**
1. **New** - Change request created
2. **Assess** - Risk and impact assessment
3. **Authorize** - Approval process
4. **Scheduled** - Implementation scheduled
5. **Implement** - Change being implemented
6. **Review** - Post-implementation review
7. **Closed** - Change completed

## Step-by-step Workflow

### 1. Define Change Types

Ask user:
- Normal change (standard approval flow)
- Standard change (pre-approved template)
- Emergency change (expedited approval)
- What approvals are needed for each type?
- CAB meeting required?

### 2. Create Change Request Flow

```javascript
// Use Flow Designer or Business Rules for change lifecycle

// Business Rule: Initialize New Change
{
  name: 'Initialize Change Request',
  table: 'change_request',
  when: 'before',
  insert: true,

  script: `
    (function executeRule(current, previous) {

      // Set defaults for new change
      current.state = 'new';
      current.risk = 'moderate';

      // Auto-assign number if not set
      if (!current.number) {
        current.number = new NumberManager('change_request').getNextNumber();
      }

      // Set default planned dates
      var now = new GlideDateTime();
      var plannedStart = new GlideDateTime(now);
      plannedStart.addDaysLocalTime(7);  // 7 days from now

      if (!current.start_date) {
        current.start_date = plannedStart;
      }

      // Calculate end date based on duration
      if (!current.end_date && current.u_duration_hours) {
        var endDate = new GlideDateTime(plannedStart);
        var durationMs = parseInt(current.u_duration_hours) * 60 * 60 * 1000;
        endDate.add(durationMs);
        current.end_date = endDate;
      }

      gs.info('Initialized change request: ' + current.number);

    })(current, previous);
  `
}
```

### 3. Risk Assessment Automation

```javascript
{
  name: 'Auto-Calculate Change Risk',
  table: 'change_request',
  when: 'before',
  insert: true,
  update: true,

  script: `
    (function executeRule(current, previous) {

      // Auto-calculate risk based on multiple factors
      var riskScore = 0;
      var riskFactors = [];

      // Factor 1: Impact
      var impact = current.getValue('impact');
      if (impact == '1') {
        riskScore += 30;
        riskFactors.push('High impact');
      } else if (impact == '2') {
        riskScore += 20;
      } else if (impact == '3') {
        riskScore += 10;
      }

      // Factor 2: Affected CIs
      var ciCount = current.affected_cis.size();
      if (ciCount > 10) {
        riskScore += 20;
        riskFactors.push('Multiple CIs affected (' + ciCount + ')');
      } else if (ciCount > 5) {
        riskScore += 10;
      }

      // Factor 3: Implementation window
      if (current.outside_maintenance_schedule) {
        riskScore += 15;
        riskFactors.push('Outside maintenance window');
      }

      // Factor 4: Complexity
      var complexity = current.getValue('u_complexity');
      if (complexity == 'high') {
        riskScore += 25;
        riskFactors.push('High complexity');
      } else if (complexity == 'medium') {
        riskScore += 15;
      }

      // Factor 5: Emergency change
      if (current.type == 'emergency') {
        riskScore += 20;
        riskFactors.push('Emergency change');
      }

      // Set risk level based on score
      if (riskScore >= 60) {
        current.risk = 'high';
      } else if (riskScore >= 30) {
        current.risk = 'moderate';
      } else {
        current.risk = 'low';
      }

      // Store risk factors for review
      if (riskFactors.length > 0) {
        current.u_risk_factors = riskFactors.join('; ');
      }

      gs.info('Change ' + current.number + ' risk: ' + current.risk +
              ' (score: ' + riskScore + ')');

    })(current, previous);
  `
}
```

### 4. Approval Workflow Configuration

```javascript
{
  name: 'Route Change for Approval',
  table: 'change_request',
  when: 'after',
  insert: true,
  update: true,

  script: `
    (function executeRule(current, previous) {

      // Only route when moving to Assess state
      if (current.state != 'assess' || !current.state.changes()) {
        return;
      }

      // Standard changes are pre-approved
      if (current.type == 'standard') {
        current.approval = 'approved';
        current.state = 'scheduled';
        current.update();
        gs.info('Standard change ' + current.number + ' auto-approved');
        return;
      }

      // Create approval records based on risk
      var approvers = [];

      // Always require manager approval
      if (current.requested_by.manager) {
        approvers.push({
          user: current.requested_by.manager,
          order: 1
        });
      }

      // CAB approval for moderate/high risk
      if (current.risk == 'moderate' || current.risk == 'high') {
        approvers.push({
          group: 'CAB Approvers',
          order: 2
        });
      }

      // Additional approval for high risk changes
      if (current.risk == 'high') {
        approvers.push({
          user: 'change_manager_sys_id',
          order: 3
        });
      }

      // Emergency changes need expedited approval
      if (current.type == 'emergency') {
        approvers = [{
          user: 'emergency_change_manager_sys_id',
          order: 1
        }];
      }

      // Create approval records
      for (var i = 0; i < approvers.length; i++) {
        var approver = approvers[i];
        var approval = new GlideRecord('sysapproval_approver');
        approval.initialize();
        approval.source_table = 'change_request';
        approval.sysapproval = current.sys_id;
        approval.state = 'requested';

        if (approver.user) {
          approval.approver = approver.user;
        } else if (approver.group) {
          approval.group = approver.group;
        }

        approval.insert();
      }

      gs.info('Created ' + approvers.length + ' approvals for change ' + current.number);

    })(current, previous);
  `
}
```

### 5. CAB Meeting Scheduling

```javascript
{
  name: 'Schedule CAB Meeting for High-Risk Changes',
  table: 'change_request',
  when: 'after',
  update: true,

  script: `
    (function executeRule(current, previous) {

      // Only for high-risk changes moving to Assess state
      if (current.risk != 'high' || current.state != 'assess') {
        return;
      }

      // Check if CAB meeting already scheduled
      var cabMeeting = new GlideRecord('change_request_cab');
      cabMeeting.addQuery('change_request', current.sys_id);
      cabMeeting.query();

      if (cabMeeting.hasNext()) {
        gs.info('CAB meeting already scheduled for ' + current.number);
        return;
      }

      // Find next CAB meeting
      var nextCAB = new GlideRecord('sys_cal_event');
      nextCAB.addQuery('name', 'CONTAINS', 'CAB Meeting');
      nextCAB.addQuery('start_date', '>', new GlideDateTime());
      nextCAB.orderBy('start_date');
      nextCAB.setLimit(1);
      nextCAB.query();

      if (nextCAB.next()) {
        // Add change to CAB meeting agenda
        var cabAgenda = new GlideRecord('change_request_cab');
        cabAgenda.initialize();
        cabAgenda.change_request = current.sys_id;
        cabAgenda.cab_meeting = nextCAB.sys_id;
        cabAgenda.agenda_order = 999;  // Add to end
        cabAgenda.insert();

        // Notify requester
        gs.eventQueue('change.cab.scheduled', current, nextCAB.start_date);

        gs.info('Added change ' + current.number + ' to CAB meeting on ' +
                nextCAB.start_date.getDisplayValue());
      } else {
        gs.warn('No upcoming CAB meeting found for change ' + current.number);
      }

    })(current, previous);
  `
}
```

### 6. Implementation Validation

```javascript
{
  name: 'Validate Change Before Implementation',
  table: 'change_request',
  when: 'before',
  update: true,

  script: `
    (function executeRule(current, previous) {

      // Only validate when moving to Implement state
      if (current.state != 'implement' || !current.state.changes()) {
        return;
      }

      var errors = [];

      // Check approval status
      if (current.approval != 'approved') {
        errors.push('Change must be approved before implementation');
      }

      // Check implementation plan
      if (!current.implementation_plan || current.implementation_plan.length < 100) {
        errors.push('Implementation plan must be detailed (minimum 100 characters)');
      }

      // Check backout plan
      if (!current.backout_plan || current.backout_plan.length < 50) {
        errors.push('Backout plan is required for implementation');
      }

      // Check test plan
      if (!current.test_plan) {
        errors.push('Test plan is required');
      }

      // Check CI relationships
      if (current.affected_cis.size() == 0) {
        errors.push('At least one affected CI must be specified');
      }

      // Check implementation window
      var now = new GlideDateTime();
      var startDate = new GlideDateTime(current.start_date);

      if (startDate.before(now)) {
        errors.push('Implementation start date cannot be in the past');
      }

      // Abort if errors found
      if (errors.length > 0) {
        gs.addErrorMessage('Cannot implement change: ' + errors.join('; '));
        current.state = previous.state;  // Revert state
        current.setAbortAction(true);
      }

    })(current, previous);
  `
}
```

### 7. Post-Implementation Review

```javascript
{
  name: 'Create Post-Implementation Review Task',
  table: 'change_request',
  when: 'after',
  update: true,

  script: `
    (function executeRule(current, previous) {

      // Create review task when change moves to Review state
      if (current.state != 'review' || !current.state.changes()) {
        return;
      }

      // Create review task
      var reviewTask = new GlideRecord('change_task');
      reviewTask.initialize();
      reviewTask.change_request = current.sys_id;
      reviewTask.short_description = 'Post-Implementation Review for ' + current.number;
      reviewTask.description = 'Review the implementation and verify all objectives were met.\\n\\n' +
                                'Checklist:\\n' +
                                '- All changes implemented successfully\\n' +
                                '- No unexpected issues occurred\\n' +
                                '- Test results are satisfactory\\n' +
                                '- Documentation updated\\n' +
                                '- Lessons learned documented';

      reviewTask.assignment_group = current.assignment_group;
      reviewTask.assigned_to = current.assigned_to;

      // Set due date (3 days from now)
      var dueDate = new GlideDateTime();
      dueDate.addDaysLocalTime(3);
      reviewTask.due_date = dueDate;

      reviewTask.insert();

      gs.info('Created PIR task ' + reviewTask.number + ' for change ' + current.number);

      // Send notification
      gs.eventQueue('change.review.created', current, reviewTask.sys_id);

    })(current, previous);
  `
}
```

### 8. Emergency Change Fast-Track

```javascript
{
  name: 'Fast-Track Emergency Changes',
  table: 'change_request',
  when: 'after',
  insert: true,
  update: true,

  script: `
    (function executeRule(current, previous) {

      // Only for emergency changes
      if (current.type != 'emergency') {
        return;
      }

      // Auto-escalate priority
      if (current.priority != '1') {
        current.priority = '1';  // Critical
      }

      // Skip normal workflow states for emergencies
      if (current.isNewRecord() || current.state == 'new') {
        current.state = 'assess';

        // Create emergency approval
        var approval = new GlideRecord('sysapproval_approver');
        approval.initialize();
        approval.source_table = 'change_request';
        approval.sysapproval = current.sys_id;
        approval.state = 'requested';
        approval.approver = 'emergency_change_manager_sys_id';
        approval.due_date = new GlideDateTime();  // Due immediately
        approval.insert();

        // Notify emergency change manager
        gs.eventQueue('change.emergency.approval_needed', current, approval.sys_id);

        current.update();
      }

      // Log emergency change
      gs.warn('Emergency change created: ' + current.number +
              ' - Reason: ' + current.u_emergency_reason);

    })(current, previous);
  `
}
```

## Change Management Best Practices

### Risk Management
- Always assess risk before approval
- Document risk factors clearly
- Require additional approvals for high-risk changes
- Ensure backout plans exist

### Approval Process
- Define clear approval hierarchies
- Set appropriate approval timeouts
- Escalate overdue approvals
- Track approval history

### Implementation
- Validate all prerequisites before implementation
- Ensure proper documentation
- Test changes before production
- Have rollback procedures ready

### Communication
- Notify affected stakeholders
- Update change status regularly
- Document lessons learned
- Share PIR results with team

## Common Change Workflows

**Standard Change:**
1. Create from template → Auto-approved → Schedule → Implement → Close

**Normal Change:**
1. Create → Assess risk → Route approvals → CAB (if needed) → Schedule → Implement → Review → Close

**Emergency Change:**
1. Create → Fast-track approval → Implement → Post-review → Document

## Success Criteria

Change management workflow is complete when:
1. ✅ All change types handled appropriately
2. ✅ Risk assessment automated
3. ✅ Approval routing works correctly
4. ✅ CAB scheduling integrated
5. ✅ Implementation validation in place
6. ✅ PIR tasks created automatically
7. ✅ Emergency changes fast-tracked
8. ✅ Notifications sent to stakeholders
