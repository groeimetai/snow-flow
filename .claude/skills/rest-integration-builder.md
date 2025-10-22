# REST API Integration Builder

Build complete REST API integrations with ServiceNow including inbound/outbound APIs, authentication, error handling, and data transformation.

## When to use this skill

Use when asked to:
- "Integrate with external API"
- "Create REST integration"
- "Build webhook receiver"
- "Send data to external system"
- "Consume third-party API"

## What this skill does

Creates comprehensive REST integrations with:
- REST API configuration (methods, endpoints, headers)
- Authentication (Basic, OAuth 2.0, API keys)
- Request/response transformation
- Error handling and retry logic
- Inbound webhook receivers
- Outbound API calls

## Integration Types

**Outbound:** ServiceNow calls external APIs
**Inbound:** External systems call ServiceNow APIs

## Step-by-step Workflow

### 0. 🚨 CREATE UPDATE SET FIRST (MANDATORY!)

**BEFORE creating anything, create an Update Set:**

```javascript
// STEP 0: Create Update Set
const updateSet = await snow_update_set_manage({
  action: 'create',
  name: "Feature: REST Integration - [Name]",
  description: "Create REST integration for [purpose]",
  application: "global"
});

// Verify it's active
const current = await snow_update_set_query({ action: 'current' });
console.log('Active Update Set:', current.name);
```

**✅ Now all development will be tracked in this Update Set!**

### 1. Gather Requirements

Ask user:
- What system to integrate with?
- Authentication method?
- What data to send/receive?
- When should integration trigger?
- Error handling requirements?

### 2. Create Outbound REST Integration

**Step A: Create REST Message**

```javascript
// Use snow_create_rest_message
{
  name: 'Slack Notification API',
  description: 'Send notifications to Slack channels',
  endpoint: 'https://hooks.slack.com/services/',

  // Authentication
  authentication_type: 'no_authentication',  // Use webhook URL instead

  // HTTP Methods
  http_methods: [
    {
      name: 'post_message',
      http_method: 'POST',
      endpoint: '${webhook_path}',  // Variable endpoint

      // Headers
      headers: {
        'Content-Type': 'application/json'
      },

      // Request body template
      content: `{
        "channel": "\${channel}",
        "username": "ServiceNow",
        "text": "\${message}",
        "icon_emoji": ":robot_face:"
      }`
    }
  ]
}
```

**Step B: Create Script to Call REST API**

```javascript
{
  name: 'Send Slack Notification',
  script: `
    function sendSlackNotification(channel, message) {
      try {
        // Get Slack webhook URL from system property
        var webhookPath = gs.getProperty('slack.webhook.path');

        if (!webhookPath) {
          gs.error('Slack webhook not configured');
          return false;
        }

        // Create REST message
        var request = new sn_ws.RESTMessageV2('Slack Notification API', 'post_message');

        // Set variable substitutions
        request.setStringParameterNoEscape('webhook_path', webhookPath);
        request.setStringParameterNoEscape('channel', channel);
        request.setStringParameterNoEscape('message', message);

        // Execute request
        var response = request.execute();
        var statusCode = response.getStatusCode();

        if (statusCode == 200) {
          gs.info('Slack notification sent successfully to ' + channel);
          return true;
        } else {
          gs.error('Slack API error: ' + statusCode + ' - ' + response.getBody());
          return false;
        }

      } catch (e) {
        gs.error('Error sending Slack notification: ' + e.message);
        return false;
      }
    }

    // Usage example
    sendSlackNotification('#incidents', 'New P1 incident created: INC0012345');
  `
}
```

### 3. OAuth 2.0 Authentication

```javascript
{
  name: 'OAuth 2.0 REST Integration',
  endpoint: 'https://api.example.com',
  authentication_type: 'oauth2',

  // OAuth configuration
  oauth_config: {
    oauth_profile: 'Example API OAuth',
    token_url: 'https://api.example.com/oauth/token',
    client_id: '${example.api.client_id}',  // From sys_properties
    client_secret: '${example.api.client_secret}',
    scope: 'read write',
    grant_type: 'client_credentials'
  },

  http_methods: [
    {
      name: 'get_users',
      http_method: 'GET',
      endpoint: '/api/v1/users',

      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ${access_token}'  // Auto-managed by OAuth
      }
    }
  ]
}
```

**Script to call OAuth API:**

```javascript
{
  script: `
    function getUsersFromAPI() {
      try {
        var request = new sn_ws.RESTMessageV2('OAuth 2.0 REST Integration', 'get_users');

        // OAuth token is automatically managed
        var response = request.execute();
        var statusCode = response.getStatusCode();

        if (statusCode == 200) {
          var body = response.getBody();
          var users = JSON.parse(body);

          gs.info('Retrieved ' + users.length + ' users from API');
          return users;

        } else if (statusCode == 401) {
          // Token expired - will auto-refresh on next call
          gs.warn('OAuth token expired, will refresh on retry');
          return null;

        } else {
          gs.error('API error: ' + statusCode + ' - ' + response.getBody());
          return null;
        }

      } catch (e) {
        gs.error('Error calling API: ' + e.message);
        return null;
      }
    }
  `
}
```

