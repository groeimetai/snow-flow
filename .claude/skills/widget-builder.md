# Service Portal Widget Builder

Build complete, production-ready Service Portal widgets with proper client-server communication and coherence validation.

## When to use this skill

Use this skill when asked to:
- "Create a Service Portal widget"
- "Build a widget for [functionality]"
- "Make a dashboard widget"
- "Develop a Service Portal component"

## What this skill does

Creates a complete Service Portal widget with:
- HTML template with Angular bindings
- Server script with data initialization
- Client controller with methods
- CSS styling
- Widget coherence validation
- Automatic deployment to portal

## Step-by-step workflow

### 0. 🚨 CREATE UPDATE SET FIRST (MANDATORY!)

**BEFORE doing ANYTHING, create an Update Set:**

```javascript
// STEP 0: Create Update Set
const updateSet = await snow_update_set_manage({
  action: 'create',
  name: "Feature: Widget - [Widget Name]",
  description: "Create [widget purpose] widget for Service Portal",
  application: "global"
});

// Verify it's active
const current = await snow_update_set_query({ action: 'current' });
console.log('Active Update Set:', current.name);
```

**✅ Now all widget development will be tracked in this Update Set!**

### 1. Gather Requirements
Ask the user:
- What should the widget display/do?
- Which data sources are needed? (tables, APIs)
- Any specific styling requirements?
- Which portal should it be added to?

### 2. Design Widget Structure
Plan:
- **Data model**: What data properties are needed?
- **User interactions**: What buttons/actions?
- **Server actions**: What input.action handlers?
- **Client methods**: What ng-click methods?

### 3. Create Widget with MCP Tools

```javascript
// Use snow_deploy to create widget
{
  type: 'widget',
  config: {
    name: 'widget_name',
    title: 'Widget Display Title',
    description: 'Widget description',

    // HTML Template - Angular bindings
    template: `
      <div class="panel panel-default">
        <div class="panel-heading">
          <h3>{{data.title}}</h3>
        </div>
        <div class="panel-body">
          <div ng-repeat="item in data.items">
            <button ng-click="c.handleAction(item)"
                    class="btn btn-primary">
              {{item.label}}
            </button>
          </div>
        </div>
      </div>
    `,

    // Server Script - ES5 ONLY!
    server_script: `
      (function() {
        // Initialize data
        data.title = input.title || 'Default Title';
        data.items = [];

        // Handle client actions
        if (input.action === 'loadData') {
          var gr = new GlideRecord('table_name');
          gr.query();
          while (gr.next()) {
            data.items.push({
              sys_id: gr.getValue('sys_id'),
              label: gr.getValue('field_name')
            });
          }
        }
      })();
    `,

    // Client Controller - Angular $scope
    client_script: `
      function($scope) {
        var c = this;

        // Load data on init
        c.$onInit = function() {
          c.server.get({action: 'loadData'}).then(function() {
            console.log('Data loaded');
          });
        };

        // Handle button clicks
        c.handleAction = function(item) {
          alert('Clicked: ' + item.label);
        };
      }
    `,

    // CSS Styling
    css: `
      .panel {
        margin: 20px 0;
      }
      .btn-primary {
        margin: 5px;
      }
    `
  }
}
```

### 4. Validate Widget Coherence

After creation, validate that:
- ✅ Every `data.property` in server has matching `{{data.property}}` in HTML
- ✅ Every `ng-click="methodName()"` in HTML has matching `c.methodName` in client
- ✅ Every `c.server.get({action})` in client has matching `if(input.action)` in server
- ✅ All data flows correctly: Server → HTML → Client → Server

Use `snow_validate_deployment` to check coherence automatically.

### 5. Test Widget

1. Preview widget: Use `snow_preview_widget`
2. Test functionality: Click buttons, check data loading
3. Check console for errors
4. Verify data updates correctly

### 6. Deploy to Portal

Add widget to portal page:
```javascript
// Use snow_update to add widget to page
{
  type: 'portal_page',
  identifier: 'page_name',
  config: {
    widgets: ['widget_name']
  }
}
```

## Critical ES5 Rules for Server Scripts

⚠️ **NEVER use modern JavaScript in server scripts!**

### ❌ WRONG (These BREAK ServiceNow):
```javascript
const data = [];              // SyntaxError
let items = [];               // SyntaxError
const fn = () => {};          // SyntaxError
var msg = `Hello ${name}`;    // SyntaxError
for (let item of items) {}    // SyntaxError
var {name, id} = user;        // SyntaxError
items.map(x => x.id);         // SyntaxError
```

### ✅ CORRECT (ES5 compatible):
```javascript
var data = [];
var items = [];
function fn() { return 'result'; }
var msg = 'Hello ' + name;
for (var i = 0; i < items.length; i++) {
  var item = items[i];
}
var name = user.name;
var id = user.id;
var ids = [];
for (var j = 0; j < items.length; j++) {
  ids.push(items[j].id);
}
```

## Common Widget Patterns

