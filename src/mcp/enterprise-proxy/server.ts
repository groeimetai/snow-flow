#!/usr/bin/env node
/**
 * Snow-Flow Enterprise MCP Proxy
 *
 * Forwards MCP tool requests from Claude Code to the Enterprise License Server.
 * This allows the open source Snow-Flow to use enterprise-hosted tools.
 *
 * Architecture:
 * Claude Code → stdio → This Proxy → HTTPS → License Server → External APIs
 *
 * Usage:
 * node server.js
 *
 * Environment Variables:
 * - SNOW_ENTERPRISE_URL: License server URL (required)
 * - SNOW_LICENSE_KEY: Your license key (required)
 * - SNOW_INSTANCE_URL: ServiceNow instance URL
 * - SNOW_USERNAME: ServiceNow username
 * - SNOW_PASSWORD: ServiceNow password
 * - JIRA_BASE_URL: Jira Cloud base URL
 * - JIRA_EMAIL: Jira email
 * - JIRA_API_TOKEN: Jira API token
 * - AZDO_ORG_URL: Azure DevOps org URL
 * - AZDO_PAT: Azure DevOps PAT
 * - CONFLUENCE_BASE_URL: Confluence base URL
 * - CONFLUENCE_EMAIL: Confluence email
 * - CONFLUENCE_API_TOKEN: Confluence API token
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

// Configuration from environment variables
const LICENSE_SERVER_URL = process.env.SNOW_ENTERPRISE_URL || '';
const LICENSE_KEY = process.env.SNOW_LICENSE_KEY || '';

// ServiceNow credentials
const SNOW_INSTANCE_URL = process.env.SNOW_INSTANCE_URL || '';
const SNOW_USERNAME = process.env.SNOW_USERNAME || '';
const SNOW_PASSWORD = process.env.SNOW_PASSWORD || '';

// Jira credentials (optional)
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';

// Azure DevOps credentials (optional)
const AZDO_ORG_URL = process.env.AZDO_ORG_URL || '';
const AZDO_PAT = process.env.AZDO_PAT || '';

// Confluence credentials (optional)
const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL || '';
const CONFLUENCE_EMAIL = process.env.CONFLUENCE_EMAIL || '';
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || '';

class EnterpriseProxyServer {
  private server: Server;
  private httpClient: AxiosInstance;
  private availableTools: Tool[] = [];

  constructor() {
    // Validate required configuration
    if (!LICENSE_SERVER_URL) {
      throw new Error('SNOW_ENTERPRISE_URL environment variable is required');
    }
    if (!LICENSE_KEY) {
      throw new Error('SNOW_LICENSE_KEY environment variable is required');
    }

    // Create MCP server
    this.server = new Server(
      {
        name: 'snow-flow-enterprise-proxy',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Create HTTP client for license server
    this.httpClient = axios.create({
      baseURL: LICENSE_SERVER_URL,
      headers: {
        'Authorization': `Bearer ${LICENSE_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutes
    });

    this.setupHandlers();
    this.logConfiguration();
  }

  private logConfiguration() {
    console.error('═══════════════════════════════════════════════════');
    console.error('Snow-Flow Enterprise MCP Proxy');
    console.error('═══════════════════════════════════════════════════');
    console.error(`License Server: ${LICENSE_SERVER_URL}`);
    console.error(`License Key: ${LICENSE_KEY.substring(0, 20)}...`);
    console.error('');
    console.error('Configured Services:');
    console.error(`  ServiceNow: ${SNOW_INSTANCE_URL ? '✓' : '✗'}`);
    console.error(`  Jira: ${JIRA_BASE_URL ? '✓' : '✗'}`);
    console.error(`  Azure DevOps: ${AZDO_ORG_URL ? '✓' : '✗'}`);
    console.error(`  Confluence: ${CONFLUENCE_BASE_URL ? '✓' : '✗'}`);
    console.error('═══════════════════════════════════════════════════');
    console.error('');
  }

  private buildCredentials() {
    var credentials: any = {};

    // ServiceNow credentials
    if (SNOW_INSTANCE_URL && SNOW_USERNAME && SNOW_PASSWORD) {
      credentials.servicenow = {
        instanceUrl: SNOW_INSTANCE_URL,
        username: SNOW_USERNAME,
        password: SNOW_PASSWORD
      };
    }

    // Jira credentials
    if (JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN) {
      credentials.jira = {
        baseUrl: JIRA_BASE_URL,
        email: JIRA_EMAIL,
        apiToken: JIRA_API_TOKEN
      };
    }

    // Azure DevOps credentials
    if (AZDO_ORG_URL && AZDO_PAT) {
      credentials.azdo = {
        orgUrl: AZDO_ORG_URL,
        pat: AZDO_PAT
      };
    }

    // Confluence credentials
    if (CONFLUENCE_BASE_URL && CONFLUENCE_EMAIL && CONFLUENCE_API_TOKEN) {
      credentials.confluence = {
        baseUrl: CONFLUENCE_BASE_URL,
        email: CONFLUENCE_EMAIL,
        apiToken: CONFLUENCE_API_TOKEN
      };
    }

    return credentials;
  }

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        console.error('[Proxy] Fetching available tools from license server...');

        var response = await this.httpClient.get('/mcp/tools/list');
        this.availableTools = response.data.tools || [];

        console.error(`[Proxy] ✓ ${this.availableTools.length} tools available`);

        return {
          tools: this.availableTools
        };
      } catch (error: any) {
        console.error('[Proxy] ✗ Failed to fetch tools:', error.message);

        if (error.response) {
          console.error('[Proxy] Response status:', error.response.status);
          console.error('[Proxy] Response data:', error.response.data);
        }

        throw new Error('Failed to connect to license server: ' + error.message);
      }
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      var toolName = request.params.name;
      var toolArgs = request.params.arguments || {};

      try {
        console.error(`[Proxy] Executing tool: ${toolName}`);

        // Build credentials
        var credentials = this.buildCredentials();

        // Call enterprise server
        var startTime = Date.now();
        var response = await this.httpClient.post('/mcp/tools/call', {
          tool: toolName,
          arguments: toolArgs,
          credentials: credentials
        });
        var duration = Date.now() - startTime;

        if (!response.data.success) {
          throw new Error(response.data.error || 'Tool execution failed');
        }

        console.error(`[Proxy] ✓ Tool executed successfully (${duration}ms)`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data.result, null, 2)
            }
          ]
        };
      } catch (error: any) {
        console.error(`[Proxy] ✗ Tool execution failed: ${error.message}`);

        if (error.response) {
          console.error('[Proxy] Response status:', error.response.status);
          console.error('[Proxy] Response data:', JSON.stringify(error.response.data, null, 2));
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                tool: toolName,
                details: error.response?.data || null
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });
  }

  async run() {
    var transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Proxy] ✓ Enterprise MCP Proxy running on stdio');
    console.error('[Proxy] Ready to receive requests from Claude Code');
  }
}

// Start server
try {
  var proxy = new EnterpriseProxyServer();
  proxy.run().catch(function(error) {
    console.error('[Proxy] Fatal error:', error);
    process.exit(1);
  });
} catch (error: any) {
  console.error('[Proxy] Failed to start:', error.message);
  process.exit(1);
}
