# Service Portal Widget Debugger

Debug Service Portal widgets efficiently using local sync, coherence validation, and systematic troubleshooting.

## When to use this skill

Use this skill when:
- "Widget isn't working"
- "Debug this widget"
- "Widget skips questions"
- "Form doesn't submit properly"
- "Data not displaying in widget"
- "Button doesn't work"
- "Fix widget issue"

## What this skill does

Systematically debugs Service Portal widgets by:
- Pulling widget to local files (avoiding token limits)
- Analyzing client-server-HTML coherence
- Finding missing methods, data properties, or handlers
- Validating ES5 compliance in server scripts
- Testing widget functionality
- Pushing fixes back to ServiceNow

## Critical: Always Use Local Sync for Widget Debugging

⚠️ **NEVER use `snow_query_table` for debugging widgets!**

### ❌ WRONG Approach:
```javascript
// This hits token limits and can't use native tools
snow_query_table({
  table: 'sp_widget',
  query: 'sys_id=...',
  fields: ['template', 'script', 'client_script']
});
```

### ✅ CORRECT Approach:
```javascript
// Pull widget to local files - NO token limits!
snow_pull_artifact({
  sys_id: 'widget_sys_id',
  table: 'sp_widget'
});
// Now all files available locally with native search/edit
```

## Step-by-step Debugging Workflow

### 1. Pull Widget to Local Files

```javascript
// Use snow_pull_artifact to get all widget components
{
  sys_id: 'widget_sys_id',  // Or find by name first
  table: 'sp_widget'
}
```

This creates local files:
```
/tmp/snow-flow-artifacts/widgets/widget_name/
├── widget_name.html          # Template
├── widget_name.server.js     # Server script (ES5)
├── widget_name.client.js     # Client script
├── widget_name.css           # Styles
├── widget_name.config.json   # Configuration
└── README.md                 # Context
```

### 2. Analyze the Issue

**Common Widget Issues:**

**A. Data Not Displaying**
- Check: Does server initialize `data.property`?
- Check: Does HTML reference `{{data.property}}`?
- Check: Is server script ES5-only?

**B. Button Doesn't Work**
- Check: HTML has `ng-click="c.methodName()"`?
- Check: Client has `c.methodName = function()`?
- Check: Method calls `c.server.get({action})`?

**C. Server Action Not Triggered**
- Check: Client sends `{action: 'actionName'}`?
- Check: Server has `if(input.action === 'actionName')`?
- Check: Server updates `data` correctly?

**D. Form Skips Fields**
- Check: All form fields have `ng-model`?
- Check: Client passes field data to server?
- Check: Server receives all expected inputs?

### 3. Search for Issues Across Files

Use native search to find problems:

```bash
# Find all data property references
grep -r "data\." widget_name/

# Find all ng-click methods
grep "ng-click" widget_name/*.html

# Find all server actions
grep "input.action" widget_name/*.server.js

# Find ES6+ violations
grep -E "const |let |=>|\`" widget_name/*.server.js
```

### 4. Validate Widget Coherence

Use coherence validation tool:
```javascript
snow_validate_artifact_coherence({
  sys_id: 'widget_sys_id'
});
```

This checks:
- ✅ All `data.` properties have matching references
- ✅ All `ng-click` methods exist in client
- ✅ All client actions have server handlers
- ✅ Server script is ES5-only
- ✅ No orphaned methods or properties

### 5. Fix Issues

Common fixes:

**Fix A: Missing Server Data Initialization**
```javascript
// BEFORE (broken)
if (input.action === 'loadData') {
  data.items = []; // Only set when action called
}

// AFTER (fixed)
data.items = []; // Always initialize!

if (input.action === 'loadData') {
  // Load data
  data.items.push({...});
}
```

**Fix B: Missing Client Method**
```javascript
// HTML has this
<button ng-click="c.submitForm()">Submit</button>

// But client is missing method - ADD IT:
c.submitForm = function() {
  c.server.get({
    action: 'submit',
    formData: c.formData
  });
};
```

