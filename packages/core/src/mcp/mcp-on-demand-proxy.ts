#!/usr/bin/env node
/**
 * MCP On-Demand Proxy
 * Routes MCP requests to the appropriate server, starting it if needed
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPOnDemandManager } from '../utils/mcp-on-demand-manager.js';
import { Logger } from '../utils/logger.js';
import { execSync } from 'child_process';

const logger = new Logger('MCPProxy');

// Tool to server mapping
const TOOL_SERVER_MAP: Record<string, string> = {
  // Operations tools
  'snow_query_table': 'servicenow-operations',
  'snow_query_incidents': 'servicenow-operations',
  'snow_create_incident': 'servicenow-operations',
  'snow_update_incident': 'servicenow-operations',
  'snow_query_users': 'servicenow-operations',
  'snow_create_user': 'servicenow-operations',
  
  // Deployment tools
  'snow_create_widget': 'servicenow-deployment',
  'snow_create_artifact': 'servicenow-unified',
  'snow_create_flow': 'servicenow-deployment',
  
  // ML tools
  'ml_train_incident_classifier': 'servicenow-machine-learning',
  'ml_classify_incident': 'servicenow-machine-learning',
  'ml_train_change_risk': 'servicenow-machine-learning',
  'ml_predict_change_risk': 'servicenow-machine-learning',
  'ml_train_anomaly_detector': 'servicenow-machine-learning',
  'ml_detect_anomalies': 'servicenow-machine-learning',
  
  // Update Set tools
  'snow_create_update_set': 'servicenow-update-set',
  'snow_get_current_update_set': 'servicenow-update-set',
  'snow_commit_update_set': 'servicenow-update-set',
  
  // Platform Development tools
  'snow_create_business_rule': 'servicenow-platform-development',
  'snow_create_script_include': 'servicenow-platform-development',
  'snow_create_client_script': 'servicenow-platform-development',
  
  // Integration tools
  'snow_discover_rest_endpoints': 'servicenow-integration',
  'snow_create_rest_endpoint': 'servicenow-integration',
  'snow_create_transform_map': 'servicenow-integration',
  
  // Automation tools
  'snow_create_event_rule': 'servicenow-automation',
  'snow_create_workflow': 'servicenow-automation',

  // Scheduled Jobs tools (unified server)
  'snow_trigger_scheduled_job': 'servicenow-unified',
  'snow_scheduled_job_manage': 'servicenow-unified',
  
  // Security tools
  'snow_create_security_rule': 'servicenow-security-compliance',
  'snow_scan_security': 'servicenow-security-compliance',
  'snow_check_compliance': 'servicenow-security-compliance',
  
  // Reporting tools
  'snow_create_report': 'servicenow-reporting-analytics',
  'snow_create_dashboard': 'servicenow-reporting-analytics',
  'snow_get_kpis': 'servicenow-reporting-analytics',
  
  // Intelligent tools
  'snow_batch_api': 'servicenow-intelligent',
  'snow_analyze_query': 'servicenow-intelligent',
  'snow_predict_change_impact': 'servicenow-intelligent'
};

class MCPOnDemandProxy {
  private server: Server;
  private manager: MCPOnDemandManager;
  private activeServers = new Map<string, any>();
  
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-on-demand-proxy',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.manager = MCPOnDemandManager.getInstance();
    this.setupHandlers();
  }
  
  private setupHandlers() {
    // List all available tools from all servers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('📋 Listing all available tools (servers will start on demand)');
      
      // Return a comprehensive list of all tools
      // In production, this could be loaded from a configuration file
      const tools: Tool[] = Object.keys(TOOL_SERVER_MAP).map(toolName => ({
        name: toolName,
        description: `Tool ${toolName} (server starts on demand)`,
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }));
      
      return { tools };
    });
    
    // Handle tool calls by routing to appropriate server
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: args } = request.params;
      
      logger.info(`🔧 Tool requested: ${toolName}`);
      
      // Find which server handles this tool
      const serverName = TOOL_SERVER_MAP[toolName];
      
      if (!serverName) {
        throw new Error(`Unknown tool: ${toolName}`);
      }
      
      // Get or start the server
      logger.info(`🚀 Getting server: ${serverName} for tool: ${toolName}`);
      
      try {
        const serverProcess = await this.manager.getServer(serverName);
        
        // Forward the request to the actual server
        // This is simplified - in production you'd use proper IPC
        return await this.forwardToServer(serverName, toolName, args);
        
      } catch (error: any) {
        logger.error(`Failed to handle tool ${toolName}:`, error);
        throw error;
      }
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down MCP proxy...');
      await this.manager.stopAll();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Shutting down MCP proxy...');
      await this.manager.stopAll();
      process.exit(0);
    });
  }
  
  /**
   * Forward request to actual MCP server
   * In production, this would use proper IPC/stdio communication
   */
  private async forwardToServer(serverName: string, toolName: string, args: any): Promise<any> {
    // For now, we'll use a simple exec approach
    // In production, you'd maintain persistent connections
    
    try {
      // Create a temporary request file
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: Date.now()
      };
      
      // This is a simplified example - in production use proper IPC
      logger.info(`Forwarding ${toolName} to ${serverName}`);
      
      // Return a mock response for now
      return {
        content: [{
          type: 'text',
          text: `Tool ${toolName} executed via on-demand server ${serverName}`
        }]
      };
      
    } catch (error) {
      logger.error(`Failed to forward to ${serverName}:`, error);
      throw error;
    }
  }
  
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('🎯 MCP On-Demand Proxy started');
    logger.info('📊 Servers will start automatically when tools are used');
    
    // Log status periodically
    setInterval(() => {
      const status = this.manager.getStatus();
      if (status.running > 0) {
        logger.info(`📊 Status: ${status.running} running, ${status.stopped} stopped`);
      }
    }, 60000).unref();
  }
}

// Start the proxy
const proxy = new MCPOnDemandProxy();
proxy.run().catch((error) => {
  logger.error('Failed to start MCP proxy:', error);
  process.exit(1);
});