### Data Loading Pattern
```javascript
// Server
if (input.action === 'loadData') {
  var gr = new GlideRecord('incident');
  gr.addQuery('active', true);
  gr.query();
  data.records = [];
  while (gr.next()) {
    data.records.push({
      number: gr.getValue('number'),
      short_description: gr.getValue('short_description')
    });
  }
}

// Client
c.loadData = function() {
  c.server.get({action: 'loadData'}).then(function(response) {
    c.data.records = response.data.records;
  });
};

// HTML
<div ng-repeat="record in data.records">
  {{record.number}}: {{record.short_description}}
</div>
```

### User Input Pattern
```javascript
// Server
if (input.action === 'submitForm') {
  var gr = new GlideRecord('incident');
  gr.initialize();
  gr.setValue('short_description', input.description);
  gr.insert();
  data.success = true;
  data.message = 'Incident created: ' + gr.getDisplayValue();
}

// Client
c.submitForm = function() {
  c.server.get({
    action: 'submitForm',
    description: c.formData.description
  }).then(function(response) {
    if (response.data.success) {
      alert(response.data.message);
    }
  });
};

// HTML
<input ng-model="c.formData.description" class="form-control" />
<button ng-click="c.submitForm()" class="btn btn-primary">
  Submit
</button>
```

## Widget Coherence Checklist

Before finalizing widget, verify:

- [ ] All server `data.` properties are used in HTML or client
- [ ] All HTML `{{data.}}` references exist in server script
- [ ] All HTML `ng-click` methods exist in client controller
- [ ] All client `c.server.get({action})` have server handlers
- [ ] Server script is ES5-only (no const/let/arrows/template literals)
- [ ] CSS classes in HTML have matching CSS rules
- [ ] No orphaned methods or unused data properties
- [ ] Widget tested in actual portal environment

## Example: Incident Dashboard Widget

Complete example:

```javascript
// Use snow_deploy
{
  type: 'widget',
  config: {
    name: 'incident_dashboard',
    title: 'Incident Dashboard',
    description: 'Display active incidents with priority breakdown',

    template: `
      <div class="incident-dashboard">
        <h2>{{data.title}}</h2>
        <div class="stats">
          <div class="stat-box priority-1">
            <h3>{{data.stats.p1}}</h3>
            <p>Critical</p>
          </div>
          <div class="stat-box priority-2">
            <h3>{{data.stats.p2}}</h3>
            <p>High</p>
          </div>
          <div class="stat-box priority-3">
            <h3>{{data.stats.p3}}</h3>
            <p>Medium</p>
          </div>
        </div>
        <button ng-click="c.refresh()" class="btn btn-primary">
          Refresh
        </button>
      </div>
    `,

    server_script: `
      (function() {
        data.title = 'Active Incidents';
        data.stats = {p1: 0, p2: 0, p3: 0};

        if (input.action === 'loadStats' || !input.action) {
          var gr = new GlideRecord('incident');
          gr.addQuery('active', true);
          gr.query();

          while (gr.next()) {
            var priority = gr.getValue('priority');
            if (priority === '1') data.stats.p1++;
            else if (priority === '2') data.stats.p2++;
            else if (priority === '3') data.stats.p3++;
          }
        }
      })();
    `,

    client_script: `
      function($scope) {
        var c = this;

        c.refresh = function() {
          c.server.get({action: 'loadStats'}).then(function() {
            console.log('Stats refreshed');
          });
        };
      }
    `,

    css: `
      .incident-dashboard {
        padding: 20px;
      }
      .stats {
        display: flex;
        gap: 20px;
      }
      .stat-box {
        flex: 1;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
      }
      .priority-1 {
        background: #d32f2f;
        color: white;
      }
      .priority-2 {
        background: #f57c00;
        color: white;
      }
      .priority-3 {
        background: #fbc02d;
      }
    `
  }
}
```

## Troubleshooting

**Widget doesn't load:**
- Check browser console for errors
- Verify server script has no ES6+ syntax
- Check `data` initialization in server

**Data not displaying:**
- Verify `data.property` exists in server
- Check HTML uses correct `{{data.property}}` syntax
- Ensure client controller is properly defined

**Button clicks don't work:**
- Verify method exists: `c.methodName` in client
- Check HTML: `ng-click="c.methodName()"`
- Ensure server has matching action handler

**Coherence errors:**
- Run `snow_validate_deployment` for automatic checks
- Review Widget Coherence Checklist
- Verify data flow: Server → HTML → Client → Server

## Success Criteria

Widget is complete when:
1. ✅ Update Set created and active
2. ✅ All functionality works as expected
3. ✅ No console errors in browser
4. ✅ Widget coherence validation passes
5. ✅ Server script is ES5-only
6. ✅ Deployed to correct portal
7. ✅ User can interact with all features
8. ✅ Data updates correctly
9. ✅ Styling looks professional

### Final Step: Complete Update Set

```javascript
// Mark Update Set as complete
await snow_update_set_manage({
  action: 'complete',
  update_set_id: updateSet.sys_id,
  state: 'complete'
});

console.log('✅ Widget development complete and tracked in Update Set!');
```