### 4. API Error Handling and Retry Logic

```javascript
{
  name: 'Resilient API Call with Retry',
  script: `
    function callAPIWithRetry(restMessage, httpMethod, maxRetries) {
      maxRetries = maxRetries || 3;
      var retryDelay = 2000;  // 2 seconds

      for (var attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          var request = new sn_ws.RESTMessageV2(restMessage, httpMethod);
          var response = request.execute();
          var statusCode = response.getStatusCode();

          // Success
          if (statusCode >= 200 && statusCode < 300) {
            gs.info('API call successful on attempt ' + attempt);
            return {
              success: true,
              statusCode: statusCode,
              body: response.getBody(),
              headers: response.getHeaders()
            };
          }

          // Retry on server errors (5xx)
          if (statusCode >= 500 && attempt < maxRetries) {
            gs.warn('API returned ' + statusCode + ', retrying in ' +
                    (retryDelay / 1000) + 's (attempt ' + attempt + '/' + maxRetries + ')');
            gs.sleep(retryDelay);
            retryDelay *= 2;  // Exponential backoff
            continue;
          }

          // Client error (4xx) - don't retry
          if (statusCode >= 400 && statusCode < 500) {
            gs.error('API client error ' + statusCode + ': ' + response.getBody());
            return {
              success: false,
              statusCode: statusCode,
              error: response.getBody()
            };
          }

        } catch (e) {
          gs.error('API call exception on attempt ' + attempt + ': ' + e.message);

          if (attempt < maxRetries) {
            gs.sleep(retryDelay);
            retryDelay *= 2;
          }
        }
      }

      // All retries failed
      gs.error('API call failed after ' + maxRetries + ' attempts');
      return {
        success: false,
        error: 'Max retries exceeded'
      };
    }

    // Usage
    var result = callAPIWithRetry('My REST Message', 'get_data', 3);
    if (result.success) {
      gs.info('Data: ' + result.body);
    }
  `
}
```

### 5. Inbound REST API (Webhook Receiver)

**Step A: Create Scripted REST API**

```javascript
// Use snow_create_rest_api
{
  name: 'Incident Webhook API',
  api_id: 'incident_webhook',
  base_path: '/api/now/incident_webhook',

  resources: [
    {
      name: 'Create Incident',
      http_method: 'POST',
      relative_path: '/create',

      script: `
        (function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {

          try {
            // Parse request body
            var requestBody = request.body.data;

            // Validate required fields
            if (!requestBody.short_description) {
              response.setStatus(400);
              response.setBody({
                error: 'short_description is required'
              });
              return;
            }

            // Create incident
            var incident = new GlideRecord('incident');
            incident.initialize();
            incident.short_description = requestBody.short_description;
            incident.description = requestBody.description || '';
            incident.caller_id = requestBody.caller_id || '';
            incident.category = requestBody.category || 'inquiry';
            incident.priority = requestBody.priority || '3';

            // Set custom fields from webhook
            if (requestBody.external_id) {
              incident.u_external_id = requestBody.external_id;
            }

            var sysId = incident.insert();

            if (sysId) {
              // Success response
              response.setStatus(201);
              response.setBody({
                success: true,
                sys_id: sysId,
                number: incident.getValue('number'),
                message: 'Incident created successfully'
              });

              gs.info('Incident created via webhook: ' + incident.number);

            } else {
              response.setStatus(500);
              response.setBody({
                error: 'Failed to create incident'
              });
            }

          } catch (e) {
            gs.error('Webhook error: ' + e.message);
            response.setStatus(500);
            response.setBody({
              error: 'Internal server error: ' + e.message
            });
          }

        })(request, response);
      `
    },

    {
      name: 'Update Incident',
      http_method: 'PUT',
      relative_path: '/update/{sys_id}',

      script: `
        (function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {

          try {
            var sysId = request.pathParams.sys_id;
            var requestBody = request.body.data;

            // Find incident
            var incident = new GlideRecord('incident');
            if (!incident.get(sysId)) {
              response.setStatus(404);
              response.setBody({
                error: 'Incident not found'
              });
              return;
            }

            // Update fields
            if (requestBody.short_description) {
              incident.short_description = requestBody.short_description;
            }
            if (requestBody.description) {
              incident.description = requestBody.description;
            }
            if (requestBody.state) {
              incident.state = requestBody.state;
            }

            incident.update();

            response.setStatus(200);
            response.setBody({
              success: true,
              sys_id: sysId,
              number: incident.getValue('number'),
              message: 'Incident updated successfully'
            });

          } catch (e) {
            gs.error('Webhook update error: ' + e.message);
            response.setStatus(500);
            response.setBody({
              error: 'Internal server error: ' + e.message
            });
          }

        })(request, response);
      `
    }
  ]
}
```

