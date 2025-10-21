# Client Script Builder

Create interactive client-side scripts for ServiceNow forms with field validation, dynamic behavior, and user interaction.

## When to use this skill

Use when asked to:
- "Add client-side validation"
- "Show/hide fields dynamically"
- "Auto-populate fields on form"
- "Add real-time field validation"
- "Make fields mandatory conditionally"

## What this skill does

Creates client scripts with:
- Form field manipulation
- Real-time validation
- Dynamic field visibility
- Auto-population logic
- User interaction handling
- GlideAjax server calls

## Client Script Types

**onChange** - Triggers when field value changes
**onLoad** - Triggers when form loads
**onSubmit** - Triggers before form submission
**onCellEdit** - Triggers on list cell edit (list view only)

## Step-by-step Workflow

### 1. Gather Requirements

Ask user:
- Which table/form?
- Which fields to monitor?
- What should trigger the script?
- What validation/behavior is needed?
- Should it run on desktop, mobile, or both?

### 2. Create onChange Client Script

**Pattern: Auto-populate related fields**

```javascript
{
  name: 'Auto-populate Caller Details',
  table: 'incident',
  type: 'onChange',
  field: 'caller_id',  // Trigger field
  active: true,

  script: `
    function onChange(control, oldValue, newValue, isLoading, isTemplate) {
      // Don't run on form load or when clearing field
      if (isLoading || newValue === '') {
        return;
      }

      // Get caller's details
      var ga = new GlideAjax('CallerInfoAjax');
      ga.addParam('sysparm_name', 'getCallerInfo');
      ga.addParam('sysparm_caller_id', newValue);
      ga.getXMLAnswer(function(response) {
        var info = JSON.parse(response);

        // Auto-populate email and phone
        g_form.setValue('caller_email', info.email);
        g_form.setValue('caller_phone', info.phone);
        g_form.setValue('location', info.location);

        g_form.showFieldMsg('caller_id', 'Caller details populated', 'info');
      });
    }
  `
}
```

### 3. Create onLoad Client Script

**Pattern: Initialize form and set defaults**

```javascript
{
  name: 'Initialize Incident Form',
  table: 'incident',
  type: 'onLoad',
  active: true,

  script: `
    function onLoad() {
      // Set default priority for new records
      if (g_form.isNewRecord()) {
        g_form.setValue('priority', '3');  // Medium priority
        g_form.setValue('category', 'inquiry');

        // Hide fields until category is selected
        g_form.setDisplay('subcategory', false);
        g_form.setDisplay('cmdb_ci', false);
      }

      // Make assignment group mandatory if assigned_to is filled
      if (!g_form.getValue('assigned_to')) {
        g_form.setMandatory('assignment_group', false);
      } else {
        g_form.setMandatory('assignment_group', true);
      }

      // Show info message for high-priority incidents
      var priority = g_form.getValue('priority');
      if (priority === '1' || priority === '2') {
        g_form.addInfoMessage('This is a high-priority incident. Please escalate if needed.');
      }
    }
  `
}
```

### 4. Create onSubmit Client Script

**Pattern: Validate before submission**

```javascript
{
  name: 'Validate Change Request Before Submit',
  table: 'change_request',
  type: 'onSubmit',
  active: true,

  script: `
    function onSubmit() {
      // Validate change request has required approvals

      var state = g_form.getValue('state');
      var approvalState = g_form.getValue('approval');

      // If moving to Implement state, must be approved
      if (state === 'implement' && approvalState !== 'approved') {
        g_form.addErrorMessage('Change request must be approved before implementation');
        return false;  // Prevent submission
      }

      // Validate risk assessment completed for high-risk changes
      var risk = g_form.getValue('risk');
      var riskImpact = g_form.getValue('risk_impact_analysis');

      if (risk === 'high' && !riskImpact) {
        g_form.addErrorMessage('Risk impact analysis is required for high-risk changes');
        g_form.flash('risk_impact_analysis', '#FF0000', 3);  // Flash red
        return false;
      }

      // Validate implementation plan
      var implPlan = g_form.getValue('implementation_plan');
      if (state === 'implement' && (!implPlan || implPlan.length < 50)) {
        g_form.addErrorMessage('Implementation plan must be detailed (minimum 50 characters)');
        return false;
      }

      // All validations passed
      return true;
    }
  `
}
```

