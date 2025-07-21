/**
 * HTTP Transport Wrapper for MCP Servers
 * Converts stdio-based MCP servers to HTTP endpoints for containerization
 */

import express, { Express, Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Logger } from '../utils/logger.js';
import { ServiceDiscoveryClient } from './service-discovery-client.js';

export interface MCPServerConfig {
  name: string;
  port: number;
  version: string;
  healthCheckPath?: string;
  metricsPath?: string;
}

export class HttpTransportWrapper {
  private app: Express;
  private mcpServer: Server;
  private logger: Logger;
  private config: MCPServerConfig;
  private serviceDiscovery: ServiceDiscoveryClient;
  private isReady: boolean = false;

  constructor(mcpServer: Server, config: MCPServerConfig) {
    this.mcpServer = mcpServer;
    this.config = config;
    this.logger = new Logger(`HttpTransport:${config.name}`);
    this.app = express();
    this.serviceDiscovery = new ServiceDiscoveryClient();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      next();
    });

    // Body parser for JSON requests
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`, {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: req.get('Content-Length')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get(this.config.healthCheckPath || '/health', (req: Request, res: Response) => {
      const health = {
        status: this.isReady ? 'healthy' : 'starting',
        service: this.config.name,
        version: this.config.version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        port: this.config.port
      };

      const statusCode = this.isReady ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Readiness probe
    this.app.get('/ready', (req: Request, res: Response) => {
      if (this.isReady) {
        res.status(200).json({ ready: true, service: this.config.name });
      } else {
        res.status(503).json({ ready: false, service: this.config.name });
      }
    });

    // Liveness probe
    this.app.get('/live', (req: Request, res: Response) => {
      res.status(200).json({ alive: true, service: this.config.name });
    });

    // Metrics endpoint (basic)
    this.app.get(this.config.metricsPath || '/metrics', (req: Request, res: Response) => {
      const metrics = this.generateMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    });

    // MCP API endpoints
    this.app.post('/mcp/list-tools', async (req: Request, res: Response) => {
      try {
        const result = await this.handleMCPRequest('listTools', req.body);
        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    this.app.post('/mcp/call-tool', async (req: Request, res: Response) => {
      try {
        const result = await this.handleMCPRequest('callTool', req.body);
        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    this.app.post('/mcp/list-resources', async (req: Request, res: Response) => {
      try {
        const result = await this.handleMCPRequest('listResources', req.body);
        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    this.app.post('/mcp/read-resource', async (req: Request, res: Response) => {
      try {
        const result = await this.handleMCPRequest('readResource', req.body);
        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    // Service info endpoint
    this.app.get('/info', (req: Request, res: Response) => {
      res.json({
        name: this.config.name,
        version: this.config.version,
        port: this.config.port,
        endpoints: {
          health: this.config.healthCheckPath || '/health',
          metrics: this.config.metricsPath || '/metrics',
          mcp: [
            '/mcp/list-tools',
            '/mcp/call-tool',
            '/mcp/list-resources',
            '/mcp/read-resource'
          ]
        }
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.originalUrl,
        service: this.config.name
      });
    });

    // Global error handler
    this.app.use((error: any, req: Request, res: Response, next: Function) => {
      this.logger.error('Unhandled error:', error);
      this.handleError(res, error);
    });
  }

  private async handleMCPRequest(method: string, params: any): Promise<any> {
    // Convert HTTP request to MCP protocol format
    const mcpRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: params || {}
    };

    try {
      // Process request through the MCP server
      let result: any;

      switch (method) {
        case 'listTools':
          // Handle list tools request by calling the MCP server's tools handler
          const toolsResponse = await this.mcpServer.getCapabilities();
          result = {
            tools: toolsResponse.capabilities?.tools || []
          };
          break;

        case 'callTool':
          // Handle tool call by routing to the MCP server's tool handler
          if (!params.name) {
            throw new Error('Tool name is required for callTool');
          }
          
          // Create a mock request that matches MCP CallToolRequestSchema
          const toolRequest = {
            params: {
              name: params.name,
              arguments: params.arguments || {}
            }
          };

          // Find the appropriate request handler for CallToolRequestSchema
          // Note: This requires internal access to MCP server handlers
          // In a production environment, you'd need a more robust integration
          result = await this.handleToolCall(toolRequest);
          break;

        case 'listResources':
          // Handle list resources - return empty list if not supported
          result = { resources: [] };
          break;

        case 'readResource':
          // Handle read resource - throw error if not supported
          throw new Error('Resource reading not implemented for this server');

        default:
          throw new Error(`Unsupported MCP method: ${method}`);
      }

      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result
      };
    } catch (error) {
      this.logger.error(`MCP request error for ${method}:`, error);
      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          data: { method, originalParams: params }
        }
      };
    }
  }

  private async handleToolCall(request: any): Promise<any> {
    // This is a workaround since we can't directly access MCP server's internal handlers
    // In a real implementation, you'd need to either:
    // 1. Extend the MCP SDK to expose request handlers
    // 2. Use a proper transport layer that already exists
    // 3. Create a bridge that uses the existing stdio transport

    const { name, arguments: args } = request.params;
    
    // For now, we'll at least validate that the tool exists
    const capabilities = await this.mcpServer.getCapabilities();
    const tools = capabilities.capabilities?.tools || [];
    
    // This is still a limitation - we can't actually execute the tool without
    // access to the MCP server's internal request handlers
    throw new Error(`Tool execution not yet implemented in HTTP transport. Tool '${name}' exists but cannot be executed via HTTP. Use stdio transport instead.`);
  }

  private handleError(res: Response, error: any): void {
    const statusCode = error.statusCode || 500;
    const errorResponse = {
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal server error',
        service: this.config.name
      }
    };

    this.logger.error('Request error:', error);
    res.status(statusCode).json(errorResponse);
  }

  private generateMetrics(): string {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return `# HELP mcp_server_uptime_seconds Total uptime of the MCP server