**Fix C: Missing Server Action Handler**
```javascript
// Client sends this action
c.server.get({action: 'deleteItem'});

// But server has no handler - ADD IT:
if (input.action === 'deleteItem') {
  var gr = new GlideRecord('table');
  if (gr.get(input.sys_id)) {
    gr.deleteRecord();
    data.success = true;
  }
}
```

**Fix D: ES6+ Syntax in Server (BREAKS ServiceNow!)**
```javascript
// BEFORE (broken - ES6+)
const items = data.items.filter(item => item.active);
let total = items.reduce((sum, item) => sum + item.value, 0);

// AFTER (fixed - ES5)
var items = [];
for (var i = 0; i < data.items.length; i++) {
  if (data.items[i].active) {
    items.push(data.items[i]);
  }
}
var total = 0;
for (var j = 0; j < items.length; j++) {
  total = total + items[j].value;
}
```

### 6. Test Locally

Before pushing, verify:
1. Server script has no ES6+ syntax
2. All coherence checks pass
3. Data flow is complete: Server → HTML → Client → Server
4. No orphaned code

### 7. Push Fixes Back

```javascript
snow_push_artifact({
  sys_id: 'widget_sys_id'
});
```

### 8. Verify in ServiceNow

1. Open widget in Service Portal
2. Check browser console for errors
3. Test all functionality
4. Verify data displays correctly

## Widget Coherence Debugging Checklist

### Server Script Checks
- [ ] All `data.property` assignments present?
- [ ] All `input.action` handlers implemented?
- [ ] ES5-only syntax (no const/let/arrows)?
- [ ] Data initialized before conditional logic?
- [ ] GlideRecord queries use proper ES5 loops?

### Client Script Checks
- [ ] All HTML `ng-click` methods defined?
- [ ] All methods call `c.server.get({action})`?
- [ ] Client updates `c.data` on response?
- [ ] Angular controller properly structured?
- [ ] No syntax errors in console?

### HTML Template Checks
- [ ] All `{{data.property}}` exist in server?
- [ ] All `ng-click` methods exist in client?
- [ ] All `ng-model` bindings have client properties?
- [ ] CSS classes have matching CSS rules?
- [ ] Angular directives used correctly?

### Data Flow Validation
- [ ] Server initializes data → HTML displays → Client reads
- [ ] Client sends input → Server processes → Data updates
- [ ] All actions have full cycle: Client → Server → Client
- [ ] No broken references or missing handlers

## Common Widget Bugs & Fixes

### Bug: "Widget shows nothing"
**Cause**: Server doesn't initialize `data`
**Fix**: Add data initialization at top of server script
```javascript
// Always initialize data first!
data.title = 'Default Title';
data.items = [];
data.loaded = false;
```

### Bug: "Button click does nothing"
**Cause**: Client method missing or server action not handled
**Fix**: Ensure complete action chain
```javascript
// HTML
<button ng-click="c.doAction()">Click</button>

// Client - MUST exist
c.doAction = function() {
  c.server.get({action: 'performAction'});
};

// Server - MUST handle
if (input.action === 'performAction') {
  // Process action
  data.result = 'Done';
}
```

### Bug: "Data doesn't update after action"
**Cause**: Server doesn't update `data` or client doesn't refresh
**Fix**: Always update `data` in server handler
```javascript
// Server MUST update data
if (input.action === 'refresh') {
  var gr = new GlideRecord('incident');
  gr.query();
  data.items = []; // Clear and rebuild
  while (gr.next()) {
    data.items.push({...});
  }
}
```