### 5. Dynamic Field Visibility

```javascript
{
  name: 'Show/Hide Fields Based on Category',
  table: 'incident',
  type: 'onChange',
  field: 'category',
  active: true,

  script: `
    function onChange(control, oldValue, newValue, isLoading) {
      if (isLoading) return;

      // Hide all optional fields first
      g_form.setDisplay('u_hardware_type', false);
      g_form.setDisplay('u_software_name', false);
      g_form.setDisplay('u_network_issue', false);
      g_form.setDisplay('u_access_request', false);

      // Show relevant fields based on category
      switch(newValue) {
        case 'hardware':
          g_form.setDisplay('u_hardware_type', true);
          g_form.setMandatory('u_hardware_type', true);
          g_form.setDisplay('cmdb_ci', true);
          break;

        case 'software':
          g_form.setDisplay('u_software_name', true);
          g_form.setMandatory('u_software_name', true);
          break;

        case 'network':
          g_form.setDisplay('u_network_issue', true);
          g_form.setDisplay('cmdb_ci', true);
          break;

        case 'access':
          g_form.setDisplay('u_access_request', true);
          g_form.setMandatory('u_access_request', true);
          break;

        default:
          // No special fields for other categories
          break;
      }
    }
  `
}
```

### 6. Real-Time Field Validation

```javascript
{
  name: 'Validate Email Format',
  table: 'sys_user',
  type: 'onChange',
  field: 'email',
  active: true,

  script: `
    function onChange(control, oldValue, newValue, isLoading) {
      if (isLoading || !newValue) return;

      // Email validation regex
      var emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;

      if (!emailRegex.test(newValue)) {
        g_form.showFieldMsg('email', 'Please enter a valid email address', 'error');
        g_form.setValue('email', oldValue);  // Revert to old value
      } else {
        g_form.hideFieldMsg('email');

        // Check if email is unique
        var ga = new GlideAjax('UserUtilsAjax');
        ga.addParam('sysparm_name', 'isEmailUnique');
        ga.addParam('sysparm_email', newValue);
        ga.addParam('sysparm_sys_id', g_form.getUniqueValue());
        ga.getXMLAnswer(function(response) {
          if (response === 'false') {
            g_form.showFieldMsg('email', 'This email is already in use', 'error');
          }
        });
      }
    }
  `
}
```

### 7. GlideAjax Server Communication

**Client Script:**
```javascript
{
  name: 'Get Available Approvers',
  table: 'change_request',
  type: 'onChange',
  field: 'type',
  active: true,

  script: `
    function onChange(control, oldValue, newValue, isLoading) {
      if (isLoading || !newValue) return;

      // Get approvers for this change type
      var ga = new GlideAjax('ChangeApproverAjax');
      ga.addParam('sysparm_name', 'getApprovers');
      ga.addParam('sysparm_type', newValue);
      ga.getXMLAnswer(function(response) {
        var approvers = JSON.parse(response);

        g_form.clearMessages();

        if (approvers.length === 0) {
          g_form.addInfoMessage('No approvers configured for this change type');
        } else {
          var message = 'Approvers: ' + approvers.join(', ');
          g_form.addInfoMessage(message);
        }
      });
    }
  `
}
```