### 6. Webhook Authentication

**API Key Authentication:**

```javascript
{
  name: 'Secure Webhook with API Key',
  resource_script: `
    (function process(request, response) {

      // Validate API key from header
      var apiKey = request.getHeader('X-API-Key');
      var expectedKey = gs.getProperty('webhook.api.key');

      if (!apiKey || apiKey != expectedKey) {
        response.setStatus(401);
        response.setBody({
          error: 'Unauthorized - Invalid API key'
        });
        return;
      }

      // API key valid - process request
      var requestBody = request.body.data;

      // ... rest of webhook logic ...

    })(request, response);
  `
}
```

### 7. Data Transformation

**Transform incoming webhook data:**

```javascript
{
  name: 'Transform External Data to ServiceNow',
  script: `
    function transformWebhookData(externalData) {
      // Map external system fields to ServiceNow fields
      var transformed = {
        short_description: externalData.title || externalData.summary,
        description: externalData.details || externalData.body,
        priority: mapPriority(externalData.severity),
        category: mapCategory(externalData.type),
        u_external_id: externalData.id,
        u_external_system: 'External System Name'
      };

      // Map priority
      function mapPriority(severity) {
        var priorityMap = {
          'critical': '1',
          'high': '2',
          'medium': '3',
          'low': '4'
        };
        return priorityMap[severity] || '3';
      }

      // Map category
      function mapCategory(type) {
        var categoryMap = {
          'bug': 'software',
          'feature': 'inquiry',
          'support': 'request'
        };
        return categoryMap[type] || 'inquiry';
      }

      return transformed;
    }

    // Usage in webhook
    var externalData = request.body.data;
    var snowData = transformWebhookData(externalData);

    var incident = new GlideRecord('incident');
    incident.initialize();
    for (var field in snowData) {
      incident.setValue(field, snowData[field]);
    }
    incident.insert();
  `
}
```

### 8. Asynchronous Integration with Events

```javascript
{
  name: 'Async API Call via Event',

  // Business Rule: Trigger event
  trigger_script: `
    (function executeRule(current, previous) {
      // Fire event when incident is closed
      if (current.state == 6 && current.state.changes()) {
        gs.eventQueue('incident.closed.notify_external', current);
      }
    })(current, previous);
  `,

  // Script Action: Process event asynchronously
  event_script: `
    (function executeEvent(/*GlideRecord*/ current, /*GlideRecord*/ event) {

      try {
        // Call external API to notify about closure
        var request = new sn_ws.RESTMessageV2('External System API', 'close_ticket');

        request.setStringParameter('ticket_id', current.u_external_id);
        request.setStringParameter('resolution', current.close_notes);
        request.setStringParameter('resolved_by', current.resolved_by.getDisplayValue());

        var response = request.execute();

        if (response.getStatusCode() == 200) {
          // Update incident with external reference
          var incident = new GlideRecord('incident');
          if (incident.get(current.sys_id)) {
            incident.u_external_sync_status = 'synced';
            incident.u_external_sync_date = new GlideDateTime();
            incident.setWorkflow(false);
            incident.update();
          }

          gs.info('Incident ' + current.number + ' synced to external system');
        } else {
          gs.error('Failed to sync incident to external system: ' +
                   response.getStatusCode() + ' - ' + response.getBody());
        }

      } catch (e) {
        gs.error('Event processing error: ' + e.message);
      }

    })(current, event);
  `
}
```

## REST Integration Best Practices

### Security
- Always use HTTPS for sensitive data
- Store credentials in system properties (encrypted)
- Validate API keys/tokens in webhooks
- Use OAuth 2.0 when available
- Never log sensitive data (tokens, passwords)

### Error Handling
- Implement retry logic with exponential backoff
- Log all errors with context
- Return meaningful error messages
- Handle timeout scenarios
- Monitor integration health

### Performance
- Use async events for non-critical calls
- Implement request throttling if needed
- Cache responses when appropriate
- Batch requests when API supports it
- Set reasonable timeouts

### Monitoring
- Log all API calls (request/response)
- Track success/failure rates
- Monitor response times
- Alert on repeated failures
- Document API limits and quotas

## Success Criteria

REST integration is complete when:
1. ✅ Authentication works correctly
2. ✅ Request/response transformation implemented
3. ✅ Error handling and retry logic in place
4. ✅ Logging comprehensive
5. ✅ Security best practices followed
6. ✅ Performance acceptable
7. ✅ Tested with real API
8. ✅ Documentation complete


### Final Step: Complete Update Set

```javascript
// After REST integration creation, complete the Update Set
await snow_update_set_manage({
  action: "complete",
  update_set_id: updateSet.sys_id,
  state: "complete"
});

console.log("✅ REST Integration complete and tracked in Update Set!");
```
