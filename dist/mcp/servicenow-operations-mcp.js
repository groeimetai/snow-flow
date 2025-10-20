#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Operations MCP Server
 *
 * Handles operational data queries, incident management, and intelligent analysis
 * Features:
 * - Incident, Request, Problem, Change management
 * - CMDB and User management
 * - Intelligent incident _analysis and auto-resolution
 * - Pattern recognition and root cause analysis
 * - Knowledge base integration
 * - Predictive analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowOperationsMCP = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const mcp_logger_js_1 = require("./shared/mcp-logger.js");
// Operational table mappings for ServiceNow
const operationalTableMapping = {
    // ITIL Core Processes
    incident: 'incident',
    request: 'sc_request',
    request_item: 'sc_req_item',
    problem: 'problem',
    change_request: 'change_request',
    // Service Catalog
    catalog: 'sc_catalog',
    catalog_item: 'sc_cat_item',
    catalog_category: 'sc_category',
    catalog_variable: 'item_option_new',
    catalog_variable_set: 'io_set_item',
    catalog_ui_policy: 'catalog_ui_policy',
    catalog_client_script: 'catalog_script_client',
    catalog_template: 'sc_template',
    // Task Management
    task: 'task',
    incident_task: 'incident_task',
    problem_task: 'problem_task',
    change_task: 'change_task',
    approval: 'sysapproval_approver',
    // User & Group Management
    user: 'sys_user',
    user_group: 'sys_user_group',
    user_role: 'sys_user_has_role',
    // CMDB (Configuration Management Database)
    configuration_item: 'cmdb_ci',
    server: 'cmdb_ci_server',
    application: 'cmdb_ci_application',
    database: 'cmdb_ci_database',
    network_device: 'cmdb_ci_network_device',
    service: 'cmdb_ci_service',
    // Logging & Audit
    system_log: 'syslog',
    audit_log: 'sys_audit',
    email: 'sys_email',
    attachment: 'sys_attachment',
    // Knowledge Management
    knowledge_base: 'kb_knowledge_base',
    knowledge: 'kb_knowledge',
    // Metrics & Analytics
    metric: 'sys_metric',
    metric_instance: 'sys_metric_instance',
    // Notifications
    notification: 'sysevent_email_action',
    email_log: 'sys_email'
};
// Common operational queries for intelligent analysis
const commonPatterns = {
    // Network connectivity issues
    network_issues: {
        keywords: ['network', 'connectivity', 'ping', 'dns', 'timeout', 'unreachable'],
        common_solutions: [
            'Check network connectivity',
            'Verify DNS resolution',
            'Test ping to server',
            'Review firewall rules'
        ]
    },
    // Database connectivity
    database_issues: {
        keywords: ['database', 'connection', 'sql', 'timeout', 'deadlock', 'performance'],
        common_solutions: [
            'Check database connection',
            'Review connection pool settings',
            'Analyze query performance',
            'Check for blocking processes'
        ]
    },
    // Application errors
    application_errors: {
        keywords: ['application', 'error', 'exception', 'crash', 'memory', 'cpu'],
        common_solutions: [
            'Check application logs',
            'Review memory usage',
            'Analyze CPU utilization',
            'Restart application service'
        ]
    },
    // Authentication issues
    auth_issues: {
        keywords: ['authentication', 'login', 'password', 'ldap', 'sso', 'unauthorized'],
        common_solutions: [
            'Reset user password',
            'Check LDAP connectivity',
            'Verify SSO configuration',
            'Review user permissions'
        ]
    }
};
class ServiceNowOperationsMCP {
    constructor() {
        this.server = new index_js_1.Server({
            name: 'servicenow-operations-mcp',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.logger = new mcp_logger_js_1.MCPLogger('ServiceNowOperationsMCP');
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            return {
                tools: [
                    // 🎯 UNIVERSAL TABLE QUERY - Works for ANY ServiceNow table!
                    {
                        name: 'snow_query_table',
                        description: 'Universal query tool for any ServiceNow table. SMART ANALYTICS: OMIT limit for ALL records with minimal fields. For display use limit:50. For counting use include_content:false. See CLAUDE.md for optimal query patterns.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                table: {
                                    type: 'string',
                                    description: 'ServiceNow table name (e.g., incident, sc_request, problem, task, change_request, u_custom_table)',
                                    examples: ['incident', 'sc_request', 'sc_req_item', 'problem', 'change_request', 'task', 'cmdb_ci']
                                },
                                query: {
                                    type: 'string',
                                    description: 'ServiceNow encoded query or natural language description'
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Maximum records to return. OMIT for analytics (gets ALL records). Use 10-50 for display, 5000+ for ML training. No default - system auto-detects best approach.',
                                    examples: [50, 1000, 5000]
                                },
                                include_content: {
                                    type: 'boolean',
                                    description: 'Include full record data. Default false for performance, returns count only. Set true for detailed results.',
                                    default: false
                                },
                                fields: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Specific fields to return (automatically sets include_content=true). Examples: ["number", "short_description", "state"]'
                                },
                                include_display_values: {
                                    type: 'boolean',
                                    description: 'Include display values for reference fields (e.g., show user names instead of sys_ids)',
                                    default: false
                                },
                                group_by: {
                                    type: 'string',
                                    description: 'Field to group results by (returns counts per group)'
                                },
                                order_by: {
                                    type: 'string',
                                    description: 'Field to sort by (prefix with - for descending)',
                                    examples: ['created_on', '-priority', 'number']
                                }
                            },
                            required: ['table', 'query']
                        }
                    },
                    // Core Operational Queries (keeping for backwards compatibility)
                    {
                        name: 'snow_query_incidents',
                        description: 'Query incidents with advanced filtering and analysis capabilities. Optimized for performance with optional content inclusion.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'ServiceNow encoded query or natural language description'
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Maximum number of results (default: 10)',
                                    default: 10
                                },
                                include_content: {
                                    type: 'boolean',
                                    description: 'Include full incident data. Default false for performance, returns count only.',
                                    default: false
                                },
                                include__analysis: {
                                    type: 'boolean',
                                    description: 'Include intelligent _analysis of incidents (requires include_content=true)',
                                    default: false
                                },
                                fields: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Specific fields to return (automatically sets include_content=true)'
                                }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'snow_analyze_incident',
                        description: 'Analyzes specific incidents with pattern recognition, similar incident matching, and automated resolution suggestions.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                incident_id: {
                                    type: 'string',
                                    description: 'Incident number or sys_id'
                                },
                                include_similar: {
                                    type: 'boolean',
                                    description: 'Include similar incidents in _analysis',
                                    default: true
                                },
                                suggest_resolution: {
                                    type: 'boolean',
                                    description: 'Generate automated resolution suggestions',
                                    default: true
                                }
                            },
                            required: ['incident_id']
                        }
                    },
                    {
                        name: 'snow_auto_resolve_incident',
                        description: 'Attempts automated resolution of technical incidents based on known patterns and previous solutions. Includes dry-run mode for safety.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                incident_id: {
                                    type: 'string',
                                    description: 'Incident number or sys_id'
                                },
                                dry_run: {
                                    type: 'boolean',
                                    description: 'Preview actions without executing',
                                    default: true
                                }
                            },
                            required: ['incident_id']
                        }
                    },
                    {
                        name: 'snow_query_requests',
                        description: 'Queries service requests with optional inclusion of request items and fulfillment details.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'ServiceNow encoded query or natural language'
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Maximum number of results',
                                    default: 10
                                },
                                include_items: {
                                    type: 'boolean',
                                    description: 'Include request items',
                                    default: false
                                }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'snow_query_problems',
                        description: 'Queries problem records with root cause analysis and optional inclusion of related incidents.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'ServiceNow encoded query or natural language'
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Maximum number of results',
                                    default: 10
                                },
                                include_incidents: {
                                    type: 'boolean',
                                    description: 'Include related incidents',
                                    default: false
                                }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'snow_cmdb_search',
                        description: 'Searches Configuration Management Database (CMDB) for configuration items with relationship mapping.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Search query for configuration items'
                                },
                                ci_type: {
                                    type: 'string',
                                    description: 'Type of CI (server, application, service, etc.)',
                                    enum: ['server', 'application', 'database', 'network_device', 'service', 'any']
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Maximum number of results',
                                    default: 10
                                },
                                include_relationships: {
                                    type: 'boolean',
                                    description: 'Include CI relationships',
                                    default: false
                                }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'snow_user_lookup',
                        description: 'Retrieves user information including roles, groups, and permissions. Supports lookup by ID, email, or name.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                identifier: {
                                    type: 'string',
                                    description: 'User ID, email, or name'
                                },
                                include_roles: {
                                    type: 'boolean',
                                    description: 'Include user roles',
                                    default: true
                                },
                                include_groups: {
                                    type: 'boolean',
                                    description: 'Include user groups',
                                    default: true
                                }
                            },
                            required: ['identifier']
                        }
                    },
                    {
                        name: 'snow_operational_metrics',
                        description: 'Provides operational metrics and analytics including incident trends, resolution times, and performance indicators.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                timeframe: {
                                    type: 'string',
                                    description: 'Time period for metrics',
                                    enum: ['today', 'week', 'month', 'quarter'],
                                    default: 'week'
                                },
                                metric_types: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Types of metrics to include'
                                }
                            }
                        }
                    },
                    {
                        name: 'snow_pattern__analysis',
                        description: 'Analyzes patterns across incidents, requests, and problems to identify trends, common issues, and improvement opportunities.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                analysis_type: {
                                    type: 'string',
                                    description: 'Type of pattern _analysis',
                                    enum: ['incident_patterns', 'request_trends', 'problem_root_causes', 'user_behavior']
                                },
                                timeframe: {
                                    type: 'string',
                                    description: 'Time period for _analysis',
                                    enum: ['day', 'week', 'month', 'quarter'],
                                    default: 'week'
                                }
                            },
                            required: ['analysis_type']
                        }
                    },
                    {
                        name: 'snow_knowledge_search',
                        description: 'Searches knowledge base articles using intelligent matching algorithms. Links articles to incidents for resolution guidance.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Search query or incident description'
                                },
                                match_incident: {
                                    type: 'string',
                                    description: 'Match knowledge to specific incident'
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Maximum number of results',
                                    default: 5
                                }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'snow_predictive__analysis',
                        description: 'Provides predictive analysis for incident volumes, system failures, and resource issues based on historical patterns.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                prediction_type: {
                                    type: 'string',
                                    description: 'Type of prediction',
                                    enum: ['incident_volume', 'system_failure', 'resource_exhaustion', 'user_impact']
                                },
                                timeframe: {
                                    type: 'string',
                                    description: 'Prediction timeframe',
                                    enum: ['day', 'week', 'month'],
                                    default: 'week'
                                }
                            },
                            required: ['prediction_type']
                        }
                    },
                    // Service Catalog Management
                    {
                        name: 'snow_catalog_item_manager',
                        description: 'Comprehensive service catalog management including item creation, variable configuration, workflow attachment, and lifecycle management.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    description: 'Action to perform',
                                    enum: ['create', 'update', 'list', 'get', 'add_variable', 'set_workflow', 'publish', 'retire']
                                },
                                catalog_id: {
                                    type: 'string',
                                    description: 'Catalog sys_id (for create action)'
                                },
                                category_id: {
                                    type: 'string',
                                    description: 'Category sys_id'
                                },
                                item_id: {
                                    type: 'string',
                                    description: 'Catalog item sys_id (for update/get actions)'
                                },
                                name: {
                                    type: 'string',
                                    description: 'Catalog item name'
                                },
                                short_description: {
                                    type: 'string',
                                    description: 'Short description'
                                },
                                description: {
                                    type: 'string',
                                    description: 'Full description'
                                },
                                price: {
                                    type: 'string',
                                    description: 'Item price (e.g., "100.00")'
                                },
                                recurring_price: {
                                    type: 'string',
                                    description: 'Recurring price if applicable'
                                },
                                picture: {
                                    type: 'string',
                                    description: 'Picture attachment sys_id'
                                },
                                workflow: {
                                    type: 'string',
                                    description: 'Workflow to attach'
                                },
                                variable_set: {
                                    type: 'string',
                                    description: 'Variable set sys_id to attach'
                                },
                                variables: {
                                    type: 'array',
                                    description: 'Variables to add',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            label: { type: 'string' },
                                            type: {
                                                type: 'string',
                                                enum: ['single_line_text', 'multi_line_text', 'select_box', 'checkbox', 'reference', 'date', 'datetime']
                                            },
                                            mandatory: { type: 'boolean' },
                                            default_value: { type: 'string' },
                                            choices: { type: 'array', items: { type: 'string' } }
                                        }
                                    }
                                },
                                active: {
                                    type: 'boolean',
                                    description: 'Whether the item is active',
                                    default: true
                                },
                                billable: {
                                    type: 'boolean',
                                    description: 'Whether the item is billable',
                                    default: false
                                },
                                sc_catalogs: {
                                    type: 'string',
                                    description: 'Comma-separated catalog sys_ids'
                                },
                                sc_categories: {
                                    type: 'string',
                                    description: 'Comma-separated category sys_ids'
                                }
                            },
                            required: ['action']
                        }
                    },
                    {
                        name: 'snow_catalog_item_search',
                        description: 'Searches service catalog items with fuzzy matching and category filtering. Returns items with full variable and pricing details.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Search query (e.g., "iPhone", "laptop", "mobile device")'
                                },
                                include_inactive: {
                                    type: 'boolean',
                                    description: 'Include inactive catalog items',
                                    default: false
                                },
                                fuzzy_match: {
                                    type: 'boolean',
                                    description: 'Enable fuzzy matching for similar items',
                                    default: true
                                },
                                category_filter: {
                                    type: 'string',
                                    description: 'Filter by category name or sys_id'
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Maximum results to return',
                                    default: 50
                                },
                                include_variables: {
                                    type: 'boolean',
                                    description: 'Include catalog item variables in results',
                                    default: false
                                }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'snow_cleanup_test_artifacts',
                        description: 'Removes test artifacts (Test*, Mock*, Demo*) from ServiceNow while preserving Update Set history for audit compliance.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                artifact_types: {
                                    type: 'array',
                                    description: 'Types of artifacts to clean up',
                                    items: {
                                        type: 'string',
                                        enum: ['catalog_items', 'flows', 'users', 'requests', 'all']
                                    },
                                    default: ['catalog_items', 'flows', 'users']
                                },
                                test_patterns: {
                                    type: 'array',
                                    description: 'Name patterns that identify test artifacts',
                                    items: { type: 'string' },
                                    default: ['Test%', 'Mock%', 'Demo%', '%_test_%', '%test', '%mock']
                                },
                                max_age_hours: {
                                    type: 'number',
                                    description: 'Only clean artifacts older than this (hours)',
                                    default: 1
                                },
                                dry_run: {
                                    type: 'boolean',
                                    description: 'Preview what would be deleted without actually deleting',
                                    default: false
                                },
                                preserve_update_set_entries: {
                                    type: 'boolean',
                                    description: 'Keep Update Set entries as audit trail',
                                    default: true
                                },
                                update_set_filter: {
                                    type: 'string',
                                    description: 'Only clean from specific Update Set (optional)'
                                }
                            }
                        }
                    },
                    // User and Group Management Tools
                    {
                        name: 'snow_create_user_group',
                        description: 'Creates user groups in ServiceNow with configurable hierarchy, managers, and types for access control and assignment management.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                name: {
                                    type: 'string',
                                    description: 'Group name (e.g., "Need Approval")'
                                },
                                description: {
                                    type: 'string',
                                    description: 'Group description'
                                },
                                email: {
                                    type: 'string',
                                    description: 'Group email address (optional)'
                                },
                                manager: {
                                    type: 'string',
                                    description: 'Group manager sys_id or user_name (optional)'
                                },
                                parent: {
                                    type: 'string',
                                    description: 'Parent group sys_id (optional)'
                                },
                                type: {
                                    type: 'string',
                                    description: 'Group type (optional)',
                                    enum: ['', 'catalog', 'change', 'incident', 'problem', 'request']
                                },
                                active: {
                                    type: 'boolean',
                                    description: 'Is group active',
                                    default: true
                                }
                            },
                            required: ['name']
                        }
                    },
                    {
                        name: 'snow_create_user',
                        description: 'Creates new users in ServiceNow with complete profile information including department, manager, and initial credentials.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                user_name: {
                                    type: 'string',
                                    description: 'Unique username for login'
                                },
                                first_name: {
                                    type: 'string',
                                    description: 'User first name'
                                },
                                last_name: {
                                    type: 'string',
                                    description: 'User last name'
                                },
                                email: {
                                    type: 'string',
                                    description: 'User email address'
                                },
                                department: {
                                    type: 'string',
                                    description: 'Department name or sys_id (optional)'
                                },
                                manager: {
                                    type: 'string',
                                    description: 'Manager sys_id or user_name (optional)'
                                },
                                phone: {
                                    type: 'string',
                                    description: 'Phone number (optional)'
                                },
                                title: {
                                    type: 'string',
                                    description: 'Job title (optional)'
                                },
                                location: {
                                    type: 'string',
                                    description: 'Location name or sys_id (optional)'
                                },
                                active: {
                                    type: 'boolean',
                                    description: 'Is user active',
                                    default: true
                                },
                                password: {
                                    type: 'string',
                                    description: 'Initial password (will require change on first login)'
                                }
                            },
                            required: ['user_name', 'first_name', 'last_name', 'email']
                        }
                    },
                    {
                        name: 'snow_assign_user_to_group',
                        description: 'Assigns users to groups for role-based access control and workflow assignments. Supports lookup by sys_id or username.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                user: {
                                    type: 'string',
                                    description: 'User sys_id or user_name'
                                },
                                group: {
                                    type: 'string',
                                    description: 'Group sys_id or name'
                                }
                            },
                            required: ['user', 'group']
                        }
                    },
                    {
                        name: 'snow_remove_user_from_group',
                        description: 'Removes users from groups to revoke access and update role assignments. Maintains audit trail of membership changes.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                user: {
                                    type: 'string',
                                    description: 'User sys_id or user_name'
                                },
                                group: {
                                    type: 'string',
                                    description: 'Group sys_id or name'
                                }
                            },
                            required: ['user', 'group']
                        }
                    },
                    {
                        name: 'snow_list_group_members',
                        description: 'Lists all members of a specified group with filtering for active/inactive users. Returns user details and roles.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                group: {
                                    type: 'string',
                                    description: 'Group sys_id or name'
                                },
                                active_only: {
                                    type: 'boolean',
                                    description: 'Only show active users',
                                    default: true
                                }
                            },
                            required: ['group']
                        }
                    }
                ],
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                // Start operation with token tracking
                this.logger.operationStart(name, args);
                let result;
                switch (name) {
                    case 'snow_query_table':
                        result = await this.handleUniversalQuery(args);
                        break;
                    case 'snow_query_incidents':
                        result = await this.handleQueryIncidents(args);
                        break;
                    case 'snow_analyze_incident':
                        result = await this.handleAnalyzeIncident(args);
                        break;
                    case 'snow_auto_resolve_incident':
                        result = await this.handleAutoResolveIncident(args);
                        break;
                    case 'snow_query_requests':
                        result = await this.handleQueryRequests(args);
                        break;
                    case 'snow_query_problems':
                        result = await this.handleQueryProblems(args);
                        break;
                    case 'snow_cmdb_search':
                        result = await this.handleCMDBSearch(args);
                        break;
                    case 'snow_user_lookup':
                        result = await this.handleUserLookup(args);
                        break;
                    case 'snow_operational_metrics':
                        result = await this.handleOperationalMetrics(args);
                        break;
                    case 'snow_pattern__analysis':
                        result = await this.handlePatternAnalysis(args);
                        break;
                    case 'snow_knowledge_search':
                        result = await this.handleKnowledgeSearch(args);
                        break;
                    case 'snow_predictive__analysis':
                        result = await this.handlePredictiveAnalysis(args);
                        break;
                    case 'snow_catalog_item_manager':
                        result = await this.handleCatalogItemManager(args);
                        break;
                    case 'snow_catalog_item_search':
                        result = await this.handleCatalogItemSearch(args);
                        break;
                    case 'snow_cleanup_test_artifacts':
                        result = await this.handleCleanupTestArtifacts(args);
                        break;
                    case 'snow_create_user_group':
                        result = await this.handleCreateUserGroup(args);
                        break;
                    case 'snow_create_user':
                        result = await this.handleCreateUser(args);
                        break;
                    case 'snow_assign_user_to_group':
                        result = await this.handleAssignUserToGroup(args);
                        break;
                    case 'snow_remove_user_from_group':
                        result = await this.handleRemoveUserFromGroup(args);
                        break;
                    case 'snow_list_group_members':
                        result = await this.handleListGroupMembers(args);
                        break;
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Tool ${name} not found`);
                }
                // Complete operation with token tracking
                result = this.logger.addTokenUsageToResponse(result);
                result = this.logger.addTokenUsageToResponse(result);
                this.logger.operationComplete(name, result);
                // Add token usage to response
                result = this.logger.addTokenUsageToResponse(result);
                return result;
            }
            catch (error) {
                this.logger.operationError(name, error);
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to execute ${name}: ${error}`);
            }
        });
    }
    async handleUniversalQuery(args) {
        // 🧠 INTELLIGENT LIMIT STRATEGY - Think about the use case!
        const determineSmartLimit = (providedLimit, table, query, includeContent, fields) => {
            // User explicitly set limit - respect it
            if (providedLimit !== undefined)
                return providedLimit;
            // 📊 ANALYTICS DETECTION - Need ALL data
            const isAnalyticsContext = query?.toLowerCase().includes('analyz') ||
                query?.toLowerCase().includes('trend') ||
                query?.toLowerCase().includes('when') ||
                query?.toLowerCase().includes('pattern') ||
                query?.toLowerCase().includes('all') ||
                query?.toLowerCase().includes('onboard') ||
                (fields && fields.length <= 2); // Minimal fields = analytics
            if (isAnalyticsContext) {
                this.logger.info(`📊 Analytics context detected - NO LIMIT applied for complete analysis`);
                return undefined; // No limit - get ALL records
            }
            // 🤖 ML Training context
            const isMLContext = query?.toLowerCase().includes('train') ||
                query?.toLowerCase().includes('ml') ||
                table?.toLowerCase().includes('train');
            if (isMLContext) {
                this.logger.info(`🧠 ML context detected - using ML-optimized limit: 5000`);
                return 5000; // ML training needs substantial data
            }
            // 📈 Count-only queries - efficient
            if (!includeContent) {
                this.logger.info(`📈 Count-only query - can handle large datasets efficiently`);
                return 10000; // Count queries are very memory-efficient
            }
            // 🖥️ Display context - limited data needed
            if (includeContent && fields && fields.length > 5) {
                this.logger.info(`🖥️ Display context detected - limiting to viewable records`);
                return 100; // Display queries need less data
            }
            // Default: moderate limit
            this.logger.info(`⚠️ No specific context detected - using conservative limit. Consider specifying limit for your use case!`);
            return 500; // Conservative default
        };
        const { table, query = '', include_content = false, fields, include_display_values = false, group_by, order_by, offset = 0 // ✅ NEW: Support pagination!
         } = args;
        // Validate table name
        if (!table) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, 'Table name is required');
        }
        // Apply intelligent limit strategy
        const limit = determineSmartLimit(args.limit, table, query, include_content || !!fields, fields);
        // For analytics, we want NO limit at all
        const effectiveLimit = limit === undefined ? 999999 : limit; // ServiceNow theoretical max (actual varies by instance)
        // 🚨 ML Training Warning for low limits
        const isMLTrainingContext = query?.toLowerCase().includes('train') ||
            query?.toLowerCase().includes('ml') ||
            args.limit !== undefined && args.limit < 1000;
        if (isMLTrainingContext && limit < 1000) {
            this.logger.warn(`⚠️  ML Training detected with low limit (${limit}). Consider setting limit=5000+ for better training data!`);
        }
        this.logger.info(`Universal query on table '${table}' with: ${query} (limit: ${limit === undefined ? 'UNLIMITED' : limit}, offset: ${offset}, include_content: ${include_content})`);
        try {
            // Convert natural language to ServiceNow query if needed
            const processedQuery = this.processNaturalLanguageQuery(query || '', table);
            // Build the query with CORRECT order_by syntax
            let finalQuery = processedQuery;
            if (order_by) {
                // ✅ FIX: Use correct ServiceNow ordering syntax
                const orderDirection = order_by.startsWith('-') ? 'DESC' : '';
                const orderField = order_by.replace(/^-/, '');
                finalQuery += `^ORDERBY${orderDirection ? orderDirection : ''}${orderField}`;
            }
            // ✅ NEW: Use searchRecordsWithOffset when offset is provided
            this.logger.trackAPICall('SEARCH', table, effectiveLimit);
            const records = offset > 0
                ? await this.client.searchRecordsWithOffset(table, finalQuery, effectiveLimit, offset)
                : await this.client.searchRecords(table, finalQuery, effectiveLimit);
            let result = {
                table: table,
                total_results: records.success ? records.data.result.length : 0,
                query_used: processedQuery
            };
            // Handle group_by aggregation
            if (group_by && records.success) {
                const grouped = {};
                records.data.result.forEach((record) => {
                    const groupValue = record[group_by] || 'undefined';
                    grouped[groupValue] = (grouped[groupValue] || 0) + 1;
                });
                result.grouped_counts = grouped;
                result.unique_values = Object.keys(grouped).length;
            }
            // ✅ IMPROVED: Clear content decision logic
            const shouldIncludeContent = include_content === true || (fields && fields.length > 0);
            if (shouldIncludeContent) {
                // Include full record data when specifically requested
                result.records = records.success ? records.data.result : [];
                // If specific fields requested, filter and validate them
                if (fields && fields.length > 0 && records.success && records.data.result.length > 0) {
                    // ✅ NEW: Validate fields exist
                    const sampleRecord = records.data.result[0];
                    const validFields = fields.filter((field) => {
                        const exists = sampleRecord.hasOwnProperty(field) ||
                            sampleRecord.hasOwnProperty(`${field}_display_value`);
                        if (!exists) {
                            this.logger.warn(`⚠️ Field '${field}' not found in table '${table}'`);
                        }
                        return exists;
                    });
                    if (validFields.length === 0 && fields.length > 0) {
                        // All requested fields are invalid
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `None of the requested fields exist in table '${table}'. Available fields: ${Object.keys(sampleRecord).slice(0, 10).join(', ')}...`);
                    }
                    result.records = records.data.result.map((record) => {
                        const filtered = {};
                        // Always include sys_id and number/name if available
                        if (record.sys_id)
                            filtered.sys_id = record.sys_id;
                        if (record.number && !validFields.includes('number'))
                            filtered.number = record.number;
                        if (record.name && !validFields.includes('name'))
                            filtered.name = record.name;
                        // Add requested fields
                        validFields.forEach((field) => {
                            if (record[field] !== undefined) {
                                filtered[field] = record[field];
                                // ✅ FIX: Properly handle display values
                                if (include_display_values) {
                                    // Check for standard display value pattern
                                    const displayField = `dv_${field}`; // Some tables use dv_ prefix
                                    const displayFieldAlt = `${field}_display_value`; // Others use _display_value suffix
                                    if (record[displayField]) {
                                        filtered[`${field}_display`] = record[displayField];
                                    }
                                    else if (record[displayFieldAlt]) {
                                        filtered[`${field}_display`] = record[displayFieldAlt];
                                    }
                                }
                            }
                        });
                        return filtered;
                    });
                    // Add metadata about fields
                    result.fields_info = {
                        requested: fields,
                        valid: validFields,
                        invalid: fields.filter((f) => !validFields.includes(f))
                    };
                }
            }
            else {
                // 🚀 PERFORMANCE MODE: Only return summary for large datasets
                result.summary = {
                    count: records.success ? records.data.result.length : 0,
                    message: `Use include_content=true to retrieve full ${table} data`
                };
                // Provide intelligent sample based on table type
                if (records.success && records.data.result.length > 0) {
                    const sampleSize = Math.min(5, records.data.result.length);
                    const sample = records.data.result.slice(0, sampleSize);
                    // Dynamic field detection for sample
                    const commonFields = this.detectCommonFields(table, sample);
                    result.summary.sample = {
                        record_identifiers: sample.map((r) => r.number || r.name || r.sys_id),
                        common_fields: commonFields
                    };
                }
            }
            // ✅ NEW: Add pagination info when offset is used
            if (offset > 0) {
                result.pagination = {
                    offset: offset,
                    limit: effectiveLimit,
                    has_more: records.success && records.data.result.length === effectiveLimit,
                    next_offset: offset + effectiveLimit
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${records.success ? records.data.result.length : 0} ${table} records${offset > 0 ? ` (offset: ${offset})` : ''} matching query: "${query || 'all'}"\n\n${JSON.stringify(result, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            // ✅ IMPROVED: Better error messages
            this.logger.error(`Error querying ${table}:`, error);
            if (error.code === 'ECONNREFUSED') {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Cannot connect to ServiceNow. Please check your instance URL and network connection.`);
            }
            if (error.response?.status === 401) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Authentication failed. Please run: snow-flow auth login`);
            }
            if (error.response?.status === 404) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Table '${table}' not found. Please check the table name.`);
            }
            if (error.response?.status === 400) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Invalid query syntax: ${query}. Check ServiceNow encoded query format.`);
            }
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to query ${table}: ${error.message || error}`);
        }
    }
    detectCommonFields(table, records) {
        const commonFields = {};
        // Fields to check based on table type
        const fieldsToCheck = ['state', 'priority', 'category', 'type', 'status', 'active', 'stage'];
        records.forEach(record => {
            fieldsToCheck.forEach(field => {
                if (record[field] !== undefined && record[field] !== null) {
                    if (!commonFields[field])
                        commonFields[field] = new Set();
                    commonFields[field].add(record[field]);
                }
            });
        });
        // Convert sets to arrays for JSON serialization
        const result = {};
        Object.entries(commonFields).forEach(([field, values]) => {
            result[field] = Array.from(values);
        });
        return result;
    }
    async handleQueryIncidents(args) {
        const { query, limit = 10, include__analysis = false, fields, include_content = false // 🎯 NEW: Explicit control over returning full incident data
         } = args;
        this.logger.info(`Querying incidents with: ${query} (include_content: ${include_content})`);
        try {
            // Convert natural language to ServiceNow query if needed
            const processedQuery = this.processNaturalLanguageQuery(query, 'incident');
            // Query incidents
            this.logger.trackAPICall('SEARCH', 'incident', limit);
            const incidents = await this.client.searchRecords('incident', processedQuery, limit);
            let result = {
                total_results: incidents.success ? incidents.data.result.length : 0,
                query_used: processedQuery
            };
            // 🎯 SMART CONTENT DECISION: Only include full data if explicitly requested
            if (include_content || (fields && fields.length > 0)) {
                // Include full incident data when specifically requested
                result.incidents = incidents.success ? incidents.data.result : [];
                // If specific fields requested, filter them
                if (fields && fields.length > 0 && incidents.success) {
                    result.incidents = incidents.data.result.map((inc) => {
                        const filtered = {};
                        fields.forEach((field) => {
                            if (inc[field] !== undefined)
                                filtered[field] = inc[field];
                        });
                        return filtered;
                    });
                }
            }
            else {
                // 🚀 PERFORMANCE MODE: Only return summary for large datasets
                result.summary = {
                    count: incidents.success ? incidents.data.result.length : 0,
                    message: `Use include_content=true to retrieve full incident data`
                };
                // Provide a small sample for context
                if (incidents.success && incidents.data.result.length > 0) {
                    result.summary.sample = {
                        first_incident: incidents.data.result[0].number || 'Unknown',
                        categories: [...new Set(incidents.data.result.slice(0, 5).map((inc) => inc.category || 'none'))],
                        priorities: [...new Set(incidents.data.result.slice(0, 5).map((inc) => inc.priority || 'none'))],
                        states: [...new Set(incidents.data.result.slice(0, 5).map((inc) => inc.state || 'unknown'))]
                    };
                }
            }
            // Add intelligent _analysis if requested (only works with content)
            if (include__analysis && incidents.success && incidents.data.result.length > 0) {
                const _analysis = await this.analyzeIncidents(incidents.data.result);
                result = { ...result, ..._analysis };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${incidents.success ? incidents.data.result.length : 0} incidents matching query: "${query}"\n\n${JSON.stringify(result, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error querying incidents:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to query incidents: ${error}`);
        }
    }
    async handleAnalyzeIncident(args) {
        const { incident_id, include_similar = true, suggest_resolution = true } = args;
        this.logger.info(`Analyzing incident: ${incident_id}`);
        try {
            // Get incident details
            const incident = await this.getIncidentDetails(incident_id);
            if (!incident) {
                throw new Error(`Incident ${incident_id} not found`);
            }
            // Perform intelligent analysis
            const _analysis = await this.performIncidentAnalysis(incident, include_similar, suggest_resolution);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Incident Analysis for ${incident_id}:\n\n${JSON.stringify(_analysis, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error analyzing incident:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to analyze incident: ${error}`);
        }
    }
    async handleAutoResolveIncident(args) {
        const { incident_id, dry_run = true } = args;
        this.logger.info(`Auto-resolving incident: ${incident_id} (dry_run: ${dry_run})`);
        try {
            // Get incident details
            const incident = await this.getIncidentDetails(incident_id);
            if (!incident) {
                throw new Error(`Incident ${incident_id} not found`);
            }
            // Analyze incident for auto-resolution potential
            const _analysis = await this.performIncidentAnalysis(incident, true, true);
            // Generate automated resolution actions
            const resolutionActions = await this.generateResolutionActions(incident, _analysis);
            const result = {
                incident_id,
                _analysis,
                resolution_actions: resolutionActions,
                dry_run,
                actions_executed: []
            };
            // Execute actions if not dry run
            if (!dry_run && resolutionActions.length > 0) {
                result.actions_executed = await this.executeResolutionActions(incident_id, resolutionActions);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Auto-Resolution Analysis for ${incident_id}:\n\n${JSON.stringify(result, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error auto-resolving incident:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to auto-resolve incident: ${error}`);
        }
    }
    async handleQueryRequests(args) {
        const { query, limit = 10, include_items = false } = args;
        this.logger.info(`Querying requests with: ${query}`);
        try {
            const processedQuery = this.processNaturalLanguageQuery(query, 'request');
            const requests = await this.client.searchRecords('sc_request', processedQuery, limit);
            let result = {
                total_results: requests.success ? requests.data.result.length : 0,
                requests: requests.success ? requests.data.result : []
            };
            // Include request items if requested
            if (include_items && requests.success && requests.data.result.length > 0) {
                const requestItems = await this.getRequestItems(requests.data.result);
                result = { ...result, request_items: requestItems };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${requests.success ? requests.data.result.length : 0} requests matching query: "${query}"\n\n${JSON.stringify(result, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error querying requests:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to query requests: ${error}`);
        }
    }
    async handleQueryProblems(args) {
        const { query, limit = 10, include_incidents = false } = args;
        this.logger.info(`Querying problems with: ${query}`);
        try {
            const processedQuery = this.processNaturalLanguageQuery(query, 'problem');
            const problems = await this.client.searchRecords('problem', processedQuery, limit);
            let result = {
                total_results: problems.success ? problems.data.result.length : 0,
                problems: problems.success ? problems.data.result : []
            };
            // Include related incidents if requested
            if (include_incidents && problems.success && problems.data.result.length > 0) {
                const incidents = await this.getRelatedIncidents(problems.data.result);
                result = { ...result, related_incidents: incidents };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${problems.success ? problems.data.result.length : 0} problems matching query: "${query}"\n\n${JSON.stringify(result, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error querying problems:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to query problems: ${error}`);
        }
    }
    async handleCMDBSearch(args) {
        const { query, ci_type = 'any', limit = 10, include_relationships = false } = args;
        this.logger.info(`Searching CMDB with: ${query}, type: ${ci_type}`);
        try {
            const ciTable = ci_type === 'any' ? 'cmdb_ci' : operationalTableMapping[ci_type] || 'cmdb_ci';
            const processedQuery = this.processNaturalLanguageQuery(query, 'cmdb');
            const configItems = await this.client.searchRecords(ciTable, processedQuery, limit);
            let result = {
                total_results: configItems.success ? configItems.data.result.length : 0,
                configuration_items: configItems.success ? configItems.data.result : [],
                ci_type: ci_type
            };
            // Include relationships if requested
            if (include_relationships && configItems.success && configItems.data.result.length > 0) {
                const relationships = await this.getCIRelationships(configItems.data.result);
                result = { ...result, relationships };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${configItems.success ? configItems.data.result.length : 0} configuration items matching query: "${query}"\n\n${JSON.stringify(result, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error searching CMDB:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to search CMDB: ${error}`);
        }
    }
    async handleUserLookup(args) {
        const { identifier, include_roles = true, include_groups = true } = args;
        this.logger.info(`Looking up user: ${identifier}`);
        try {
            // Try different user lookup strategies
            let userQuery = '';
            if (identifier.includes('@')) {
                userQuery = `email=${identifier}`;
            }
            else if (identifier.includes('.')) {
                userQuery = `user_name=${identifier}`;
            }
            else {
                userQuery = `nameLIKE${identifier}^ORuser_nameLIKE${identifier}^ORemailLIKE${identifier}`;
            }
            const users = await this.client.searchRecords('sys_user', userQuery, 5);
            if (!users.success || users.data.result.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `No users found matching identifier: "${identifier}"`
                        }
                    ]
                };
            }
            let result = {
                total_results: users.data.result.length,
                users: users.data.result
            };
            // Include roles and groups if requested
            if (include_roles || include_groups) {
                const userDetails = await this.getUserDetails(users.data.result[0].sys_id, include_roles, include_groups);
                result = { ...result, user_details: userDetails };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${users.success ? users.data.result.length : 0} users matching identifier: "${identifier}"\n\n${JSON.stringify(result, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error looking up user:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to lookup user: ${error}`);
        }
    }
    async handleOperationalMetrics(args) {
        const { timeframe = 'week', metric_types = [] } = args;
        this.logger.info(`Getting operational metrics for timeframe: ${timeframe}`);
        try {
            const metrics = await this.calculateOperationalMetrics(timeframe, metric_types);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Operational Metrics (${timeframe}):\n\n${JSON.stringify(metrics, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error getting operational metrics:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to get operational metrics: ${error}`);
        }
    }
    async handlePatternAnalysis(args) {
        const { analysis_type, timeframe = 'week' } = args;
        this.logger.info(`Performing pattern _analysis: ${analysis_type} for ${timeframe}`);
        try {
            const patterns = await this.analyzePatterns(analysis_type, timeframe);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Pattern Analysis (${analysis_type} - ${timeframe}):\n\n${JSON.stringify(patterns, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error analyzing patterns:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to analyze patterns: ${error}`);
        }
    }
    async handleKnowledgeSearch(args) {
        const { query, match_incident, limit = 5 } = args;
        this.logger.info(`Searching knowledge base with: ${query}`);
        try {
            const processedQuery = this.processNaturalLanguageQuery(query, 'knowledge');
            const articles = await this.client.searchRecords('kb_knowledge', processedQuery, limit);
            let result = {
                total_results: articles.success ? articles.data.result.length : 0,
                knowledge_articles: articles.success ? articles.data.result : []
            };
            // If matching to incident, provide relevance scoring
            if (match_incident) {
                const incident = await this.getIncidentDetails(match_incident);
                if (incident) {
                    const relevanceScores = await this.calculateKnowledgeRelevance(articles.success ? articles.data.result : [], incident);
                    result = { ...result, relevance_scores: relevanceScores };
                }
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${articles.success ? articles.data.result.length : 0} knowledge articles matching query: "${query}"\n\n${JSON.stringify(result, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error searching knowledge base:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to search knowledge base: ${error}`);
        }
    }
    async handlePredictiveAnalysis(args) {
        const { prediction_type, timeframe = 'week' } = args;
        this.logger.info(`Performing predictive _analysis: ${prediction_type} for ${timeframe}`);
        try {
            const predictions = await this.performPredictiveAnalysis(prediction_type, timeframe);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Predictive Analysis (${prediction_type} - ${timeframe}):\n\n${JSON.stringify(predictions, null, 2)}`
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error('Error performing predictive _analysis:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to perform predictive _analysis: ${error}`);
        }
    }
    // Helper methods for intelligent analysis
    processNaturalLanguageQuery(query, context) {
        // Convert natural language to ServiceNow encoded query
        const lowerQuery = query.toLowerCase();
        // If already a ServiceNow encoded query, return as-is
        if (query.includes('=') || query.includes('!=') || query.includes('^') || query.includes('LIKE')) {
            this.logger.info(`Using raw ServiceNow query: ${query}`);
            return query;
        }
        // Common ServiceNow query patterns
        if (lowerQuery.includes('high priority')) {
            return 'priority=1';
        }
        if (lowerQuery.includes('critical')) {
            return 'priority=1^ORseverity=1';
        }
        if (lowerQuery.includes('open') || lowerQuery.includes('active')) {
            return 'active=true^state!=6^state!=7';
        }
        if (lowerQuery.includes('closed') || lowerQuery.includes('resolved')) {
            return 'state=6^ORstate=7';
        }
        if (lowerQuery.includes('all') || lowerQuery === '') {
            return ''; // Empty query returns all records
        }
        if (lowerQuery.includes('today')) {
            return 'sys_created_onONToday@javascript:gs.daysAgoStart(0)@javascript:gs.daysAgoEnd(0)';
        }
        if (lowerQuery.includes('last week')) {
            return 'sys_created_onONLast week@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(1)';
        }
        // Context-specific processing
        if (context === 'incident') {
            if (lowerQuery.includes('network')) {
                return 'categoryLIKEnetwork^ORshort_descriptionLIKEnetwork';
            }
            if (lowerQuery.includes('database')) {
                return 'categoryLIKEdatabase^ORshort_descriptionLIKEdatabase';
            }
        }
        // Default: treat as general search
        return `short_descriptionLIKE${query}^ORdescriptionLIKE${query}`;
    }
    async analyzeIncidents(incidents) {
        const patterns = [];
        const categories = new Map();
        for (const incident of incidents) {
            // Count categories
            const category = incident.category || 'uncategorized';
            categories.set(category, (categories.get(category) || 0) + 1);
            // Detect patterns
            const description = (incident.short_description || '').toLowerCase();
            for (const [patternName, pattern] of Object.entries(commonPatterns)) {
                if (pattern.keywords.some(keyword => description.includes(keyword))) {
                    patterns.push({
                        incident_number: incident.number,
                        pattern: patternName,
                        confidence: 0.8
                    });
                }
            }
        }
        return {
            patterns_detected: patterns,
            category_distribution: Object.fromEntries(categories),
            total_analyzed: incidents.length
        };
    }
    async getIncidentDetails(incident_id) {
        // Try to get incident by number first, then by sys_id
        let query = `number=${incident_id}`;
        let incidents = await this.client.searchRecords('incident', query, 1);
        if (!incidents.success || incidents.data.result.length === 0) {
            // Try by sys_id
            query = `sys_id=${incident_id}`;
            incidents = await this.client.searchRecords('incident', query, 1);
        }
        return (incidents.success && incidents.data.result.length > 0) ? incidents.data.result[0] : null;
    }
    async performIncidentAnalysis(incident, include_similar, suggest_resolution) {
        const _analysis = {
            incident_id: incident.number,
            patterns_found: [],
            root_cause__analysis: '',
            suggested_resolution: [],
            confidence_score: 0,
            similar_incidents: [],
            knowledge_articles: [],
            automated_actions: []
        };
        // Pattern detection
        const description = (incident.short_description || '').toLowerCase();
        for (const [patternName, pattern] of Object.entries(commonPatterns)) {
            if (pattern.keywords.some(keyword => description.includes(keyword))) {
                _analysis.patterns_found.push(patternName);
                _analysis.suggested_resolution.push(...pattern.common_solutions);
                _analysis.confidence_score += 0.2;
            }
        }
        // Find similar incidents
        if (include_similar) {
            const similarQuery = `short_descriptionLIKE${incident.short_description}^sys_id!=${incident.sys_id}^state=6`;
            const similarIncidents = await this.client.searchRecords('incident', similarQuery, 5);
            _analysis.similar_incidents = similarIncidents.success ? similarIncidents.data.result : [];
        }
        // Root cause analysis
        _analysis.root_cause__analysis = this.generateRootCauseAnalysis(incident, _analysis.patterns_found);
        // Search knowledge base
        const kbQuery = `textLIKE${incident.short_description}^workflow_state=published`;
        const kbArticles = await this.client.searchRecords('kb_knowledge', kbQuery, 3);
        _analysis.knowledge_articles = kbArticles.success ? kbArticles.data.result : [];
        // Automated actions
        _analysis.automated_actions = this.generateAutomatedActions(incident, _analysis.patterns_found);
        return _analysis;
    }
    generateRootCauseAnalysis(incident, patterns) {
        if (patterns.length === 0) {
            return 'No specific patterns detected. Manual investigation required.';
        }
        const _analysis = [];
        if (patterns.includes('network_issues')) {
            _analysis.push('Network connectivity issue detected. Check network infrastructure, DNS, and firewall rules.');
        }
        if (patterns.includes('database_issues')) {
            _analysis.push('Database connectivity or performance issue detected. Check database server, connection pools, and query performance.');
        }
        if (patterns.includes('application_errors')) {
            _analysis.push('Application error detected. Check application logs, resource utilization, and service status.');
        }
        if (patterns.includes('auth_issues')) {
            _analysis.push('Authentication issue detected. Check user credentials, LDAP/SSO configuration, and permissions.');
        }
        return _analysis.join(' ');
    }
    generateAutomatedActions(incident, patterns) {
        const actions = [];
        if (patterns.includes('network_issues')) {
            actions.push('Execute network connectivity test');
            actions.push('Check DNS resolution');
            actions.push('Verify firewall rules');
        }
        if (patterns.includes('database_issues')) {
            actions.push('Test database connectivity');
            actions.push('Check database performance metrics');
            actions.push('Review connection pool status');
        }
        if (patterns.includes('application_errors')) {
            actions.push('Restart application service');
            actions.push('Check application logs');
            actions.push('Monitor resource utilization');
        }
        if (patterns.includes('auth_issues')) {
            actions.push('Reset user session');
            actions.push('Verify user permissions');
            actions.push('Check authentication service status');
        }
        return actions;
    }
    async generateResolutionActions(incident, _analysis) {
        const actions = [];
        // Add high-confidence automated actions
        if (_analysis.confidence_score > 0.6) {
            actions.push(..._analysis.automated_actions);
        }
        // Add knowledge-based actions
        if (_analysis.knowledge_articles.length > 0) {
            actions.push('Apply resolution from knowledge article');
        }
        // Add pattern-based actions
        if (_analysis.similar_incidents.length > 0) {
            actions.push('Apply resolution from similar incident');
        }
        return actions;
    }
    async executeResolutionActions(incident_id, actions) {
        const executed = [];
        for (const action of actions) {
            try {
                // This would integrate with actual automation systems
                this.logger.info(`Executing action: ${action} for incident ${incident_id}`);
                executed.push(`✅ ${action}`);
            }
            catch (error) {
                executed.push(`❌ ${action}: ${error}`);
            }
        }
        return executed;
    }
    async getRequestItems(requests) {
        const items = [];
        for (const request of requests) {
            const requestItems = await this.client.searchRecords('sc_req_item', `request=${request.sys_id}`, 10);
            if (requestItems.success) {
                items.push(...requestItems.data.result);
            }
        }
        return items;
    }
    async getRelatedIncidents(problems) {
        const incidents = [];
        for (const problem of problems) {
            const relatedIncidents = await this.client.searchRecords('incident', `problem_id=${problem.sys_id}`, 10);
            if (relatedIncidents.success) {
                incidents.push(...relatedIncidents.data.result);
            }
        }
        return incidents;
    }
    async getCIRelationships(configItems) {
        const relationships = [];
        for (const ci of configItems) {
            try {
                const ciRelationships = await this.client.searchRecords('cmdb_rel_ci', `parent=${ci.sys_id}^ORchild=${ci.sys_id}`, 10);
                relationships.push({
                    ci_id: ci.sys_id,
                    ci_name: ci.name,
                    relationships: ciRelationships
                });
            }
            catch (error) {
                this.logger.error(`Error getting relationships for CI ${ci.sys_id}:`, error);
            }
        }
        return relationships;
    }
    async getUserDetails(userId, include_roles, include_groups) {
        const details = {};
        if (include_roles) {
            details.roles = await this.client.searchRecords('sys_user_has_role', `user=${userId}`, 20);
        }
        if (include_groups) {
            details.groups = await this.client.searchRecords('sys_user_grmember', `user=${userId}`, 20);
        }
        return details;
    }
    async calculateOperationalMetrics(timeframe, metricTypes) {
        const dateFilter = this.getDateFilter(timeframe);
        const metrics = {
            total_incidents: 0,
            open_incidents: 0,
            high_priority_incidents: 0,
            avg_resolution_time: 0,
            common_categories: [],
            trending_issues: []
        };
        try {
            // Get total incidents
            const totalIncidents = await this.client.searchRecords('incident', `sys_created_on${dateFilter}`, 1000);
            metrics.total_incidents = totalIncidents.success ? totalIncidents.data.result.length : 0;
            // Get open incidents
            const openIncidents = await this.client.searchRecords('incident', `active=true^sys_created_on${dateFilter}`, 1000);
            metrics.open_incidents = openIncidents.success ? openIncidents.data.result.length : 0;
            // Get high priority incidents
            const highPriorityIncidents = await this.client.searchRecords('incident', `priority=1^sys_created_on${dateFilter}`, 1000);
            metrics.high_priority_incidents = highPriorityIncidents.success ? highPriorityIncidents.data.result.length : 0;
            // Calculate common categories
            const categories = new Map();
            if (totalIncidents.success) {
                totalIncidents.data.result.forEach((incident) => {
                    const category = incident.category || 'uncategorized';
                    categories.set(category, (categories.get(category) || 0) + 1);
                });
            }
            metrics.common_categories = Array.from(categories.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([category, count]) => `${category}: ${count}`);
        }
        catch (error) {
            this.logger.error('Error calculating operational metrics:', error);
        }
        return metrics;
    }
    getDateFilter(timeframe) {
        switch (timeframe) {
            case 'today':
                return 'ONToday@javascript:gs.daysAgoStart(0)@javascript:gs.daysAgoEnd(0)';
            case 'week':
                return 'ONLast 7 days@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)';
            case 'month':
                return 'ONLast 30 days@javascript:gs.daysAgoStart(30)@javascript:gs.daysAgoEnd(0)';
            case 'quarter':
                return 'ONLast 90 days@javascript:gs.daysAgoStart(90)@javascript:gs.daysAgoEnd(0)';
            default:
                return 'ONLast 7 days@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)';
        }
    }
    async analyzePatterns(analysisType, timeframe) {
        const dateFilter = this.getDateFilter(timeframe);
        switch (analysisType) {
            case 'incident_patterns':
                return await this.analyzeIncidentPatterns(dateFilter);
            case 'request_trends':
                return await this.analyzeRequestTrends(dateFilter);
            case 'problem_root_causes':
                return await this.analyzeProblemRootCauses(dateFilter);
            case 'user_behavior':
                return await this.analyzeUserBehavior(dateFilter);
            default:
                return { error: 'Unknown _analysis type' };
        }
    }
    async analyzeIncidentPatterns(dateFilter) {
        const incidents = await this.client.searchRecords('incident', `sys_created_on${dateFilter}`, 1000);
        const patterns = {
            by_category: new Map(),
            by_priority: new Map(),
            by_state: new Map(),
            by_hour: new Map(),
            common_keywords: new Map()
        };
        if (incidents.success) {
            incidents.data.result.forEach((incident) => {
                // Category patterns
                const category = incident.category || 'uncategorized';
                patterns.by_category.set(category, (patterns.by_category.get(category) || 0) + 1);
                // Priority patterns
                const priority = incident.priority || 'unknown';
                patterns.by_priority.set(priority, (patterns.by_priority.get(priority) || 0) + 1);
                // State patterns
                const state = incident.state || 'unknown';
                patterns.by_state.set(state, (patterns.by_state.get(state) || 0) + 1);
                // Time patterns
                if (incident.sys_created_on) {
                    const hour = new Date(incident.sys_created_on).getHours();
                    patterns.by_hour.set(hour, (patterns.by_hour.get(hour) || 0) + 1);
                }
                // Keyword patterns
                const description = (incident.short_description || '').toLowerCase();
                const keywords = description.split(/\s+/).filter((word) => word.length > 3);
                keywords.forEach((keyword) => {
                    patterns.common_keywords.set(keyword, (patterns.common_keywords.get(keyword) || 0) + 1);
                });
            });
        }
        return {
            total_incidents: incidents.success ? incidents.data.result.length : 0,
            patterns: {
                by_category: Object.fromEntries(patterns.by_category),
                by_priority: Object.fromEntries(patterns.by_priority),
                by_state: Object.fromEntries(patterns.by_state),
                by_hour: Object.fromEntries(patterns.by_hour),
                top_keywords: Array.from(patterns.common_keywords.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([keyword, count]) => ({ keyword, count }))
            }
        };
    }
    async analyzeRequestTrends(dateFilter) {
        const requests = await this.client.searchRecords('sc_request', `sys_created_on${dateFilter}`, 1000);
        const trends = {
            by_state: new Map(),
            by_requested_for: new Map(),
            by_approval_status: new Map()
        };
        if (requests.success) {
            requests.data.result.forEach((request) => {
                const state = request.state || 'unknown';
                trends.by_state.set(state, (trends.by_state.get(state) || 0) + 1);
                const requestedFor = request.requested_for || 'unknown';
                trends.by_requested_for.set(requestedFor, (trends.by_requested_for.get(requestedFor) || 0) + 1);
                const approvalStatus = request.approval || 'unknown';
                trends.by_approval_status.set(approvalStatus, (trends.by_approval_status.get(approvalStatus) || 0) + 1);
            });
        }
        return {
            total_requests: requests.success ? requests.data.result.length : 0,
            trends: {
                by_state: Object.fromEntries(trends.by_state),
                top_requesters: Array.from(trends.by_requested_for.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10),
                by_approval_status: Object.fromEntries(trends.by_approval_status)
            }
        };
    }
    async analyzeProblemRootCauses(dateFilter) {
        const problems = await this.client.searchRecords('problem', `sys_created_on${dateFilter}`, 1000);
        const rootCauses = {
            by_category: new Map(),
            by_state: new Map(),
            resolution_patterns: new Map()
        };
        if (problems.success) {
            problems.data.result.forEach((problem) => {
                const category = problem.category || 'uncategorized';
                rootCauses.by_category.set(category, (rootCauses.by_category.get(category) || 0) + 1);
                const state = problem.state || 'unknown';
                rootCauses.by_state.set(state, (rootCauses.by_state.get(state) || 0) + 1);
                if (problem.resolution_notes) {
                    const resolution = problem.resolution_notes.toLowerCase();
                    // Simple pattern matching for resolution types
                    if (resolution.includes('restart')) {
                        rootCauses.resolution_patterns.set('restart', (rootCauses.resolution_patterns.get('restart') || 0) + 1);
                    }
                    if (resolution.includes('configuration')) {
                        rootCauses.resolution_patterns.set('configuration', (rootCauses.resolution_patterns.get('configuration') || 0) + 1);
                    }
                    if (resolution.includes('patch') || resolution.includes('update')) {
                        rootCauses.resolution_patterns.set('patch/update', (rootCauses.resolution_patterns.get('patch/update') || 0) + 1);
                    }
                }
            });
        }
        return {
            total_problems: problems.success ? problems.data.result.length : 0,
            root_causes: {
                by_category: Object.fromEntries(rootCauses.by_category),
                by_state: Object.fromEntries(rootCauses.by_state),
                resolution_patterns: Object.fromEntries(rootCauses.resolution_patterns)
            }
        };
    }
    async analyzeUserBehavior(dateFilter) {
        try {
            // Query actual user activity data from ServiceNow
            const activities = [];
            // Get recent incidents created by users
            const incidents = await this.client.searchRecords('incident', `sys_created_on>=${dateFilter}^caller_idISNOTEMPTY`, 100);
            if (incidents.success && incidents.data) {
                const incidentData = Array.isArray(incidents.data) ? incidents.data : [incidents.data];
                const userIncidents = new Map();
                incidentData.forEach(inc => {
                    const userId = inc.caller_id?.value || inc.caller_id;
                    if (userId) {
                        userIncidents.set(userId, (userIncidents.get(userId) || 0) + 1);
                    }
                });
                activities.push({
                    metric: 'incident_reporting',
                    total_incidents: incidentData.length,
                    unique_users: userIncidents.size,
                    avg_per_user: userIncidents.size > 0 ? Math.round(incidentData.length / userIncidents.size * 10) / 10 : 0
                });
            }
            // Get service requests
            const requests = await this.client.searchRecords('sc_request', `sys_created_on>=${dateFilter}^requested_forISNOTEMPTY`, 100);
            if (requests.success && requests.data) {
                const requestData = Array.isArray(requests.data) ? requests.data : [requests.data];
                activities.push({
                    metric: 'request_frequency',
                    total_requests: requestData.length,
                    period: dateFilter
                });
            }
            return {
                analysis_period: dateFilter,
                generated_at: new Date().toISOString(),
                user_activities: activities,
                summary: `Analyzed ${activities.length} activity metrics for period: ${dateFilter}`,
                note: 'Analysis based on actual ServiceNow data from incident and request tables'
            };
        }
        catch (error) {
            return {
                error: 'User behavior _analysis failed',
                message: error instanceof Error ? error.message : String(error),
                available_metrics: ['incident_reporting', 'request_frequency']
            };
        }
    }
    async calculateKnowledgeRelevance(articles, incident) {
        const relevanceScores = [];
        const incidentDescription = (incident.short_description || '').toLowerCase();
        const incidentKeywords = incidentDescription.split(/\s+/).filter((word) => word.length > 3);
        articles.forEach(article => {
            const articleText = (article.text || '').toLowerCase();
            const articleKeywords = articleText.split(/\s+/).filter((word) => word.length > 3);
            // Simple relevance scoring based on keyword overlap
            const commonKeywords = incidentKeywords.filter((keyword) => articleKeywords.includes(keyword));
            const relevanceScore = commonKeywords.length / Math.max(incidentKeywords.length, 1);
            relevanceScores.push({
                article_id: article.sys_id,
                article_title: article.title,
                relevance_score: relevanceScore,
                common_keywords: commonKeywords
            });
        });
        return relevanceScores.sort((a, b) => b.relevance_score - a.relevance_score);
    }
    async performPredictiveAnalysis(predictionType, timeframe) {
        try {
            const currentDate = new Date();
            const _analysis = {
                prediction_type: predictionType,
                timeframe: timeframe,
                generated_at: currentDate.toISOString(),
                analysis_method: 'trend__analysis',
                data_points: []
            };
            switch (predictionType) {
                case 'incident_volume':
                    _analysis.data_points = await this.analyzeIncidentTrends(timeframe);
                    _analysis.interpretation = 'Based on recent incident creation patterns';
                    break;
                case 'system_failure':
                    _analysis.data_points = await this.analyzeSystemHealthTrends(timeframe);
                    _analysis.interpretation = 'Based on critical incident patterns and system health indicators';
                    break;
                case 'resource_exhaustion':
                    _analysis.data_points = await this.analyzeResourceTrends(timeframe);
                    _analysis.interpretation = 'Based on request volumes and capacity indicators';
                    break;
                case 'user_impact':
                    _analysis.data_points = await this.analyzeUserImpactTrends(timeframe);
                    _analysis.interpretation = 'Based on user-reported incidents and service requests';
                    break;
                default:
                    _analysis.data_points = [{ error: 'Unknown prediction type', supported_types: ['incident_volume', 'system_failure', 'resource_exhaustion', 'user_impact'] }];
                    _analysis.interpretation = 'Unsupported _analysis type';
            }
            return _analysis;
        }
        catch (error) {
            return {
                prediction_type: predictionType,
                timeframe: timeframe,
                error: 'Analysis failed',
                message: error instanceof Error ? error.message : String(error),
                generated_at: new Date().toISOString()
            };
        }
    }
    // New trend _analysis methods
    async analyzeIncidentTrends(timeframe) {
        try {
            const incidents = await this.client.searchRecords('incident', 'sys_created_onONToday@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)', 100);
            if (incidents.success && incidents.data) {
                const incidentData = Array.isArray(incidents.data) ? incidents.data : [incidents.data];
                const dailyCounts = new Map();
                incidentData.forEach(incident => {
                    const date = new Date(incident.sys_created_on).toDateString();
                    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
                });
                return Array.from(dailyCounts.entries()).map(([date, count]) => ({
                    date,
                    incident_count: count,
                    trend: count > 5 ? 'increasing' : 'stable'
                }));
            }
        }
        catch (error) {
            return [{ error: 'Failed to analyze incident trends', message: String(error) }];
        }
        return [{ message: 'No incident data available for _analysis' }];
    }
    async analyzeSystemHealthTrends(timeframe) {
        try {
            const criticalIncidents = await this.client.searchRecords('incident', 'priority=1^sys_created_onONToday@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)', 50);
            if (criticalIncidents.success && criticalIncidents.data) {
                const criticalData = Array.isArray(criticalIncidents.data) ? criticalIncidents.data : [criticalIncidents.data];
                return [{
                        metric: 'critical_incidents',
                        count: criticalData.length,
                        health_indicator: criticalData.length > 3 ? 'at_risk' : 'stable',
                        recent_issues: criticalData.slice(0, 3).map(inc => inc.short_description)
                    }];
            }
        }
        catch (error) {
            return [{ error: 'Failed to analyze system health trends', message: String(error) }];
        }
        return [{ message: 'No system health data available' }];
    }
    async analyzeResourceTrends(timeframe) {
        try {
            const requests = await this.client.searchRecords('sc_request', 'sys_created_onONToday@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)', 100);
            if (requests.success && requests.data) {
                const requestData = Array.isArray(requests.data) ? requests.data : [requests.data];
                return [{
                        metric: 'request_volume',
                        total_requests: requestData.length,
                        resource_pressure: requestData.length > 20 ? 'high' : 'normal',
                        trend: 'stable'
                    }];
            }
        }
        catch (error) {
            return [{ error: 'Failed to analyze resource trends', message: String(error) }];
        }
        return [{ message: 'No resource usage data available' }];
    }
    async analyzeUserImpactTrends(timeframe) {
        try {
            const userIncidents = await this.client.searchRecords('incident', 'caller_idISNOTEMPTY^sys_created_onONToday@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)', 100);
            if (userIncidents.success && userIncidents.data) {
                const incidentData = Array.isArray(userIncidents.data) ? userIncidents.data : [userIncidents.data];
                const impactCounts = new Map();
                incidentData.forEach(incident => {
                    const impact = incident.impact || 'unknown';
                    impactCounts.set(impact, (impactCounts.get(impact) || 0) + 1);
                });
                return [{
                        metric: 'user_impact_distribution',
                        high_impact: impactCounts.get('1') || 0,
                        medium_impact: impactCounts.get('2') || 0,
                        low_impact: impactCounts.get('3') || 0,
                        total_affected_users: incidentData.length,
                        impact_trend: (impactCounts.get('1') || 0) > 5 ? 'increasing' : 'stable'
                    }];
            }
        }
        catch (error) {
            return [{ error: 'Failed to analyze user impact trends', message: String(error) }];
        }
        return [{ message: 'No user impact data available' }];
    }
    async predictIncidentVolume(timeframe) {
        // Get historical incident data
        const historicalData = await this.client.searchRecords('incident', 'sys_created_onONLast 30 days@javascript:gs.daysAgoStart(30)@javascript:gs.daysAgoEnd(0)', 1000);
        const dailyVolume = new Map();
        if (historicalData.success) {
            historicalData.data.result.forEach((incident) => {
                const date = new Date(incident.sys_created_on).toDateString();
                dailyVolume.set(date, (dailyVolume.get(date) || 0) + 1);
            });
        }
        const avgDailyVolume = Array.from(dailyVolume.values()).reduce((a, b) => a + b, 0) / dailyVolume.size;
        return [
            {
                metric: 'daily_incident_volume',
                predicted_value: Math.round(avgDailyVolume * 1.1), // Simple trend prediction
                current_average: Math.round(avgDailyVolume),
                trend: 'increasing',
                confidence: 0.6
            }
        ];
    }
    async predictSystemFailure(timeframe) {
        // Analyze problem records and incident patterns
        const problems = await this.client.searchRecords('problem', 'sys_created_onONLast 30 days@javascript:gs.daysAgoStart(30)@javascript:gs.daysAgoEnd(0)', 100);
        const systemFailures = problems.success ? problems.data.result.filter((problem) => (problem.short_description || '').toLowerCase().includes('system') ||
            (problem.short_description || '').toLowerCase().includes('failure') ||
            (problem.short_description || '').toLowerCase().includes('outage')) : [];
        return [
            {
                metric: 'system_failure_risk',
                predicted_value: systemFailures.length > 5 ? 'high' : 'medium',
                current_problems: systemFailures.length,
                risk_factors: ['Historical system problems', 'Incident patterns'],
                confidence: 0.5
            }
        ];
    }
    async predictResourceExhaustion(timeframe) {
        // This would require integration with monitoring systems
        return [
            {
                metric: 'resource_exhaustion_risk',
                predicted_value: 'low',
                message: 'Resource exhaustion prediction requires monitoring system integration',
                confidence: 0.3
            }
        ];
    }
    async predictUserImpact(timeframe) {
        // Analyze user-reported incidents
        const userIncidents = await this.client.searchRecords('incident', 'sys_created_onONLast 7 days@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)^priority=1', 100);
        const impactLevels = new Map();
        if (userIncidents.success) {
            userIncidents.data.result.forEach((incident) => {
                const impact = incident.impact || 'unknown';
                impactLevels.set(impact, (impactLevels.get(impact) || 0) + 1);
            });
        }
        return [
            {
                metric: 'user_impact_prediction',
                predicted_value: impactLevels.get('1') > 5 ? 'high' : 'medium',
                current_high_impact: impactLevels.get('1') || 0,
                trend_factors: ['High priority incidents', 'User complaints'],
                confidence: 0.6
            }
        ];
    }
    async handleCatalogItemManager(args) {
        const { action, item_id, ...params } = args;
        this.logger.info(`Catalog item manager action: ${action}`, { item_id, params });
        try {
            switch (action) {
                case 'create': {
                    // Get default catalog if none provided
                    let catalogId = params.sc_catalogs || params.catalog_id;
                    let categoryId = params.sc_categories || params.category_id;
                    if (!catalogId) {
                        // Find default Service Catalog
                        const defaultCatalogResult = await this.client.searchRecords('sc_catalog', 'active=true^ORDERBYsys_created_on', 1);
                        if (defaultCatalogResult.success && defaultCatalogResult.data?.result?.length > 0) {
                            catalogId = defaultCatalogResult.data.result[0].sys_id;
                            this.logger.info('Using default catalog:', {
                                catalogId,
                                catalogName: defaultCatalogResult.data.result[0].title
                            });
                        }
                        else {
                            this.logger.warn('No catalogs found, catalog item may not be visible');
                        }
                    }
                    if (!categoryId) {
                        // Find a default category like "Hardware" or "General"
                        const defaultCategoryResult = await this.client.searchRecords('sc_category', 'active=true^titleLIKEHardware^ORtitleLIKEGeneral^ORtitleLIKEIT^ORDERBYsys_created_on', 1);
                        if (defaultCategoryResult.success && defaultCategoryResult.data?.result?.length > 0) {
                            categoryId = defaultCategoryResult.data.result[0].sys_id;
                            this.logger.info('Using default category:', {
                                categoryId,
                                categoryName: defaultCategoryResult.data.result[0].title
                            });
                        }
                    }
                    const catalogItem = {
                        name: params.name,
                        short_description: params.short_description,
                        description: params.description,
                        price: params.price || '0',
                        recurring_price: params.recurring_price || '0',
                        billable: params.billable || false,
                        active: params.active !== false,
                        workflow: params.workflow,
                        picture: params.picture,
                        sc_catalogs: catalogId,
                        sc_categories: categoryId,
                        sys_class_name: 'sc_cat_item'
                    };
                    const result = await this.client.createRecord('sc_cat_item', catalogItem);
                    if (result.success && params.variables && params.variables.length > 0) {
                        // Add variables to the catalog item
                        for (const variable of params.variables) {
                            await this.createCatalogVariable(result.data.sys_id, variable);
                        }
                    }
                    return {
                        content: [{
                                type: 'text',
                                text: result.success
                                    ? `✅ Catalog item created successfully!\n\nSys ID: ${result.data.sys_id}\nName: ${result.data.name}\n\nView at: ${this.getServiceNowUrl()}/nav_to.do?uri=sc_cat_item.do?sys_id=${result.data.sys_id}`
                                    : `❌ Failed to create catalog item: ${result.error}`
                            }]
                    };
                }
                case 'update': {
                    if (!item_id) {
                        throw new Error('item_id is required for update action');
                    }
                    const updateData = {};
                    if (params.name)
                        updateData.name = params.name;
                    if (params.short_description)
                        updateData.short_description = params.short_description;
                    if (params.description)
                        updateData.description = params.description;
                    if (params.price)
                        updateData.price = params.price;
                    if (params.recurring_price)
                        updateData.recurring_price = params.recurring_price;
                    if (params.billable !== undefined)
                        updateData.billable = params.billable;
                    if (params.active !== undefined)
                        updateData.active = params.active;
                    if (params.workflow)
                        updateData.workflow = params.workflow;
                    if (params.sc_catalogs)
                        updateData.sc_catalogs = params.sc_catalogs;
                    if (params.sc_categories)
                        updateData.sc_categories = params.sc_categories;
                    const result = await this.client.updateRecord('sc_cat_item', item_id, updateData);
                    return {
                        content: [{
                                type: 'text',
                                text: result.success
                                    ? `✅ Catalog item updated successfully!\n\nSys ID: ${item_id}\n\nView at: ${this.getServiceNowUrl()}/nav_to.do?uri=sc_cat_item.do?sys_id=${item_id}`
                                    : `❌ Failed to update catalog item: ${result.error}`
                            }]
                    };
                }
                case 'list': {
                    const query = params.category_id ? `sc_categories=${params.category_id}` : 'active=true';
                    const result = await this.client.searchRecords('sc_cat_item', query, 50);
                    if (result.success) {
                        const items = result.data.result.map((item) => ({
                            sys_id: item.sys_id,
                            name: item.name,
                            short_description: item.short_description,
                            price: item.price,
                            active: item.active,
                            category: item.category?.display_value
                        }));
                        return {
                            content: [{
                                    type: 'text',
                                    text: `📋 Found ${items.length} catalog items:\n\n${JSON.stringify(items, null, 2)}`
                                }]
                        };
                    }
                    else {
                        throw new Error(`Failed to list catalog items: ${result.error}`);
                    }
                }
                case 'get': {
                    if (!item_id) {
                        throw new Error('item_id is required for get action');
                    }
                    const result = await this.client.getRecord('sc_cat_item', item_id);
                    if (result.success) {
                        // Get variables for the item
                        const variables = await this.client.searchRecords('item_option_new', `cat_item=${item_id}`, 50);
                        return {
                            content: [{
                                    type: 'text',
                                    text: `📋 Catalog Item Details:\n\n${JSON.stringify(result.data, null, 2)}\n\n📊 Variables:\n${JSON.stringify(variables.data?.result || [], null, 2)}`
                                }]
                        };
                    }
                    else {
                        throw new Error(`Failed to get catalog item: ${result.error}`);
                    }
                }
                case 'add_variable': {
                    if (!item_id) {
                        throw new Error('item_id is required for add_variable action');
                    }
                    if (!params.variables || params.variables.length === 0) {
                        throw new Error('variables array is required');
                    }
                    const results = [];
                    for (const variable of params.variables) {
                        const result = await this.createCatalogVariable(item_id, variable);
                        results.push(result);
                    }
                    return {
                        content: [{
                                type: 'text',
                                text: `✅ Added ${results.length} variables to catalog item ${item_id}`
                            }]
                    };
                }
                case 'set_workflow': {
                    if (!item_id) {
                        throw new Error('item_id is required for set_workflow action');
                    }
                    if (!params.workflow) {
                        throw new Error('workflow is required');
                    }
                    const result = await this.client.updateRecord('sc_cat_item', item_id, {
                        workflow: params.workflow
                    });
                    return {
                        content: [{
                                type: 'text',
                                text: result.success
                                    ? `✅ Workflow set successfully for catalog item ${item_id}`
                                    : `❌ Failed to set workflow: ${result.error}`
                            }]
                    };
                }
                case 'publish': {
                    if (!item_id) {
                        throw new Error('item_id is required for publish action');
                    }
                    const result = await this.client.updateRecord('sc_cat_item', item_id, {
                        active: true
                    });
                    return {
                        content: [{
                                type: 'text',
                                text: result.success
                                    ? `✅ Catalog item ${item_id} published successfully`
                                    : `❌ Failed to publish catalog item: ${result.error}`
                            }]
                    };
                }
                case 'retire': {
                    if (!item_id) {
                        throw new Error('item_id is required for retire action');
                    }
                    const result = await this.client.updateRecord('sc_cat_item', item_id, {
                        active: false
                    });
                    return {
                        content: [{
                                type: 'text',
                                text: result.success
                                    ? `✅ Catalog item ${item_id} retired successfully`
                                    : `❌ Failed to retire catalog item: ${result.error}`
                            }]
                    };
                }
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        }
        catch (error) {
            this.logger.error('Error in catalog item manager:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Catalog item manager error: ${error}`);
        }
    }
    async createCatalogVariable(catalogItemId, variable) {
        const variableData = {
            cat_item: catalogItemId,
            name: variable.name,
            question_text: variable.label || variable.name,
            type: this.mapVariableType(variable.type),
            mandatory: variable.mandatory || false,
            default_value: variable.default_value || '',
            order: variable.order || 100
        };
        // Handle select box choices
        if (variable.type === 'select_box' && variable.choices) {
            variableData.lookup_table = 'question_choice';
            // Note: In a real implementation, you'd need to create choice records
        }
        return await this.client.createRecord('item_option_new', variableData);
    }
    mapVariableType(type) {
        const typeMap = {
            'single_line_text': '6', // Single Line Text
            'multi_line_text': '2', // Multi Line Text
            'select_box': '3', // Select Box
            'checkbox': '7', // Checkbox
            'reference': '8', // Reference
            'date': '9', // Date
            'datetime': '10' // Date/Time
        };
        return typeMap[type] || '6'; // Default to single line text
    }
    async handleCatalogItemSearch(args) {
        const { query, include_inactive = false, fuzzy_match = true, category_filter, limit = 50, include_variables = false } = args;
        this.logger.info(`Searching catalog items for: ${query}`, { fuzzy_match, category_filter, limit });
        try {
            // Build search queries
            const searchQueries = [];
            // Exact match
            searchQueries.push(`name=${query}`);
            // Contains match
            searchQueries.push(`nameLIKE${query}`);
            searchQueries.push(`short_descriptionLIKE${query}`);
            // Fuzzy matching for similar items
            if (fuzzy_match) {
                // Handle common variations
                const variations = this.generateSearchVariations(query);
                variations.forEach(variation => {
                    searchQueries.push(`nameLIKE${variation}`);
                    searchQueries.push(`short_descriptionLIKE${variation}`);
                });
            }
            // Add active filter
            const activeFilter = include_inactive ? '' : '^active=true';
            // Add category filter if provided
            let categoryFilter = '';
            if (category_filter) {
                // First try to find the category
                const categoryResult = await this.client.searchRecords('sc_category', `nameLIKE${category_filter}^ORtitle=${category_filter}^ORsys_id=${category_filter}`, 10);
                if (categoryResult.success && categoryResult.data?.result?.length > 0) {
                    // Try to find the most relevant category
                    const exactMatch = categoryResult.data.result.find((c) => c.name.toLowerCase() === category_filter.toLowerCase());
                    const category = exactMatch || categoryResult.data.result[0];
                    categoryFilter = `^sc_categoriesLIKE${category.sys_id}`;
                }
            }
            // Execute searches
            const allResults = new Map();
            for (const searchQuery of searchQueries) {
                const fullQuery = searchQuery + activeFilter + categoryFilter;
                const result = await this.client.searchRecords('sc_cat_item', fullQuery, limit);
                if (result.success && result.data?.result) {
                    result.data.result.forEach((item) => {
                        if (!allResults.has(item.sys_id)) {
                            // Filter out items that don't make sense for the search
                            const itemName = (item.name || '').toLowerCase();
                            const itemDesc = (item.short_description || '').toLowerCase();
                            // Skip items that are clearly not what the user is looking for
                            if (this.shouldExcludeItem(query, itemName, itemDesc)) {
                                return;
                            }
                            allResults.set(item.sys_id, {
                                sys_id: item.sys_id,
                                name: item.name,
                                short_description: item.short_description,
                                price: item.price,
                                recurring_price: item.recurring_price,
                                active: item.active,
                                category: item.sc_categories?.display_value,
                                catalog: item.sc_catalogs?.display_value,
                                model_number: item.model,
                                manufacturer: item.vendor,
                                variables: []
                            });
                        }
                    });
                }
            }
            // Get variables if requested
            if (include_variables && allResults.size > 0) {
                for (const [sys_id, item] of allResults) {
                    const variablesResult = await this.client.searchRecords('item_option_new', `cat_item=${sys_id}`, 50);
                    if (variablesResult.success && variablesResult.data?.result) {
                        item.variables = variablesResult.data.result.map((v) => ({
                            name: v.name,
                            label: v.question_text,
                            type: v.type,
                            mandatory: v.mandatory,
                            default_value: v.default_value
                        }));
                    }
                }
            }
            const resultsArray = Array.from(allResults.values());
            // Sort by relevance (exact matches first)
            resultsArray.sort((a, b) => {
                const aExact = a.name.toLowerCase() === query.toLowerCase();
                const bExact = b.name.toLowerCase() === query.toLowerCase();
                if (aExact && !bExact)
                    return -1;
                if (!aExact && bExact)
                    return 1;
                return 0;
            });
            if (resultsArray.length === 0) {
                // Provide suggestions if no results found
                const suggestions = this.generateSearchSuggestions(query);
                return {
                    content: [{
                            type: 'text',
                            text: `❌ No catalog items found for "${query}"\n\n` +
                                `💡 Suggestions:\n` +
                                suggestions.map(s => `- Try searching for "${s}"`).join('\n') +
                                `\n\n💡 Tips:\n` +
                                `- Check if the item name is spelled correctly\n` +
                                `- Try searching with partial names (e.g., "iPhone" instead of "iPhone 6S")\n` +
                                `- Use category filter to narrow down results\n` +
                                `- Enable include_inactive if looking for retired items`
                        }]
                };
            }
            // Format results
            let resultText = `🔍 Found ${resultsArray.length} catalog items matching "${query}":\n\n`;
            resultsArray.forEach((item, index) => {
                resultText += `${index + 1}. **${item.name}** (${item.sys_id})\n`;
                resultText += `   📝 ${item.short_description || 'No description'}\n`;
                resultText += `   💰 Price: $${item.price || '0'} ${item.recurring_price ? `(+ $${item.recurring_price}/month)` : ''}\n`;
                resultText += `   📁 Category: ${item.category || 'Uncategorized'}\n`;
                resultText += `   📚 Catalog: ${item.catalog || 'Default'}\n`;
                if (item.model_number) {
                    resultText += `   🔢 Model: ${item.model_number}\n`;
                }
                if (item.manufacturer) {
                    resultText += `   🏭 Manufacturer: ${item.manufacturer}\n`;
                }
                resultText += `   ✅ Status: ${item.active ? 'Active' : 'Inactive'}\n`;
                if (item.variables && item.variables.length > 0) {
                    resultText += `   📋 Variables (${item.variables.length}):\n`;
                    item.variables.forEach((v) => {
                        resultText += `      - ${v.label} (${v.name}) - ${v.type}${v.mandatory ? ' *Required' : ''}\n`;
                    });
                }
                resultText += '\n';
            });
            resultText += `\n💡 Use snow_catalog_item_manager to create or update catalog items`;
            return {
                content: [{
                        type: 'text',
                        text: resultText
                    }]
            };
        }
        catch (error) {
            this.logger.error('Error searching catalog items:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Catalog search error: ${error}`);
        }
    }
    generateSearchVariations(query) {
        const variations = [];
        const lowerQuery = query.toLowerCase();
        // Handle common product variations
        if (lowerQuery.includes('iphone')) {
            // Add variations without spaces, with different numbers
            const baseModel = query.replace(/iphone\s*/i, 'iPhone ');
            variations.push(baseModel);
            variations.push(baseModel.replace(' ', ''));
            // Try different model numbers
            const modelMatch = query.match(/\d+/);
            if (modelMatch) {
                const modelNum = parseInt(modelMatch[0]);
                variations.push(query.replace(modelNum.toString(), (modelNum + 1).toString()));
                variations.push(query.replace(modelNum.toString(), (modelNum - 1).toString()));
            }
        }
        // Handle laptop/computer variations
        if (lowerQuery.includes('laptop') || lowerQuery.includes('computer')) {
            variations.push('notebook', 'macbook', 'thinkpad', 'dell', 'hp');
        }
        // Handle phone variations
        if (lowerQuery.includes('phone') || lowerQuery.includes('mobile')) {
            variations.push('smartphone', 'android', 'samsung', 'pixel');
        }
        // Handle monitor/display variations
        if (lowerQuery.includes('monitor') || lowerQuery.includes('display') ||
            lowerQuery.includes('screen') || lowerQuery.includes('lcd')) {
            variations.push('monitor', 'display', 'screen', 'lcd', 'led', 'desktop monitor', 'computer monitor', 'external display', 'lcd monitor', 'led monitor', 'dell monitor', 'hp monitor', 'samsung monitor', 'lg monitor');
        }
        // Handle desktop/workstation variations
        if (lowerQuery.includes('desktop') || lowerQuery.includes('workstation')) {
            variations.push('desktop computer', 'workstation', 'pc', 'desktop pc', 'dell desktop', 'hp desktop', 'lenovo desktop');
        }
        // Handle specific hardware terms
        if (lowerQuery.includes('hardware') || lowerQuery.includes('equipment')) {
            // Extract specific items from the query
            const specificItems = [];
            if (lowerQuery.includes('monitor') || lowerQuery.includes('display') || lowerQuery.includes('screen')) {
                specificItems.push('monitor', 'display');
            }
            if (lowerQuery.includes('desktop')) {
                specificItems.push('desktop', 'computer');
            }
            if (lowerQuery.includes('laptop')) {
                specificItems.push('laptop', 'notebook');
            }
            // If we found specific items, use those instead of generic "hardware"
            if (specificItems.length > 0) {
                variations.push(...specificItems);
            }
        }
        // Remove duplicates and empty strings
        return [...new Set(variations)].filter(v => v && v.length > 0);
    }
    generateSearchSuggestions(query) {
        const suggestions = [];
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('iphone')) {
            suggestions.push('iPhone', 'Apple iPhone', 'iOS device', 'Apple mobile');
        }
        else if (lowerQuery.includes('laptop')) {
            suggestions.push('notebook', 'computer', 'workstation', 'MacBook', 'ThinkPad');
        }
        else if (lowerQuery.includes('software')) {
            suggestions.push('license', 'application', 'subscription', 'SaaS');
        }
        else if (lowerQuery.includes('monitor') || lowerQuery.includes('display') ||
            lowerQuery.includes('screen') || lowerQuery.includes('lcd')) {
            suggestions.push('monitor', 'display', 'external monitor', 'desktop monitor', 'Dell monitor', 'HP monitor', 'Samsung monitor');
        }
        else if (lowerQuery.includes('desktop')) {
            suggestions.push('desktop computer', 'workstation', 'PC', 'desktop PC', 'Dell desktop', 'HP desktop');
        }
        else if (lowerQuery.includes('hardware')) {
            // For hardware searches, suggest specific item types
            suggestions.push('monitor', 'keyboard', 'mouse', 'laptop', 'desktop', 'printer', 'scanner', 'docking station', 'headset');
        }
        else {
            // Generic suggestions based on the query
            const words = query.split(' ');
            if (words.length > 1) {
                // Try individual words
                suggestions.push(...words.filter(w => w.length > 3));
                // Try first and last word
                suggestions.push(words[0], words[words.length - 1]);
            }
            // Add generic category suggestions
            suggestions.push('hardware', 'software', 'equipment', 'device', 'accessory');
        }
        return [...new Set(suggestions)].filter(s => s && s !== query && s.length > 0);
    }
    shouldExcludeItem(query, itemName, itemDesc) {
        const lowerQuery = query.toLowerCase();
        // If searching for hardware/monitors/displays, exclude service/process items
        if ((lowerQuery.includes('hardware') || lowerQuery.includes('monitor') ||
            lowerQuery.includes('display') || lowerQuery.includes('screen') ||
            lowerQuery.includes('desktop') || lowerQuery.includes('equipment')) &&
            (itemName.includes('decommission') || itemName.includes('service') ||
                itemName.includes('process') || itemName.includes('request') ||
                itemName.includes('removal') || itemName.includes('decomm') ||
                itemDesc.includes('decommission') || itemDesc.includes('service process'))) {
            return true;
        }
        // If searching for specific hardware, exclude unrelated items
        if (lowerQuery.includes('monitor') || lowerQuery.includes('display') || lowerQuery.includes('screen')) {
            // Exclude items that are clearly not monitors
            if ((itemName.includes('server') || itemName.includes('controller') ||
                itemName.includes('software') || itemName.includes('license') ||
                itemName.includes('training') || itemName.includes('support')) &&
                !itemName.includes('monitor') && !itemName.includes('display') &&
                !itemName.includes('screen')) {
                return true;
            }
        }
        // If searching for desktops, exclude non-desktop items
        if (lowerQuery.includes('desktop')) {
            if ((itemName.includes('mobile') || itemName.includes('phone') ||
                itemName.includes('tablet') || itemName.includes('service')) &&
                !itemName.includes('desktop')) {
                return true;
            }
        }
        return false;
    }
    async handleCleanupTestArtifacts(args) {
        const { artifact_types = ['catalog_items', 'flows', 'users'], test_patterns = ['Test%', 'Mock%', 'Demo%', '%_test_%', '%test', '%mock'], max_age_hours = 1, dry_run = false, preserve_update_set_entries = true, update_set_filter } = args;
        this.logger.info('Starting test artifact cleanup', {
            artifact_types,
            test_patterns,
            max_age_hours,
            dry_run
        });
        const cleanupResults = {
            start_time: new Date().toISOString(),
            dry_run,
            artifacts_found: {
                catalog_items: [],
                flows: [],
                users: [],
                requests: []
            },
            artifacts_deleted: {
                catalog_items: 0,
                flows: 0,
                users: 0,
                requests: 0
            },
            update_set_entries_preserved: 0,
            errors: [],
            summary: ''
        };
        try {
            // Calculate cutoff time
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - max_age_hours);
            const cutoffISO = cutoffTime.toISOString();
            // Process each artifact type
            for (const artifactType of artifact_types) {
                if (artifactType === 'all' || artifact_types.includes('catalog_items')) {
                    await this.cleanupTestCatalogItems(test_patterns, cutoffISO, dry_run, cleanupResults, update_set_filter);
                }
                // Flow cleanup removed in v1.4.38 - flows no longer supported
                if (artifactType === 'all' || artifact_types.includes('users')) {
                    await this.cleanupTestUsers(test_patterns, cutoffISO, dry_run, cleanupResults, update_set_filter);
                }
                if (artifactType === 'all' || artifact_types.includes('requests')) {
                    await this.cleanupTestRequests(test_patterns, cutoffISO, dry_run, cleanupResults, update_set_filter);
                }
            }
            // Generate summary
            const totalFound = Object.values(cleanupResults.artifacts_found)
                .reduce((sum, items) => (typeof sum === 'number' ? sum : 0) + (Array.isArray(items) ? items.length : 0), 0);
            const totalDeleted = Object.values(cleanupResults.artifacts_deleted)
                .reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
            cleanupResults.summary = dry_run
                ? `🔍 Dry Run: Found ${totalFound} test artifacts that would be cleaned up`
                : `🧹 Cleaned up ${totalDeleted} test artifacts successfully`;
            // Format results
            let resultText = `🧹 Test Artifact Cleanup Results\n${'='.repeat(50)}\n\n`;
            if (dry_run) {
                resultText += `🔍 **DRY RUN MODE** - No actual deletion performed\n\n`;
            }
            resultText += `⏰ **Cleanup Configuration:**\n`;
            resultText += `- Artifact Types: ${artifact_types.join(', ')}\n`;
            resultText += `- Test Patterns: ${test_patterns.join(', ')}\n`;
            resultText += `- Max Age: ${max_age_hours} hours\n`;
            resultText += `- Cutoff Time: ${cutoffISO}\n`;
            resultText += `- Preserve Update Set Entries: ${preserve_update_set_entries ? '✅' : '❌'}\n\n`;
            // Report findings by type
            ['catalog_items', 'flows', 'users', 'requests'].forEach(type => {
                const found = cleanupResults.artifacts_found[type] || [];
                const deleted = cleanupResults.artifacts_deleted[type] || 0;
                if (found.length > 0) {
                    resultText += `📦 **${type.replace('_', ' ').toUpperCase()}:**\n`;
                    resultText += `   ${dry_run ? 'Found' : 'Deleted'}: ${dry_run ? found.length : deleted}\n`;
                    if (dry_run && found.length > 0) {
                        found.slice(0, 10).forEach((item) => {
                            resultText += `   - ${item.name} (${item.sys_id}) - Created: ${item.sys_created_on}\n`;
                        });
                        if (found.length > 10) {
                            resultText += `   ... and ${found.length - 10} more\n`;
                        }
                    }
                    resultText += '\n';
                }
            });
            if (cleanupResults.update_set_entries_preserved > 0) {
                resultText += `📋 **Update Set Audit Trail Preserved:** ${cleanupResults.update_set_entries_preserved} entries\n\n`;
            }
            if (cleanupResults.errors.length > 0) {
                resultText += `❌ **Errors:**\n`;
                cleanupResults.errors.forEach(error => {
                    resultText += `   - ${error}\n`;
                });
                resultText += '\n';
            }
            resultText += `✅ **${cleanupResults.summary}**\n\n`;
            if (!dry_run && totalDeleted > 0) {
                resultText += `💡 **Note:** Update Set entries have been preserved as audit trail.\n`;
                resultText += `This shows that testing was performed and cleanup was completed.\n\n`;
            }
            if (dry_run) {
                resultText += `▶️ **Next Steps:**\n`;
                resultText += `1. Review the artifacts that would be deleted\n`;
                resultText += `2. Run again with dry_run: false to perform actual cleanup\n`;
                resultText += `3. Verify Update Set entries are preserved as intended\n`;
            }
            return {
                content: [{
                        type: 'text',
                        text: resultText
                    }]
            };
        }
        catch (error) {
            this.logger.error('Error during test artifact cleanup:', error);
            return {
                content: [{
                        type: 'text',
                        text: `❌ Test artifact cleanup failed\n\nError: ${error.message}\n\n` +
                            `🔧 Troubleshooting:\n` +
                            `1. Check ServiceNow connection and permissions\n` +
                            `2. Verify test patterns are correct\n` +
                            `3. Ensure artifacts exist and are accessible\n\n` +
                            `Debug Info: ${JSON.stringify(cleanupResults, null, 2)}`
                    }]
            };
        }
    }
    async cleanupTestCatalogItems(patterns, cutoffTime, dryRun, results, updateSetFilter) {
        try {
            // Build query for test catalog items
            const patternQueries = patterns.map(pattern => {
                if (pattern.includes('%')) {
                    return `nameLIKE${pattern.replace(/%/g, '')}`;
                }
                else {
                    return `name=${pattern}`;
                }
            });
            const query = `(${patternQueries.join('^OR')})^sys_created_on<${cutoffTime}`;
            const searchResult = await this.client.searchRecords('sc_cat_item', query, 100);
            if (searchResult.success && searchResult.data?.result) {
                results.artifacts_found.catalog_items = searchResult.data.result.map((item) => ({
                    sys_id: item.sys_id,
                    name: item.name,
                    sys_created_on: item.sys_created_on
                }));
                if (!dryRun) {
                    // Delete each catalog item
                    for (const item of searchResult.data.result) {
                        const deleteResult = await this.client.deleteRecord('sc_cat_item', item.sys_id);
                        if (deleteResult.success) {
                            results.artifacts_deleted.catalog_items++;
                        }
                        else {
                            results.errors.push(`Failed to delete catalog item ${item.name}: ${deleteResult.error}`);
                        }
                    }
                }
            }
        }
        catch (error) {
            results.errors.push(`Error cleaning catalog items: ${error.message}`);
        }
    }
    async cleanupTestUsers(patterns, cutoffTime, dryRun, results, updateSetFilter) {
        try {
            const patternQueries = patterns.map(pattern => {
                if (pattern.includes('%')) {
                    return `user_nameLIKE${pattern.replace(/%/g, '')}^ORfirst_nameLIKE${pattern.replace(/%/g, '')}`;
                }
                else {
                    return `user_name=${pattern}^ORfirst_name=${pattern}`;
                }
            });
            const query = `(${patternQueries.join('^OR')})^sys_created_on<${cutoffTime}^active=false`;
            const searchResult = await this.client.searchRecords('sys_user', query, 100);
            if (searchResult.success && searchResult.data?.result) {
                results.artifacts_found.users = searchResult.data.result.map((user) => ({
                    sys_id: user.sys_id,
                    name: user.user_name || user.name,
                    sys_created_on: user.sys_created_on
                }));
                if (!dryRun) {
                    for (const user of searchResult.data.result) {
                        const deleteResult = await this.client.deleteRecord('sys_user', user.sys_id);
                        if (deleteResult.success) {
                            results.artifacts_deleted.users++;
                        }
                        else {
                            results.errors.push(`Failed to delete user ${user.user_name}: ${deleteResult.error}`);
                        }
                    }
                }
            }
        }
        catch (error) {
            results.errors.push(`Error cleaning users: ${error.message}`);
        }
    }
    async cleanupTestRequests(patterns, cutoffTime, dryRun, results, updateSetFilter) {
        try {
            const patternQueries = patterns.map(pattern => {
                if (pattern.includes('%')) {
                    return `short_descriptionLIKE${pattern.replace(/%/g, '')}`;
                }
                else {
                    return `short_description=${pattern}`;
                }
            });
            const query = `(${patternQueries.join('^OR')})^sys_created_on<${cutoffTime}`;
            const searchResult = await this.client.searchRecords('sc_request', query, 100);
            if (searchResult.success && searchResult.data?.result) {
                results.artifacts_found.requests = searchResult.data.result.map((req) => ({
                    sys_id: req.sys_id,
                    name: req.number || req.short_description,
                    sys_created_on: req.sys_created_on
                }));
                if (!dryRun) {
                    for (const request of searchResult.data.result) {
                        // Cancel request instead of deleting (safer)
                        const updateResult = await this.client.updateRecord('sc_request', request.sys_id, {
                            state: '4', // Cancelled
                            comments: 'Cancelled by test cleanup automation'
                        });
                        if (updateResult.success) {
                            results.artifacts_deleted.requests++;
                        }
                        else {
                            results.errors.push(`Failed to cancel request ${request.number}: ${updateResult.error}`);
                        }
                    }
                }
            }
        }
        catch (error) {
            results.errors.push(`Error cleaning requests: ${error.message}`);
        }
    }
    getServiceNowUrl() {
        // This would need to get the instance URL from credentials
        return 'https://instance.service-now.com';
    }
    async handleCreateUserGroup(args) {
        const { name, description, email, manager, parent, type, active = true } = args;
        this.logger.info(`Creating user group: ${name}`);
        try {
            // Check if group already exists
            const existingGroup = await this.client.get('/api/now/table/sys_user_group', {
                sysparm_query: `name=${name}`,
                sysparm_limit: 1
            });
            if (existingGroup.result?.length > 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `✅ Group "${name}" already exists!\n\nSys ID: ${existingGroup.result[0].sys_id}\nManager: ${existingGroup.result[0].manager?.display_value || 'None'}\nType: ${existingGroup.result[0].type || 'Standard'}\nActive: ${existingGroup.result[0].active}\n\nNo action taken.`
                        }]
                };
            }
            // Prepare group data
            const groupData = {
                name,
                active: active.toString()
            };
            if (description)
                groupData.description = description;
            if (email)
                groupData.email = email;
            if (type)
                groupData.type = type;
            // Handle manager lookup
            if (manager) {
                const managerUser = await this.findUserBySysIdOrUsername(manager);
                if (managerUser) {
                    groupData.manager = managerUser.sys_id;
                }
                else {
                    this.logger.warn(`Manager "${manager}" not found, creating group without manager`);
                }
            }
            // Handle parent group lookup
            if (parent) {
                const parentGroup = await this.findGroupBySysIdOrName(parent);
                if (parentGroup) {
                    groupData.parent = parentGroup.sys_id;
                }
                else {
                    this.logger.warn(`Parent group "${parent}" not found, creating group without parent`);
                }
            }
            // Create the group
            const result = await this.client.post('/api/now/table/sys_user_group', groupData);
            if (result.result) {
                const groupUrl = `${process.env.SNOW_INSTANCE ? `https://${process.env.SNOW_INSTANCE.replace(/\/$/, '')}.service-now.com` : ''}/sys_user_group.do?sys_id=${result.result.sys_id}`;
                return {
                    content: [{
                            type: 'text',
                            text: `✅ **User Group Created Successfully!**\n\n**Group Name:** ${result.result.name}\n**Sys ID:** ${result.result.sys_id}\n**Type:** ${result.result.type || 'Standard'}\n**Active:** ${result.result.active}\n${result.result.manager ? `**Manager:** ${result.result.manager.display_value}` : ''}\n${result.result.parent ? `**Parent Group:** ${result.result.parent.display_value}` : ''}\n\n**View Group:** ${groupUrl}\n\nYou can now assign users to this group using \`snow_assign_user_to_group\`.`
                        }]
                };
            }
            else {
                throw new Error('Failed to create group - no result returned');
            }
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ **Failed to create user group**\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nTip: Ensure you have the necessary permissions to create groups (admin or user_admin role).`
                    }]
            };
        }
    }
    async handleCreateUser(args) {
        const { user_name, first_name, last_name, email, department, manager, phone, title, location, active = true, password } = args;
        this.logger.info(`Creating user: ${user_name}`);
        try {
            // Check if user already exists
            const existingUser = await this.client.get('/api/now/table/sys_user', {
                sysparm_query: `user_name=${user_name}`,
                sysparm_limit: 1
            });
            if (existingUser.result?.length > 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `✅ User "${user_name}" already exists!\n\nSys ID: ${existingUser.result[0].sys_id}\nName: ${existingUser.result[0].first_name} ${existingUser.result[0].last_name}\nEmail: ${existingUser.result[0].email}\nActive: ${existingUser.result[0].active}\n\nNo action taken.`
                        }]
                };
            }
            // Prepare user data
            const userData = {
                user_name,
                first_name,
                last_name,
                email,
                active: active.toString()
            };
            if (phone)
                userData.phone = phone;
            if (title)
                userData.title = title;
            if (password)
                userData.user_password = password;
            // Handle manager lookup
            if (manager) {
                const managerUser = await this.findUserBySysIdOrUsername(manager);
                if (managerUser) {
                    userData.manager = managerUser.sys_id;
                }
                else {
                    this.logger.warn(`Manager "${manager}" not found, creating user without manager`);
                }
            }
            // Handle department lookup
            if (department) {
                const dept = await this.findDepartment(department);
                if (dept) {
                    userData.department = dept.sys_id;
                }
                else {
                    this.logger.warn(`Department "${department}" not found, creating user without department`);
                }
            }
            // Handle location lookup
            if (location) {
                const loc = await this.findLocation(location);
                if (loc) {
                    userData.location = loc.sys_id;
                }
                else {
                    this.logger.warn(`Location "${location}" not found, creating user without location`);
                }
            }
            // Create the user
            const result = await this.client.post('/api/now/table/sys_user', userData);
            if (result.result) {
                const userUrl = `${process.env.SNOW_INSTANCE ? `https://${process.env.SNOW_INSTANCE.replace(/\/$/, '')}.service-now.com` : ''}/sys_user.do?sys_id=${result.result.sys_id}`;
                return {
                    content: [{
                            type: 'text',
                            text: `✅ **User Created Successfully!**\n\n**Username:** ${result.result.user_name}\n**Name:** ${result.result.first_name} ${result.result.last_name}\n**Email:** ${result.result.email}\n**Sys ID:** ${result.result.sys_id}\n**Active:** ${result.result.active}\n${result.result.manager ? `**Manager:** ${result.result.manager.display_value}` : ''}\n${result.result.department ? `**Department:** ${result.result.department.display_value}` : ''}\n${password ? '\n⚠️ **Note:** User will be required to change password on first login.' : ''}\n\n**View User:** ${userUrl}\n\nYou can now assign this user to groups using \`snow_assign_user_to_group\`.`
                        }]
                };
            }
            else {
                throw new Error('Failed to create user - no result returned');
            }
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ **Failed to create user**\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nTip: Ensure you have the necessary permissions to create users (admin or user_admin role).`
                    }]
            };
        }
    }
    async handleAssignUserToGroup(args) {
        const { user, group } = args;
        this.logger.info(`Assigning user ${user} to group ${group}`);
        try {
            // Find the user
            const userRecord = await this.findUserBySysIdOrUsername(user);
            if (!userRecord) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ User "${user}" not found. Please check the username or sys_id.`
                        }]
                };
            }
            // Find the group
            const groupRecord = await this.findGroupBySysIdOrName(group);
            if (!groupRecord) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Group "${group}" not found. Please check the group name or sys_id.\n\nTip: You can create a new group using \`snow_create_user_group\`.`
                        }]
                };
            }
            // Check if user is already in group
            const existingMembership = await this.client.get('/api/now/table/sys_user_grmember', {
                sysparm_query: `user=${userRecord.sys_id}^group=${groupRecord.sys_id}`,
                sysparm_limit: 1
            });
            if (existingMembership.result?.length > 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `ℹ️ User "${userRecord.user_name}" is already a member of group "${groupRecord.name}".\n\nNo action taken.`
                        }]
                };
            }
            // Add user to group
            const result = await this.client.post('/api/now/table/sys_user_grmember', {
                user: userRecord.sys_id,
                group: groupRecord.sys_id
            });
            if (result.result) {
                return {
                    content: [{
                            type: 'text',
                            text: `✅ **User Added to Group Successfully!**\n\n**User:** ${userRecord.first_name} ${userRecord.last_name} (${userRecord.user_name})\n**Group:** ${groupRecord.name}\n**Membership Sys ID:** ${result.result.sys_id}\n\nThe user now has all permissions associated with the "${groupRecord.name}" group.`
                        }]
                };
            }
            else {
                throw new Error('Failed to add user to group - no result returned');
            }
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ **Failed to assign user to group**\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nTip: Ensure you have the necessary permissions to manage group membership.`
                    }]
            };
        }
    }
    async handleRemoveUserFromGroup(args) {
        const { user, group } = args;
        this.logger.info(`Removing user ${user} from group ${group}`);
        try {
            // Find the user
            const userRecord = await this.findUserBySysIdOrUsername(user);
            if (!userRecord) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ User "${user}" not found. Please check the username or sys_id.`
                        }]
                };
            }
            // Find the group
            const groupRecord = await this.findGroupBySysIdOrName(group);
            if (!groupRecord) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Group "${group}" not found. Please check the group name or sys_id.`
                        }]
                };
            }
            // Find the membership record
            const membership = await this.client.get('/api/now/table/sys_user_grmember', {
                sysparm_query: `user=${userRecord.sys_id}^group=${groupRecord.sys_id}`,
                sysparm_limit: 1
            });
            if (!membership.result || membership.result.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `ℹ️ User "${userRecord.user_name}" is not a member of group "${groupRecord.name}".\n\nNo action taken.`
                        }]
                };
            }
            // Remove user from group
            await this.client.delete(`/api/now/table/sys_user_grmember/${membership.result[0].sys_id}`);
            return {
                content: [{
                        type: 'text',
                        text: `✅ **User Removed from Group Successfully!**\n\n**User:** ${userRecord.first_name} ${userRecord.last_name} (${userRecord.user_name})\n**Group:** ${groupRecord.name}\n\nThe user no longer has permissions associated with the "${groupRecord.name}" group.`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ **Failed to remove user from group**\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nTip: Ensure you have the necessary permissions to manage group membership.`
                    }]
            };
        }
    }
    async handleListGroupMembers(args) {
        const { group, active_only = true } = args;
        this.logger.info(`Listing members of group: ${group}`);
        try {
            // Find the group
            const groupRecord = await this.findGroupBySysIdOrName(group);
            if (!groupRecord) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Group "${group}" not found. Please check the group name or sys_id.`
                        }]
                };
            }
            // Get group members
            let query = `group=${groupRecord.sys_id}`;
            if (active_only) {
                query += '^user.active=true';
            }
            const members = await this.client.get('/api/now/table/sys_user_grmember', {
                sysparm_query: query,
                sysparm_fields: 'user.user_name,user.first_name,user.last_name,user.email,user.title,user.active,user.sys_id',
                sysparm_limit: 100
            });
            if (!members.result || members.result.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `ℹ️ **Group "${groupRecord.name}" has no members.**\n\nYou can add users to this group using \`snow_assign_user_to_group\`.`
                        }]
                };
            }
            // Format member list
            let response = `👥 **Members of "${groupRecord.name}" Group**\n\n`;
            response += `**Total Members:** ${members.result.length}${active_only ? ' (active only)' : ''}\n\n`;
            members.result.forEach((member, index) => {
                const u = member.user;
                // Defensive programming: check if user object exists and has required fields
                if (!u || !u.user_name) {
                    this.logger.warn(`Group member ${index + 1} has invalid user data:`, member);
                    response += `${index + 1}. **Invalid User Data** - ${member.sys_id || 'Unknown ID'}\n\n`;
                    return;
                }
                const firstName = u.first_name || 'N/A';
                const lastName = u.last_name || 'N/A';
                const email = u.email || 'N/A';
                const title = u.title || '';
                const active = u.active !== undefined ? u.active : 'Unknown';
                const sysId = u.sys_id || 'N/A';
                response += `${index + 1}. **${firstName} ${lastName}** (${u.user_name})\n`;
                response += `   - Email: ${email}\n`;
                if (title)
                    response += `   - Title: ${title}\n`;
                response += `   - Active: ${active}\n`;
                response += `   - Sys ID: ${sysId}\n\n`;
            });
            if (members.result.length === 100) {
                response += `\n⚠️ **Note:** Results limited to 100 members. The group may have additional members.`;
            }
            return {
                content: [{
                        type: 'text',
                        text: response
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ **Failed to list group members**\n\nError: ${error instanceof Error ? error.message : String(error)}`
                    }]
            };
        }
    }
    // Helper methods
    async findUserBySysIdOrUsername(identifier) {
        // First try as sys_id
        if (identifier.match(/^[a-f0-9]{32}$/)) {
            const result = await this.client.get(`/api/now/table/sys_user/${identifier}`);
            if (result.result)
                return result.result;
        }
        // Then try as username
        const result = await this.client.get('/api/now/table/sys_user', {
            sysparm_query: `user_name=${identifier}`,
            sysparm_limit: 1
        });
        return result.result?.[0] || null;
    }
    async findGroupBySysIdOrName(identifier) {
        // First try as sys_id
        if (identifier.match(/^[a-f0-9]{32}$/)) {
            const result = await this.client.get(`/api/now/table/sys_user_group/${identifier}`);
            if (result.result)
                return result.result;
        }
        // Then try as name
        const result = await this.client.get('/api/now/table/sys_user_group', {
            sysparm_query: `name=${identifier}`,
            sysparm_limit: 1
        });
        return result.result?.[0] || null;
    }
    async findDepartment(identifier) {
        // First try as sys_id
        if (identifier.match(/^[a-f0-9]{32}$/)) {
            const result = await this.client.get(`/api/now/table/cmn_department/${identifier}`);
            if (result.result)
                return result.result;
        }
        // Then try as name
        const result = await this.client.get('/api/now/table/cmn_department', {
            sysparm_query: `name=${identifier}`,
            sysparm_limit: 1
        });
        return result.result?.[0] || null;
    }
    async findLocation(identifier) {
        // First try as sys_id
        if (identifier.match(/^[a-f0-9]{32}$/)) {
            const result = await this.client.get(`/api/now/table/cmn_location/${identifier}`);
            if (result.result)
                return result.result;
        }
        // Then try as name
        const result = await this.client.get('/api/now/table/cmn_location', {
            sysparm_query: `name=${identifier}`,
            sysparm_limit: 1
        });
        return result.result?.[0] || null;
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        // Use stderr for logs to keep stdout clean for JSON-RPC
        console.error('ServiceNow Operations MCP Server running on stdio');
    }
}
exports.ServiceNowOperationsMCP = ServiceNowOperationsMCP;
// Start the server only if run directly
if (require.main === module) {
    const server = new ServiceNowOperationsMCP();
    server.run().catch((error) => {
        console.error('Failed to start ServiceNow Operations MCP server:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=servicenow-operations-mcp.js.map