**Corresponding Script Include:**
```javascript
{
  name: 'ChangeApproverAjax',
  script: `
    var ChangeApproverAjax = Class.create();
    ChangeApproverAjax.prototype = Object.extendsObject(AbstractAjaxProcessor, {

      getApprovers: function() {
        var changeType = this.getParameter('sysparm_type');
        var approvers = [];

        var gr = new GlideRecord('sys_user');
        gr.addQuery('u_change_approver', true);
        gr.addQuery('u_change_types', 'CONTAINS', changeType);
        gr.addQuery('active', true);
        gr.query();

        while (gr.next()) {
          approvers.push(gr.getDisplayValue());
        }

        return JSON.stringify(approvers);
      },

      type: 'ChangeApproverAjax'
    });
  `
}
```

### 8. Advanced Field Manipulation

**Pattern: Cascading dropdowns**

```javascript
{
  name: 'Cascade City Based on Country',
  table: 'sys_user',
  type: 'onChange',
  field: 'country',
  active: true,

  script: `
    function onChange(control, oldValue, newValue, isLoading) {
      if (isLoading) return;

      // Clear city field
      g_form.clearValue('city');

      if (!newValue) {
        g_form.setReadOnly('city', true);
        return;
      }

      // Enable city field
      g_form.setReadOnly('city', false);

      // Set reference qualifier to filter cities by country
      g_form.addFilter('city', 'country', newValue);

      // Optionally show available cities
      var ga = new GlideAjax('LocationAjax');
      ga.addParam('sysparm_name', 'getCities');
      ga.addParam('sysparm_country', newValue);
      ga.getXMLAnswer(function(response) {
        var cities = JSON.parse(response);
        if (cities.length > 0) {
          g_form.showFieldMsg('city', cities.length + ' cities available', 'info', true);
        }
      });
    }
  `
}
```

## Client Script Best Practices

### Performance
- Don't make unnecessary server calls
- Cache results when possible
- Use `isLoading` parameter to avoid running on form load
- Minimize DOM manipulations

### User Experience
- Provide immediate feedback (field messages)
- Don't block user unnecessarily
- Clear previous messages before showing new ones
- Use appropriate message types (info/warning/error)

### Code Quality
- Check for null/empty values
- Handle async responses properly
- Use meaningful variable names
- Add comments for complex logic

### Common g_form Methods

**Field Values:**
- `g_form.getValue('field')` - Get field value
- `g_form.setValue('field', value)` - Set field value
- `g_form.clearValue('field')` - Clear field

**Field Visibility:**
- `g_form.setDisplay('field', true/false)` - Show/hide field
- `g_form.setReadOnly('field', true/false)` - Make read-only
- `g_form.setMandatory('field', true/false)` - Make mandatory

**Field Messages:**
- `g_form.showFieldMsg('field', 'message', 'info/warning/error')` - Show field message
- `g_form.hideFieldMsg('field')` - Hide field message
- `g_form.flash('field', 'color', duration)` - Flash field

**Form Messages:**
- `g_form.addInfoMessage('message')` - Add info message
- `g_form.addErrorMessage('message')` - Add error message
- `g_form.clearMessages()` - Clear all messages

**Form State:**
- `g_form.isNewRecord()` - Check if new record
- `g_form.getUniqueValue()` - Get sys_id
- `g_form.getSections()` - Get form sections

## Troubleshooting

**Script doesn't trigger:**
- Verify field name is correct
- Check if script is active
- Confirm UI policy isn't interfering
- Check browser console for errors

**GlideAjax doesn't work:**
- Verify Script Include is client-callable
- Check Script Include extends AbstractAjaxProcessor
- Verify parameter names match
- Check for JavaScript errors in response

**Form submission blocked:**
- Check onSubmit returns true/false
- Verify validation logic is correct
- Check for JavaScript errors
- Test in different browsers

## Success Criteria

Client Script is complete when:
1. ✅ Triggers at correct time
2. ✅ Field manipulation works correctly
3. ✅ Validation logic is robust
4. ✅ User feedback is clear
5. ✅ No JavaScript errors
6. ✅ Performance is acceptable
7. ✅ Tested across browsers
8. ✅ GlideAjax calls work (if used)