### Bug: "Form skips fields"
**Cause**: Fields not bound to ng-model or not sent to server
**Fix**: Ensure complete form binding
```javascript
// HTML - bind all fields
<input ng-model="c.formData.field1" />
<input ng-model="c.formData.field2" />

// Client - send all fields
c.submit = function() {
  c.server.get({
    action: 'submitForm',
    field1: c.formData.field1,
    field2: c.formData.field2
  });
};

// Server - receive all fields
if (input.action === 'submitForm') {
  var gr = new GlideRecord('table');
  gr.initialize();
  gr.setValue('field1', input.field1);
  gr.setValue('field2', input.field2);
  gr.insert();
}
```

### Bug: "SyntaxError in server script"
**Cause**: ES6+ syntax used in server script
**Fix**: Convert all ES6+ to ES5
```javascript
// Find violations
grep -E "const |let |=>|\`|\{.*\}.*=" widget.server.js

// Convert to ES5
const items = [];        → var items = [];
let x = 5;               → var x = 5;
() => {}                 → function() {}
`Hello ${name}`          → 'Hello ' + name
{name, id} = obj         → var name = obj.name; var id = obj.id;
for (let x of arr)       → for (var i = 0; i < arr.length; i++)
arr.map(x => x.id)       → for loop with push
```

## Advanced Debugging Techniques

### Technique 1: Trace Data Flow
Add console logging to trace data:

```javascript
// Client
c.loadData = function() {
  console.log('Client: Requesting data');
  c.server.get({action: 'loadData'}).then(function(response) {
    console.log('Client: Received', response.data);
  });
};

// Server (use gs.print for server-side logging)
if (input.action === 'loadData') {
  gs.print('Server: Loading data');
  // Process data
  gs.print('Server: Returning ' + data.items.length + ' items');
}
```

### Technique 2: Validate All References
Search for potential missing references:

```bash
# Find all data properties set in server
grep "data\\.\\w\\+" widget.server.js

# Find all data properties used in HTML
grep "{{data\\.\\w\\+}}" widget.html

# Find all client methods called in HTML
grep "c\\.\\w\\+(" widget.html

# Find all actions sent to server
grep "action:" widget.client.js
```

### Technique 3: Compare Working vs Broken
If you have a working reference widget:

```bash
# Compare server scripts
diff working_widget.server.js broken_widget.server.js

# Compare client scripts
diff working_widget.client.js broken_widget.client.js

# Look for structural differences
```

## Debugging Decision Tree

```
Widget Issue?
│
├─ Data not displaying?
│  ├─ Check server: data.property initialized?
│  ├─ Check HTML: {{data.property}} correct?
│  └─ Check ES5: No ES6+ syntax?
│
├─ Button not working?
│  ├─ Check HTML: ng-click="c.method()"?
│  ├─ Check client: c.method exists?
│  └─ Check server: input.action handler?
│
├─ Form not submitting?
│  ├─ Check HTML: All ng-model bindings?
│  ├─ Check client: Sends all fields?
│  └─ Check server: Receives all inputs?
│
├─ Syntax error?
│  ├─ Check server: ES5-only?
│  ├─ Check client: Valid Angular?
│  └─ Check HTML: Valid AngularJS?
│
└─ General malfunction?
   ├─ Run coherence validation
   ├─ Check browser console
   ├─ Check ServiceNow logs
   └─ Test each component separately
```

## Tools Summary

**For Debugging:**
- `snow_pull_artifact` - Pull widget to local files (ALWAYS use this!)
- `snow_validate_artifact_coherence` - Validate coherence
- Native search - Find issues across files
- `snow_push_artifact` - Push fixes back

**For Testing:**
- Browser console - Check for JavaScript errors
- ServiceNow logs - Check server-side errors
- `snow_execute_script_with_output` - Test server logic
- Portal preview - Test in actual environment

## Success Criteria

Widget debugging is complete when:
1. ✅ No errors in browser console
2. ✅ All functionality works as expected
3. ✅ Widget coherence validation passes
4. ✅ Server script is ES5-only
5. ✅ All data displays correctly
6. ✅ All buttons/forms work
7. ✅ Data updates properly after actions
8. ✅ Widget tested in actual portal
