# Data Import & Export Builder

Build complete data import/export workflows with transform maps, data cleansing, validation, and error handling.

## When to use this skill

Use when asked to:
- "Import data from CSV/Excel"
- "Bulk load records"
- "Create import set"
- "Export data to file"
- "Migrate data between instances"

## What this skill does

Creates data import/export workflows with:
- Import set configuration
- Transform maps with field mapping
- Data validation and cleansing
- Error handling and rollback
- Scheduled imports
- Data export to CSV/Excel/XML

## Import Process Flow

1. **Staging** - Load data into import set table
2. **Transform** - Map import data to target table
3. **Validate** - Check data quality and constraints
4. **Load** - Insert/update target records
5. **Cleanup** - Handle errors and mark complete

## Step-by-step Workflow

### 1. Gather Requirements

Ask user:
- What data source? (CSV, Excel, REST API, database)
- What target table in ServiceNow?
- Field mappings needed?
- Data validation rules?
- Update existing records or insert only?
- How often to import? (one-time, scheduled)

### 2. Create Import Set Table

```javascript
// Use snow_create_import_set_table
{
  name: 'u_import_employees',
  label: 'Import Employees',

  fields: [
    {name: 'u_employee_id', type: 'string', max_length: 40},
    {name: 'u_first_name', type: 'string', max_length: 100},
    {name: 'u_last_name', type: 'string', max_length: 100},
    {name: 'u_email', type: 'string', max_length: 100},
    {name: 'u_department', type: 'string', max_length: 100},
    {name: 'u_title', type: 'string', max_length: 100},
    {name: 'u_manager_id', type: 'string', max_length: 40},
    {name: 'u_start_date', type: 'string', max_length: 20},
    {name: 'u_status', type: 'string', max_length: 20}
  ]
}
```

### 3. Create Transform Map

```javascript
{
  name: 'Employee Import Transform',
  source_table: 'u_import_employees',
  target_table: 'sys_user',

  // Coalesce on employee ID to update existing records
  coalesce_fields: ['employee_number'],

  // Field mappings
  field_maps: [
    {
      source: 'u_first_name',
      target: 'first_name',
      coalesce: false
    },
    {
      source: 'u_last_name',
      target: 'last_name',
      coalesce: false
    },
    {
      source: 'u_email',
      target: 'email',
      coalesce: false
    },
    {
      source: 'u_employee_id',
      target: 'employee_number',
      coalesce: true
    },
    {
      source: 'u_title',
      target: 'title',
      coalesce: false
    }
  ],

  // Transform script for complex mappings
  script: `
    (function runTransformScript(source, map, log, target /*undefined onStart*/) {

      // Complex field transformations

      // 1. Map department name to department sys_id
      if (source.u_department) {
        var dept = new GlideRecord('cmn_department');
        dept.addQuery('name', source.u_department);
        dept.query();

        if (dept.next()) {
          target.department = dept.sys_id;
        } else {
          // Create department if doesn't exist
          var newDept = new GlideRecord('cmn_department');
          newDept.initialize();
          newDept.name = source.u_department;
          var deptId = newDept.insert();
          target.department = deptId;

          log.info('Created new department: ' + source.u_department);
        }
      }

      // 2. Map manager by employee ID
      if (source.u_manager_id) {
        var manager = new GlideRecord('sys_user');
        manager.addQuery('employee_number', source.u_manager_id);
        manager.query();

        if (manager.next()) {
          target.manager = manager.sys_id;
        } else {
          log.warn('Manager not found: ' + source.u_manager_id);
        }
      }

      // 3. Parse and validate date
      if (source.u_start_date) {
        try {
          // Convert MM/DD/YYYY to YYYY-MM-DD
          var dateParts = source.u_start_date.split('/');
          if (dateParts.length == 3) {
            var year = dateParts[2];
            var month = dateParts[0].padStart(2, '0');
            var day = dateParts[1].padStart(2, '0');
            target.u_hire_date = year + '-' + month + '-' + day;
          }
        } catch (e) {
          log.error('Invalid date format: ' + source.u_start_date);
        }
      }

      // 4. Set user status based on import status
      if (source.u_status == 'Active') {
        target.active = true;
      } else if (source.u_status == 'Inactive') {
        target.active = false;
      }

      // 5. Generate username from email
      if (source.u_email && !target.user_name) {
        target.user_name = source.u_email.split('@')[0];
      }

      // 6. Set default values
      if (!target.time_zone) {
        target.time_zone = 'US/Pacific';
      }

      log.info('Transformed employee: ' + source.u_employee_id);

    })(source, map, log, target);
  `
}
```

