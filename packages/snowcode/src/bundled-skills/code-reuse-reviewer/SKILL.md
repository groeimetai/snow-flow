---
name: "code-reuse-reviewer"
description: "Reviews ServiceNow code for reuse opportunities, detects duplicate code patterns, identifies existing Script Includes that should be used, and enforces DRY (Don't Repeat Yourself) principles. Use when creating new scripts, reviewing existing code, or analyzing codebase for optimization opportunities."
license: "MIT"
compatibility: "Snow-Flow 3.4+, ServiceNow Quebec+"
triggers:
  - "code review"
  - "duplicate code"
  - "reuse"
  - "script include"
  - "DRY"
  - "refactor"
  - "common pattern"
  - "centralize"
  - "abstract"
  - "utility"
  - "helper"
  - "shared code"
priority: 75
metadata:
  author: "Snow-Flow Team"
  version: "1.0.0"
  category: "code-quality"
  servicenow_tables:
    - "sys_script_include"
    - "sys_script"
    - "sys_script_client"
    - "sys_ui_policy"
    - "sys_hub_flow"
allowed-tools: "snow_search_artifacts snow_analyze_artifact snow_query_table snow_find_artifact snow_comprehensive_search"
---

# Code Reuse Reviewer

This skill helps identify code reuse opportunities and enforce DRY (Don't Repeat Yourself) principles in ServiceNow development.

## Purpose

When developing in ServiceNow, code duplication leads to:
- Maintenance nightmares (fixing bugs in multiple places)
- Inconsistent behavior across the platform
- Increased testing burden
- Larger update sets and deployment complexity

This skill systematically reviews code for reuse opportunities.

---

## 1. Script Include Reuse Analysis

### When to Create a Script Include

A Script Include should be created when:
- **Code is used 2+ times** across different artifacts
- **Logic is complex** (>10 lines of business logic)
- **Functionality is table-agnostic** (works on multiple tables)
- **GlideRecord patterns repeat** across business rules

### Script Include Discovery Pattern

Before writing new server-side code, ALWAYS search for existing Script Includes:

```javascript
// STEP 1: Search for existing utilities
// Use snow_search_artifacts to find existing Script Includes
await snow_search_artifacts({
  query: 'utility helper',
  types: ['script_include'],
  include_inactive: false
});

// STEP 2: Check common naming patterns
// ServiceNow standard naming conventions:
// - *Utils (IncidentUtils, UserUtils, CMDBUtils)
// - *Helper (QueryHelper, DateHelper)
// - *Service (ApprovalService, NotificationService)
// - *API (RestAPI, TableAPI)
```

### Common Reusable Script Include Patterns

**Pattern 1: Table Utility Class (ES5)**
```javascript
var IncidentUtils = Class.create();
IncidentUtils.prototype = {
    initialize: function() {
        this.TABLE = 'incident';
    },

    getActiveIncidentsByAssignee: function(userId) {
        var incidents = [];
        var gr = new GlideRecord(this.TABLE);
        gr.addQuery('assigned_to', userId);
        gr.addQuery('active', true);
        gr.query();
        while (gr.next()) {
            incidents.push({
                sys_id: gr.getUniqueValue(),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description')
            });
        }
        return incidents;
    },

    type: 'IncidentUtils'
};
```

**Pattern 2: GlideAjax-Ready Script Include (ES5)**
```javascript
var AjaxUtils = Class.create();
AjaxUtils.prototype = Object.extendsObject(AbstractAjaxProcessor, {

    getUserDisplayName: function() {
        var userId = this.getParameter('sysparm_user_id');
        var gr = new GlideRecord('sys_user');
        if (gr.get(userId)) {
            return gr.getValue('name');
        }
        return '';
    },

    type: 'AjaxUtils'
});
```

---

## 2. Duplicate Code Detection

### Code Smell Indicators

Watch for these patterns that indicate code duplication:

| Code Smell | Description | Solution |
|------------|-------------|----------|
| **Repeated GlideRecord setup** | Same table queried with similar conditions | Create a Script Include with query methods |
| **Copy-paste validation** | Same validation logic in multiple client scripts | Create a shared validation Script Include |
| **Hardcoded values** | Same magic numbers/strings scattered across code | Use System Properties or a Constants Script Include |
| **Similar business rules** | Multiple BRs doing nearly the same thing | Consolidate into single BR with conditions |
| **Repeated date calculations** | gs.daysAgo(), date formatting in multiple places | Create DateUtils Script Include |

### Detection Checklist

When reviewing code, check for:

- [ ] **GlideRecord patterns** - Same `new GlideRecord('table')` + similar `addQuery()` combinations
- [ ] **User lookups** - Repeated `gs.getUser()` or user record queries
- [ ] **Date operations** - Similar date calculations/formatting
- [ ] **String manipulations** - Common parsing/formatting patterns
- [ ] **Approval logic** - Repeated approval workflow patterns
- [ ] **Email templates** - Similar notification structures
- [ ] **Error handling** - Identical try-catch patterns

---

## 3. ServiceNow-Specific Reuse Patterns

### Business Rule Consolidation

**BAD: Multiple similar Business Rules**
```javascript
// BR 1: Set Priority on Incident Insert (P1)
if (current.impact == 1 && current.urgency == 1) {
    current.priority = 1;
}

// BR 2: Set Priority on Incident Insert (P2)
if (current.impact == 1 && current.urgency == 2) {
    current.priority = 2;
}
```

**GOOD: Single Business Rule with Script Include**
```javascript
// Business Rule: Calculate Priority (before insert/update)
var priorityCalc = new PriorityCalculator();
current.priority = priorityCalc.calculate(current.impact, current.urgency);

// Script Include: PriorityCalculator
var PriorityCalculator = Class.create();
PriorityCalculator.prototype = {
    initialize: function() {
        this.matrix = this._loadPriorityMatrix();
    },

    calculate: function(impact, urgency) {
        var key = impact + '_' + urgency;
        return this.matrix[key] || 4;
    },

    _loadPriorityMatrix: function() {
        return {
            '1_1': 1, '1_2': 2, '1_3': 3,
            '2_1': 2, '2_2': 2, '2_3': 3,
            '3_1': 3, '3_2': 3, '3_3': 4
        };
    },

    type: 'PriorityCalculator'
};
```

### Client Script Consolidation

**BAD: Duplicate validation in multiple Client Scripts**
```javascript
// Client Script 1: Validate Email on Incident
function onChange(control, oldValue, newValue) {
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newValue)) {
        g_form.showErrorBox('email', 'Invalid email format');
    }
}
```

**GOOD: Shared validation via GlideAjax**
```javascript
// Client Script (reusable pattern)
function onChange(control, oldValue, newValue) {
    var ga = new GlideAjax('ValidationUtils');
    ga.addParam('sysparm_name', 'validateEmail');
    ga.addParam('sysparm_email', newValue);
    ga.getXMLAnswer(function(answer) {
        if (answer !== 'valid') {
            g_form.showErrorBox('email', 'Invalid email format');
        }
    });
}
```

---

## 4. Review Criteria

### Approve (set to completed) when:
- No existing Script Includes provide equivalent functionality
- Code patterns are unique to this use case
- Minor optimizations possible but not blocking
- Low-severity suggestions only (informational)

### Request Revision when:
- Existing Script Include provides >80% of needed functionality
- Duplicate code detected that should be consolidated
- High-severity code smell or anti-pattern detected
- Business logic should be extracted to Script Include for reuse

---

## 5. Review Output Format

Structure findings as:

```json
{
  "reviewStatus": "approved" | "needs_revision",
  "summary": "Brief summary of findings",
  "artifactsReviewed": [
    {
      "sys_id": "string",
      "type": "widget|business_rule|client_script|etc",
      "name": "artifact name"
    }
  ],
  "reuseOpportunities": [
    {
      "type": "existing_script_include" | "duplicate_pattern" | "refactor_suggestion",
      "severity": "high" | "medium" | "low",
      "description": "What was found",
      "existingArtifact": {
        "sys_id": "optional",
        "name": "optional"
      },
      "recommendation": "Specific action to take"
    }
  ],
  "approved": true | false,
  "feedback": "If not approved, explanation for the developer"
}
```

---

## 6. Recommended Script Include Naming

| Type | Pattern | Example |
|------|---------|---------|
| Table-specific utility | `[Table]Utils` | `IncidentUtils`, `ChangeUtils` |
| Cross-table service | `[Domain]Service` | `ApprovalService`, `NotificationService` |
| Client-callable AJAX | `[Name]Ajax` | `UserLookupAjax`, `ValidationAjax` |
| Integration wrapper | `[System]Integration` | `JiraIntegration`, `SlackIntegration` |
| Constants/Config | `[Domain]Config` | `ITSMConfig`, `HRConfig` |

---

## Summary

**Always ask these questions before writing new code:**

1. Does similar functionality already exist?
2. Will this code be needed elsewhere?
3. Can this be generalized for reuse?
4. Is this violating DRY principles?

**When in doubt, search first!** Use `snow_search_artifacts` to find existing patterns before creating new code.
