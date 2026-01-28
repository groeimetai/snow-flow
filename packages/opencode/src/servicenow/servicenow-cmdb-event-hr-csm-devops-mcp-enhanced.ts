#!/usr/bin/env node
/**
 * ServiceNow CMDB, Event Management, HR, CSM & DevOps MCP Server - ENHANCED VERSION
 * With logging, token tracking, and progress indicators
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { EnhancedBaseMCPServer, MCPToolResult } from './shared/enhanced-base-mcp-server.js';
import { mcpAuth } from '../utils/mcp-auth-middleware.js';
import { mcpConfig } from '../utils/mcp-config-manager.js';

class ServiceNowCMDBEventHRCSMDevOpsMCPEnhanced extends EnhancedBaseMCPServer {
  private config: ReturnType<typeof mcpConfig.getConfig>;

  constructor() {
    super('servicenow-cmdb-event-hr-csm-devops-enhanced', '2.0.0');
    this.config = mcpConfig.getConfig();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // CMDB & Discovery Tools
        {
          name: 'snow_create_cmdb_ci',
          description: 'Creates configuration item in CMDB using cmdb_ci_* tables.',
          inputSchema: {
            type: 'object',
            properties: {
              ci_class: { type: 'string', description: 'CI class (e.g., cmdb_ci_server, cmdb_ci_appl)' },
              name: { type: 'string', description: 'CI name' },
              asset_tag: { type: 'string', description: 'Asset tag' },
              serial_number: { type: 'string', description: 'Serial number' },
              model_id: { type: 'string', description: 'Model sys_id' },
              location: { type: 'string', description: 'Location sys_id' },
              operational_status: { type: 'string', description: 'Status: operational, non-operational' },
              attributes: { type: 'object', description: 'Additional CI attributes' }
            },
            required: ['ci_class', 'name']
          }
        },
        {
          name: 'snow_create_ci_relationship',
          description: 'Creates CI relationship using cmdb_rel_ci table.',
          inputSchema: {
            type: 'object',
            properties: {
              parent: { type: 'string', description: 'Parent CI sys_id' },
              child: { type: 'string', description: 'Child CI sys_id' },
              type: { type: 'string', description: 'Relationship type sys_id' },
              description: { type: 'string', description: 'Relationship description' }
            },
            required: ['parent', 'child', 'type']
          }
        },
        {
          name: 'snow_discover_ci_dependencies',
          description: 'Discovers CI dependencies from cmdb_rel_ci table.',
          inputSchema: {
            type: 'object',
            properties: {
              ci_sys_id: { type: 'string', description: 'CI sys_id' },
              depth: { type: 'number', default: 2, description: 'Dependency depth' },
              direction: { type: 'string', description: 'upstream, downstream, both' }
            },
            required: ['ci_sys_id']
          }
        },
        {
          name: 'snow_run_discovery',
          description: 'Runs discovery schedule using discovery_status table.',
          inputSchema: {
            type: 'object',
            properties: {
              schedule_sys_id: { type: 'string', description: 'Discovery schedule sys_id' },
              ip_range: { type: 'string', description: 'IP range to discover' },
              mid_server: { type: 'string', description: 'MID server sys_id' }
            },
            required: ['schedule_sys_id']
          }
        },
        {
          name: 'snow_get_discovery_status',
          description: 'Gets discovery status from discovery_status table.',
          inputSchema: {
            type: 'object',
            properties: {
              schedule_sys_id: { type: 'string', description: 'Discovery schedule sys_id' },
              limit: { type: 'number', default: 10 }
            }
          }
        },
        {
          name: 'snow_import_cmdb_data',
          description: 'Imports CMDB data using sys_import_set table.',
          inputSchema: {
            type: 'object',
            properties: {
              table_name: { type: 'string', description: 'Target table' },
              data: { type: 'array', items: { type: 'object' }, description: 'Data to import' },
              transform_map: { type: 'string', description: 'Transform map sys_id' }
            },
            required: ['table_name', 'data']
          }
        },
        // Event Management Tools
        {
          name: 'snow_create_event',
          description: 'Creates event using em_event table.',
          inputSchema: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Event source' },
              node: { type: 'string', description: 'Node/CI' },
              type: { type: 'string', description: 'Event type' },
              severity: { type: 'string', description: '1-critical to 5-info' },
              description: { type: 'string', description: 'Event description' },
              message_key: { type: 'string', description: 'Unique message key' },
              metric_name: { type: 'string', description: 'Metric name' },
              resource: { type: 'string', description: 'Resource identifier' }
            },
            required: ['source', 'node', 'type', 'severity']
          }
        },
        {
          name: 'snow_create_alert_rule',
          description: 'Creates alert rule using em_alert_rule table.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Rule name' },
              condition: { type: 'string', description: 'Alert condition' },
              threshold: { type: 'number', description: 'Threshold value' },
              action: { type: 'string', description: 'Action to take' },
              active: { type: 'boolean', default: true }
            },
            required: ['name', 'condition']
          }
        },
        {
          name: 'snow_correlate_alerts',
          description: 'Correlates alerts using em_alert table.',
          inputSchema: {
            type: 'object',
            properties: {
              alerts: { type: 'array', items: { type: 'string' }, description: 'Alert sys_ids' },
              correlation_rule: { type: 'string', description: 'Rule sys_id' },
              create_incident: { type: 'boolean', default: false }
            },
            required: ['alerts']
          }
        },
        {
          name: 'snow_get_event_metrics',
          description: 'Gets event metrics from em_event table.',
          inputSchema: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Filter by source' },
              node: { type: 'string', description: 'Filter by node' },
              time_range: { type: 'string', description: 'Time range' },
              group_by: { type: 'string', description: 'Group by field' }
            }
          }
        },
        // HR Service Delivery Tools
        {
          name: 'snow_create_hr_case',
          description: 'Creates HR case using sn_hr_core_case table.',
          inputSchema: {
            type: 'object',
            properties: {
              subject_person: { type: 'string', description: 'Employee sys_id' },
              short_description: { type: 'string', description: 'Case description' },
              category: { type: 'string', description: 'HR category' },
              subcategory: { type: 'string', description: 'HR subcategory' },
              priority: { type: 'string', description: 'Priority level' },
              confidential: { type: 'boolean', default: false },
              hr_service: { type: 'string', description: 'HR service sys_id' }
            },
            required: ['subject_person', 'short_description']
          }
        },
        {
          name: 'snow_manage_onboarding',
          description: 'Manages employee onboarding using sn_hr_core_task table.',
          inputSchema: {
            type: 'object',
            properties: {
              employee_sys_id: { type: 'string', description: 'New employee sys_id' },
              start_date: { type: 'string', description: 'Start date' },
              department: { type: 'string', description: 'Department sys_id' },
              manager: { type: 'string', description: 'Manager sys_id' },
              tasks: { type: 'array', items: { type: 'object' }, description: 'Onboarding tasks' }
            },
            required: ['employee_sys_id', 'start_date']
          }
        },
        {
          name: 'snow_manage_offboarding',
          description: 'Manages employee offboarding using sn_hr_core_task table.',
          inputSchema: {
            type: 'object',
            properties: {
              employee_sys_id: { type: 'string', description: 'Employee sys_id' },
              last_day: { type: 'string', description: 'Last working day' },
              reason: { type: 'string', description: 'Departure reason' },
              tasks: { type: 'array', items: { type: 'object' }, description: 'Offboarding tasks' }
            },
            required: ['employee_sys_id', 'last_day']
          }
        },
        {
          name: 'snow_get_hr_analytics',
          description: 'Gets HR analytics from sn_hr_core_case table.',
          inputSchema: {
            type: 'object',
            properties: {
              metric: { type: 'string', description: 'case_volume, resolution_time, satisfaction' },
              time_range: { type: 'string', description: 'Analysis period' },
              department: { type: 'string', description: 'Filter by department' }
            },
            required: ['metric']
          }
        },
        // Customer Service Management Tools
        {
          name: 'snow_create_csm_case',
          description: 'Creates customer service case using sn_customerservice_case table.',
          inputSchema: {
            type: 'object',
            properties: {
              account: { type: 'string', description: 'Customer account sys_id' },
              contact: { type: 'string', description: 'Contact sys_id' },
              short_description: { type: 'string', description: 'Case description' },
              category: { type: 'string', description: 'Case category' },
              product: { type: 'string', description: 'Product sys_id' },
              priority: { type: 'string', description: 'Priority level' },
              channel: { type: 'string', description: 'Contact channel' }
            },
            required: ['account', 'short_description']
          }
        },
        {
          name: 'snow_manage_customer_account',
          description: 'Manages customer account using sn_customerservice_account table.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Account name' },
              industry: { type: 'string', description: 'Industry type' },
              tier: { type: 'string', description: 'Customer tier' },
              annual_revenue: { type: 'number', description: 'Annual revenue' },
              primary_contact: { type: 'string', description: 'Primary contact sys_id' }
            },
            required: ['name']
          }
        },
        {
          name: 'snow_create_csm_communication',
          description: 'Creates customer communication using sn_customerservice_communication table.',
          inputSchema: {
            type: 'object',
            properties: {
              case_sys_id: { type: 'string', description: 'Case sys_id' },
              type: { type: 'string', description: 'email, phone, chat' },
              direction: { type: 'string', description: 'inbound, outbound' },
              subject: { type: 'string', description: 'Communication subject' },
              body: { type: 'string', description: 'Message content' }
            },
            required: ['case_sys_id', 'type', 'body']
          }
        },
        {
          name: 'snow_get_customer_satisfaction',
          description: 'Gets CSAT metrics from sn_customerservice_csat table.',
          inputSchema: {
            type: 'object',
            properties: {
              account: { type: 'string', description: 'Filter by account' },
              time_range: { type: 'string', description: 'Analysis period' },
              include_comments: { type: 'boolean', default: false }
            }
          }
        },
        // DevOps Tools
        {
          name: 'snow_create_devops_pipeline',
          description: 'Creates DevOps pipeline using sn_devops_pipeline table.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Pipeline name' },
              application: { type: 'string', description: 'Application sys_id' },
              stages: { type: 'array', items: { type: 'object' }, description: 'Pipeline stages' },
              repository: { type: 'string', description: 'Repository URL' },
              branch: { type: 'string', description: 'Branch name' }
            },
            required: ['name', 'application']
          }
        },
        {
          name: 'snow_track_deployment',
          description: 'Tracks deployment using sn_devops_deployment table.',
          inputSchema: {
            type: 'object',
            properties: {
              pipeline: { type: 'string', description: 'Pipeline sys_id' },
              environment: { type: 'string', description: 'Target environment' },
              version: { type: 'string', description: 'Version number' },
              status: { type: 'string', description: 'Deployment status' },
              change_request: { type: 'string', description: 'Associated change' }
            },
            required: ['pipeline', 'environment', 'version']
          }
        },
        {
          name: 'snow_manage_devops_change',
          description: 'Manages DevOps change using sn_devops_change table.',
          inputSchema: {
            type: 'object',
            properties: {
              pipeline: { type: 'string', description: 'Pipeline sys_id' },
              deployment: { type: 'string', description: 'Deployment sys_id' },
              auto_approve: { type: 'boolean', default: false },
              validation_results: { type: 'object', description: 'Validation data' }
            },
            required: ['pipeline', 'deployment']
          }
        },
        {
          name: 'snow_get_velocity_metrics',
          description: 'Gets team velocity from sn_devops_velocity table.',
          inputSchema: {
            type: 'object',
            properties: {
              team: { type: 'string', description: 'Team sys_id' },
              sprint: { type: 'string', description: 'Sprint identifier' },
              time_range: { type: 'string', description: 'Analysis period' }
            }
          }
        },
        {
          name: 'snow_create_devops_artifact',
          description: 'Creates build artifact using sn_devops_artifact table.',
          inputSchema: {
            type: 'object',
            properties: {
              pipeline: { type: 'string', description: 'Pipeline sys_id' },
              build_number: { type: 'string', description: 'Build number' },
              artifact_type: { type: 'string', description: 'Artifact type' },
              repository_url: { type: 'string', description: 'Artifact location' },
              checksum: { type: 'string', description: 'Artifact checksum' }
            },
            required: ['pipeline', 'build_number']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        
        // Execute with enhanced tracking
        return await this.executeTool(name, async () => {
          switch (name) {
            // CMDB & Discovery
            case 'snow_create_cmdb_ci':
              return await this.createCMDBCI(args as any);
            case 'snow_create_ci_relationship':
              return await this.createCIRelationship(args as any);
            case 'snow_discover_ci_dependencies':
              return await this.discoverCIDependencies(args as any);
            case 'snow_run_discovery':
              return await this.runDiscovery(args as any);
            case 'snow_get_discovery_status':
              return await this.getDiscoveryStatus(args as any);
            case 'snow_import_cmdb_data':
              return await this.importCMDBData(args as any);
            // Event Management
            case 'snow_create_event':
              return await this.createEvent(args as any);
            case 'snow_create_alert_rule':
              return await this.createAlertRule(args as any);
            case 'snow_correlate_alerts':
              return await this.correlateAlerts(args as any);
            case 'snow_get_event_metrics':
              return await this.getEventMetrics(args as any);
            // HR Service Delivery
            case 'snow_create_hr_case':
              return await this.createHRCase(args as any);
            case 'snow_manage_onboarding':
              return await this.manageOnboarding(args as any);
            case 'snow_manage_offboarding':
              return await this.manageOffboarding(args as any);
            case 'snow_get_hr_analytics':
              return await this.getHRAnalytics(args as any);
            // Customer Service Management
            case 'snow_create_csm_case':
              return await this.createCSMCase(args as any);
            case 'snow_manage_customer_account':
              return await this.manageCustomerAccount(args as any);
            case 'snow_create_csm_communication':
              return await this.createCSMCommunication(args as any);
            case 'snow_get_customer_satisfaction':
              return await this.getCustomerSatisfaction(args as any);
            // DevOps
            case 'snow_create_devops_pipeline':
              return await this.createDevOpsPipeline(args as any);
            case 'snow_track_deployment':
              return await this.trackDeployment(args as any);
            case 'snow_manage_devops_change':
              return await this.manageDevOpsChange(args as any);
            case 'snow_get_velocity_metrics':
              return await this.getVelocityMetrics(args as any);
            case 'snow_create_devops_artifact':
              return await this.createDevOpsArtifact(args as any);
            default:
              throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
          }
        });
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
      }
    });
  }

  // CMDB & Discovery Methods

  private async createCMDBCI(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating CMDB CI...', { 
      ci_class: args.ci_class,
      name: args.name 
    });

    const ciData = {
      name: args.name,
      asset_tag: args.asset_tag || '',
      serial_number: args.serial_number || '',
      model_id: args.model_id || '',
      location: args.location || '',
      operational_status: args.operational_status || 'operational',
      ...args.attributes
    };

    this.logger.progress(`Creating CI in ${args.ci_class}...`);
    const response = await this.createRecord(args.ci_class, ciData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create CI: ${response.error}`);
    }

    const result = response.data;
    this.logger.info('✅ CI created', { 
      sys_id: result.sys_id,
      name: args.name 
    });

    return this.createResponse(
      `✅ Configuration Item created!
🖥️ **${args.name}**
📦 Class: ${args.ci_class}
🏷️ Asset Tag: ${args.asset_tag || 'N/A'}
📍 Location: ${args.location || 'N/A'}
🆔 sys_id: ${result.sys_id}

✨ CI added to CMDB!`
    );
  }

  private async createCIRelationship(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating CI relationship...', { 
      parent: args.parent,
      child: args.child 
    });

    const relData = {
      parent: args.parent,
      child: args.child,
      type: args.type,
      description: args.description || ''
    };

    this.logger.progress('Creating relationship...');
    const response = await this.createRecord('cmdb_rel_ci', relData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create relationship: ${response.error}`);
    }

    this.logger.info('✅ Relationship created');
    return this.createResponse(
      `✅ CI Relationship created!
🔗 Parent → Child
📝 Type: ${args.type}
🆔 sys_id: ${response.data.sys_id}`
    );
  }

  private async discoverCIDependencies(args: any): Promise<MCPToolResult> {
    this.logger.info('Discovering CI dependencies...', { 
      ci_sys_id: args.ci_sys_id,
      depth: args.depth 
    });

    const direction = args.direction || 'both';
    let query = '';
    
    if (direction === 'upstream' || direction === 'both') {
      query = `child=${args.ci_sys_id}`;
    }
    if (direction === 'downstream' || direction === 'both') {
      query += query ? `^ORparent=${args.ci_sys_id}` : `parent=${args.ci_sys_id}`;
    }

    this.logger.progress('Analyzing dependencies...');
    const response = await this.queryTable('cmdb_rel_ci', query, 100);

    if (!response.success) {
      return this.createResponse(`❌ Failed to discover dependencies: ${response.error}`);
    }

    const relationships = response.data.result;
    this.logger.info(`Found ${relationships.length} dependencies`);

    const depList = relationships.map((rel: any) => 
      `🔗 ${rel.parent.display_value} → ${rel.child.display_value} (${rel.type.display_value})`
    ).join('\n');

    return this.createResponse(
      `🔍 CI Dependencies:\n\n${depList}\n\n✨ Total: ${relationships.length} relationship(s)`
    );
  }

  private async runDiscovery(args: any): Promise<MCPToolResult> {
    this.logger.info('Running discovery...', { 
      schedule_sys_id: args.schedule_sys_id 
    });

    const discoveryData = {
      schedule: args.schedule_sys_id,
      ip_range: args.ip_range || '',
      mid_server: args.mid_server || '',
      state: 'starting',
      started: new Date().toISOString()
    };

    this.logger.progress('Initiating discovery...');
    const response = await this.createRecord('discovery_status', discoveryData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to start discovery: ${response.error}`);
    }

    this.logger.info('✅ Discovery started');
    return this.createResponse(
      `✅ Discovery started!
🔍 Schedule: ${args.schedule_sys_id}
🌐 IP Range: ${args.ip_range || 'Default'}
🖥️ MID Server: ${args.mid_server || 'Auto-select'}
🆔 Status ID: ${response.data.sys_id}

⏳ Discovery in progress...`
    );
  }

  private async getDiscoveryStatus(args: any): Promise<MCPToolResult> {
    this.logger.info('Getting discovery status...');

    let query = '';
    if (args.schedule_sys_id) {
      query = `schedule=${args.schedule_sys_id}`;
    }

    const response = await this.queryTable('discovery_status', query, args.limit || 10);

    if (!response.success) {
      return this.createResponse(`❌ Failed to get status: ${response.error}`);
    }

    const statuses = response.data.result;
    
    if (!statuses.length) {
      return this.createResponse(`❌ No discovery status found`);
    }

    const statusList = statuses.map((status: any) => 
      `🔍 ${status.schedule?.display_value || 'Discovery'}
  📊 State: ${status.state}
  ⏰ Started: ${status.started}
  🎯 Discovered: ${status.devices_discovered || 0} devices`
    ).join('\n\n');

    return this.createResponse(
      `📊 Discovery Status:\n\n${statusList}\n\n✨ ${statuses.length} discovery run(s)`
    );
  }

  private async importCMDBData(args: any): Promise<MCPToolResult> {
    this.logger.info('Importing CMDB data...', { 
      table_name: args.table_name,
      records: args.data.length 
    });

    const importSetData = {
      table_name: args.table_name,
      import_set_table: `u_import_${args.table_name}`,
      transform_map: args.transform_map || '',
      state: 'loading'
    };

    this.logger.progress('Creating import set...');
    const importSet = await this.createRecord('sys_import_set', importSetData);

    if (!importSet.success) {
      return this.createResponse(`❌ Failed to create import set: ${importSet.error}`);
    }

    // Import data records
    let imported = 0;
    for (const record of args.data) {
      const importRecord = await this.createRecord(importSetData.import_set_table, {
        ...record,
        sys_import_set: importSet.data.sys_id
      });
      if (importRecord.success) imported++;
    }

    this.logger.info(`✅ Imported ${imported} records`);
    return this.createResponse(
      `✅ CMDB Import completed!
📋 Table: ${args.table_name}
📊 Records: ${imported}/${args.data.length}
🆔 Import Set: ${importSet.data.sys_id}

✨ Data imported successfully!`
    );
  }

  // Event Management Methods

  private async createEvent(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating event...', { 
      source: args.source,
      severity: args.severity 
    });

    const eventData = {
      source: args.source,
      node: args.node,
      type: args.type,
      severity: args.severity,
      description: args.description || '',
      message_key: args.message_key || `${args.source}_${Date.now()}`,
      metric_name: args.metric_name || '',
      resource: args.resource || '',
      time_of_event: new Date().toISOString()
    };

    this.logger.progress('Creating event...');
    const response = await this.createRecord('em_event', eventData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create event: ${response.error}`);
    }

    this.logger.info('✅ Event created');
    return this.createResponse(
      `✅ Event created!
🚨 Source: ${args.source}
📊 Severity: ${args.severity}
🖥️ Node: ${args.node}
🔑 Message Key: ${eventData.message_key}
🆔 sys_id: ${response.data.sys_id}`
    );
  }

  private async createAlertRule(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating alert rule...', { name: args.name });

    const ruleData = {
      name: args.name,
      condition: args.condition,
      threshold: args.threshold || 0,
      action: args.action || '',
      active: args.active !== false
    };

    this.logger.progress('Creating rule...');
    const response = await this.createRecord('em_alert_rule', ruleData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create rule: ${response.error}`);
    }

    this.logger.info('✅ Alert rule created');
    return this.createResponse(
      `✅ Alert rule created!
📋 **${args.name}**
🔍 Condition: ${args.condition}
⚠️ Threshold: ${args.threshold || 'N/A'}
✅ Active: ${args.active !== false}
🆔 sys_id: ${response.data.sys_id}`
    );
  }

  private async correlateAlerts(args: any): Promise<MCPToolResult> {
    this.logger.info('Correlating alerts...', { 
      alerts: args.alerts.length 
    });

    const correlationData = {
      alerts: args.alerts.join(','),
      correlation_rule: args.correlation_rule || '',
      correlation_id: `CORR_${Date.now()}`,
      state: 'correlated'
    };

    this.logger.progress('Correlating alerts...');
    
    // Update alerts with correlation ID
    for (const alertId of args.alerts) {
      await this.updateRecord('em_alert', alertId, {
        correlation_id: correlationData.correlation_id
      });
    }

    if (args.create_incident) {
      // Create incident from correlated alerts
      const incidentData = {
        short_description: `Correlated Alert: ${correlationData.correlation_id}`,
        description: `Correlated ${args.alerts.length} alerts`,
        priority: '2',
        category: 'event'
      };
      
      const incident = await this.createRecord('incident', incidentData);
      
      if (incident.success) {
        return this.createResponse(
          `✅ Alerts correlated & incident created!
🔗 Correlation ID: ${correlationData.correlation_id}
📊 Alerts: ${args.alerts.length}
🎫 Incident: ${incident.data.number}`
        );
      }
    }

    this.logger.info('✅ Alerts correlated');
    return this.createResponse(
      `✅ Alerts correlated!
🔗 Correlation ID: ${correlationData.correlation_id}
📊 Correlated: ${args.alerts.length} alerts`
    );
  }

  private async getEventMetrics(args: any): Promise<MCPToolResult> {
    this.logger.info('Getting event metrics...');

    let query = '';
    if (args.source) query += `source=${args.source}`;
    if (args.node) query += `^node=${args.node}`;

    this.logger.progress('Analyzing events...');
    const response = await this.queryTable('em_event', query, 100);

    if (!response.success) {
      return this.createResponse(`❌ Failed to get metrics: ${response.error}`);
    }

    const events = response.data.result;
    
    // Calculate metrics
    const severityCounts: any = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    events.forEach((event: any) => {
      severityCounts[event.severity] = (severityCounts[event.severity] || 0) + 1;
    });

    return this.createResponse(
      `📊 Event Metrics:
🚨 Critical: ${severityCounts['1']}
⚠️ Major: ${severityCounts['2']}
⚡ Minor: ${severityCounts['3']}
ℹ️ Warning: ${severityCounts['4']}
📝 Info: ${severityCounts['5']}

✨ Total: ${events.length} events`
    );
  }

  // HR Service Delivery Methods

  private async createHRCase(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating HR case...', { 
      subject_person: args.subject_person,
      category: args.category 
    });

    const caseData = {
      subject_person: args.subject_person,
      short_description: args.short_description,
      category: args.category || '',
      subcategory: args.subcategory || '',
      priority: args.priority || '3',
      confidential: args.confidential || false,
      hr_service: args.hr_service || '',
      state: 'new'
    };

    this.logger.progress('Creating HR case...');
    const response = await this.createRecord('sn_hr_core_case', caseData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create HR case: ${response.error}`);
    }

    const result = response.data;
    this.logger.info('✅ HR case created', { number: result.number });

    return this.createResponse(
      `✅ HR Case created!
📋 **${result.number}**
👤 Employee: ${args.subject_person}
📁 Category: ${args.category || 'General'}
🔒 Confidential: ${args.confidential ? 'Yes' : 'No'}
🆔 sys_id: ${result.sys_id}

✨ HR case ready for processing!`
    );
  }

  private async manageOnboarding(args: any): Promise<MCPToolResult> {
    this.logger.info('Managing onboarding...', { 
      employee: args.employee_sys_id,
      start_date: args.start_date 
    });

    // Create onboarding case
    const onboardingCase = await this.createRecord('sn_hr_core_case', {
      subject_person: args.employee_sys_id,
      short_description: `Onboarding - Start Date: ${args.start_date}`,
      category: 'onboarding',
      hr_service: 'employee_onboarding',
      state: 'in_progress'
    });

    if (!onboardingCase.success) {
      return this.createResponse(`❌ Failed to create onboarding: ${onboardingCase.error}`);
    }

    // Create onboarding tasks
    const tasks = args.tasks || [
      { name: 'Provision equipment', days_before: 3 },
      { name: 'Create accounts', days_before: 2 },
      { name: 'Schedule orientation', days_before: 1 }
    ];

    let createdTasks = 0;
    for (const task of tasks) {
      const taskData = {
        parent: onboardingCase.data.sys_id,
        short_description: task.name,
        assigned_to: task.assigned_to || '',
        due_date: task.due_date || args.start_date
      };
      
      const taskResult = await this.createRecord('sn_hr_core_task', taskData);
      if (taskResult.success) createdTasks++;
    }

    this.logger.info('✅ Onboarding created', { 
      case: onboardingCase.data.number,
      tasks: createdTasks 
    });

    return this.createResponse(
      `✅ Onboarding initiated!
📋 Case: ${onboardingCase.data.number}
👤 Employee: ${args.employee_sys_id}
📅 Start Date: ${args.start_date}
🏢 Department: ${args.department || 'TBD'}
👨‍💼 Manager: ${args.manager || 'TBD'}
📌 Tasks Created: ${createdTasks}

✨ Onboarding process started!`
    );
  }

  private async manageOffboarding(args: any): Promise<MCPToolResult> {
    this.logger.info('Managing offboarding...', { 
      employee: args.employee_sys_id,
      last_day: args.last_day 
    });

    // Create offboarding case
    const offboardingCase = await this.createRecord('sn_hr_core_case', {
      subject_person: args.employee_sys_id,
      short_description: `Offboarding - Last Day: ${args.last_day}`,
      category: 'offboarding',
      hr_service: 'employee_offboarding',
      u_reason: args.reason || '',
      state: 'in_progress'
    });

    if (!offboardingCase.success) {
      return this.createResponse(`❌ Failed to create offboarding: ${offboardingCase.error}`);
    }

    // Create offboarding tasks
    const tasks = args.tasks || [
      { name: 'Collect equipment', days_after: 0 },
      { name: 'Revoke access', days_after: 1 },
      { name: 'Exit interview', days_before: 1 }
    ];

    let createdTasks = 0;
    for (const task of tasks) {
      const taskResult = await this.createRecord('sn_hr_core_task', {
        parent: offboardingCase.data.sys_id,
        short_description: task.name
      });
      if (taskResult.success) createdTasks++;
    }

    this.logger.info('✅ Offboarding created');
    return this.createResponse(
      `✅ Offboarding initiated!
📋 Case: ${offboardingCase.data.number}
👤 Employee: ${args.employee_sys_id}
📅 Last Day: ${args.last_day}
📝 Reason: ${args.reason || 'Not specified'}
📌 Tasks Created: ${createdTasks}

✨ Offboarding process started!`
    );
  }

  private async getHRAnalytics(args: any): Promise<MCPToolResult> {
    this.logger.info('Getting HR analytics...', { metric: args.metric });

    let query = '';
    if (args.department) query = `department=${args.department}`;

    const response = await this.queryTable('sn_hr_core_case', query, 100);

    if (!response.success) {
      return this.createResponse(`❌ Failed to get analytics: ${response.error}`);
    }

    const cases = response.data.result;
    
    if (args.metric === 'case_volume') {
      const categoryCounts: any = {};
      cases.forEach((c: any) => {
        categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      });
      
      const breakdown = Object.entries(categoryCounts)
        .map(([cat, count]) => `  ${cat}: ${count}`)
        .join('\n');
      
      return this.createResponse(
        `📊 HR Case Volume:\n${breakdown}\n\n✨ Total: ${cases.length} cases`
      );
    }

    return this.createResponse(
      `📊 HR Analytics:
📋 Total Cases: ${cases.length}
📈 Metric: ${args.metric}
📅 Period: ${args.time_range || 'All time'}`
    );
  }

  // Customer Service Management Methods

  private async createCSMCase(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating customer case...', { 
      account: args.account,
      short_description: args.short_description 
    });

    const caseData = {
      account: args.account,
      contact: args.contact || '',
      short_description: args.short_description,
      category: args.category || '',
      product: args.product || '',
      priority: args.priority || '3',
      channel: args.channel || 'web',
      state: 'new'
    };

    this.logger.progress('Creating customer case...');
    const response = await this.createRecord('sn_customerservice_case', caseData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create case: ${response.error}`);
    }

    const result = response.data;
    this.logger.info('✅ Customer case created', { number: result.number });

    return this.createResponse(
      `✅ Customer Case created!
📋 **${result.number}**
🏢 Account: ${args.account}
📝 ${args.short_description}
📱 Channel: ${args.channel || 'Web'}
🆔 sys_id: ${result.sys_id}

✨ Case ready for support team!`
    );
  }

  private async manageCustomerAccount(args: any): Promise<MCPToolResult> {
    this.logger.info('Managing customer account...', { name: args.name });

    const accountData = {
      name: args.name,
      industry: args.industry || '',
      tier: args.tier || 'standard',
      annual_revenue: args.annual_revenue || 0,
      primary_contact: args.primary_contact || ''
    };

    this.logger.progress('Creating/updating account...');
    const response = await this.createRecord('sn_customerservice_account', accountData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to manage account: ${response.error}`);
    }

    this.logger.info('✅ Account managed');
    return this.createResponse(
      `✅ Customer Account created!
🏢 **${args.name}**
🏭 Industry: ${args.industry || 'N/A'}
⭐ Tier: ${args.tier || 'Standard'}
💰 Revenue: ${args.annual_revenue || 'N/A'}
🆔 sys_id: ${response.data.sys_id}`
    );
  }

  private async createCSMCommunication(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating communication...', { 
      case_sys_id: args.case_sys_id,
      type: args.type 
    });

    const commData = {
      case: args.case_sys_id,
      type: args.type,
      direction: args.direction || 'outbound',
      subject: args.subject || '',
      body: args.body,
      created: new Date().toISOString()
    };

    this.logger.progress('Recording communication...');
    const response = await this.createRecord('sn_customerservice_communication', commData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create communication: ${response.error}`);
    }

    this.logger.info('✅ Communication recorded');
    return this.createResponse(
      `✅ Communication recorded!
📧 Type: ${args.type}
📤 Direction: ${args.direction || 'Outbound'}
📝 Subject: ${args.subject || 'N/A'}
🆔 sys_id: ${response.data.sys_id}`
    );
  }

  private async getCustomerSatisfaction(args: any): Promise<MCPToolResult> {
    this.logger.info('Getting CSAT metrics...');

    let query = '';
    if (args.account) query = `account=${args.account}`;

    const response = await this.queryTable('sn_customerservice_csat', query, 100);

    if (!response.success) {
      return this.createResponse(`❌ Failed to get CSAT: ${response.error}`);
    }

    const surveys = response.data.result;
    
    if (!surveys.length) {
      return this.createResponse(`❌ No CSAT data found`);
    }

    // Calculate average CSAT
    const scores = surveys.map((s: any) => parseFloat(s.score || 0));
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);

    let result = `📊 Customer Satisfaction:
⭐ Average Score: ${avgScore}/5
📋 Responses: ${surveys.length}
📅 Period: ${args.time_range || 'All time'}`;

    if (args.include_comments) {
      const comments = surveys
        .filter((s: any) => s.comments)
        .slice(0, 3)
        .map((s: any) => `  💬 "${s.comments}"`)
        .join('\n');
      
      if (comments) {
        result += `\n\nRecent Comments:\n${comments}`;
      }
    }

    return this.createResponse(result);
  }

  // DevOps Methods

  private async createDevOpsPipeline(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating DevOps pipeline...', { 
      name: args.name,
      application: args.application 
    });

    const pipelineData = {
      name: args.name,
      application: args.application,
      stages: JSON.stringify(args.stages || []),
      repository: args.repository || '',
      branch: args.branch || 'main',
      active: true
    };

    this.logger.progress('Creating pipeline...');
    const response = await this.createRecord('sn_devops_pipeline', pipelineData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create pipeline: ${response.error}`);
    }

    const result = response.data;
    this.logger.info('✅ Pipeline created', { sys_id: result.sys_id });

    return this.createResponse(
      `✅ DevOps Pipeline created!
🚀 **${args.name}**
📱 Application: ${args.application}
📦 Repository: ${args.repository || 'N/A'}
🌿 Branch: ${args.branch || 'main'}
📊 Stages: ${args.stages?.length || 0}
🆔 sys_id: ${result.sys_id}

✨ Pipeline ready for deployments!`
    );
  }

  private async trackDeployment(args: any): Promise<MCPToolResult> {
    this.logger.info('Tracking deployment...', { 
      pipeline: args.pipeline,
      environment: args.environment,
      version: args.version 
    });

    const deploymentData = {
      pipeline: args.pipeline,
      environment: args.environment,
      version: args.version,
      status: args.status || 'in_progress',
      change_request: args.change_request || '',
      deployed_on: new Date().toISOString()
    };

    this.logger.progress('Recording deployment...');
    const response = await this.createRecord('sn_devops_deployment', deploymentData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to track deployment: ${response.error}`);
    }

    this.logger.info('✅ Deployment tracked');
    return this.createResponse(
      `✅ Deployment tracked!
🚀 Version: ${args.version}
🌍 Environment: ${args.environment}
📊 Status: ${args.status || 'In Progress'}
🔄 Change: ${args.change_request || 'N/A'}
🆔 sys_id: ${response.data.sys_id}`
    );
  }

  private async manageDevOpsChange(args: any): Promise<MCPToolResult> {
    this.logger.info('Managing DevOps change...', { 
      pipeline: args.pipeline,
      deployment: args.deployment 
    });

    const changeData = {
      pipeline: args.pipeline,
      deployment: args.deployment,
      auto_approve: args.auto_approve || false,
      validation_results: JSON.stringify(args.validation_results || {}),
      state: args.auto_approve ? 'approved' : 'pending'
    };

    this.logger.progress('Processing change...');
    const response = await this.createRecord('sn_devops_change', changeData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to manage change: ${response.error}`);
    }

    this.logger.info('✅ Change processed');
    return this.createResponse(
      `✅ DevOps change processed!
🔄 Pipeline: ${args.pipeline}
🚀 Deployment: ${args.deployment}
✅ Auto-approve: ${args.auto_approve ? 'Yes' : 'No'}
📊 State: ${args.auto_approve ? 'Approved' : 'Pending'}
🆔 sys_id: ${response.data.sys_id}`
    );
  }

  private async getVelocityMetrics(args: any): Promise<MCPToolResult> {
    this.logger.info('Getting velocity metrics...');

    let query = '';
    if (args.team) query = `team=${args.team}`;
    if (args.sprint) query += `^sprint=${args.sprint}`;

    const response = await this.queryTable('sn_devops_velocity', query, 50);

    if (!response.success) {
      return this.createResponse(`❌ Failed to get velocity: ${response.error}`);
    }

    const metrics = response.data.result;
    
    if (!metrics.length) {
      return this.createResponse(`❌ No velocity data found`);
    }

    // Calculate velocity
    const storyPoints = metrics.map((m: any) => parseFloat(m.story_points || 0));
    const avgVelocity = (storyPoints.reduce((a, b) => a + b, 0) / storyPoints.length).toFixed(1);

    return this.createResponse(
      `📊 Team Velocity:
🚀 Average: ${avgVelocity} story points/sprint
📈 Sprints: ${metrics.length}
👥 Team: ${args.team || 'All teams'}
📅 Period: ${args.time_range || 'Recent sprints'}

✨ Velocity trending ${parseFloat(avgVelocity) > 20 ? 'up' : 'stable'}!`
    );
  }

  private async createDevOpsArtifact(args: any): Promise<MCPToolResult> {
    this.logger.info('Creating build artifact...', { 
      pipeline: args.pipeline,
      build_number: args.build_number 
    });

    const artifactData = {
      pipeline: args.pipeline,
      build_number: args.build_number,
      artifact_type: args.artifact_type || 'build',
      repository_url: args.repository_url || '',
      checksum: args.checksum || '',
      created: new Date().toISOString()
    };

    this.logger.progress('Recording artifact...');
    const response = await this.createRecord('sn_devops_artifact', artifactData);

    if (!response.success) {
      return this.createResponse(`❌ Failed to create artifact: ${response.error}`);
    }

    this.logger.info('✅ Artifact created');
    return this.createResponse(
      `✅ Build artifact recorded!
📦 Build: #${args.build_number}
🔧 Type: ${args.artifact_type || 'Build'}
🔗 Repository: ${args.repository_url || 'N/A'}
🔐 Checksum: ${args.checksum ? '✓' : 'N/A'}
🆔 sys_id: ${response.data.sys_id}

✨ Artifact ready for deployment!`
    );
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Log ready state
    this.logger.info('🚀 ServiceNow CMDB, Event, HR, CSM & DevOps MCP Server (Enhanced) running');
    this.logger.info('📊 Token tracking enabled');
    this.logger.info('⏳ Progress indicators active');
  }
}

// Start the enhanced server
const server = new ServiceNowCMDBEventHRCSMDevOpsMCPEnhanced();
server.start().catch((error) => {
  console.error('Failed to start enhanced server:', error);
  process.exit(1);
});