### 4. Data Validation Script

```javascript
{
  name: 'Validate Import Data',

  // onBefore script - validates before transformation
  script: `
    (function onBefore(source, map, log) {

      var errors = [];

      // Validate required fields
      if (!source.u_employee_id) {
        errors.push('Employee ID is required');
      }

      if (!source.u_email) {
        errors.push('Email is required');
      } else {
        // Validate email format
        var emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!emailRegex.test(source.u_email)) {
          errors.push('Invalid email format: ' + source.u_email);
        }
      }

      if (!source.u_first_name || !source.u_last_name) {
        errors.push('First and last name are required');
      }

      // Validate date format
      if (source.u_start_date) {
        var dateRegex = /^\\d{1,2}\\/\\d{1,2}\\/\\d{4}$/;
        if (!dateRegex.test(source.u_start_date)) {
          errors.push('Invalid date format (expected MM/DD/YYYY): ' + source.u_start_date);
        }
      }

      // Check for duplicate email
      var existingUser = new GlideRecord('sys_user');
      existingUser.addQuery('email', source.u_email);
      existingUser.addQuery('employee_number', '!=', source.u_employee_id);
      existingUser.query();

      if (existingUser.hasNext()) {
        errors.push('Email already in use by another user');
      }

      // If errors found, mark import row as error
      if (errors.length > 0) {
        source.import_set_run.state = 'error';
        source.import_set_run.error_message = errors.join('; ');
        source.import_set_run.update();

        log.error('Validation failed: ' + errors.join('; '));
        return false;  // Skip transformation
      }

      return true;  // Continue with transformation

    })(source, map, log);
  `
}
```

### 5. Import Data from File

```javascript
// Load CSV file via Import Sets
{
  action: 'load_data',

  // Method 1: Via UI (manual)
  steps: [
    '1. Navigate to System Import Sets > Load Data',
    '2. Select import set table: u_import_employees',
    '3. Upload CSV file',
    '4. Map columns (auto-detect or manual)',
    '5. Click "Upload"'
  ],

  // Method 2: Automated via REST API
  rest_import: {
    endpoint: '/api/now/import/{tableName}',
    method: 'POST',
    body: {
      format: 'csv',
      content: '/* Base64 encoded CSV data */'
    }
  },

  // Method 3: Scheduled import from SFTP/shared drive
  scheduled_import: {
    type: 'Data Source',
    format: 'CSV',
    import_set_table: 'u_import_employees',
    file_path: '/imports/employees.csv',
    schedule: 'Daily at 2:00 AM'
  }
}
```

### 6. Transform and Load Data

```javascript
{
  name: 'Run Transform Map',
  script: `
    function transformImportSet(importSetSysId) {

      // Get import set run
      var importRun = new GlideRecord('sys_import_set_run');
      if (!importRun.get(importSetSysId)) {
        gs.error('Import set run not found');
        return false;
      }

      // Get transform map
      var transformMap = new GlideRecord('sys_transform_map');
      transformMap.addQuery('source_table', importRun.import_set);
      transformMap.addQuery('active', true);
      transformMap.query();

      if (!transformMap.next()) {
        gs.error('No active transform map found for table: ' + importRun.import_set);
        return false;
      }

      // Run transformation
      var transformer = new GlideImportSetTransformer();
      transformer.setTransformMap(transformMap.sys_id);
      transformer.transformAllRecords();

      // Check results
      var stats = {
        total: 0,
        inserted: 0,
        updated: 0,
        error: 0,
        ignored: 0
      };

      var rows = new GlideRecord(importRun.import_set);
      rows.addQuery('sys_import_set', importSetSysId);
      rows.query();

      while (rows.next()) {
        stats.total++;
        var state = rows.getValue('sys_import_state');

        if (state == 'inserted') stats.inserted++;
        else if (state == 'updated') stats.updated++;
        else if (state == 'error') stats.error++;
        else if (state == 'ignored') stats.ignored++;
      }

      gs.info('Import complete - Total: ' + stats.total +
              ', Inserted: ' + stats.inserted +
              ', Updated: ' + stats.updated +
              ', Errors: ' + stats.error +
              ', Ignored: ' + stats.ignored);

      return stats;
    }
  `
}
```

### 7. Export Data to CSV

