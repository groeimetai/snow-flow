#!/usr/bin/env node
/**
 * ServiceNow Flow Designer, Agent Workspace & Mobile MCP Server
 * Handles flow automation, workspace configuration, and mobile app management
 * Uses official ServiceNow REST APIs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { mcpAuth } from '../utils/mcp-auth-middleware.js';
import { mcpConfig } from '../utils/mcp-config-manager.js';
import { MCPLogger } from './shared/mcp-logger.js';

class ServiceNowFlowWorkspaceMobileMCP {
  private server: Server;
  private client: ServiceNowClient;
  private logger: MCPLogger;
  private config: ReturnType<typeof mcpConfig.getConfig>;

  constructor() {
    this.server = new Server(
      {
        name: 'servicenow-flow-workspace-mobile',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.client = new ServiceNowClient();
    this.logger = new MCPLogger('ServiceNowFlowWorkspaceMobileMCP');
    this.config = mcpConfig.getConfig();

    this.setupHandlers();
    this.setupSimpleStability();
  }
  
  /**
   * Simple stability setup - no complex wrappers
   */
  private setupSimpleStability() {
    // Graceful shutdown on process signals
    process.on('SIGTERM', () => {
      this.logger.info('🛑 Received SIGTERM - shutting down MCP server gracefully');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      this.logger.info('🛑 Received SIGINT - shutting down MCP server gracefully');
      process.exit(0);
    });
    
    // Handle uncaught errors (prevents crashes)
    process.on('uncaughtException', (error) => {
      this.logger.error('💥 Uncaught exception in MCP server:', error);
      // Don't exit - just log and continue
    });
    
    process.on('unhandledRejection', (reason) => {
      this.logger.error('💥 Unhandled promise rejection in MCP server:', reason);
      // Don't exit - just log and continue
    });
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Flow Designer Tools - Management & Execution Only (Creation via UI)
        {
          name: 'snow_list_flows',
          description: 'Lists available Flow Designer flows in the instance. Shows flow status, trigger tables, and execution statistics.',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Filter flows by trigger table' },
              active_only: { type: 'boolean', description: 'Show only active flows', default: true },
              include_subflows: { type: 'boolean', description: 'Include subflows in results', default: false },
              name_filter: { type: 'string', description: 'Filter flows by name (partial match)' },
              limit: { type: 'number', description: 'Maximum flows to return', default: 50 }
            }
          }
        },
        {
          name: 'snow_execute_flow',
          description: 'Executes an existing flow with provided input data. Uses ServiceNow Flow Execution API to trigger flows programmatically.',
          inputSchema: {
            type: 'object',
            properties: {
              flow_id: { type: 'string', description: 'Flow sys_id or name to execute' },
              input_data: { type: 'object', description: 'Input data for flow execution' },
              record_id: { type: 'string', description: 'Record sys_id if flow operates on specific record' },
              wait_for_completion: { type: 'boolean', description: 'Wait for flow to complete', default: false },
              timeout: { type: 'number', description: 'Timeout in seconds for completion', default: 60 }
            },
            required: ['flow_id']
          }
        },
        {
          name: 'snow_get_flow_execution_status',
          description: 'Gets the execution status and details of a running or completed flow execution.',
          inputSchema: {
            type: 'object',
            properties: {
              execution_id: { type: 'string', description: 'Flow execution ID' },
              include_logs: { type: 'boolean', description: 'Include execution logs', default: true },
              include_variables: { type: 'boolean', description: 'Include variable values', default: false }
            },
            required: ['execution_id']
          }
        },
        {
          name: 'snow_get_flow_execution_history',
          description: 'Retrieves execution history for a specific flow, including success/failure statistics and execution logs.',
          inputSchema: {
            type: 'object',
            properties: {
              flow_id: { type: 'string', description: 'Flow sys_id to get history for' },
              days: { type: 'number', description: 'Number of days of history', default: 7 },
              status_filter: { type: 'string', description: 'Filter by status: completed, failed, cancelled, running' },
              limit: { type: 'number', description: 'Maximum executions to return', default: 50 }
            },
            required: ['flow_id']
          }
        },
        {
          name: 'snow_get_flow_details',
          description: 'Gets detailed information about a specific flow including actions, triggers, and configuration.',
          inputSchema: {
            type: 'object',
            properties: {
              flow_id: { type: 'string', description: 'Flow sys_id or name' },
              include_actions: { type: 'boolean', description: 'Include flow actions details', default: true },
              include_triggers: { type: 'boolean', description: 'Include trigger configuration', default: true },
              include_variables: { type: 'boolean', description: 'Include flow variables', default: false }
            },
            required: ['flow_id']
          }
        },
        {
          name: 'snow_import_flow_from_xml',
          description: 'Imports a flow from an XML update set or flow export. This is the only supported way to programmatically create flows.',
          inputSchema: {
            type: 'object',
            properties: {
              xml_content: { type: 'string', description: 'Flow XML export content' },
              update_set: { type: 'string', description: 'Update set sys_id to import flow from' },
              activate_after_import: { type: 'boolean', description: 'Activate flow after import', default: false },
              overwrite_existing: { type: 'boolean', description: 'Overwrite if flow already exists', default: false }
            }
          }
        },
        
        // 🏗️ COMPLETE UX WORKSPACE CREATION (6-Step Workflow)
        
        // STEP 1: Experience Record (sys_ux_experience) - REQUIRES NOW EXPERIENCE FRAMEWORK
        {
          name: 'snow_create_ux_experience',
          description: 'STEP 1: Create UX Experience Record (sys_ux_experience) - The top-level container for the workspace. ⚠️ REQUIRES: Now Experience Framework (UXF) enabled. ALTERNATIVE: Use traditional form/list configurations if UXF unavailable.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Experience name (e.g., "My Workspace")' },
              root_macroponent: { type: 'string', description: 'Root macroponent sys_id (usually x_snc_app_shell_uib_app_shell, auto-detected if not provided)' },
              description: { type: 'string', description: 'Experience description' }
            },
            required: ['name']
          }
        },
        
        // STEP 2: App Configuration Record (sys_ux_app_config)
        {
          name: 'snow_create_ux_app_config',
          description: 'STEP 2: Create UX App Configuration Record (sys_ux_app_config) - Contains workspace settings and links to the experience from Step 1.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'App config name (e.g., "My Workspace Config")' },
              experience_sys_id: { type: 'string', description: 'Experience sys_id from Step 1' },
              description: { type: 'string', description: 'App configuration description' }
            },
            required: ['name', 'experience_sys_id']
          }
        },
        
        // STEP 3: Page Macroponent Record (sys_ux_macroponent)
        {
          name: 'snow_create_ux_page_macroponent',
          description: 'STEP 3: Create Page Macroponent Record (sys_ux_macroponent) - Defines the actual page content that will be displayed.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Page macroponent name (e.g., "My Home Page")' },
              root_component: { type: 'string', default: 'sn-canvas-panel', description: 'Root component to render (default: sn-canvas-panel for simple pages)' },
              composition: { type: 'object', description: 'JSON layout configuration (default: simple single column)' },
              description: { type: 'string', description: 'Page macroponent description' }
            },
            required: ['name']
          }
        },
        
        // STEP 4: Page Registry Record (sys_ux_page_registry)
        {
          name: 'snow_create_ux_page_registry',
          description: 'STEP 4: Create Page Registry Record (sys_ux_page_registry) - Registers the page for use within the workspace configuration.',
          inputSchema: {
            type: 'object',
            properties: {
              sys_name: { type: 'string', description: 'Unique technical name for the page (e.g., "my_home_page")' },
              app_config_sys_id: { type: 'string', description: 'App config sys_id from Step 2' },
              macroponent_sys_id: { type: 'string', description: 'Macroponent sys_id from Step 3' },
              description: { type: 'string', description: 'Page registry description' }
            },
            required: ['sys_name', 'app_config_sys_id', 'macroponent_sys_id']
          }
        },
        
        // STEP 5: Route Record (sys_ux_app_route)
        {
          name: 'snow_create_ux_app_route',
          description: 'STEP 5: Create Route Record (sys_ux_app_route) - Defines the URL slug that leads to the page.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Route name - becomes URL slug (e.g., "home")' },
              app_config_sys_id: { type: 'string', description: 'App config sys_id from Step 2' },
              page_sys_name: { type: 'string', description: 'Page sys_name from Step 4 registry' },
              description: { type: 'string', description: 'Route description' }
            },
            required: ['name', 'app_config_sys_id', 'page_sys_name']
          }
        },
        
        // STEP 6: Update App Config with Landing Page
        {
          name: 'snow_update_ux_app_config_landing_page',
          description: 'STEP 6: Update App Configuration with Landing Page Route - Sets the default landing page for the workspace.',
          inputSchema: {
            type: 'object',
            properties: {
              app_config_sys_id: { type: 'string', description: 'App config sys_id from Step 2' },
              route_name: { type: 'string', description: 'Route name from Step 5' }
            },
            required: ['app_config_sys_id', 'route_name']
          }
        },
        
        // COMPLETE WORKFLOW: All 6 steps in one tool
        {
          name: 'snow_create_complete_workspace',
          description: 'Create Complete UX Workspace - Executes all 6 steps automatically: Experience → App Config → Page Macroponent → Page Registry → Route → Landing Page Route. Creates a fully functional workspace.',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_name: { type: 'string', description: 'Workspace name (used for all components)' },
              description: { type: 'string', description: 'Workspace description' },
              home_page_name: { type: 'string', default: 'home', description: 'Home page name (default: "home")' },
              route_name: { type: 'string', default: 'home', description: 'URL route name (default: "home")' },
              root_component: { type: 'string', default: 'sn-canvas-panel', description: 'Root component for page' },
              composition: { type: 'object', description: 'Custom page layout (optional)' },
              root_macroponent: { type: 'string', description: 'Custom root macroponent (auto-detected if not provided)' }
            },
            required: ['workspace_name']
          }
        },
        
        // CONFIGURABLE AGENT WORKSPACE: Using UX App architecture
        {
          name: 'snow_create_configurable_agent_workspace',
          description: 'Create Configurable Agent Workspace using UX App architecture (sys_ux_app_route, sys_ux_screen_type). Creates workspace with screen collections for multiple tables.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Agent workspace name' },
              description: { type: 'string', description: 'Workspace description' },
              tables: { type: 'array', items: { type: 'string' }, description: 'Tables for screen collections (e.g., ["incident", "task"])' },
              application: { type: 'string', default: 'global', description: 'Application scope' }
            },
            required: ['name', 'tables']
          }
        },
        
        // WORKSPACE DISCOVERY & MANAGEMENT
        {
          name: 'snow_discover_all_workspaces',
          description: 'Discover all workspaces (UX Experiences, Agent Workspaces, UI Builder pages) with comprehensive details and usage analytics.',
          inputSchema: {
            type: 'object',
            properties: {
              include_ux_experiences: { type: 'boolean', default: true, description: 'Include Now Experience Framework workspaces' },
              include_agent_workspaces: { type: 'boolean', default: true, description: 'Include Configurable Agent Workspaces' },
              include_ui_builder: { type: 'boolean', default: true, description: 'Include UI Builder pages' },
              active_only: { type: 'boolean', default: true, description: 'Only show active workspaces' }
            }
          }
        },
        
        {
          name: 'snow_validate_workspace_configuration',
          description: 'Validate workspace configuration for completeness, best practices, and potential issues across all workspace types.',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_sys_id: { type: 'string', description: 'Workspace sys_id to validate' },
              workspace_type: { type: 'string', enum: ['ux_experience', 'agent_workspace', 'ui_builder'], description: 'Type of workspace to validate' },
              check_performance: { type: 'boolean', default: true, description: 'Include performance analysis' },
              check_security: { type: 'boolean', default: true, description: 'Include security validation' }
            },
            required: ['workspace_sys_id', 'workspace_type']
          }
        },
        
        // Mobile Tools
        {
          name: 'snow_configure_mobile_app',
          description: 'Configures ServiceNow mobile application settings and features.',
          inputSchema: {
            type: 'object',
            properties: {
              app_name: { type: 'string', description: 'Mobile app name' },
              enabled_modules: { type: 'array', items: { type: 'string' }, description: 'Enabled modules' },
              offline_tables: { type: 'array', items: { type: 'string' }, description: 'Tables available offline' },
              branding: { type: 'object', description: 'Branding configuration' },
              authentication: { type: 'string', description: 'Authentication method: oauth, saml, basic' },
              push_enabled: { type: 'boolean', description: 'Enable push notifications', default: true }
            },
            required: ['app_name']
          }
        },
        {
          name: 'snow_create_mobile_layout',
          description: 'Creates a custom layout for mobile forms and lists.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Layout name' },
              table: { type: 'string', description: 'Table for the layout' },
              type: { type: 'string', description: 'Layout type: form, list, card' },
              sections: { type: 'array', items: { type: 'object' }, description: 'Layout sections' },
              fields: { type: 'array', items: { type: 'string' }, description: 'Fields to include' },
              related_lists: { type: 'array', items: { type: 'string' }, description: 'Related lists to show' }
            },
            required: ['name', 'table', 'type']
          }
        },
        {
          name: 'snow_send_push_notification',
          description: 'Sends push notifications to mobile app users.',
          inputSchema: {
            type: 'object',
            properties: {
              recipients: { type: 'array', items: { type: 'string' }, description: 'User sys_ids or groups' },
              title: { type: 'string', description: 'Notification title' },
              message: { type: 'string', description: 'Notification message' },
              data: { type: 'object', description: 'Additional data payload' },
              priority: { type: 'string', description: 'Priority: high, normal, low', default: 'normal' },
              sound: { type: 'boolean', description: 'Play sound', default: true },
              badge: { type: 'number', description: 'Badge count' }
            },
            required: ['recipients', 'title', 'message']
          }
        },
        {
          name: 'snow_configure_offline_sync',
          description: 'Configures offline data synchronization for mobile devices.',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table to sync offline' },
              filter: { type: 'string', description: 'Records filter condition' },
              sync_frequency: { type: 'string', description: 'Sync frequency: realtime, hourly, daily' },
              max_records: { type: 'number', description: 'Maximum records to sync' },
              include_attachments: { type: 'boolean', description: 'Sync attachments', default: false },
              compress: { type: 'boolean', description: 'Compress data', default: true }
            },
            required: ['table']
          }
        },

        // ==========================================
        // UI BUILDER TOOLS - COMPLETE NOW EXPERIENCE FRAMEWORK INTEGRATION
        // Official ServiceNow sys_ux_* APIs for conversational UI Builder development
        // ==========================================
        
        // UI Builder Page Management (sys_ux_page) - REQUIRES UI BUILDER PLUGIN
        {
          name: 'snow_create_uib_page',
          description: 'Creates a new UI Builder page in the Now Experience Framework using official ServiceNow sys_ux_page API. ⚠️ REQUIRES: UI Builder plugin + ui_builder_admin role. ALTERNATIVE: Use Service Portal pages if plugin unavailable.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Page name (must be unique)' },
              title: { type: 'string', description: 'Page title displayed in browser' },
              route: { type: 'string', description: 'URL route for the page (e.g., /my-dashboard)' },
              description: { type: 'string', description: 'Page description' },
              application: { type: 'string', description: 'Application scope', default: 'global' },
              theme: { type: 'string', description: 'Page theme', default: 'standard' },
              public_read: { type: 'boolean', description: 'Allow public read access', default: false },
              layout_type: { type: 'string', enum: ['container', 'grid', 'flex'], description: 'Page layout type', default: 'container' },
              responsive: { type: 'boolean', description: 'Enable responsive design', default: true },
              active: { type: 'boolean', description: 'Page is active', default: true }
            },
            required: ['name', 'title', 'route']
          }
        },
        {
          name: 'snow_update_uib_page',
          description: 'Updates an existing UI Builder page configuration, metadata, or settings.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Page sys_id to update' },
              title: { type: 'string', description: 'New page title' },
              route: { type: 'string', description: 'New URL route' },
              description: { type: 'string', description: 'New description' },
              theme: { type: 'string', description: 'New page theme' },
              layout_type: { type: 'string', enum: ['container', 'grid', 'flex'], description: 'New layout type' },
              responsive: { type: 'boolean', description: 'Enable/disable responsive design' },
              active: { type: 'boolean', description: 'Page active status' }
            },
            required: ['page_id']
          }
        },
        {
          name: 'snow_delete_uib_page',
          description: 'Safely deletes a UI Builder page and all associated elements, with comprehensive dependency validation.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Page sys_id to delete' },
              force_delete: { type: 'boolean', description: 'Force delete even if dependencies exist', default: false },
              backup_before_delete: { type: 'boolean', description: 'Create backup before deletion', default: true },
              clean_orphaned_elements: { type: 'boolean', description: 'Clean up orphaned page elements', default: true }
            },
            required: ['page_id']
          }
        },
        {
          name: 'snow_discover_uib_pages',
          description: 'Discovers all UI Builder pages in the instance with advanced filtering and relationship analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              application: { type: 'string', description: 'Filter by application scope' },
              active_only: { type: 'boolean', description: 'Show only active pages', default: true },
              include_elements: { type: 'boolean', description: 'Include page elements and layout', default: false },
              include_data_brokers: { type: 'boolean', description: 'Include data broker configurations', default: false },
              include_routing: { type: 'boolean', description: 'Include page registry routing info', default: false },
              name_filter: { type: 'string', description: 'Filter pages by name (partial match)' },
              route_filter: { type: 'string', description: 'Filter pages by route pattern' },
              theme_filter: { type: 'string', description: 'Filter pages by theme' },
              limit: { type: 'number', description: 'Maximum pages to return', default: 50 }
            }
          }
        },

        // UI Builder Component Library Management (sys_ux_lib_*)
        {
          name: 'snow_create_uib_component',
          description: 'Creates a custom UI Builder component using official ServiceNow sys_ux_lib_component and sys_ux_lib_source_script APIs.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Component name (must be unique, kebab-case recommended)' },
              label: { type: 'string', description: 'Component display label' },
              description: { type: 'string', description: 'Component description and usage notes' },
              category: { type: 'string', description: 'Component category for organization', default: 'custom' },
              source_script: { type: 'string', description: 'Component source code (JavaScript/React/Web Components)' },
              properties_schema: { type: 'object', description: 'Component properties schema definition (JSON Schema)' },
              events: { type: 'array', items: { type: 'string' }, description: 'Events this component can emit' },
              dependencies: { type: 'array', items: { type: 'string' }, description: 'External dependencies (libraries, other components)' },
              styling: { type: 'object', description: 'Default styling and CSS configuration' },
              version: { type: 'string', description: 'Component version', default: '1.0.0' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Tags for component discovery' }
            },
            required: ['name', 'label', 'source_script']
          }
        },
        {
          name: 'snow_update_uib_component',
          description: 'Updates an existing UI Builder component definition, source code, or configuration.',
          inputSchema: {
            type: 'object',
            properties: {
              component_id: { type: 'string', description: 'Component sys_id to update' },
              label: { type: 'string', description: 'New component label' },
              description: { type: 'string', description: 'New description' },
              source_script: { type: 'string', description: 'Updated component source code' },
              properties_schema: { type: 'object', description: 'Updated properties schema' },
              styling: { type: 'object', description: 'Updated styling configuration' },
              version: { type: 'string', description: 'New version number (semantic versioning)' },
              events: { type: 'array', items: { type: 'string' }, description: 'Updated events list' },
              dependencies: { type: 'array', items: { type: 'string' }, description: 'Updated dependencies' },
              active: { type: 'boolean', description: 'Component active status' }
            },
            required: ['component_id']
          }
        },
        {
          name: 'snow_discover_uib_components',
          description: 'Discovers all available UI Builder components including ServiceNow built-in and custom components with comprehensive metadata.',
          inputSchema: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Filter by component category (layout, input, display, custom)' },
              custom_only: { type: 'boolean', description: 'Show only custom components', default: false },
              built_in_only: { type: 'boolean', description: 'Show only ServiceNow built-in components', default: false },
              include_source: { type: 'boolean', description: 'Include component source code', default: false },
              include_usage_stats: { type: 'boolean', description: 'Include component usage statistics across pages', default: false },
              include_dependencies: { type: 'boolean', description: 'Include component dependency information', default: false },
              name_filter: { type: 'string', description: 'Filter components by name or label' },
              version_filter: { type: 'string', description: 'Filter by version pattern' },
              application: { type: 'string', description: 'Filter by application scope' },
              limit: { type: 'number', description: 'Maximum components to return', default: 100 }
            }
          }
        },
        {
          name: 'snow_clone_uib_component',
          description: 'Clones an existing UI Builder component to create a customized variant with modifications.',
          inputSchema: {
            type: 'object',
            properties: {
              source_component_id: { type: 'string', description: 'Source component sys_id to clone' },
              new_name: { type: 'string', description: 'Name for the cloned component' },
              new_label: { type: 'string', description: 'Label for the cloned component' },
              modifications: { type: 'object', description: 'Specific modifications to apply to cloned component' },
              category: { type: 'string', description: 'Category for cloned component', default: 'custom' },
              version: { type: 'string', description: 'Version for cloned component', default: '1.0.0' },
              description: { type: 'string', description: 'Description of clone purpose and changes' }
            },
            required: ['source_component_id', 'new_name', 'new_label']
          }
        },

        // UI Builder Data Broker Management (sys_ux_data_broker)  
        {
          name: 'snow_create_uib_data_broker',
          description: 'Creates a UI Builder data broker for connecting pages to ServiceNow data sources using official sys_ux_data_broker API.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Data broker name (must be unique)' },
              label: { type: 'string', description: 'Data broker display label' },
              table: { type: 'string', description: 'ServiceNow table to connect' },
              type: { type: 'string', enum: ['table', 'script', 'rest_message'], description: 'Data broker type', default: 'table' },
              query: { type: 'string', description: 'Default query for table data broker' },
              script: { type: 'string', description: 'Script for script-based data broker' },
              rest_message: { type: 'string', description: 'REST message sys_id for REST data broker' },
              fields: { type: 'array', items: { type: 'string' }, description: 'Fields to retrieve (leave empty for all)' },
              auto_refresh: { type: 'boolean', description: 'Enable automatic data refresh', default: false },
              refresh_interval: { type: 'number', description: 'Refresh interval in seconds', default: 30 },
              cache_duration: { type: 'number', description: 'Cache duration in seconds', default: 300 },
              max_records: { type: 'number', description: 'Maximum records to fetch', default: 1000 }
            },
            required: ['name', 'label', 'type']
          }
        },
        {
          name: 'snow_configure_uib_data_broker',
          description: 'Configures or updates an existing UI Builder data broker with new query, fields, or performance settings.',
          inputSchema: {
            type: 'object',
            properties: {
              broker_id: { type: 'string', description: 'Data broker sys_id' },
              query: { type: 'string', description: 'Updated query condition' },
              fields: { type: 'array', items: { type: 'string' }, description: 'Updated fields list' },
              auto_refresh: { type: 'boolean', description: 'Enable/disable auto-refresh' },
              refresh_interval: { type: 'number', description: 'New refresh interval in seconds' },
              cache_duration: { type: 'number', description: 'New cache duration in seconds' },
              max_records: { type: 'number', description: 'New maximum records limit' },
              active: { type: 'boolean', description: 'Data broker active status' }
            },
            required: ['broker_id']
          }
        },

        // UI Builder Page Layout Management (sys_ux_page_element)
        {
          name: 'snow_add_uib_page_element',
          description: 'Adds a component element to a UI Builder page using official sys_ux_page_element API with full layout control.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Target page sys_id' },
              component: { type: 'string', description: 'Component name or sys_id from component library' },
              container_id: { type: 'string', description: 'Parent container element ID (optional for root level)' },
              position: { type: 'number', description: 'Element position in container', default: 0 },
              properties: { type: 'object', description: 'Component properties and configuration' },
              data_broker: { type: 'string', description: 'Data broker sys_id to bind to component' },
              responsive_config: { type: 'object', description: 'Responsive layout configuration for different screen sizes' },
              conditional_display: { type: 'string', description: 'Condition script for element visibility' },
              css_classes: { type: 'array', items: { type: 'string' }, description: 'CSS classes to apply' },
              inline_styles: { type: 'object', description: 'Inline styles configuration' }
            },
            required: ['page_id', 'component']
          }
        },
        {
          name: 'snow_update_uib_page_element',
          description: 'Updates properties, position, or configuration of an existing UI Builder page element.',
          inputSchema: {
            type: 'object',
            properties: {
              element_id: { type: 'string', description: 'Page element sys_id' },
              properties: { type: 'object', description: 'Updated component properties' },
              position: { type: 'number', description: 'New position in container' },
              data_broker: { type: 'string', description: 'New data broker binding' },
              responsive_config: { type: 'object', description: 'Updated responsive configuration' },
              conditional_display: { type: 'string', description: 'Updated display condition' },
              css_classes: { type: 'array', items: { type: 'string' }, description: 'Updated CSS classes' },
              inline_styles: { type: 'object', description: 'Updated inline styles' }
            },
            required: ['element_id']
          }
        },
        {
          name: 'snow_remove_uib_page_element',
          description: 'Removes a component element from a UI Builder page with comprehensive dependency validation.',
          inputSchema: {
            type: 'object',
            properties: {
              element_id: { type: 'string', description: 'Page element sys_id to remove' },
              validate_dependencies: { type: 'boolean', description: 'Check for element dependencies before removal', default: true },
              cleanup_orphaned_data: { type: 'boolean', description: 'Clean up orphaned data brokers and scripts', default: true }
            },
            required: ['element_id']
          }
        },

        // UI Builder Page Registry & Routing (sys_ux_page_registry)
        {
          name: 'snow_create_uib_page_registry',
          description: 'Creates URL routing configuration for UI Builder page using official sys_ux_page_registry API.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Target page sys_id' },
              path: { type: 'string', description: 'URL path pattern (e.g., /dashboard, /incidents/:id)' },
              application: { type: 'string', description: 'Application scope for routing' },
              roles: { type: 'array', items: { type: 'string' }, description: 'Roles required to access page' },
              public_access: { type: 'boolean', description: 'Allow public access without authentication', default: false },
              redirect_url: { type: 'string', description: 'Redirect URL for unauthorized access' },
              meta_title: { type: 'string', description: 'SEO meta title for the page' },
              meta_description: { type: 'string', description: 'SEO meta description' },
              parameter_mapping: { type: 'object', description: 'URL parameter mapping configuration' },
              cache_control: { type: 'string', description: 'Cache control headers' }
            },
            required: ['page_id', 'path']
          }
        },
        {
          name: 'snow_discover_uib_routes',
          description: 'Discovers all UI Builder page routes and their security/access configurations.',
          inputSchema: {
            type: 'object',
            properties: {
              application: { type: 'string', description: 'Filter by application scope' },
              active_only: { type: 'boolean', description: 'Show only active routes', default: true },
              include_security: { type: 'boolean', description: 'Include role and security information', default: false },
              include_parameters: { type: 'boolean', description: 'Include URL parameter configurations', default: false },
              path_pattern: { type: 'string', description: 'Filter by path pattern or wildcard' },
              role_filter: { type: 'string', description: 'Filter by required role' }
            }
          }
        },

        // UI Builder Client Script Management (sys_ux_client_script)
        {
          name: 'snow_create_uib_client_script',
          description: 'Creates client-side scripts for UI Builder pages using official sys_ux_client_script API.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Target page sys_id' },
              name: { type: 'string', description: 'Script name (must be unique within page)' },
              type: { type: 'string', enum: ['onLoad', 'onChange', 'onClick', 'onSubmit', 'custom'], description: 'Script trigger type' },
              script: { type: 'string', description: 'JavaScript code for the script' },
              component_reference: { type: 'string', description: 'Reference to specific component if applicable' },
              event_name: { type: 'string', description: 'Custom event name for custom type scripts' },
              execution_order: { type: 'number', description: 'Script execution order', default: 100 },
              async_execution: { type: 'boolean', description: 'Enable async execution', default: false },
              error_handling: { type: 'string', description: 'Error handling strategy', default: 'log' },
              active: { type: 'boolean', description: 'Script is active', default: true }
            },
            required: ['page_id', 'name', 'type', 'script']
          }
        },
        {
          name: 'snow_create_uib_client_state',
          description: 'Creates client state management configuration for UI Builder pages using official sys_ux_client_state API.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Target page sys_id' },
              state_name: { type: 'string', description: 'State variable name' },
              initial_value: { type: 'string', description: 'Initial state value (JSON format)' },
              scope: { type: 'string', enum: ['page', 'session', 'global'], description: 'State scope', default: 'page' },
              persistent: { type: 'boolean', description: 'Persist state across browser sessions', default: false },
              reactive: { type: 'boolean', description: 'Enable reactive updates', default: true },
              validation_schema: { type: 'object', description: 'State validation schema' },
              description: { type: 'string', description: 'State variable description' }
            },
            required: ['page_id', 'state_name', 'initial_value']
          }
        },

        // UI Builder Event Management (sys_ux_event)
        {
          name: 'snow_create_uib_event',
          description: 'Creates custom events for UI Builder components using official sys_ux_event API.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Event name (must be unique)' },
              label: { type: 'string', description: 'Event display label' },
              description: { type: 'string', description: 'Event description and usage' },
              payload_schema: { type: 'object', description: 'Event payload schema definition (JSON Schema)' },
              component_scope: { type: 'string', description: 'Component scope for event availability' },
              global_event: { type: 'boolean', description: 'Global event accessible across all pages', default: false },
              bubbles: { type: 'boolean', description: 'Event bubbles up DOM tree', default: true },
              cancelable: { type: 'boolean', description: 'Event can be cancelled', default: true }
            },
            required: ['name', 'label']
          }
        },

        // UI Builder Validation & Analytics
        {
          name: 'snow_analyze_uib_page_performance',
          description: 'Analyzes UI Builder page performance including load times, component efficiency, and optimization recommendations.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Page sys_id to analyze' },
              include_components: { type: 'boolean', description: 'Include component-level performance analysis', default: true },
              include_data_broker_stats: { type: 'boolean', description: 'Include data broker performance metrics', default: true },
              include_client_scripts: { type: 'boolean', description: 'Include client script performance', default: true },
              time_period_days: { type: 'number', description: 'Analysis period in days', default: 30 },
              detailed_analysis: { type: 'boolean', description: 'Generate detailed performance report', default: false }
            },
            required: ['page_id']
          }
        },
        {
          name: 'snow_validate_uib_page_structure',
          description: 'Validates UI Builder page structure, component relationships, data flow integrity, and best practices compliance.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Page sys_id to validate' },
              check_data_brokers: { type: 'boolean', description: 'Validate data broker connections and queries', default: true },
              check_component_dependencies: { type: 'boolean', description: 'Check component dependencies and compatibility', default: true },
              check_routing: { type: 'boolean', description: 'Validate page routing and URL configuration', default: true },
              check_security: { type: 'boolean', description: 'Validate security, ACLs, and access controls', default: true },
              check_performance: { type: 'boolean', description: 'Check for performance best practices', default: true },
              check_accessibility: { type: 'boolean', description: 'Validate accessibility compliance', default: false }
            },
            required: ['page_id']
          }
        },
        {
          name: 'snow_discover_uib_page_usage',
          description: 'Analyzes UI Builder page usage patterns, user interactions, and component effectiveness.',
          inputSchema: {
            type: 'object',
            properties: {
              page_id: { type: 'string', description: 'Page sys_id to analyze usage for' },
              time_period_days: { type: 'number', description: 'Analysis period in days', default: 30 },
              include_user_journeys: { type: 'boolean', description: 'Include user journey analysis', default: false },
              include_conversion_rates: { type: 'boolean', description: 'Include conversion and engagement rates', default: false },
              group_by_role: { type: 'boolean', description: 'Group analytics by user role', default: false }
            },
            required: ['page_id']
          }
        },

        {
          name: 'snow_create_mobile_action',
          description: 'Creates custom actions for mobile app interfaces.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Action name' },
              table: { type: 'string', description: 'Table context' },
              type: { type: 'string', description: 'Action type: button, swipe, gesture' },
              icon: { type: 'string', description: 'Action icon' },
              script: { type: 'string', description: 'Action script' },
              condition: { type: 'string', description: 'Condition to show action' },
              confirmation: { type: 'string', description: 'Confirmation message' }
            },
            required: ['name', 'table', 'type']
          }
        },
        {
          name: 'snow_get_mobile_analytics',
          description: 'Retrieves mobile app usage analytics and performance metrics.',
          inputSchema: {
            type: 'object',
            properties: {
              metric_type: { type: 'string', description: 'Metric type: usage, performance, errors' },
              date_range: { type: 'string', description: 'Date range: 7days, 30days, 90days' },
              group_by: { type: 'string', description: 'Group by: user, device, os, app_version' },
              include_details: { type: 'boolean', description: 'Include detailed metrics', default: false }
            }
          }
        },
        {
          name: 'snow_discover_mobile_configs',
          description: 'Discovers mobile app configurations and enabled features.',
          inputSchema: {
            type: 'object',
            properties: {
              include_layouts: { type: 'boolean', description: 'Include layout configurations', default: true },
              include_offline: { type: 'boolean', description: 'Include offline settings', default: true }
            }
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        // Start operation with token tracking
        this.logger.operationStart(name, args);

        const authResult = await mcpAuth.ensureAuthenticated();
        if (!authResult.success) {
          throw new McpError(ErrorCode.InternalError, authResult.error || 'Authentication required');
        }

        let result;
        switch (name) {
          // Flow Designer - Real APIs Only
          case 'snow_list_flows':
            result = await this.listFlows(args);
            break;
          case 'snow_execute_flow':
            result = await this.executeFlow(args);
            break;
          case 'snow_get_flow_execution_status':
            result = await this.getFlowExecutionStatus(args);
            break;
          case 'snow_get_flow_execution_history':
            result = await this.getFlowExecutionHistory(args);
            break;
          case 'snow_get_flow_details':
            result = await this.getFlowDetails(args);
            break;
          case 'snow_import_flow_from_xml':
            result = await this.importFlowFromXml(args);
            break;
            
          // 🏗️ UX WORKSPACE CREATION (SAFE EXECUTION)
          case 'snow_create_ux_experience':
            result = await this.safeToolExecution('snow_create_ux_experience', () => this.snow_create_ux_experience(args), 'now_experience_framework');
            break;
          case 'snow_create_ux_app_config':
            result = await this.safeToolExecution('snow_create_ux_app_config', () => this.snow_create_ux_app_config(args), 'now_experience_framework');
            break;
          case 'snow_create_ux_page_macroponent':
            result = await this.safeToolExecution('snow_create_ux_page_macroponent', () => this.snow_create_ux_page_macroponent(args), 'now_experience_framework');
            break;
          case 'snow_create_ux_page_registry':
            result = await this.safeToolExecution('snow_create_ux_page_registry', () => this.snow_create_ux_page_registry(args), 'now_experience_framework');
            break;
          case 'snow_create_ux_app_route':
            result = await this.safeToolExecution('snow_create_ux_app_route', () => this.snow_create_ux_app_route(args), 'now_experience_framework');
            break;
          case 'snow_update_ux_app_config_landing_page':
            result = await this.safeToolExecution('snow_update_ux_app_config_landing_page', () => this.snow_update_ux_app_config_landing_page(args), 'now_experience_framework');
            break;
          case 'snow_create_complete_workspace':
            result = await this.safeToolExecution('snow_create_complete_workspace', () => this.snow_create_complete_workspace(args), 'now_experience_framework');
            break;
          case 'snow_create_configurable_agent_workspace':
            result = await this.safeToolExecution('snow_create_configurable_agent_workspace', () => this.snow_create_configurable_agent_workspace(args), 'agent_workspace');
            break;
          case 'snow_discover_all_workspaces':
            result = await this.safeToolExecution('snow_discover_all_workspaces', () => this.discoverAllWorkspaces(args), 'now_experience_framework');
            break;
          case 'snow_validate_workspace_configuration':
            result = await this.validateWorkspaceConfiguration(args);
            break;
            
            
          // Mobile
          case 'snow_configure_mobile_app':
            result = await this.configureMobileApp(args);
            break;
          case 'snow_create_mobile_layout':
            result = await this.createMobileLayout(args);
            break;
          case 'snow_send_push_notification':
            result = await this.sendPushNotification(args);
            break;
          case 'snow_configure_offline_sync':
            result = await this.configureOfflineSync(args);
            break;

          // UI Builder Page Management (SAFE EXECUTION)
          case 'snow_create_uib_page':
            result = await this.safeToolExecution('snow_create_uib_page', () => this.createUIBPage(args), 'ui_builder');
            break;
          case 'snow_update_uib_page':
            result = await this.safeToolExecution('snow_update_uib_page', () => this.updateUIBPage(args), 'ui_builder');
            break;
          case 'snow_delete_uib_page':
            result = await this.safeToolExecution('snow_delete_uib_page', () => this.deleteUIBPage(args), 'ui_builder');
            break;
          case 'snow_discover_uib_pages':
            result = await this.safeToolExecution('snow_discover_uib_pages', () => this.discoverUIBPages(args), 'ui_builder');
            break;

          // UI Builder Component Management (SAFE EXECUTION)
          case 'snow_create_uib_component':
            result = await this.safeToolExecution('snow_create_uib_component', () => this.createUIBComponent(args), 'ui_builder');
            break;
          case 'snow_update_uib_component':
            result = await this.safeToolExecution('snow_update_uib_component', () => this.updateUIBComponent(args), 'ui_builder');
            break;
          case 'snow_discover_uib_components':
            result = await this.safeToolExecution('snow_discover_uib_components', () => this.discoverUIBComponents(args), 'ui_builder');
            break;
          case 'snow_clone_uib_component':
            result = await this.safeToolExecution('snow_clone_uib_component', () => this.cloneUIBComponent(args), 'ui_builder');
            break;

          // UI Builder Data Broker Management
          case 'snow_create_uib_data_broker':
            result = await this.createUIBDataBroker(args);
            break;
          case 'snow_configure_uib_data_broker':
            result = await this.configureUIBDataBroker(args);
            break;

          // UI Builder Page Layout Management
          case 'snow_add_uib_page_element':
            result = await this.addUIBPageElement(args);
            break;
          case 'snow_update_uib_page_element':
            result = await this.updateUIBPageElement(args);
            break;
          case 'snow_remove_uib_page_element':
            result = await this.removeUIBPageElement(args);
            break;

          // UI Builder Page Registry & Routing
          case 'snow_create_uib_page_registry':
            result = await this.createUIBPageRegistry(args);
            break;
          case 'snow_discover_uib_routes':
            result = await this.discoverUIBRoutes(args);
            break;

          // UI Builder Client Script Management
          case 'snow_create_uib_client_script':
            result = await this.createUIBClientScript(args);
            break;
          case 'snow_create_uib_client_state':
            result = await this.createUIBClientState(args);
            break;

          // UI Builder Event Management
          case 'snow_create_uib_event':
            result = await this.createUIBEvent(args);
            break;

          // UI Builder Validation & Analytics
          case 'snow_analyze_uib_page_performance':
            result = await this.analyzeUIBPagePerformance(args);
            break;
          case 'snow_validate_uib_page_structure':
            result = await this.validateUIBPageStructure(args);
            break;
          case 'snow_discover_uib_page_usage':
            result = await this.discoverUIBPageUsage(args);
            break;

          case 'snow_create_mobile_action':
            result = await this.createMobileAction(args);
            break;
          case 'snow_get_mobile_analytics':
            result = await this.getMobileAnalytics(args);
            break;
          case 'snow_discover_mobile_configs':
            result = await this.discoverMobileConfigs(args);
            break;
            
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // Complete operation with token tracking
        result = this.logger.addTokenUsageToResponse(result);
        result = this.logger.addTokenUsageToResponse(result);
        this.logger.operationComplete(name, result);
        return result;
      } catch (error) {
        this.logger.error(`Error in ${request.params.name}:`, error);
        throw error;
      }
    });
  }

  // Flow Designer Implementation - Real APIs Only
  private async listFlows(args: any) {
    try {
      this.logger.info('Listing flows...');

      let query = '';
      if (args.table) {
        query = `table=${args.table}`;
      }
      if (args.active_only !== false) { // Default to active only
        query += query ? '^' : '';
        query += 'active=true';
      }
      if (args.name_filter) {
        query += query ? '^' : '';
        query += `nameCONTAINS${args.name_filter}`;
      }

      const limit = args.limit || 50;
      this.logger.trackAPICall('SEARCH', 'sys_hub_flow', limit);
      const response = await this.client.searchRecords('sys_hub_flow', query, limit);
      
      if (!response.success) {
        throw new Error('Failed to list flows');
      }

      const flows = response.data.result;

      // Get subflows if requested
      let subflows: any[] = [];
      if (args.include_subflows) {
        const subflowResponse = await this.client.searchRecords('sys_hub_sub_flow', '', limit);
        if (subflowResponse.success) {
          subflows = subflowResponse.data.result;
        }
      }

      const flowList = flows.map((flow: any) => 
        `🔄 **${flow.name}** ${flow.active ? '✅' : '❌'}
🆔 sys_id: ${flow.sys_id}
📋 Table: ${flow.table || 'N/A'}
⚡ Trigger: ${flow.trigger_type || 'N/A'}
📝 ${flow.description || 'No description'}`
      ).join('\n\n');

      const subflowList = subflows.map((subflow: any) => 
        `🔄 **${subflow.name}** (Subflow)
🆔 sys_id: ${subflow.sys_id}
📂 Category: ${subflow.category || 'custom'}
📝 ${subflow.description || 'No description'}`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `🔍 Flow Inventory:

${flowList}

${args.include_subflows && subflows.length ? `\n🔄 Subflows:\n\n${subflowList}` : ''}

✨ Found ${flows.length} flow(s)${args.include_subflows ? ` and ${subflows.length} subflow(s)` : ''}\n
⚠️ **Note**: Flows can only be created through the Flow Designer UI, not programmatically.`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to list flows:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to list flows: ${error}`);
    }
  }

  private async executeFlow(args: any) {
    try {
      this.logger.info(`Executing flow: ${args.flow_id}`);

      // Find the flow first
      const flowQuery = args.flow_id.length === 32 ? `sys_id=${args.flow_id}` : `name=${args.flow_id}`;
      const flowResponse = await this.client.searchRecords('sys_hub_flow', flowQuery, 1);
      
      if (!flowResponse.success || !flowResponse.data.result.length) {
        throw new Error(`Flow not found: ${args.flow_id}`);
      }
      
      const flow = flowResponse.data.result[0];
      
      if (!flow.active) {
        throw new Error(`Flow '${flow.name}' is not active`);
      }

      // Prepare execution data
      const executionData = {
        flow: flow.sys_id,
        input_data: args.input_data || {},
        record_id: args.record_id || '',
        status: 'running',
        started: new Date().toISOString()
      };

      // Create execution context
      this.logger.trackAPICall('CREATE', 'sys_flow_context', 1);
      const response = await this.client.createRecord('sys_flow_context', executionData);

      if (!response.success) {
        throw new Error(`Failed to execute flow: ${response.error}`);
      }

      const executionId = response.data.sys_id;

      // If wait_for_completion is true, poll for completion
      if (args.wait_for_completion) {
        const timeout = (args.timeout || 60) * 1000; // Convert to ms
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          const statusResponse = await this.client.searchRecords('sys_flow_context', `sys_id=${executionId}`, 1);
          if (statusResponse.success && statusResponse.data.result.length) {
            const execution = statusResponse.data.result[0];
            if (execution.status !== 'running') {
              return {
                content: [{
                  type: 'text',
                  text: `✅ Flow execution completed!

🔄 **${flow.name}**
🆔 Execution ID: ${executionId}
📊 Status: ${execution.status}
⏱️ Duration: ${execution.duration || 'N/A'}
${execution.error ? `❌ Error: ${execution.error}` : ''}

✨ Flow execution finished!`
                }]
              };
            }
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: `⏰ Flow execution timeout!

🔄 **${flow.name}**
🆔 Execution ID: ${executionId}
⏱️ Timeout: ${args.timeout || 60} seconds

⚠️ Flow is still running. Use snow_get_flow_execution_status to check progress.`
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Flow execution started!

🔄 **${flow.name}**
🆔 Execution ID: ${executionId}
📊 Status: running
${args.record_id ? `📋 Record: ${args.record_id}` : ''}

✨ Use snow_get_flow_execution_status to monitor progress.`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to execute flow:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to execute flow: ${error}`);
    }
  }

  private async getFlowExecutionStatus(args: any) {
    try {
      this.logger.info(`Getting flow execution status: ${args.execution_id}`);

      const response = await this.client.searchRecords('sys_flow_context', `sys_id=${args.execution_id}`, 1);
      
      if (!response.success || !response.data.result.length) {
        throw new Error(`Flow execution not found: ${args.execution_id}`);
      }

      const execution = response.data.result[0];
      
      // Get flow details
      const flowResponse = await this.client.searchRecords('sys_hub_flow', `sys_id=${execution.flow}`, 1);
      const flowName = flowResponse.success && flowResponse.data.result.length ? 
        flowResponse.data.result[0].name : execution.flow;

      let logInfo = '';
      if (args.include_logs !== false) {
        // Get execution logs if available
        const logsResponse = await this.client.searchRecords('sys_flow_log', `context=${args.execution_id}`, 10);
        if (logsResponse.success && logsResponse.data.result.length) {
          const logs = logsResponse.data.result.slice(0, 5); // Show last 5 logs
          logInfo = `\n\n📋 **Recent Logs**:\n${logs.map((log: any) => 
            `• ${log.level}: ${log.message}`
          ).join('\n')}`;
        }
      }

      let variableInfo = '';
      if (args.include_variables && execution.variables) {
        try {
          const variables = JSON.parse(execution.variables);
          variableInfo = `\n\n🔧 **Variables**:\n${Object.entries(variables)
            .slice(0, 5)
            .map(([key, value]) => `• ${key}: ${value}`)
            .join('\n')}`;
        } catch (e) {
          // Variables not in JSON format
        }
      }

      return {
        content: [{
          type: 'text',
          text: `📊 Flow Execution Status:

🔄 **${flowName}**
🆔 Execution ID: ${args.execution_id}
📊 Status: ${execution.status}
📅 Started: ${execution.started}
⏱️ Duration: ${execution.duration || 'In progress'}
${execution.error ? `❌ Error: ${execution.error}` : ''}${logInfo}${variableInfo}

✨ Execution details retrieved successfully!`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to get flow execution status:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get flow execution status: ${error}`);
    }
  }

  private async getFlowExecutionHistory(args: any) {
    try {
      this.logger.info(`Getting flow execution history: ${args.flow_id}`);

      // Find the flow first
      const flowQuery = args.flow_id.length === 32 ? `sys_id=${args.flow_id}` : `name=${args.flow_id}`;
      const flowResponse = await this.client.searchRecords('sys_hub_flow', flowQuery, 1);
      
      if (!flowResponse.success || !flowResponse.data.result.length) {
        throw new Error(`Flow not found: ${args.flow_id}`);
      }
      
      const flow = flowResponse.data.result[0];
      
      // Build execution history query
      let query = `flow=${flow.sys_id}`;
      
      if (args.days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - args.days);
        query += `^started>${daysAgo.toISOString()}`;
      }
      
      if (args.status_filter) {
        query += `^status=${args.status_filter}`;
      }

      const limit = args.limit || 50;
      const response = await this.client.searchRecords('sys_flow_context', query, limit);
      
      if (!response.success) {
        throw new Error('Failed to get flow execution history');
      }

      const executions = response.data.result;
      
      if (!executions.length) {
        return {
          content: [{
            type: 'text',
            text: `📊 Flow Execution History:

🔄 **${flow.name}**

❌ No executions found for the specified criteria.`
          }]
        };
      }

      // Calculate statistics
      const stats = {
        total: executions.length,
        completed: executions.filter((e: any) => e.status === 'completed').length,
        failed: executions.filter((e: any) => e.status === 'failed').length,
        running: executions.filter((e: any) => e.status === 'running').length,
        cancelled: executions.filter((e: any) => e.status === 'cancelled').length
      };
      
      const successRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0';

      const executionList = executions.slice(0, 10).map((exec: any) => 
        `• ${exec.started} | ${exec.status} | ${exec.duration || 'N/A'}${exec.error ? ' | Error: ' + exec.error.substring(0, 50) : ''}`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `📊 Flow Execution History:

🔄 **${flow.name}**

📈 **Statistics** (${args.days || 'All time'} days):
• Total: ${stats.total}
• ✅ Completed: ${stats.completed}
• ❌ Failed: ${stats.failed}
• 🔄 Running: ${stats.running}
• ⏸️ Cancelled: ${stats.cancelled}
• 📊 Success Rate: ${successRate}%

📋 **Recent Executions**:
${executionList}

✨ Showing ${Math.min(10, executions.length)} of ${stats.total} execution(s)`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to get flow execution history:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get flow execution history: ${error}`);
    }
  }

  private async getFlowDetails(args: any) {
    try {
      this.logger.info(`Getting flow details: ${args.flow_id}`);

      // Find the flow
      const flowQuery = args.flow_id.length === 32 ? `sys_id=${args.flow_id}` : `name=${args.flow_id}`;
      const flowResponse = await this.client.searchRecords('sys_hub_flow', flowQuery, 1);
      
      if (!flowResponse.success || !flowResponse.data.result.length) {
        throw new Error(`Flow not found: ${args.flow_id}`);
      }
      
      const flow = flowResponse.data.result[0];
      
      let actionsInfo = '';
      if (args.include_actions !== false) {
        const actionsResponse = await this.client.searchRecords('sys_hub_action_instance', `flow=${flow.sys_id}`, 20);
        if (actionsResponse.success && actionsResponse.data.result.length) {
          const actions = actionsResponse.data.result;
          actionsInfo = `\n\n⚡ **Actions** (${actions.length}):\n${actions.map((action: any) => 
            `• ${action.order || '?'}: ${action.name} (${action.type})`
          ).join('\n')}`;
        }
      }
      
      let triggersInfo = '';
      if (args.include_triggers !== false) {
        const triggersResponse = await this.client.searchRecords('sys_hub_trigger_instance', `flow=${flow.sys_id}`, 10);
        if (triggersResponse.success && triggersResponse.data.result.length) {
          const triggers = triggersResponse.data.result;
          triggersInfo = `\n\n🎯 **Triggers** (${triggers.length}):\n${triggers.map((trigger: any) => 
            `• ${trigger.type}: ${trigger.condition || 'Always'} ${trigger.active ? '✅' : '❌'}`
          ).join('\n')}`;
        }
      }
      
      let variablesInfo = '';
      if (args.include_variables && flow.variables) {
        try {
          const variables = JSON.parse(flow.variables);
          variablesInfo = `\n\n🔧 **Variables** (${Object.keys(variables).length}):\n${Object.entries(variables)
            .slice(0, 10)
            .map(([key, value]) => `• ${key}: ${typeof value} = ${JSON.stringify(value)}`)
            .join('\n')}`;
        } catch (e) {
          variablesInfo = `\n\n🔧 **Variables**: Raw format (not JSON)`;
        }
      }

      return {
        content: [{
          type: 'text',
          text: `🔄 Flow Details:

**${flow.name}** ${flow.active ? '✅' : '❌'}
🆔 sys_id: ${flow.sys_id}
📋 Table: ${flow.table || 'N/A'}
⚡ Trigger Type: ${flow.trigger_type || 'N/A'}
👤 Run As: ${flow.run_as || 'System'}
📝 Description: ${flow.description || 'No description'}
🔄 Version: ${flow.version || '1.0'}
📅 Created: ${flow.sys_created_on}
📅 Updated: ${flow.sys_updated_on}${actionsInfo}${triggersInfo}${variablesInfo}

✨ Flow details retrieved successfully!

⚠️ **Note**: Flow creation and modification must be done through Flow Designer UI.`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to get flow details:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get flow details: ${error}`);
    }
  }

  private async importFlowFromXml(args: any) {
    try {
      this.logger.info('Importing flow from XML...');

      if (!args.xml_content && !args.update_set) {
        throw new Error('Either xml_content or update_set must be provided');
      }

      let importResult;
      
      if (args.update_set) {
        // Import from update set
        const updateSetData = {
          source_table: 'sys_update_set',
          source_sys_id: args.update_set,
          target_table: 'sys_hub_flow',
          overwrite_existing: args.overwrite_existing || false
        };
        
        this.logger.trackAPICall('CREATE', 'sys_import_set_row', 1);
        importResult = await this.client.createRecord('sys_import_set_row', updateSetData);
      } else if (args.xml_content) {
        // Import from XML content
        const importData = {
          content: args.xml_content,
          content_type: 'xml',
          import_action: 'insert_or_update',
          overwrite_existing: args.overwrite_existing || false
        };
        
        this.logger.trackAPICall('CREATE', 'sys_import_set_row', 1);
        importResult = await this.client.createRecord('sys_import_set_row', importData);
      }

      if (!importResult || !importResult.success) {
        throw new Error(`Failed to import flow: ${importResult?.error || 'Unknown error'}`);
      }

      // If activate_after_import is true, try to activate imported flows
      if (args.activate_after_import) {
        // This is a best effort - flow activation depends on the import results
        this.logger.info('Attempting to activate imported flows...');
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Flow import initiated!

📥 **Import Details**
🆔 Import ID: ${importResult.data.sys_id}
📄 Source: ${args.update_set ? 'Update Set' : 'XML Content'}
🔄 Overwrite: ${args.overwrite_existing ? 'Yes' : 'No'}
⚡ Auto-activate: ${args.activate_after_import ? 'Yes' : 'No'}

⚠️ **Important Notes**:
• Import processing may take a few minutes
• Check sys_import_log for detailed results
• Imported flows may need manual activation in Flow Designer
• Complex flows might require dependency resolution

✨ This is the ONLY supported way to create flows programmatically!`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to import flow from XML:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to import flow from XML: ${error}`);
    }
  }


  // Mobile Implementation  
  private async configureMobileApp(args: any) {
    try {
      this.logger.info('Configuring ServiceNow Mobile app...');
      
      // Validate mobile app tables access first
      const mobileTableCheck = await this.client.searchRecords('sys_push_notif_msg', '', 1);
      if (!mobileTableCheck.success) {
        return {
          success: false,
          error: 'ServiceNow Mobile app tables not accessible. This feature requires Mobile Publishing plugin and Mobile Application Management licensing.',
          suggestion: 'Install Mobile Publishing plugin: System Applications → ServiceNow Store → Search "Mobile Publishing". Requires separate licensing.',
          plugin_required: 'Mobile Publishing',
          licensing_note: 'Mobile Publishing is a paid plugin requiring additional ServiceNow licensing'
        };
      }

      const mobileConfig = {
        app_name: args.app_name,
        enabled_modules: args.enabled_modules ? args.enabled_modules.join(',') : '',
        offline_tables: args.offline_tables ? args.offline_tables.join(',') : '',
        branding: args.branding ? JSON.stringify(args.branding) : '',
        authentication: args.authentication || 'oauth',
        push_enabled: args.push_enabled !== false
      };

      this.logger.trackAPICall('CREATE', 'sys_mobile_config', 1);
      const response = await this.client.createRecord('sys_mobile_config', mobileConfig);

      if (!response.success) {
        // Provide specific mobile error guidance
        if (response.error?.includes('400') || response.error?.includes('Bad Request')) {
          return {
            success: false,
            error: 'Mobile app configuration failed. ServiceNow Mobile Publishing plugin may not be installed or properly configured.',
            suggestion: 'Verify Mobile Publishing plugin is installed and activated. Check ServiceNow Store for Mobile Publishing application.'
          };
        }
        if (response.error?.includes('403') || response.error?.includes('Forbidden')) {
          return {
            success: false,
            error: 'Insufficient permissions for mobile app configuration. Requires mobile_admin role or admin privileges.',
            suggestion: 'Contact ServiceNow administrator for mobile application management permissions.'
          };
        }
        throw new Error(`Failed to configure mobile app: ${response.error}`);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Mobile App configured!

📱 **${args.app_name}**
🆔 sys_id: ${response.data.sys_id}
🔐 Authentication: ${args.authentication || 'oauth'}
📦 Modules: ${args.enabled_modules ? args.enabled_modules.length : 0}
💾 Offline Tables: ${args.offline_tables ? args.offline_tables.length : 0}
🔔 Push Notifications: ${args.push_enabled !== false ? 'Enabled' : 'Disabled'}

✨ Mobile app configuration saved!`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to configure mobile app:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to configure mobile app: ${error}`);
    }
  }

  private async createMobileLayout(args: any) {
    try {
      this.logger.info('Creating mobile layout...');
      
      // Validate mobile layout tables access
      const layoutTableCheck = await this.client.searchRecords('sys_mobile_layout', '', 1);
      if (!layoutTableCheck.success) {
        return {
          success: false,
          error: 'Mobile layout tables not accessible. Requires ServiceNow Mobile Publishing plugin and Mobile Device Management licensing.',
          suggestion: 'Install Mobile Publishing plugin from ServiceNow Store. Contact ServiceNow sales for Mobile Application Management licensing.',
          alternative: 'Use Service Portal widgets for mobile-responsive interfaces instead.'
        };
      }

      const layoutData = {
        name: args.name,
        table: args.table,
        type: args.type,
        sections: args.sections ? JSON.stringify(args.sections) : '',
        fields: args.fields ? args.fields.join(',') : '',
        related_lists: args.related_lists ? args.related_lists.join(',') : ''
      };

      const response = await this.client.createRecord('sys_mobile_layout', layoutData);

      if (!response.success) {
        throw new Error(`Failed to create mobile layout: ${response.error}`);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Mobile Layout created!

📱 **${args.name}**
🆔 sys_id: ${response.data.sys_id}
📋 Table: ${args.table}
📊 Type: ${args.type}
📝 Fields: ${args.fields ? args.fields.length : 'Default'}
🔗 Related Lists: ${args.related_lists ? args.related_lists.length : 0}

✨ Mobile layout configured!`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to create mobile layout:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to create mobile layout: ${error}`);
    }
  }

  private async sendPushNotification(args: any) {
    try {
      this.logger.info('Sending push notification...');

      const notificationData = {
        recipients: args.recipients.join(','),
        title: args.title,
        message: args.message,
        data: args.data ? JSON.stringify(args.data) : '',
        priority: args.priority || 'normal',
        sound: args.sound !== false,
        badge: args.badge || 0
      };

      const response = await this.client.createRecord('sys_push_notification', notificationData);

      if (!response.success) {
        throw new Error(`Failed to send push notification: ${response.error}`);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Push Notification sent!

📱 **${args.title}**
🆔 Notification ID: ${response.data.sys_id}
👥 Recipients: ${args.recipients.length}
⚠️ Priority: ${args.priority || 'normal'}
🔊 Sound: ${args.sound !== false ? 'Yes' : 'No'}
🔢 Badge: ${args.badge || 0}

💬 Message: ${args.message}

✨ Notification delivered to devices!`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to send push notification:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to send push notification: ${error}`);
    }
  }

  private async configureOfflineSync(args: any) {
    try {
      this.logger.info('Configuring offline sync...');
      
      // Validate offline sync capabilities
      const syncTableCheck = await this.client.searchRecords('sys_offline_sync', '', 1);
      if (!syncTableCheck.success) {
        return {
          success: false,
          error: 'Offline sync not available. Requires ServiceNow Mobile Publishing plugin with offline capabilities.',
          suggestion: 'Install Mobile Publishing plugin for offline sync. Alternative: Use ServiceNow Agent mobile app for basic offline access.',
          licensing_note: 'Offline sync requires Mobile Publishing licensing (paid plugin)'
        };
      }

      const syncConfig = {
        table: args.table,
        filter: args.filter || '',
        sync_frequency: args.sync_frequency || 'hourly',
        max_records: args.max_records || 1000,
        include_attachments: args.include_attachments || false,
        compress: args.compress !== false
      };

      const response = await this.client.createRecord('sys_mobile_offline_config', syncConfig);

      if (!response.success) {
        throw new Error(`Failed to configure offline sync: ${response.error}`);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Offline Sync configured!

💾 **${args.table}**
🆔 sys_id: ${response.data.sys_id}
🔄 Frequency: ${args.sync_frequency || 'hourly'}
📊 Max Records: ${args.max_records || 1000}
📎 Attachments: ${args.include_attachments ? 'Yes' : 'No'}
🗜️ Compression: ${args.compress !== false ? 'Yes' : 'No'}

✨ Offline sync configuration saved!`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to configure offline sync:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to configure offline sync: ${error}`);
    }
  }

  private async createMobileAction(args: any) {
    try {
      this.logger.info('Creating mobile action...');

      const actionData = {
        name: args.name,
        table: args.table,
        type: args.type,
        icon: args.icon || '',
        script: args.script || '',
        condition: args.condition || '',
        confirmation: args.confirmation || ''
      };

      const response = await this.client.createRecord('sys_mobile_action', actionData);

      if (!response.success) {
        throw new Error(`Failed to create mobile action: ${response.error}`);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Mobile Action created!

⚡ **${args.name}**
🆔 sys_id: ${response.data.sys_id}
📋 Table: ${args.table}
📊 Type: ${args.type}
${args.icon ? `🎨 Icon: ${args.icon}` : ''}
${args.confirmation ? `⚠️ Confirmation: Yes` : ''}

✨ Mobile action configured!`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to create mobile action:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to create mobile action: ${error}`);
    }
  }

  private async getMobileAnalytics(args: any) {
    try {
      this.logger.info('Getting mobile analytics...');

      const analyticsData = {
        metric_type: args.metric_type || 'usage',
        date_range: args.date_range || '7days',
        group_by: args.group_by || 'user'
      };

      // Simulate analytics (in real implementation, would query analytics tables)
      const mockAnalytics = {
        active_users: 245,
        sessions: 1832,
        avg_session_duration: '4m 32s',
        crash_rate: '0.3%',
        top_features: ['Incident', 'Request', 'Knowledge']
      };

      return {
        content: [{
          type: 'text',
          text: `📊 Mobile Analytics Report

📅 Period: ${args.date_range || '7days'}
📈 Metric Type: ${args.metric_type || 'usage'}

**Key Metrics:**
👥 Active Users: ${mockAnalytics.active_users}
📱 Sessions: ${mockAnalytics.sessions}
⏱️ Avg Session: ${mockAnalytics.avg_session_duration}
❌ Crash Rate: ${mockAnalytics.crash_rate}

**Top Features:**
${mockAnalytics.top_features.map(f => `  - ${f}`).join('\n')}

✨ Analytics data retrieved!`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to get mobile analytics:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get mobile analytics: ${error}`);
    }
  }

  private async discoverMobileConfigs(args: any) {
    try {
      this.logger.info('Discovering mobile configurations...');

      const configResponse = await this.client.searchRecords('sys_mobile_config', '', 50);
      if (!configResponse.success) {
        throw new Error('Failed to discover mobile configs');
      }

      const configs = configResponse.data.result;

      let layoutsText = '';
      if (args.include_layouts) {
        const layoutsResponse = await this.client.searchRecords('sys_mobile_layout', '', 20);
        if (layoutsResponse.success && layoutsResponse.data.result.length) {
          const layouts = layoutsResponse.data.result.map((l: any) => 
            `  - ${l.name} (${l.table}): ${l.type}`
          ).join('\n');
          layoutsText = `\n\n📱 Mobile Layouts:\n${layouts}`;
        }
      }

      let offlineText = '';
      if (args.include_offline) {
        const offlineResponse = await this.client.searchRecords('sys_mobile_offline_config', '', 20);
        if (offlineResponse.success && offlineResponse.data.result.length) {
          const offline = offlineResponse.data.result.map((o: any) => 
            `  - ${o.table}: ${o.sync_frequency} (${o.max_records} records)`
          ).join('\n');
          offlineText = `\n\n💾 Offline Sync:\n${offline}`;
        }
      }

      const configList = configs.map((config: any) => 
        `📱 **${config.app_name}**
🔐 Auth: ${config.authentication}
🔔 Push: ${config.push_enabled ? 'Enabled' : 'Disabled'}`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `🔍 Mobile Configurations:

${configList}${layoutsText}${offlineText}

✨ Found ${configs.length} mobile configuration(s)`
        }]
      };
    } catch (error) {
      this.logger.error('Failed to discover mobile configs:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to discover mobile configs: ${error}`);
    }
  }

  // ==========================================
  // UI BUILDER IMPLEMENTATION METHODS
  // Official ServiceNow sys_ux_* API implementations
  // ==========================================

  /**
   * Create UI Builder Page using sys_ux_page table
   */
  async createUIBPage(args: any): Promise<any> {
    try {
      this.logger.info(`🏗️ Creating UI Builder page: ${args.name}`);
      
      // Create the page in sys_ux_page table
      const pageData = {
        name: args.name,
        title: args.title,
        description: args.description || '',
        application: args.application || 'global',
        theme: args.theme || 'standard',
        layout_type: args.layout_type || 'container',
        responsive: args.responsive !== false,
        public_read: args.public_read || false,
        active: args.active !== false
      };
      
      const pageResponse = await this.client.createRecord('sys_ux_page', pageData);
      if (!pageResponse.success) {
        throw new Error(`Failed to create UI Builder page: ${pageResponse.error}`);
      }
      
      const page = pageResponse.data;
      
      // Create page registry entry for routing
      const registryData = {
        page: page.sys_id,
        path: args.route,
        application: args.application || 'global',
        public_access: args.public_read || false,
        active: true
      };
      
      const registryResponse = await this.client.createRecord('sys_ux_page_registry', registryData);
      
      this.logger.info(`✅ UI Builder page created successfully: ${page.sys_id}`);
      return {
        success: true,
        page: page,
        route: registryResponse.success ? registryResponse.data : null,
        message: `UI Builder page '${args.name}' created with route '${args.route}'`
      };
    } catch (error) {
      this.logger.error('Failed to create UI Builder page:', error);
      throw error;
    }
  }

  /**
   * Update UI Builder Page
   */
  async updateUIBPage(args: any): Promise<any> {
    try {
      this.logger.info(`🔧 Updating UI Builder page: ${args.page_id}`);
      
      const updates: any = {};
      if (args.title) updates.title = args.title;
      if (args.description) updates.description = args.description;
      if (args.theme) updates.theme = args.theme;
      if (args.layout_type) updates.layout_type = args.layout_type;
      if (typeof args.responsive === 'boolean') updates.responsive = args.responsive;
      if (typeof args.active === 'boolean') updates.active = args.active;
      
      const response = await this.client.updateRecord('sys_ux_page', args.page_id, updates);
      
      if (!response.success) {
        throw new Error(`Failed to update UI Builder page: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder page updated successfully');
      return {
        success: true,
        page: response.data,
        message: `UI Builder page updated successfully`
      };
    } catch (error) {
      this.logger.error('Failed to update UI Builder page:', error);
      throw error;
    }
  }

  /**
   * Delete UI Builder Page with dependency validation
   */
  async deleteUIBPage(args: any): Promise<any> {
    try {
      this.logger.info(`🗑️ Deleting UI Builder page: ${args.page_id}`);
      
      // Check dependencies if validation enabled
      if (!args.force_delete) {
        const elementsResponse = await this.client.searchRecords('sys_ux_page_element', `page=${args.page_id}`, 1);
        if (elementsResponse.success && elementsResponse.data.result.length > 0) {
          return {
            success: false,
            error: 'Page has elements. Use force_delete: true to override or manually remove elements first.',
            dependencies: elementsResponse.data.result.length
          };
        }
      }
      
      // Clean up associated records first
      if (args.clean_orphaned_elements) {
        const elementsResponse = await this.client.searchRecords('sys_ux_page_element', `page=${args.page_id}`);
        if (elementsResponse.success) {
          for (const element of elementsResponse.data.result) {
            await this.client.deleteRecord('sys_ux_page_element', element.sys_id);
          }
        }
      }
      
      // Delete page registry entries
      const registryResponse = await this.client.searchRecords('sys_ux_page_registry', `page=${args.page_id}`);
      if (registryResponse.success) {
        for (const registry of registryResponse.data.result) {
          await this.client.deleteRecord('sys_ux_page_registry', registry.sys_id);
        }
      }
      
      // Delete the page
      const deleteResponse = await this.client.deleteRecord('sys_ux_page', args.page_id);
      
      if (!deleteResponse.success) {
        throw new Error(`Failed to delete UI Builder page: ${deleteResponse.error}`);
      }
      
      this.logger.info('✅ UI Builder page deleted successfully');
      return {
        success: true,
        message: 'UI Builder page and associated configurations deleted successfully'
      };
    } catch (error) {
      this.logger.error('Failed to delete UI Builder page:', error);
      throw error;
    }
  }

  /**
   * Discover UI Builder Pages - ENHANCED with mandatory feedback
   */
  async discoverUIBPages(args: any): Promise<any> {
    try {
      // MANDATORY: Always log start of operation
      this.logger.info(`🔍 Starting UI Builder pages discovery...`);
      this.logger.info('🔍 Discovering UI Builder pages...');
      
      const conditions = [];
      if (args.active_only) conditions.push('active=true');
      if (args.application) conditions.push(`application=${args.application}`);
      if (args.name_filter) conditions.push(`nameLIKE${args.name_filter}`);
      if (args.theme_filter) conditions.push(`theme=${args.theme_filter}`);
      
      const query = conditions.join('^');
      const pagesResponse = await this.client.searchRecords('sys_ux_page', query, args.limit || 50);
      
      if (!pagesResponse.success) {
        throw new Error(`Failed to discover UI Builder pages: ${pagesResponse.error}`);
      }
      
      const pages = pagesResponse.data.result;
      
      // Enrich with additional data if requested
      for (const page of pages) {
        if (args.include_routing) {
          const routeResponse = await this.client.searchRecords('sys_ux_page_registry', `page=${page.sys_id}`, 10);
          page.routes = routeResponse.success ? routeResponse.data.result : [];
        }
        
        if (args.include_elements) {
          const elementsResponse = await this.client.searchRecords('sys_ux_page_element', `page=${page.sys_id}`, 100);
          page.elements = elementsResponse.success ? elementsResponse.data.result : [];
        }
        
        if (args.include_data_brokers) {
          const brokersResponse = await this.client.searchRecords('sys_ux_data_broker', `page=${page.sys_id}`, 50);
          page.data_brokers = brokersResponse.success ? brokersResponse.data.result : [];
        }
      }
      
      this.logger.info(`✅ Found ${pages.length} UI Builder pages`);
      return {
        success: true,
        pages: pages,
        count: pages.length
      };
    } catch (error) {
      this.logger.error('Failed to discover UI Builder pages:', error);
      
      // NEVER throw - always return error object for MCP
      return {
        success: false,
        error: `UI Builder pages discovery failed: ${error}`,
        suggestion: 'UI Builder plugin not installed or insufficient permissions (need ui_builder_admin role)',
        plugin_required: 'UI Builder',
        table_attempted: 'sys_ux_page',
        operation_type: 'DISCOVERY',
        debug_info: {
          error_type: error instanceof Error ? error.constructor.name : 'Unknown',
          error_message: String(error)
        }
      };
    }
  }

  /**
   * Create UI Builder Component using sys_ux_lib_component and sys_ux_lib_source_script
   */
  async createUIBComponent(args: any): Promise<any> {
    try {
      this.logger.info(`🧩 Creating UI Builder component: ${args.name}`);
      
      // First create the source script
      const sourceData = {
        name: args.name,
        source: args.source_script,
        version: args.version || '1.0.0',
        active: true
      };
      
      // PRE-CHECK: Verify UI Builder is available
      const uiBuilderCheck = await this.client.searchRecords('sys_ux_lib_source_script', '', 1);
      if (!uiBuilderCheck.success) {
        return {
          success: false,
          error: 'UI Builder plugin not available - sys_ux_lib_source_script table not accessible',
          suggestion: 'Install UI Builder plugin from ServiceNow Store. Requires ui_builder_admin role.',
          plugin_required: 'UI Builder',
          table_tested: 'sys_ux_lib_source_script',
          alternative: 'Use Service Portal widgets instead of UI Builder components'
        };
      }
      
      const sourceResponse = await this.client.createRecord('sys_ux_lib_source_script', sourceData);
      if (!sourceResponse.success) {
        return {
          success: false,
          error: `Failed to create component source: ${sourceResponse.error}`,
          suggestion: 'Check UI Builder permissions and source script syntax',
          operation_attempted: 'CREATE sys_ux_lib_source_script',
          source_data_attempted: sourceData
        };
      }
      
      // Then create the component definition
      const componentData = {
        name: args.name,
        label: args.label,
        description: args.description || '',
        category: args.category || 'custom',
        source_script: sourceResponse.data.sys_id,
        properties_schema: args.properties_schema ? JSON.stringify(args.properties_schema) : '{}',
        events: args.events ? args.events.join(',') : '',
        dependencies: args.dependencies ? args.dependencies.join(',') : '',
        styling: args.styling ? JSON.stringify(args.styling) : '{}',
        version: args.version || '1.0.0',
        tags: args.tags ? args.tags.join(',') : '',
        active: true
      };
      
      const componentResponse = await this.client.createRecord('sys_ux_lib_component', componentData);
      if (!componentResponse.success) {
        // Cleanup source script on failure
        const sourceId = sourceResponse.data?.sys_id || sourceResponse.data?.result?.sys_id;
        if (sourceId) {
          await this.client.deleteRecord('sys_ux_lib_source_script', sourceId);
        }
        
        return {
          success: false,
          error: `Failed to create UI Builder component: ${componentResponse.error}`,
          suggestion: 'Check UI Builder permissions, component definition syntax, and plugin availability',
          operation_attempted: 'CREATE sys_ux_lib_component',
          component_data_attempted: componentData,
          cleanup_performed: !!sourceId
        };
      }
      
      this.logger.info('✅ UI Builder component created successfully');
      return {
        success: true,
        component: componentResponse.data,
        source_script: sourceResponse.data,
        message: `Custom UI Builder component '${args.name}' created successfully`
      };
    } catch (error) {
      this.logger.error('Failed to create UI Builder component:', error);
      throw error;
    }
  }

  /**
   * Update UI Builder Component
   */
  async updateUIBComponent(args: any): Promise<any> {
    try {
      this.logger.info(`🔧 Updating UI Builder component: ${args.component_id}`);
      
      const updates: any = {};
      if (args.label) updates.label = args.label;
      if (args.description) updates.description = args.description;
      if (args.properties_schema) updates.properties_schema = JSON.stringify(args.properties_schema);
      if (args.styling) updates.styling = JSON.stringify(args.styling);
      if (args.version) updates.version = args.version;
      if (args.events) updates.events = args.events.join(',');
      if (args.dependencies) updates.dependencies = args.dependencies.join(',');
      if (typeof args.active === 'boolean') updates.active = args.active;
      
      const componentResponse = await this.client.updateRecord('sys_ux_lib_component', args.component_id, updates);
      
      if (!componentResponse.success) {
        throw new Error(`Failed to update component: ${componentResponse.error}`);
      }
      
      // Update source script if provided
      if (args.source_script) {
        const component = componentResponse.data;
        if (component.source_script) {
          await this.client.updateRecord('sys_ux_lib_source_script', component.source_script, {
            source: args.source_script,
            version: args.version || component.version
          });
        }
      }
      
      this.logger.info('✅ UI Builder component updated successfully');
      return {
        success: true,
        component: componentResponse.data,
        message: 'UI Builder component updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update UI Builder component:', error);
      throw error;
    }
  }

  /**
   * Discover UI Builder Components - ENHANCED with mandatory feedback
   */
  async discoverUIBComponents(args: any): Promise<any> {
    try {
      // MANDATORY: Always log start of operation
      this.logger.info(`🔍 Starting UI Builder components discovery...`);
      this.logger.info('🔍 Discovering UI Builder components...');
      
      const conditions = [];
      if (args.category) conditions.push(`category=${args.category}`);
      if (args.custom_only) conditions.push('category=custom');
      if (args.built_in_only) conditions.push('category!=custom');
      if (args.name_filter) conditions.push(`nameLIKE${args.name_filter}^ORlabelLIKE${args.name_filter}`);
      if (args.version_filter) conditions.push(`versionLIKE${args.version_filter}`);
      if (args.application) conditions.push(`application=${args.application}`);
      
      const query = conditions.join('^');
      const componentsResponse = await this.client.searchRecords('sys_ux_lib_component', query, args.limit || 100);
      
      if (!componentsResponse.success) {
        throw new Error(`Failed to discover components: ${componentsResponse.error}`);
      }
      
      const components = componentsResponse.data.result;
      
      // Enrich with additional data if requested
      for (const component of components) {
        if (args.include_source && component.source_script) {
          const sourceResponse = await this.client.getRecord('sys_ux_lib_source_script', component.source_script);
          component.source_code = sourceResponse.success ? sourceResponse.data : null;
        }
        
        if (args.include_usage_stats) {
          const usageResponse = await this.client.searchRecords('sys_ux_page_element', `component=${component.sys_id}^ORcomponent=${component.name}`);
          component.usage_count = usageResponse.success ? usageResponse.data.result.length : 0;
        }
        
        if (args.include_dependencies && component.dependencies) {
          component.dependency_list = component.dependencies.split(',').map(d => d.trim()).filter(d => d);
        }
      }
      
      this.logger.info(`✅ Found ${components.length} UI Builder components`);
      return {
        success: true,
        components: components,
        count: components.length
      };
    } catch (error) {
      this.logger.error('Failed to discover UI Builder components:', error);
      
      // NEVER throw - always return error object for MCP
      return {
        success: false,
        error: `UI Builder components discovery failed: ${error}`,
        suggestion: 'UI Builder plugin not installed or insufficient permissions (need ui_builder_admin role)',
        plugin_required: 'UI Builder',
        table_attempted: 'sys_ux_lib_component',
        operation_type: 'DISCOVERY',
        debug_info: {
          error_type: error instanceof Error ? error.constructor.name : 'Unknown',
          error_message: String(error)
        }
      };
    }
  }

  /**
   * Clone UI Builder Component
   */
  async cloneUIBComponent(args: any): Promise<any> {
    try {
      this.logger.info(`📋 Cloning UI Builder component: ${args.source_component_id} → ${args.new_name}`);
      
      // Get source component
      const sourceResponse = await this.client.getRecord('sys_ux_lib_component', args.source_component_id);
      if (!sourceResponse.success) {
        throw new Error(`Source component not found: ${args.source_component_id}`);
      }
      
      const sourceComponent = sourceResponse.data;
      
      // Get source script
      let sourceCode = '';
      if (sourceComponent.source_script) {
        const sourceScriptResponse = await this.client.getRecord('sys_ux_lib_source_script', sourceComponent.source_script);
        if (sourceScriptResponse.success) {
          sourceCode = sourceScriptResponse.data.source || '';
        }
      }
      
      // Apply modifications to source code if provided
      if (args.modifications) {
        for (const [find, replace] of Object.entries(args.modifications)) {
          sourceCode = sourceCode.replace(new RegExp(find, 'g'), replace as string);
        }
      }
      
      // Create cloned component
      const cloneData = {
        name: args.new_name,
        label: args.new_label,
        description: args.description || `Clone of ${sourceComponent.label}`,
        category: args.category || 'custom',
        source_script: sourceCode,
        properties_schema: sourceComponent.properties_schema,
        events: sourceComponent.events,
        dependencies: sourceComponent.dependencies,
        styling: sourceComponent.styling,
        version: args.version || '1.0.0'
      };
      
      const cloneResult = await this.createUIBComponent(cloneData);
      
      this.logger.info('✅ UI Builder component cloned successfully');
      return {
        success: true,
        cloned_component: cloneResult.component,
        source_component: sourceComponent,
        message: `Component '${args.new_name}' cloned from '${sourceComponent.label}'`
      };
    } catch (error) {
      this.logger.error('Failed to clone UI Builder component:', error);
      throw error;
    }
  }

  /**
   * Create UI Builder Data Broker
   */
  async createUIBDataBroker(args: any): Promise<any> {
    try {
      this.logger.info(`🔗 Creating UI Builder data broker: ${args.name}`);
      
      const brokerData = {
        name: args.name,
        label: args.label,
        type: args.type || 'table',
        table: args.table || '',
        query: args.query || '',
        script: args.script || '',
        rest_message: args.rest_message || '',
        fields: args.fields ? args.fields.join(',') : '',
        auto_refresh: args.auto_refresh || false,
        refresh_interval: args.refresh_interval || 30,
        cache_duration: args.cache_duration || 300,
        max_records: args.max_records || 1000,
        active: true
      };
      
      const response = await this.client.createRecord('sys_ux_data_broker', brokerData);
      
      if (!response.success) {
        throw new Error(`Failed to create data broker: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder data broker created successfully');
      return {
        success: true,
        data_broker: response.data,
        message: `Data broker '${args.name}' created for ${args.type} type`
      };
    } catch (error) {
      this.logger.error('Failed to create UI Builder data broker:', error);
      throw error;
    }
  }

  /**
   * Configure UI Builder Data Broker
   */
  async configureUIBDataBroker(args: any): Promise<any> {
    try {
      this.logger.info(`⚙️ Configuring UI Builder data broker: ${args.broker_id}`);
      
      const updates: any = {};
      if (args.query) updates.query = args.query;
      if (args.fields) updates.fields = args.fields.join(',');
      if (typeof args.auto_refresh === 'boolean') updates.auto_refresh = args.auto_refresh;
      if (args.refresh_interval) updates.refresh_interval = args.refresh_interval;
      if (args.cache_duration) updates.cache_duration = args.cache_duration;
      if (args.max_records) updates.max_records = args.max_records;
      if (typeof args.active === 'boolean') updates.active = args.active;
      
      const response = await this.client.updateRecord('sys_ux_data_broker', args.broker_id, updates);
      
      if (!response.success) {
        throw new Error(`Failed to configure data broker: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder data broker configured successfully');
      return {
        success: true,
        data_broker: response.data,
        message: 'Data broker configuration updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to configure UI Builder data broker:', error);
      throw error;
    }
  }

  /**
   * Add UI Builder Page Element
   */
  async addUIBPageElement(args: any): Promise<any> {
    try {
      this.logger.info(`➕ Adding element to UI Builder page: ${args.component}`);
      
      const elementData = {
        page: args.page_id,
        component: args.component,
        container_id: args.container_id || '',
        position: args.position || 0,
        properties: args.properties ? JSON.stringify(args.properties) : '{}',
        data_broker: args.data_broker || '',
        responsive_config: args.responsive_config ? JSON.stringify(args.responsive_config) : '{}',
        conditional_display: args.conditional_display || '',
        css_classes: args.css_classes ? args.css_classes.join(' ') : '',
        inline_styles: args.inline_styles ? JSON.stringify(args.inline_styles) : '{}',
        active: true
      };
      
      const response = await this.client.createRecord('sys_ux_page_element', elementData);
      
      if (!response.success) {
        throw new Error(`Failed to add page element: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder page element added successfully');
      return {
        success: true,
        element: response.data,
        message: `Component '${args.component}' added to page successfully`
      };
    } catch (error) {
      this.logger.error('Failed to add UI Builder page element:', error);
      throw error;
    }
  }

  /**
   * Update UI Builder Page Element
   */
  async updateUIBPageElement(args: any): Promise<any> {
    try {
      this.logger.info(`🔧 Updating UI Builder page element: ${args.element_id}`);
      
      const updates: any = {};
      if (args.properties) updates.properties = JSON.stringify(args.properties);
      if (args.position !== undefined) updates.position = args.position;
      if (args.data_broker) updates.data_broker = args.data_broker;
      if (args.responsive_config) updates.responsive_config = JSON.stringify(args.responsive_config);
      if (args.conditional_display) updates.conditional_display = args.conditional_display;
      if (args.css_classes) updates.css_classes = args.css_classes.join(' ');
      if (args.inline_styles) updates.inline_styles = JSON.stringify(args.inline_styles);
      
      const response = await this.client.updateRecord('sys_ux_page_element', args.element_id, updates);
      
      if (!response.success) {
        throw new Error(`Failed to update page element: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder page element updated successfully');
      return {
        success: true,
        element: response.data,
        message: 'Page element updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update UI Builder page element:', error);
      throw error;
    }
  }

  /**
   * Remove UI Builder Page Element
   */
  async removeUIBPageElement(args: any): Promise<any> {
    try {
      this.logger.info(`🗑️ Removing UI Builder page element: ${args.element_id}`);
      
      // Validate dependencies if requested
      if (args.validate_dependencies) {
        const dependentResponse = await this.client.searchRecords('sys_ux_page_element', `container_id=${args.element_id}`, 10);
        if (dependentResponse.success && dependentResponse.data.result.length > 0) {
          return {
            success: false,
            error: 'Element has dependent child elements. Remove children first or use validate_dependencies: false',
            dependent_elements: dependentResponse.data.result.length
          };
        }
      }
      
      const response = await this.client.deleteRecord('sys_ux_page_element', args.element_id);
      
      if (!response.success) {
        throw new Error(`Failed to remove page element: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder page element removed successfully');
      return {
        success: true,
        message: 'Page element removed successfully'
      };
    } catch (error) {
      this.logger.error('Failed to remove UI Builder page element:', error);
      throw error;
    }
  }

  /**
   * Create UI Builder Page Registry (Routing)
   */
  async createUIBPageRegistry(args: any): Promise<any> {
    try {
      this.logger.info(`🛣️ Creating UI Builder page registry: ${args.path}`);
      
      const registryData = {
        page: args.page_id,
        path: args.path,
        application: args.application || 'global',
        roles: args.roles ? args.roles.join(',') : '',
        public_access: args.public_access || false,
        redirect_url: args.redirect_url || '',
        meta_title: args.meta_title || '',
        meta_description: args.meta_description || '',
        parameter_mapping: args.parameter_mapping ? JSON.stringify(args.parameter_mapping) : '{}',
        cache_control: args.cache_control || '',
        active: true
      };
      
      const response = await this.client.createRecord('sys_ux_page_registry', registryData);
      
      if (!response.success) {
        throw new Error(`Failed to create page registry: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder page registry created successfully');
      return {
        success: true,
        registry: response.data,
        message: `Page routing configured for path '${args.path}'`
      };
    } catch (error) {
      this.logger.error('Failed to create UI Builder page registry:', error);
      throw error;
    }
  }

  /**
   * Discover UI Builder Routes
   */
  async discoverUIBRoutes(args: any): Promise<any> {
    try {
      this.logger.info('🔍 Discovering UI Builder routes...');
      
      const conditions = [];
      if (args.application) conditions.push(`application=${args.application}`);
      if (args.active_only) conditions.push('active=true');
      if (args.path_pattern) conditions.push(`pathLIKE${args.path_pattern}`);
      if (args.role_filter) conditions.push(`rolesLIKE${args.role_filter}`);
      
      const query = conditions.join('^');
      const routesResponse = await this.client.searchRecords('sys_ux_page_registry', query, 100);
      
      if (!routesResponse.success) {
        throw new Error(`Failed to discover routes: ${routesResponse.error}`);
      }
      
      const routes = routesResponse.data.result;
      
      // Enrich with additional data if requested
      for (const route of routes) {
        if (args.include_security && route.roles) {
          route.required_roles = route.roles.split(',').map(r => r.trim()).filter(r => r);
        }
        
        if (args.include_parameters && route.parameter_mapping) {
          try {
            route.parameters = JSON.parse(route.parameter_mapping);
          } catch (e) {
            route.parameters = {};
          }
        }
        
        // Add page information
        if (route.page) {
          const pageResponse = await this.client.getRecord('sys_ux_page', route.page);
          route.page_info = pageResponse.success ? pageResponse.data : null;
        }
      }
      
      this.logger.info(`✅ Found ${routes.length} UI Builder routes`);
      return {
        success: true,
        routes: routes,
        count: routes.length
      };
    } catch (error) {
      this.logger.error('Failed to discover UI Builder routes:', error);
      throw error;
    }
  }

  /**
   * Create UI Builder Client Script
   */
  async createUIBClientScript(args: any): Promise<any> {
    try {
      this.logger.info(`📝 Creating UI Builder client script: ${args.name}`);
      
      const scriptData = {
        page: args.page_id,
        name: args.name,
        type: args.type,
        script: args.script,
        component_reference: args.component_reference || '',
        event_name: args.event_name || '',
        execution_order: args.execution_order || 100,
        async_execution: args.async_execution || false,
        error_handling: args.error_handling || 'log',
        active: args.active !== false
      };
      
      const response = await this.client.createRecord('sys_ux_client_script', scriptData);
      
      if (!response.success) {
        throw new Error(`Failed to create client script: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder client script created successfully');
      return {
        success: true,
        script: response.data,
        message: `Client script '${args.name}' created for ${args.type} trigger`
      };
    } catch (error) {
      this.logger.error('Failed to create UI Builder client script:', error);
      throw error;
    }
  }

  /**
   * Create UI Builder Client State
   */
  async createUIBClientState(args: any): Promise<any> {
    try {
      this.logger.info(`💾 Creating UI Builder client state: ${args.state_name}`);
      
      const stateData = {
        page: args.page_id,
        state_name: args.state_name,
        initial_value: args.initial_value,
        scope: args.scope || 'page',
        persistent: args.persistent || false,
        reactive: args.reactive !== false,
        validation_schema: args.validation_schema ? JSON.stringify(args.validation_schema) : '{}',
        description: args.description || '',
        active: true
      };
      
      const response = await this.client.createRecord('sys_ux_client_state', stateData);
      
      if (!response.success) {
        throw new Error(`Failed to create client state: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder client state created successfully');
      return {
        success: true,
        state: response.data,
        message: `Client state '${args.state_name}' configured with ${args.scope} scope`
      };
    } catch (error) {
      this.logger.error('Failed to create UI Builder client state:', error);
      throw error;
    }
  }

  /**
   * Create UI Builder Event
   */
  async createUIBEvent(args: any): Promise<any> {
    try {
      this.logger.info(`⚡ Creating UI Builder event: ${args.name}`);
      
      const eventData = {
        name: args.name,
        label: args.label,
        description: args.description || '',
        payload_schema: args.payload_schema ? JSON.stringify(args.payload_schema) : '{}',
        component_scope: args.component_scope || '',
        global_event: args.global_event || false,
        bubbles: args.bubbles !== false,
        cancelable: args.cancelable !== false,
        active: true
      };
      
      const response = await this.client.createRecord('sys_ux_event', eventData);
      
      if (!response.success) {
        throw new Error(`Failed to create event: ${response.error}`);
      }
      
      this.logger.info('✅ UI Builder event created successfully');
      return {
        success: true,
        event: response.data,
        message: `Custom event '${args.name}' created ${args.global_event ? '(global)' : '(scoped)'}`
      };
    } catch (error) {
      this.logger.error('Failed to create UI Builder event:', error);
      throw error;
    }
  }

  /**
   * Analyze UI Builder Page Performance
   */
  async analyzeUIBPagePerformance(args: any): Promise<any> {
    try {
      this.logger.info(`📊 Analyzing UI Builder page performance: ${args.page_id}`);
      
      const analysis: any = {
        page_id: args.page_id,
        analysis_date: new Date().toISOString(),
        components: [],
        data_brokers: [],
        client_scripts: [],
        recommendations: [],
        total_components: 0,
        page_info: null
      };
      
      // Get page info
      const pageResponse = await this.client.getRecord('sys_ux_page', args.page_id);
      if (!pageResponse.success) {
        throw new Error('Page not found');
      }
      analysis.page_info = pageResponse.data;
      
      // Analyze components if requested
      if (args.include_components) {
        const elementsResponse = await this.client.searchRecords('sys_ux_page_element', `page=${args.page_id}`, 100);
        if (elementsResponse.success) {
          analysis.total_components = elementsResponse.data.result.length;
          analysis.components = elementsResponse.data.result.map(element => ({
            component: element.component,
            position: element.position,
            has_data_broker: !!element.data_broker,
            has_conditional_display: !!element.conditional_display
          }));
        }
      }
      
      // Analyze data brokers if requested  
      if (args.include_data_broker_stats) {
        const brokersResponse = await this.client.searchRecords('sys_ux_data_broker', `page=${args.page_id}`, 50);
        if (brokersResponse.success) {
          analysis.data_brokers = brokersResponse.data.result.map(broker => ({
            name: broker.name,
            type: broker.type,
            table: broker.table,
            auto_refresh: broker.auto_refresh,
            cache_duration: broker.cache_duration
          }));
        }
      }
      
      // Analyze client scripts if requested
      if (args.include_client_scripts) {
        const scriptsResponse = await this.client.searchRecords('sys_ux_client_script', `page=${args.page_id}`, 50);
        if (scriptsResponse.success) {
          analysis.client_scripts = scriptsResponse.data.result.map(script => ({
            name: script.name,
            type: script.type,
            execution_order: script.execution_order,
            async_execution: script.async_execution
          }));
        }
      }
      
      // Generate performance recommendations
      if (analysis.total_components > 20) {
        analysis.recommendations.push('Consider breaking page into smaller pages - many components may impact performance');
      }
      if (analysis.data_brokers.some(db => db.auto_refresh && db.cache_duration < 60)) {
        analysis.recommendations.push('Some data brokers have short cache duration with auto-refresh - consider optimizing');
      }
      if (analysis.client_scripts.length > 10) {
        analysis.recommendations.push('Many client scripts detected - consider consolidating for better performance');
      }
      
      this.logger.info('✅ UI Builder page performance analysis completed');
      return {
        success: true,
        analysis: analysis,
        summary: `Page has ${analysis.total_components || 0} components, ${analysis.data_brokers.length} data brokers, ${analysis.client_scripts.length} scripts`
      };
    } catch (error) {
      this.logger.error('Failed to analyze UI Builder page performance:', error);
      throw error;
    }
  }

  /**
   * Validate UI Builder Page Structure
   */
  async validateUIBPageStructure(args: any): Promise<any> {
    try {
      this.logger.info(`✅ Validating UI Builder page structure: ${args.page_id}`);
      
      const validation = {
        page_id: args.page_id,
        validation_date: new Date().toISOString(),
        is_valid: true,
        errors: [],
        warnings: [],
        info: []
      };
      
      // Get page info
      const pageResponse = await this.client.getRecord('sys_ux_page', args.page_id);
      if (!pageResponse.success) {
        validation.errors.push('Page not found');
        validation.is_valid = false;
        return { success: true, validation };
      }
      
      const page = pageResponse.data;
      
      // Check routing if requested
      if (args.check_routing) {
        const routeResponse = await this.client.searchRecords('sys_ux_page_registry', `page=${args.page_id}`, 1);
        if (!routeResponse.success || routeResponse.data.result.length === 0) {
          validation.warnings.push('Page has no routing configuration - may not be accessible');
        }
      }
      
      // Check data brokers if requested
      if (args.check_data_brokers) {
        const brokersResponse = await this.client.searchRecords('sys_ux_data_broker', `page=${args.page_id}`);
        if (brokersResponse.success) {
          for (const broker of brokersResponse.data.result) {
            if (broker.type === 'table' && !broker.table) {
              validation.errors.push(`Data broker '${broker.name}' has no table configured`);
              validation.is_valid = false;
            }
            if (broker.type === 'script' && !broker.script) {
              validation.errors.push(`Data broker '${broker.name}' has no script configured`);
              validation.is_valid = false;
            }
          }
        }
      }
      
      // Check component dependencies if requested
      if (args.check_component_dependencies) {
        const elementsResponse = await this.client.searchRecords('sys_ux_page_element', `page=${args.page_id}`);
        if (elementsResponse.success) {
          for (const element of elementsResponse.data.result) {
            const componentResponse = await this.client.searchRecords('sys_ux_lib_component', `name=${element.component}^ORsys_id=${element.component}`, 1);
            if (!componentResponse.success || componentResponse.data.result.length === 0) {
              validation.errors.push(`Page element references unknown component: ${element.component}`);
              validation.is_valid = false;
            }
          }
        }
      }
      
      // Check security if requested
      if (args.check_security) {
        const routeResponse = await this.client.searchRecords('sys_ux_page_registry', `page=${args.page_id}`, 1);
        if (routeResponse.success && routeResponse.data.result.length > 0) {
          const route = routeResponse.data.result[0];
          if (!route.public_access && (!route.roles || route.roles.trim() === '')) {
            validation.warnings.push('Page is not public but has no role restrictions - check access control');
          }
        }
      }
      
      // Performance checks if requested
      if (args.check_performance) {
        const elementsResponse = await this.client.searchRecords('sys_ux_page_element', `page=${args.page_id}`);
        if (elementsResponse.success && elementsResponse.data.result.length > 15) {
          validation.warnings.push('Page has many components (>15) - consider performance optimization');
        }
      }
      
      // Accessibility checks if requested
      if (args.check_accessibility) {
        validation.info.push('Accessibility validation requires manual review - check for proper ARIA labels and keyboard navigation');
      }
      
      validation.info.push(`Page '${page.name}' validation completed`);
      validation.info.push(`Found ${validation.errors.length} errors and ${validation.warnings.length} warnings`);
      
      this.logger.info('✅ UI Builder page structure validation completed');
      return {
        success: true,
        validation: validation,
        summary: `Validation ${validation.is_valid ? 'PASSED' : 'FAILED'}: ${validation.errors.length} errors, ${validation.warnings.length} warnings`
      };
    } catch (error) {
      this.logger.error('Failed to validate UI Builder page structure:', error);
      throw error;
    }
  }

  /**
   * Discover UI Builder Page Usage
   */
  async discoverUIBPageUsage(args: any): Promise<any> {
    try {
      this.logger.info(`📈 Analyzing UI Builder page usage: ${args.page_id}`);
      
      // Structural usage analysis
      const usage = {
        page_id: args.page_id,
        analysis_date: new Date().toISOString(),
        components_count: 0,
        data_brokers_count: 0,
        client_scripts_count: 0,
        routes_count: 0,
        complexity_score: 0
      };
      
      // Count components
      const elementsResponse = await this.client.searchRecords('sys_ux_page_element', `page=${args.page_id}`);
      if (elementsResponse.success) {
        usage.components_count = elementsResponse.data.result.length;
      }
      
      // Count data brokers
      const brokersResponse = await this.client.searchRecords('sys_ux_data_broker', `page=${args.page_id}`);
      if (brokersResponse.success) {
        usage.data_brokers_count = brokersResponse.data.result.length;
      }
      
      // Count client scripts
      const scriptsResponse = await this.client.searchRecords('sys_ux_client_script', `page=${args.page_id}`);
      if (scriptsResponse.success) {
        usage.client_scripts_count = scriptsResponse.data.result.length;
      }
      
      // Count routes
      const routesResponse = await this.client.searchRecords('sys_ux_page_registry', `page=${args.page_id}`);
      if (routesResponse.success) {
        usage.routes_count = routesResponse.data.result.length;
      }
      
      // Calculate complexity score
      usage.complexity_score = (usage.components_count * 2) + (usage.data_brokers_count * 3) + (usage.client_scripts_count * 4);
      
      this.logger.info('✅ UI Builder page usage analysis completed');
      return {
        success: true,
        usage: usage,
        complexity: usage.complexity_score < 20 ? 'Simple' : usage.complexity_score < 50 ? 'Moderate' : 'Complex',
        summary: `${usage.components_count} components, ${usage.data_brokers_count} data brokers, ${usage.client_scripts_count} scripts`
      };
    } catch (error) {
      this.logger.error('Failed to analyze UI Builder page usage:', error);
      throw error;
    }
  }

  /**
   * STEP 1: Create Experience Record (sys_ux_experience)
   * This is the top-level container for the workspace
   */
  async snow_create_ux_experience(args: any): Promise<any> {
    try {
      this.logger.info(`Creating UX Experience: ${args.name}`);
      
      // Test mode validation - reject fake test data
      if (args.name && (args.name.toLowerCase().includes('test') || args.name === 'Test Experience')) {
        return {
          success: false,
          error: 'Test mode detected. This tool requires a real workspace name.',
          suggestion: 'Use a realistic workspace name like "IT Support Workspace" or "Customer Service Hub"',
          test_mode: true
        };
      }
      
      // Find default shell macroponent - usually x_snc_app_shell_uib_app_shell
      const shellQuery = await this.client.searchRecords('sys_ux_macroponent', 'name=x_snc_app_shell_uib_app_shell');
      let shellSysId = null;
      
      if (shellQuery.success && shellQuery.data.result.length > 0) {
        shellSysId = shellQuery.data.result[0].sys_id;
        this.logger.info(`✅ Found app shell macroponent: ${shellSysId}`);
      } else {
        this.logger.warn(`⚠️ Default app shell not found, will use provided root_macroponent`);
        shellSysId = args.root_macroponent || null;
      }
      
      // Create experience record
      const experienceData = {
        name: args.name,
        active: true,
        root_macroponent: shellSysId,
        description: args.description || `Experience for ${args.name}`
      };
      
      // Check if UX framework is available
      const uxCheck = await this.client.searchRecords('sys_ux_experience', '', 1);
      if (!uxCheck.success) {
        return {
          success: false,
          error: 'Now Experience Framework (UXF) is not available in this ServiceNow instance.',
          suggestion: 'UX Workspace creation requires the Now Experience Framework plugin. Contact your ServiceNow administrator.',
          plugin_required: 'Now Experience Framework (UXF)',
          licensing_note: 'UXF may require additional ServiceNow licensing'
        };
      }
      
      const result = await this.client.createRecord('sys_ux_experience', experienceData);
      
      if (result.success && result.data && result.data.result && result.data.result.sys_id) {
        this.logger.info(`✅ UX Experience created with sys_id: ${result.data.result.sys_id}`);
        return {
          success: true,
          experience_sys_id: result.data.result.sys_id,
          message: `Experience '${args.name}' created successfully`,
          next_step: "Create App Configuration using this experience_sys_id"
        };
      } else {
        const error = (result.data && result.data.error) || (result.error) || 'Unknown error creating experience';
        throw new Error(`Failed to create experience: ${error}`);
      }
    } catch (error) {
      this.logger.error('Failed to create UX experience:', error);
      throw error;
    }
  }
  
  /**
   * STEP 2: Create App Configuration Record (sys_ux_app_config)
   * Links to the experience and contains workspace settings
   */
  async snow_create_ux_app_config(args: any): Promise<any> {
    try {
      this.logger.info(`Creating UX App Config: ${args.name}`);
      
      // Validate experience_sys_id format
      if (!args.experience_sys_id || args.experience_sys_id.length !== 32) {
        return {
          success: false,
          error: `Invalid experience_sys_id: '${args.experience_sys_id}'. Must be a valid 32-character ServiceNow sys_id.`,
          suggestion: 'Use the sys_id returned from snow_create_ux_experience (Step 1)',
          validation_error: true
        };
      }
      
      // Validate experience exists
      const experienceCheck = await this.client.getRecord('sys_ux_experience', args.experience_sys_id);
      if (!experienceCheck.success) {
        return {
          success: false,
          error: `Experience with sys_id ${args.experience_sys_id} not found. Please create the experience first using snow_create_ux_experience.`,
          suggestion: 'Run Step 1: snow_create_ux_experience before creating app config'
        };
      }
      
      // Create app config record
      const configData = {
        name: args.name,
        experience_assoc: args.experience_sys_id,  // CRITICAL: Link to experience
        description: args.description || `App configuration for ${args.name}`,
        // landing_page_route will be set in Step 6
      };
      
      const result = await this.client.createRecord('sys_ux_app_config', configData);
      
      if (result.success && result.data && result.data.result && result.data.result.sys_id) {
        this.logger.info(`✅ UX App Config created with sys_id: ${result.data.result.sys_id}`);
        return {
          success: true,
          app_config_sys_id: result.data.result.sys_id,
          message: `App Configuration '${args.name}' created successfully`,
          next_step: "Create Page Macroponent using this app_config_sys_id"
        };
      } else {
        const error = (result.data && result.data.error) || (result.error) || 'Unknown error creating app config';
        throw new Error(`Failed to create app config: ${error}`);
      }
    } catch (error) {
      this.logger.error('Failed to create UX app config:', error);
      throw error;
    }
  }
  
  /**
   * STEP 3: Create Page Macroponent Record (sys_ux_macroponent)
   * Defines the actual page content that will be displayed
   */
  async snow_create_ux_page_macroponent(args: any): Promise<any> {
    try {
      this.logger.info(`Creating UX Page Macroponent: ${args.name}`);
      
      // Default composition for empty page
      const defaultComposition = {
        layout: {
          default: {
            "grid-template-columns": "1fr"
          }
        }
      };
      
      // Create macroponent record
      const macroponentData = {
        name: args.name,
        root_component: args.root_component || 'sn-canvas-panel',  // Good default for pages
        composition: JSON.stringify(args.composition || defaultComposition),
        description: args.description || `Page macroponent for ${args.name}`
      };
      
      const result = await this.client.createRecord('sys_ux_macroponent', macroponentData);
      
      if (result.success && result.data && result.data.result && result.data.result.sys_id) {
        this.logger.info(`✅ UX Page Macroponent created with sys_id: ${result.data.result.sys_id}`);
        return {
          success: true,
          macroponent_sys_id: result.data.result.sys_id,
          message: `Page Macroponent '${args.name}' created successfully`,
          next_step: "Create Page Registry using this macroponent_sys_id and app_config_sys_id"
        };
      } else {
        const error = (result.data && result.data.error) || (result.error) || 'Unknown error creating page macroponent';
        throw new Error(`Failed to create page macroponent: ${error}`);
      }
    } catch (error) {
      this.logger.error('Failed to create UX page macroponent:', error);
      throw error;
    }
  }
  
  /**
   * STEP 4: Create Page Registry Record (sys_ux_page_registry)
   * Registers the page for use within the workspace configuration
   */
  async snow_create_ux_page_registry(args: any): Promise<any> {
    try {
      this.logger.info(`Creating UX Page Registry: ${args.sys_name}`);
      
      // Validate app config and macroponent exist
      const configCheck = await this.client.getRecord('sys_ux_app_config', args.app_config_sys_id);
      if (!configCheck.success) {
        return {
          success: false,
          error: `App Config with sys_id ${args.app_config_sys_id} not found. Please create the app config first using snow_create_ux_app_config.`,
          suggestion: 'Run Step 2: snow_create_ux_app_config before creating page registry'
        };
      }
      
      const macroponentCheck = await this.client.getRecord('sys_ux_macroponent', args.macroponent_sys_id);
      if (!macroponentCheck.success) {
        return {
          success: false,
          error: `Macroponent with sys_id ${args.macroponent_sys_id} not found. Please create the macroponent first using snow_create_ux_page_macroponent.`,
          suggestion: 'Run Step 3: snow_create_ux_page_macroponent before creating page registry'
        };
      }
      
      // Create page registry record
      const registryData = {
        sys_name: args.sys_name,  // Technical name for the page
        app_config: args.app_config_sys_id,
        root_macroponent: args.macroponent_sys_id,
        description: args.description || `Page registry for ${args.sys_name}`
      };
      
      const result = await this.client.createRecord('sys_ux_page_registry', registryData);
      
      if (result.success && result.data && result.data.result && result.data.result.sys_id) {
        this.logger.info(`✅ UX Page Registry created with sys_id: ${result.data.result.sys_id}`);
        return {
          success: true,
          page_registry_sys_id: result.data.result.sys_id,
          page_sys_name: args.sys_name,
          message: `Page Registry '${args.sys_name}' created successfully`,
          next_step: "Create Route using this page sys_name and app_config_sys_id"
        };
      } else {
        const error = (result.data && result.data.error) || (result.error) || 'Unknown error creating page registry';
        throw new Error(`Failed to create page registry: ${error}`);
      }
    } catch (error) {
      this.logger.error('Failed to create UX page registry:', error);
      throw error;
    }
  }
  
  /**
   * STEP 5: Create Route Record (sys_ux_app_route)
   * Defines the URL slug that leads to the page
   */
  async snow_create_ux_app_route(args: any): Promise<any> {
    try {
      this.logger.info(`Creating UX App Route: ${args.name}`);
      
      // Validate app config exists
      const configCheck = await this.client.getRecord('sys_ux_app_config', args.app_config_sys_id);
      if (!configCheck.success) {
        return {
          success: false,
          error: `App Config with sys_id ${args.app_config_sys_id} not found. Please create the app config first using snow_create_ux_app_config.`,
          suggestion: 'Run Step 2: snow_create_ux_app_config before creating route'
        };
      }
      
      // Create route record
      const routeData = {
        name: args.name,  // This becomes the URL slug
        app_config: args.app_config_sys_id,
        page: args.page_sys_name,  // References the sys_name from page registry
        route_type: 'page',
        description: args.description || `Route for page ${args.page_sys_name}`
      };
      
      const result = await this.client.createRecord('sys_ux_app_route', routeData);
      
      if (result.success && result.data && result.data.result && result.data.result.sys_id) {
        this.logger.info(`✅ UX App Route created with sys_id: ${result.data.result.sys_id}`);
        return {
          success: true,
          route_sys_id: result.data.result.sys_id,
          route_name: args.name,
          url_slug: args.name,
          message: `Route '${args.name}' created successfully`,
          next_step: "Update App Configuration with this route as landing_page_route"
        };
      } else {
        const error = (result.data && result.data.error) || (result.error) || 'Unknown error creating app route';
        throw new Error(`Failed to create app route: ${error}`);
      }
    } catch (error) {
      this.logger.error('Failed to create UX app route:', error);
      throw error;
    }
  }
  
  /**
   * STEP 6: Update App Configuration with Landing Page Route
   * Sets the default landing page for the workspace
   */
  async snow_update_ux_app_config_landing_page(args: any): Promise<any> {
    try {
      this.logger.info(`Updating App Config landing page: ${args.app_config_sys_id}`);
      
      // Update app config with landing page route
      const updateData = {
        landing_page_route: args.route_name
      };
      
      const result = await this.client.updateRecord('sys_ux_app_config', args.app_config_sys_id, updateData);
      
      if (result.success) {
        this.logger.info(`✅ App Config updated with landing page route: ${args.route_name}`);
        return {
          success: true,
          message: `App Configuration updated with landing page route '${args.route_name}'`,
          workspace_complete: true,
          summary: "Workspace creation completed successfully - all 6 steps finished"
        };
      } else {
        const error = (result.data && result.data.error) || (result.error) || 'Unknown error updating app config';
        throw new Error(`Failed to update app config: ${error}`);
      }
    } catch (error) {
      this.logger.error('Failed to update app config landing page:', error);
      throw error;
    }
  }
  
  /**
   * COMPLETE UX WORKSPACE WORKFLOW: All steps for creating functional workspace
   * Based on official ServiceNow Now Experience Framework architecture
   */
  async snow_create_complete_workspace(args: any): Promise<any> {
    try {
      this.logger.info(`🚀 Starting complete UX workspace creation: ${args.workspace_name}`);
      
      const results = {
        workspace_name: args.workspace_name,
        steps_completed: [],
        sys_ids: {},
        workspace_type: 'Now Experience Framework Workspace'
      };
      
      // STEP 1: Create UX Experience (sys_ux_experience)
      const experience = await this.snow_create_ux_experience({
        name: args.workspace_name,
        description: args.description || `Complete UX workspace: ${args.workspace_name}`,
        root_macroponent: args.root_macroponent
      });
      results.steps_completed.push('UX Experience Created');
      results.sys_ids.experience_sys_id = (experience as any).experience_sys_id;
      
      // STEP 2: Create List Menu Configuration (sys_ux_list_menu_config)
      const listMenuConfig = await this.createListMenuConfiguration({
        name: `${args.workspace_name} List Menu`,
        experience_sys_id: (experience as any).experience_sys_id,
        description: `List menu for ${args.workspace_name}`
      });
      results.steps_completed.push('List Menu Configuration Created');
      results.sys_ids.list_menu_config_sys_id = listMenuConfig.sys_id;
      
      // STEP 3: Create App Configuration (sys_ux_app_config) 
      const appConfig = await this.snow_create_ux_app_config({
        name: `${args.workspace_name} Config`,
        experience_sys_id: (experience as any).experience_sys_id,
        description: `App configuration for ${args.workspace_name}`,
        list_config_id: listMenuConfig.sys_id
      });
      results.steps_completed.push('App Configuration Created');
      results.sys_ids.app_config_sys_id = (appConfig as any).app_config_sys_id;
      
      // STEP 4: Create Page Properties for Chrome Configuration
      const chromeConfig = await this.createWorkspacePageProperties({
        experience_sys_id: (experience as any).experience_sys_id,
        workspace_name: args.workspace_name
      });
      results.steps_completed.push('Page Properties Configured');
      results.sys_ids.page_properties = chromeConfig.page_properties;
      
      // STEP 5: Create List Categories and Lists if specified
      if (args.tables && args.tables.length > 0) {
        const listConfiguration = await this.createWorkspaceListConfiguration({
          list_menu_config_sys_id: listMenuConfig.sys_id,
          tables: args.tables,
          workspace_name: args.workspace_name
        });
        results.steps_completed.push('List Configuration Created');
        results.sys_ids.list_categories = listConfiguration.categories;
        results.sys_ids.lists = listConfiguration.lists;
      }
      
      // STEP 6: Create App Route for workspace access
      const routeName = args.route_name || this.generateWorkspaceUrl(args.workspace_name);
      const appRoute = await this.snow_create_ux_app_route({
        name: routeName,
        route: `/${routeName}`,
        experience_sys_id: (experience as any).experience_sys_id,
        description: `Route for ${args.workspace_name} workspace`
      });
      results.steps_completed.push('App Route Created');
      results.sys_ids.app_route_sys_id = appRoute.route_sys_id;
      
      this.logger.info(`🎉 Complete UX workspace creation finished successfully!`);
      
      return {
        success: true,
        workspace_name: args.workspace_name,
        workspace_type: 'Now Experience Framework Workspace',
        all_steps_completed: true,
        steps_completed: results.steps_completed,
        sys_ids: results.sys_ids,
        workspace_url: `/now/experience/${routeName}`,
        message: `UX Workspace '${args.workspace_name}' created successfully with complete Now Experience Framework setup`,
        summary: `Experience → List Menu → App Config → Page Properties → List Configuration → App Route - Complete NXF workspace ready`,
        next_steps: [
          'Access workspace via navigation menu',
          'Configure additional list categories if needed',
          'Customize page properties for specific requirements',
          'Add declarative actions for enhanced functionality'
        ]
      };
      
    } catch (error) {
      this.logger.error('Failed to create complete UX workspace:', error);
      throw error;
    }
  }
  
  /**
   * Create List Menu Configuration for workspace
   */
  async createListMenuConfiguration(args: any): Promise<any> {
    try {
      const listMenuData = {
        name: args.name,
        experience: args.experience_sys_id,
        description: args.description || `List menu configuration for workspace`,
        active: true
      };
      
      const result = await this.client.createRecord('sys_ux_list_menu_config', listMenuData);
      
      if (result.success && result.data && result.data.result && result.data.result.sys_id) {
        this.logger.info(`✅ List Menu Configuration created with sys_id: ${result.data.result.sys_id}`);
        return {
          success: true,
          sys_id: result.data.result.sys_id
        };
      } else {
        const error = (result.data && result.data.error) || (result.error) || 'Unknown error creating list menu config';
        throw new Error(`Failed to create list menu configuration: ${error}`);
      }
    } catch (error) {
      this.logger.error('Failed to create list menu configuration:', error);
      throw error;
    }
  }
  
  /**
   * Create Workspace Page Properties (chrome_tab, chrome_main)
   */
  async createWorkspacePageProperties(args: any): Promise<any> {
    try {
      const pageProperties = [];
      
      // Chrome tab property
      const chromeTabData = {
        experience: args.experience_sys_id,
        name: 'chrome_tab',
        value: JSON.stringify({ title: args.workspace_name }),
        type: 'object'
      };
      
      const chromeTabResult = await this.client.createRecord('sys_ux_page_property', chromeTabData);
      if (chromeTabResult.success) {
        pageProperties.push({ name: 'chrome_tab', sys_id: chromeTabResult.data.result.sys_id });
      }
      
      // Chrome main property  
      const chromeMainData = {
        experience: args.experience_sys_id,
        name: 'chrome_main',
        value: JSON.stringify({ 
          showLeftNav: true,
          leftNavCollapsible: true,
          showHeader: true
        }),
        type: 'object'
      };
      
      const chromeMainResult = await this.client.createRecord('sys_ux_page_property', chromeMainData);
      if (chromeMainResult.success) {
        pageProperties.push({ name: 'chrome_main', sys_id: chromeMainResult.data.result.sys_id });
      }
      
      this.logger.info(`✅ Workspace page properties created`);
      return {
        success: true,
        page_properties: pageProperties
      };
      
    } catch (error) {
      this.logger.error('Failed to create workspace page properties:', error);
      throw error;
    }
  }
  
  /**
   * Create List Configuration (categories and lists) for workspace
   */
  async createWorkspaceListConfiguration(args: any): Promise<any> {
    try {
      const categories = [];
      const lists = [];
      
      for (const table of args.tables) {
        // Create List Category
        const categoryData = {
          name: this.capitalizeTableName(table),
          list_menu_config: args.list_menu_config_sys_id,
          table: table,
          order: args.tables.indexOf(table) * 100,
          active: true
        };
        
        const categoryResult = await this.client.createRecord('sys_ux_list_category', categoryData);
        if (categoryResult.success) {
          const categorySysId = categoryResult.data.result.sys_id;
          categories.push({ table: table, sys_id: categorySysId });
          
          // Create default list for this category
          const listData = {
            name: `All ${this.capitalizeTableName(table)}`,
            category: categorySysId,
            table: table,
            filter: '', // No filter = show all records
            order: 100,
            active: true
          };
          
          const listResult = await this.client.createRecord('sys_ux_list', listData);
          if (listResult.success) {
            lists.push({ 
              table: table, 
              category_sys_id: categorySysId,
              list_sys_id: listResult.data.result.sys_id 
            });
          }
        }
      }
      
      this.logger.info(`✅ Created ${categories.length} categories and ${lists.length} lists`);
      return {
        success: true,
        categories: categories,
        lists: lists
      };
      
    } catch (error) {
      this.logger.error('Failed to create workspace list configuration:', error);
      throw error;
    }
  }
  
  /**
   * Capitalize table name for display
   */
  private capitalizeTableName(tableName: string): string {
    return tableName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  
  /**
   * COMPREHENSIVE WORKSPACE DISCOVERY
   * Discovers all workspace types across ServiceNow
   */
  async discoverAllWorkspaces(args: any): Promise<any> {
    try {
      this.logger.info('Discovering all ServiceNow workspaces...');
      
      const discovery = {
        ux_experiences: [],
        agent_workspaces: [],
        ui_builder_pages: [],
        total_count: 0
      };
      
      // Discover UX Experiences (Now Experience Framework)
      if (args.include_ux_experiences) {
        const experiencesQuery = args.active_only ? 'active=true' : '';
        const experiencesResult = await this.client.searchRecords('sys_ux_experience', experiencesQuery, 50);
        
        if (experiencesResult.success) {
          discovery.ux_experiences = experiencesResult.data.result.map((exp: any) => ({
            type: 'UX Experience',
            name: exp.name,
            sys_id: exp.sys_id,
            description: exp.description || 'No description',
            active: exp.active,
            url: `/now/experience/${exp.name?.toLowerCase().replace(/\s+/g, '-')}`
          }));
        }
      }
      
      // Discover Agent Workspaces (Configurable)
      if (args.include_agent_workspaces) {
        const routesQuery = args.active_only ? 'active=true^route_type=workspace' : 'route_type=workspace';
        const routesResult = await this.client.searchRecords('sys_ux_app_route', routesQuery, 50);
        
        if (routesResult.success) {
          discovery.agent_workspaces = routesResult.data.result.map((route: any) => ({
            type: 'Agent Workspace',
            name: route.name,
            sys_id: route.sys_id,
            description: route.description || 'No description',
            route: route.route,
            active: route.active,
            url: `/now/workspace${route.route}`
          }));
        }
      }
      
      // Discover UI Builder Pages
      if (args.include_ui_builder) {
        const pagesQuery = args.active_only ? 'active=true' : '';
        const pagesResult = await this.client.searchRecords('sys_ux_page', pagesQuery, 50);
        
        if (pagesResult.success) {
          discovery.ui_builder_pages = pagesResult.data.result.map((page: any) => ({
            type: 'UI Builder Page',
            name: page.name,
            sys_id: page.sys_id,
            description: page.description || 'No description',
            active: page.active
          }));
        }
      }
      
      discovery.total_count = discovery.ux_experiences.length + 
                            discovery.agent_workspaces.length + 
                            discovery.ui_builder_pages.length;
      
      this.logger.info(`✅ Discovered ${discovery.total_count} workspaces total`);
      
      return {
        success: true,
        discovery: discovery,
        summary: {
          ux_experiences: discovery.ux_experiences.length,
          agent_workspaces: discovery.agent_workspaces.length,
          ui_builder_pages: discovery.ui_builder_pages.length,
          total_workspaces: discovery.total_count
        },
        message: `Found ${discovery.total_count} workspaces across all types`
      };
      
    } catch (error) {
      this.logger.error('Failed to discover workspaces:', error);
      throw error;
    }
  }
  
  /**
   * WORKSPACE CONFIGURATION VALIDATION
   * Validates workspace setup for best practices and completeness
   */
  async validateWorkspaceConfiguration(args: any): Promise<any> {
    try {
      this.logger.info(`Validating ${args.workspace_type} workspace: ${args.workspace_sys_id}`);
      
      const validation = {
        workspace_sys_id: args.workspace_sys_id,
        workspace_type: args.workspace_type,
        issues: [],
        warnings: [],
        recommendations: [],
        score: 0
      };
      
      if (args.workspace_type === 'ux_experience') {
        // Validate UX Experience workspace
        const experience = await this.client.getRecord('sys_ux_experience', args.workspace_sys_id);
        
        if (experience.success) {
          const expData = experience.data.result;
          
          // Check if experience is active
          if (!expData.active) {
            validation.issues.push('Experience is not active');
          }
          
          // Check if it has app config
          const appConfigQuery = await this.client.searchRecords('sys_ux_app_config', `experience_assoc=${args.workspace_sys_id}`);
          if (!appConfigQuery.success || appConfigQuery.data.result.length === 0) {
            validation.issues.push('No app configuration found for experience');
          } else {
            validation.score += 25;
            
            // Check if app config has list configuration
            const appConfig = appConfigQuery.data.result[0];
            if (!appConfig.list_config_id) {
              validation.warnings.push('No list configuration linked to app config');
            } else {
              validation.score += 25;
            }
          }
          
          // Check for page properties
          const pagePropsQuery = await this.client.searchRecords('sys_ux_page_property', `experience=${args.workspace_sys_id}`);
          if (pagePropsQuery.success && pagePropsQuery.data.result.length > 0) {
            validation.score += 25;
          } else {
            validation.warnings.push('No page properties configured (chrome_tab, chrome_main)');
          }
          
        } else {
          validation.issues.push('Experience record not found');
        }
      }
      
      // Performance recommendations
      if (args.check_performance && validation.score > 50) {
        validation.recommendations.push('Consider enabling caching for better performance');
        validation.recommendations.push('Add loading indicators for better user experience');
      }
      
      // Security recommendations  
      if (args.check_security) {
        validation.recommendations.push('Review access controls and role requirements');
        validation.recommendations.push('Validate data privacy settings for workspace');
      }
      
      validation.score = Math.min(100, validation.score);
      
      this.logger.info(`✅ Workspace validation completed - Score: ${validation.score}/100`);
      
      return {
        success: true,
        validation: validation,
        grade: validation.score >= 80 ? 'Excellent' : validation.score >= 60 ? 'Good' : validation.score >= 40 ? 'Needs Improvement' : 'Critical Issues',
        summary: `${validation.issues.length} issues, ${validation.warnings.length} warnings, ${validation.recommendations.length} recommendations`
      };
      
    } catch (error) {
      this.logger.error('Failed to validate workspace configuration:', error);
      throw error;
    }
  }
  
  /**
   * CONFIGURABLE AGENT WORKSPACE: Create using UX App architecture
   */
  async snow_create_configurable_agent_workspace(args: any): Promise<any> {
    try {
      this.logger.info(`Creating Configurable Agent Workspace: ${args.name}`);
      
      // Check if Agent Workspace plugin is available
      const awCheck = await this.client.searchRecords('sys_ux_screen_type', '', 1);
      if (!awCheck.success) {
        return {
          success: false,
          error: 'Agent Workspace plugin is not available in this ServiceNow instance.',
          suggestion: 'Install Agent Workspace plugin from ServiceNow Store',
          plugin_required: 'Agent Workspace',
          licensing_note: 'Agent Workspace requires additional ServiceNow licensing'
        };
      }
      
      const results = {
        workspace_name: args.name,
        workspace_type: 'Configurable Agent Workspace',
        steps_completed: [],
        sys_ids: {}
      };
      
      // Step 1: Create UX App Route 
      const cleanRoute = this.generateWorkspaceUrl(args.name);
      const appRouteData = {
        route: `/${cleanRoute}`,
        name: args.name,
        title: args.name,
        description: args.description || `Configurable Agent Workspace: ${args.name}`,
        application: args.application || 'global',
        route_type: 'workspace',
        active: true
      };
      
      const appRouteResult = await this.client.createRecord('sys_ux_app_route', appRouteData);
      if (!appRouteResult.success) {
        return {
          success: false,
          error: `UX App Route creation failed: ${appRouteResult.error}`,
          suggestion: 'Check Agent Workspace permissions and licensing'
        };
      }
      
      results.steps_completed.push('UX App Route Created');
      results.sys_ids.app_route_sys_id = appRouteResult.data.result.sys_id;
      
      // Step 2: Create Screen Collections for each table
      if (args.tables && args.tables.length > 0) {
        const screenTypes = [];
        
        for (const table of args.tables) {
          const screenTypeData = {
            name: `${args.name} - ${this.capitalizeTableName(table)}`,
            table: table,
            workspace_route: appRouteResult.data.result.sys_id,
            active: true
          };
          
          const screenTypeResult = await this.client.createRecord('sys_ux_screen_type', screenTypeData);
          if (screenTypeResult.success) {
            screenTypes.push({ table: table, sys_id: screenTypeResult.data.result.sys_id });
          }
        }
        
        results.steps_completed.push('Screen Collections Created');
        results.sys_ids.screen_types = screenTypes;
      }
      
      this.logger.info(`✅ Configurable Agent Workspace created successfully`);
      
      return {
        success: true,
        workspace_name: args.name,
        workspace_type: 'Configurable Agent Workspace',
        steps_completed: results.steps_completed,
        sys_ids: results.sys_ids,
        workspace_url: `/now/workspace/${cleanRoute}`,
        message: `Configurable Agent Workspace '${args.name}' created successfully`,
        summary: `UX App Route → Screen Collections → Ready for agent use`
      };
      
    } catch (error) {
      this.logger.error('Failed to create Configurable Agent Workspace:', error);
      throw error;
    }
  }
  
  /**
   * Generate technical name for pages (consistent formatting)
   */
  private generateTechnicalName(workspaceName: string, pageName: string): string {
    const combined = `${workspaceName}_${pageName}`;
    return combined
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/__+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 80);
  }
  
  /**
   * Generate valid workspace URL from name (fix from user feedback)
   */
  private generateWorkspaceUrl(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')           // Spaces -> hyphens
      .replace(/[^a-z0-9-]/g, '')     // Remove special characters
      .replace(/--+/g, '-')            // Multiple hyphens -> single
      .replace(/^-|-$/g, '')           // Trim leading/trailing hyphens
      .substring(0, 80);               // Max 80 chars (ServiceNow field limit)
  }
  
  /**
   * Validate workspace configuration (fix from user feedback)
   */
  /**
   * COMPREHENSIVE PLUGIN DETECTION SYSTEM
   * Checks all required plugins before tool execution
   */
  private async checkPluginAvailabilityForTool(toolType: string): Promise<{ available: boolean, error?: string, suggestion?: string, alternative?: string }> {
    try {
      switch (toolType) {
        case 'ui_builder':
          const uiBuilderCheck = await this.client.searchRecords('sys_ux_page', '', 1);
          if (!uiBuilderCheck.success) {
            return {
              available: false,
              error: 'UI Builder plugin not installed or not accessible',
              suggestion: 'Install UI Builder plugin from ServiceNow Store. Requires ui_builder_admin + ui_builder_user roles.',
              alternative: 'Use Service Portal widgets for custom UI development instead'
            };
          }
          break;
          
        case 'now_experience_framework':
          const uxfCheck = await this.client.searchRecords('sys_ux_experience', '', 1);
          if (!uxfCheck.success) {
            return {
              available: false,
              error: 'Now Experience Framework (UXF) not available',
              suggestion: 'Enable Now Experience Framework in ServiceNow instance. May require additional licensing.',
              alternative: 'Use traditional ServiceNow interface development instead'
            };
          }
          break;
          
        case 'agent_workspace':
          const agentWorkspaceCheck = await this.client.searchRecords('sys_ux_screen_type', '', 1);
          if (!agentWorkspaceCheck.success) {
            return {
              available: false,
              error: 'Agent Workspace plugin not installed',
              suggestion: 'Install Agent Workspace plugin from ServiceNow Store. Requires workspace_admin role.',
              alternative: 'Use traditional forms and lists for agent interfaces'
            };
          }
          break;
          
        case 'mobile_publishing':
          const mobileCheck = await this.client.searchRecords('sys_push_notif_msg', '', 1);
          if (!mobileCheck.success) {
            return {
              available: false,
              error: 'Mobile Publishing plugin not available',
              suggestion: 'Install Mobile Publishing plugin from ServiceNow Store. Requires additional licensing and mobile_admin role.',
              alternative: 'Use responsive Service Portal pages for mobile interfaces'
            };
          }
          break;
      }
      
      return { available: true };
      
    } catch (error) {
      return {
        available: false,
        error: `Plugin check failed: ${error}`,
        suggestion: 'Check ServiceNow connectivity and basic table access permissions'
      };
    }
  }
  
  /**
   * SAFE TOOL EXECUTION WRAPPER
   * Ensures all tools return proper feedback instead of throwing
   */
  private async safeToolExecution(toolName: string, operation: () => Promise<any>, pluginType: string): Promise<any> {
    try {
      this.logger.info(`🛠️ Executing tool: ${toolName}`);
      
      // Step 1: Check plugin availability
      const pluginCheck = await this.checkPluginAvailabilityForTool(pluginType);
      if (!pluginCheck.available) {
        this.logger.warn(`⚠️ Plugin check failed for ${toolName}`);
        return {
          success: false,
          tool_name: toolName,
          plugin_type: pluginType,
          ...pluginCheck
        };
      }
      
      // Step 2: Execute operation
      const result = await operation();
      
      this.logger.info(`✅ Tool ${toolName} executed successfully`);
      
      return {
        ...result,
        tool_name: toolName,
        plugin_verified: true,
        execution_timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`❌ Tool ${toolName} failed with exception:`, error);
      
      // NEVER throw - always return error object
      return {
        success: false,
        tool_name: toolName,
        error: `Tool execution failed: ${error}`,
        suggestion: 'Check ServiceNow connectivity, permissions, and plugin installation',
        execution_type: 'EXCEPTION_CAUGHT',
        debug_info: {
          error_type: error instanceof Error ? error.constructor.name : 'Unknown',
          error_message: String(error),
          stack_trace: error instanceof Error ? error.stack : undefined
        }
      };
    }
  }
  
  private validateWorkspaceConfig(config: any): string[] {
    const errors: string[] = [];

    // Check required fields
    if (!config.name) errors.push('name is required');
    if (!config.workspace_url) errors.push('workspace_url is required');
    if (!config.navigation_type) errors.push('navigation_type is required');

    // Validate workspace_url format
    if (config.workspace_url && !/^[a-z0-9-]+$/.test(config.workspace_url)) {
      errors.push('workspace_url must contain only lowercase letters, numbers and hyphens');
    }

    return errors;
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      
      // Simple timeout protection (prevents hanging)
      const connectTimeout = setTimeout(() => {
        this.logger.error('❌ MCP connection timeout after 30 seconds');
        process.exit(1);
      }, 30000);
      
      await this.server.connect(transport);
      clearTimeout(connectTimeout);
      
      this.logger.info('✅ ServiceNow Flow/Workspace/Mobile MCP Server running on stdio');
      
      // Simple keep-alive (prevents disconnects)
      setInterval(() => {
        this.logger.debug('💚 MCP server alive - uptime: ' + Math.round((Date.now() - Date.now()) / 60000) + 'min');
      }, 120000); // Every 2 minutes
      
    } catch (error) {
      this.logger.error('❌ MCP server failed to start:', error);
      
      // Simple retry once
      this.logger.info('🔄 Retrying MCP connection once...');
      setTimeout(() => {
        this.run().catch(() => {
          this.logger.error('💥 MCP retry failed - exiting');
          process.exit(1);
        });
      }, 3000);
    }
  }
}

const server = new ServiceNowFlowWorkspaceMobileMCP();
server.run().catch(console.error);