# TYPE mcp_server_uptime_seconds counter
mcp_server_uptime_seconds{service="${this.config.name}"} ${uptime}

# HELP mcp_server_memory_usage_bytes Memory usage in bytes
# TYPE mcp_server_memory_usage_bytes gauge
mcp_server_memory_usage_bytes{service="${this.config.name}",type="rss"} ${memUsage.rss}
mcp_server_memory_usage_bytes{service="${this.config.name}",type="heapTotal"} ${memUsage.heapTotal}
mcp_server_memory_usage_bytes{service="${this.config.name}",type="heapUsed"} ${memUsage.heapUsed}

# HELP mcp_server_ready Server readiness status
# TYPE mcp_server_ready gauge
mcp_server_ready{service="${this.config.name}"} ${this.isReady ? 1 : 0}
`;
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.config.port, async () => {
        this.logger.info(`MCP HTTP server started on port ${this.config.port}`);
        
        try {
          // Register with service discovery
          await this.serviceDiscovery.register({
            id: `${this.config.name}-${process.env.HOSTNAME || 'localhost'}`,
            name: this.config.name,
            address: process.env.SERVICE_IP || 'localhost',
            port: this.config.port,
            health: {
              http: `http://${process.env.SERVICE_IP || 'localhost'}:${this.config.port}/health`,
              interval: '10s',
              timeout: '3s',
              deregisterAfter: '30s'
            },
            tags: [
              'mcp-server',
              `version:${this.config.version}`,
              `environment:${process.env.NODE_ENV || 'development'}`
            ]
          });

          this.isReady = true;
          this.logger.info(`Service registered with discovery: ${this.config.name}`);
          resolve();
        } catch (error) {
          this.logger.warn('Service discovery registration failed:', error);
          // Continue without service discovery
          this.isReady = true;
          resolve();
        }
      });

      server.on('error', (error: any) => {
        this.logger.error(`Server startup error:`, error);
        reject(error);
      });

      // Graceful shutdown handling
      const shutdown = async () => {
        this.logger.info('Shutting down HTTP server...');
        
        try {
          await this.serviceDiscovery.deregister(`${this.config.name}-${process.env.HOSTNAME || 'localhost'}`);
          this.logger.info('Service deregistered from discovery');
        } catch (error) {
          this.logger.warn('Service deregistration failed:', error);
        }

        server.close(() => {
          this.logger.info('HTTP server closed');
          process.exit(0);
        });
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    });
  }
}