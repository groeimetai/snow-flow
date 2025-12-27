# Integration

REST messages, transform maps, and import sets

**Total Tools:** 33 | **Read:** 13 | **Write:** 20

---

## snow_analyze_query

Analyze and optimize ServiceNow queries for performance

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_analyze_query
const result = await snow_analyze_query({
});
```

---

## snow_batch_request

Execute batch REST requests

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_batch_request
const result = await snow_batch_request({
});
```

---

## snow_configure_connection

Configure ServiceNow connection alias

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_configure_connection
const result = await snow_configure_connection({
});
```

---

## snow_configure_mid_server

Configure MID Server settings for on-premise integrations and Discovery

| Property | Value |
|----------|-------|
| Permission | `admin` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | admin |

### Example

```javascript
// Using snow_configure_mid_server
const result = await snow_configure_mid_server({
});
```

---

## snow_create_connection_alias

Create connection alias for IntegrationHub/Flow Designer to reference external credentials

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_connection_alias
const result = await snow_create_connection_alias({
});
```

---

## snow_create_credential_alias

Create credential alias for secure storage of API keys, passwords, and OAuth tokens

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_credential_alias
const result = await snow_create_credential_alias({
});
```

---

## snow_create_email_config

Create email server configuration for SMTP, POP3, or IMAP

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_email_config
const result = await snow_create_email_config({
});
```

---

## snow_create_field_map

Create field mapping within transform map for data transformation

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_field_map
const result = await snow_create_field_map({
});
```

---

## snow_create_flow_action

Create custom IntegrationHub action for Flow Designer

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_flow_action
const result = await snow_create_flow_action({
});
```

---

## snow_create_import_set

Create import set for data import

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_import_set
const result = await snow_create_import_set({
});
```

---

## snow_create_oauth_profile

Create OAuth 2.0 profile for external API authentication (Jira, Azure, Salesforce, etc.)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_oauth_profile
const result = await snow_create_oauth_profile({
});
```

---

## snow_create_rest_message

Create REST message for external API integration

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_rest_message
const result = await snow_create_rest_message({
});
```

---

## snow_create_transform_map

Create transform map for import sets

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_transform_map
const result = await snow_create_transform_map({
});
```

---

## snow_create_web_service

Create SOAP web service integration from WSDL definition

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_web_service
const result = await snow_create_web_service({
});
```

---

## snow_custom_api

Call custom API endpoint

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_custom_api
const result = await snow_custom_api({
});
```

---

## snow_detect_code_patterns

Detect code patterns, anti-patterns, and best practices in ServiceNow scripts

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_detect_code_patterns
const result = await snow_detect_code_patterns({
});
```

---

## snow_discover_data_sources

Discover available data sources for integration including import sets and REST endpoints

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_data_sources
const result = await snow_discover_data_sources({
});
```

---

## snow_discover_integration_endpoints

Discover existing integration endpoints (REST, SOAP, LDAP, EMAIL)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_integration_endpoints
const result = await snow_discover_integration_endpoints({
});
```

---

## snow_execute_transform

Execute transform map on import set

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_execute_transform
const result = await snow_execute_transform({
});
```

---

## snow_export_to_xml

Export records to XML format

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_export_to_xml
const result = await snow_export_to_xml({
});
```

---

## snow_generate_docs

Generate documentation for ServiceNow artifacts

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_generate_docs
const result = await snow_generate_docs({
});
```

---

## snow_graphql_query

Execute GraphQL query

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_graphql_query
const result = await snow_graphql_query({
});
```

---

## snow_install_spoke

Install and manage IntegrationHub Spokes (Jira, Slack, Azure DevOps, etc.)

| Property | Value |
|----------|-------|
| Permission | `admin` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | admin |

### Example

```javascript
// Using snow_install_spoke
const result = await snow_install_spoke({
});
```

---

## snow_manage_mid_capabilities

Manage MID Server capabilities for Discovery, Orchestration, and integrations

| Property | Value |
|----------|-------|
| Permission | `admin` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | admin |

### Example

```javascript
// Using snow_manage_mid_capabilities
const result = await snow_manage_mid_capabilities({
});
```

---

## snow_manage_oauth_tokens

Manage OAuth tokens: view status, refresh tokens, troubleshoot authentication issues

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_manage_oauth_tokens
const result = await snow_manage_oauth_tokens({
});
```

---

## snow_manage_spoke_connection

Manage IntegrationHub spoke connections: configure, test, and troubleshoot

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_manage_spoke_connection
const result = await snow_manage_spoke_connection({
});
```

---

## snow_rest_message_manage

Action to perform

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_rest_message_manage
const result = await snow_rest_message_manage({
});
```

---

## snow_scripted_rest_api

Call scripted REST API

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_scripted_rest_api
const result = await snow_scripted_rest_api({
});
```

---

## snow_test_connection

Test ServiceNow connection

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_test_connection
const result = await snow_test_connection({
});
```

---

## snow_test_integration

Test REST/SOAP integrations and external connections with validation

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_test_integration
const result = await snow_test_integration({
});
```

---

## snow_test_mid_connectivity

Test MID Server connectivity to external endpoints and diagnose network issues

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_test_mid_connectivity
const result = await snow_test_mid_connectivity({
});
```

---

## snow_test_rest_connection

Test REST API connection with timeout and response validation

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_test_rest_connection
const result = await snow_test_rest_connection({
});
```

---

## snow_workflow_analyze

Analyze workflow executions for performance and errors

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_workflow_analyze
const result = await snow_workflow_analyze({
});
```

---