```javascript
{
  name: 'Export Incidents to CSV',
  script: `
    function exportIncidentsToCsv(query, fields) {

      var csv = '';
      var separator = ',';

      // Default fields if not specified
      if (!fields) {
        fields = ['number', 'priority', 'state', 'short_description',
                  'assigned_to', 'opened_at', 'closed_at'];
      }

      // Build CSV header
      csv = fields.join(separator) + '\\n';

      // Query incidents
      var gr = new GlideRecord('incident');
      if (query) {
        gr.addEncodedQuery(query);
      }
      gr.query();

      var rowCount = 0;

      // Build CSV rows
      while (gr.next()) {
        var row = [];

        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          var value = gr.getDisplayValue(field) || '';

          // Escape quotes and wrap in quotes if contains comma
          value = value.replace(/"/g, '""');
          if (value.indexOf(',') > -1 || value.indexOf('\\n') > -1) {
            value = '"' + value + '"';
          }

          row.push(value);
        }

        csv += row.join(separator) + '\\n';
        rowCount++;
      }

      gs.info('Exported ' + rowCount + ' incidents to CSV');

      return csv;
    }

    // Usage
    var csvData = exportIncidentsToCsv('priority<=2^active=true',
                                       ['number', 'short_description', 'priority']);

    // Save to attachment or return via REST API
  `
}
```

### 8. Error Handling and Rollback

```javascript
{
  name: 'Handle Import Errors',
  script: `
    function reviewImportErrors(importSetSysId) {

      var errors = [];

      // Find error rows
      var importRows = new GlideRecord('u_import_employees');
      importRows.addQuery('sys_import_set', importSetSysId);
      importRows.addQuery('sys_import_state', 'error');
      importRows.query();

      while (importRows.next()) {
        errors.push({
          row: importRows.getValue('sys_import_row'),
          employee_id: importRows.getValue('u_employee_id'),
          error: importRows.getValue('sys_import_state_comment')
        });
      }

      gs.info('Found ' + errors.length + ' import errors');

      return errors;
    }

    function rollbackImport(importSetSysId) {

      // Find all records created/updated by this import
      var importRows = new GlideRecord('u_import_employees');
      importRows.addQuery('sys_import_set', importSetSysId);
      importRows.addQuery('sys_import_state', 'IN', 'inserted,updated');
      importRows.query();

      var rollbackCount = 0;

      while (importRows.next()) {
        var targetSysId = importRows.getValue('sys_target_sys_id');

        if (targetSysId) {
          var targetRecord = new GlideRecord('sys_user');
          if (targetRecord.get(targetSysId)) {

            // Delete if inserted, revert if updated
            if (importRows.sys_import_state == 'inserted') {
              targetRecord.deleteRecord();
              rollbackCount++;
            } else if (importRows.sys_import_state == 'updated') {
              // Revert to previous values (requires audit history)
              // ... implementation depends on requirements ...
            }
          }
        }
      }

      gs.info('Rolled back ' + rollbackCount + ' records');
      return rollbackCount;
    }
  `
}
```

## Data Import Best Practices

### Data Quality
- Validate data before transformation
- Cleanse data (trim whitespace, standardize formats)
- Handle missing/null values gracefully
- Check for duplicates before insert

### Performance
- Import in batches (1000-5000 records)
- Use coalesce for updates vs inserts
- Avoid complex queries in transform scripts
- Schedule large imports during off-peak hours

### Error Handling
- Log all errors with context
- Provide meaningful error messages
- Don't fail entire import on single row error
- Enable import rollback if needed

### Security
- Validate user permissions
- Sanitize input data (SQL injection, XSS)
- Don't import sensitive data in plain text
- Audit import activity

## Common Import Patterns

**One-time bulk load:**
1. Create import set table
2. Load CSV file
3. Transform with validation
4. Review errors
5. Complete import

**Scheduled daily import:**
1. Configure data source (SFTP/REST)
2. Create transform map
3. Schedule daily job
4. Monitor for failures
5. Alert on errors

**Real-time API import:**
1. Create inbound REST API
2. Validate and stage data
3. Transform on-demand
4. Return success/failure

## Success Criteria

Data import is complete when:
1. ✅ Import set table created
2. ✅ Transform map configured
3. ✅ Field mappings correct
4. ✅ Validation rules implemented
5. ✅ Error handling in place
6. ✅ Test import successful
7. ✅ Production data loaded
8. ✅ Import documented
