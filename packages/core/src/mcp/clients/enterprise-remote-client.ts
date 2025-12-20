/**
 * Remote MCP client for Snow-Flow Enterprise
 * Connects to enterprise.snow-flow.dev MCP server via SSE
 */

import { EventSource } from 'eventsource';
import { getEnterpriseToken, ENTERPRISE_MCP_SERVER_URL } from '../../cli/enterprise.js';
import { createHash } from 'crypto';
import { networkInterfaces, hostname } from 'os';

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface MCPToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Generate a unique machine identifier for seat tracking
 * Based on hostname and MAC addresses
 */
function generateMachineId(): string {
  try {
    const interfaces = networkInterfaces();
    const macAddresses: string[] = [];

    // Collect MAC addresses from all network interfaces
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const config of iface) {
          if (config.mac && config.mac !== '00:00:00:00:00:00') {
            macAddresses.push(config.mac);
          }
        }
      }
    }

    // Sort for consistency
    macAddresses.sort();

    // Combine hostname and MAC addresses
    const identifier = `${hostname()}-${macAddresses.join('-')}`;

    // Create hash for privacy (don't send actual MAC addresses)
    const hash = createHash('sha256').update(identifier).digest('hex');

    return hash.substring(0, 32);
  } catch (err) {
    // Fallback to random ID if machine ID generation fails
    return createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').substring(0, 32);
  }
}

/**
 * Enterprise MCP Client
 * Connects to remote enterprise MCP server for advanced features
 */
export class EnterpriseRemoteClient {
  private sseUrl: string;
  private eventSource: EventSource | null = null;
  private tools: MCPTool[] = [];
  private connected: boolean = false;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private machineId: string;
  private role: 'developer' | 'stakeholder' | 'admin';

  constructor(role: 'developer' | 'stakeholder' | 'admin' = 'developer') {
    this.sseUrl = `${ENTERPRISE_MCP_SERVER_URL}/mcp/sse`;
    this.machineId = generateMachineId();
    this.role = role; // MCP proxy users are always developers by default
  }

  /**
   * Connect to enterprise MCP server
   */
  async connect(): Promise<void> {
    const token = await getEnterpriseToken();

    if (!token) {
      throw new Error('Not authenticated with Snow-Flow Enterprise. Run: snow-flow login <license-key>');
    }

    return new Promise((resolve, reject) => {
      try {
        // eventsource package (Node.js) supports headers, browser EventSource does not
        // Cast to any to bypass TypeScript's browser EventSourceInit type
        this.eventSource = new EventSource(this.sseUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Snow-Flow-Role': this.role,
            'X-Snow-Flow-User-Id': this.machineId
          }
        } as any);

        this.eventSource.onopen = () => {
          this.connected = true;
          console.log('🌟 Connected to Snow-Flow Enterprise MCP server');
          resolve();
        };

        this.eventSource.onerror = (error) => {
          this.connected = false;
          console.error('❌ Enterprise MCP connection error:', error);
          reject(new Error('Failed to connect to enterprise MCP server'));
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error('Failed to parse MCP message:', err);
          }
        };

        // Request tools list after connection
        setTimeout(async () => {
          await this.listTools();
          resolve();
        }, 1000);

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle incoming SSE messages
   */
  private handleMessage(data: any): void {
    const messageId = data.id;

    if (messageId && this.messageHandlers.has(messageId)) {
      const handler = this.messageHandlers.get(messageId);
      if (handler) {
        handler(data);
        this.messageHandlers.delete(messageId);
      }
    }

    // Handle specific message types
    if (data.method === 'tools/list' && data.result) {
      this.tools = data.result.tools || [];
      console.log(`📋 Loaded ${this.tools.length} enterprise tools`);
    }
  }

  /**
   * Send request to MCP server and wait for response
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.connected || !this.eventSource) {
      throw new Error('Not connected to enterprise MCP server');
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      // Set up response handler
      this.messageHandlers.set(messageId, (data) => {
        if (data.error) {
          reject(new Error(data.error.message || 'Enterprise MCP error'));
        } else {
          resolve(data.result);
        }
      });

      // Send request via POST endpoint
      getEnterpriseToken().then(token => {
        fetch(`${ENTERPRISE_MCP_SERVER_URL}/mcp/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Snow-Flow-Role': this.role,
            'X-Snow-Flow-User-Id': this.machineId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: messageId,
            method,
            params
          })
        }).catch((err) => {
          this.messageHandlers.delete(messageId);
          reject(err);
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * List available enterprise tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (this.tools.length > 0) {
      return this.tools;
    }

    const result = await this.sendRequest('tools/list');
    this.tools = result.tools || [];
    return this.tools;
  }

  /**
   * Call an enterprise tool
   */
  async callTool(toolName: string, args: any): Promise<MCPToolCallResult> {
    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    return result;
  }

  /**
   * Check if tool is available
   */
  async hasTool(toolName: string): Promise<boolean> {
    const tools = await this.listTools();
    return tools.some(tool => tool.name === toolName);
  }

  /**
   * Get all tools by category
   */
  async getToolsByCategory(category: 'jira' | 'azure-devops' | 'confluence'): Promise<MCPTool[]> {
    const tools = await this.listTools();
    return tools.filter(tool => tool.name.startsWith(category.replace('-', '_')));
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connected = false;
      console.log('🔌 Disconnected from Enterprise MCP server');
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get available tools list (cached)
   */
  getTools(): MCPTool[] {
    return this.tools;
  }
}

/**
 * Singleton instance
 */
let enterpriseClientInstance: EnterpriseRemoteClient | null = null;

/**
 * Get or create enterprise client instance
 */
export async function getEnterpriseClient(): Promise<EnterpriseRemoteClient> {
  if (!enterpriseClientInstance) {
    enterpriseClientInstance = new EnterpriseRemoteClient();
    await enterpriseClientInstance.connect();
  }

  if (!enterpriseClientInstance.isConnected()) {
    await enterpriseClientInstance.connect();
  }

  return enterpriseClientInstance;
}

/**
 * Check if enterprise tools are available
 */
export async function hasEnterpriseTools(): Promise<boolean> {
  try {
    const token = await getEnterpriseToken();
    return token !== null;
  } catch (err) {
    return false;
  }
}
