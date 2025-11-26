/**
 * MCP On-Demand Manager
 * Starts MCP servers only when needed and stops them after inactivity
 */

import { spawn, ChildProcess } from 'child_process';
import { Logger } from './logger.js';
import { MCPProcessManager } from './mcp-process-manager.js';
import { unifiedAuthStore } from './unified-auth-store.js';
import { timerRegistry } from './timer-registry.js';
import path from 'path';
import fs from 'fs';

const logger = new Logger('MCPOnDemand');

interface MCPServerInstance {
  name: string;
  process?: ChildProcess;
  lastUsed: number;
  startTime?: number;
  useCount: number;
  status: 'stopped' | 'starting' | 'running' | 'stopping';
}

export class MCPOnDemandManager {
  private static instance: MCPOnDemandManager;
  private servers = new Map<string, MCPServerInstance>();
  private inactivityTimeout = parseInt(process.env.SNOW_MCP_INACTIVITY_TIMEOUT || '300000'); // 5 minutes default
  private cleanupInterval?: NodeJS.Timeout;
  
  private constructor() {
    this.startInactivityMonitor();
  }
  
  static getInstance(): MCPOnDemandManager {
    if (!MCPOnDemandManager.instance) {
      MCPOnDemandManager.instance = new MCPOnDemandManager();
    }
    return MCPOnDemandManager.instance;
  }
  
  /**
   * Get or start an MCP server on demand
   */
  async getServer(serverName: string): Promise<ChildProcess> {
    let server = this.servers.get(serverName);
    
    if (!server) {
      server = {
        name: serverName,
        lastUsed: Date.now(),
        useCount: 0,
        status: 'stopped'
      };
      this.servers.set(serverName, server);
    }
    
    // Update last used time
    server.lastUsed = Date.now();
    server.useCount++;
    
    // If server is running, return it
    if (server.status === 'running' && server.process) {
      logger.debug(`✅ Reusing existing ${serverName} (used ${server.useCount} times)`);
      return server.process;
    }
    
    // If server is starting, wait for it
    if (server.status === 'starting') {
      logger.debug(`⏳ Waiting for ${serverName} to start...`);
      return this.waitForServer(serverName);
    }
    
    // Start the server
    return this.startServer(serverName);
  }
  
  /**
   * Start an MCP server
   */
  private async startServer(serverName: string): Promise<ChildProcess> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }
    
    // Check resource limits
    const processManager = MCPProcessManager.getInstance();
    if (!processManager.canSpawnServer()) {
      // Try to free up resources by stopping least recently used servers
      await this.stopLeastRecentlyUsed();
      
      if (!processManager.canSpawnServer()) {
        throw new Error('Cannot start server: resource limits exceeded');
      }
    }
    
    server.status = 'starting';
    logger.info(`🚀 Starting ${serverName} on demand...`);
    
    try {
      // Get the script path
      const scriptPath = this.getScriptPath(serverName);
      
      // Get auth tokens
      await unifiedAuthStore.bridgeToMCP();
      const tokens = await unifiedAuthStore.getTokens();
      const authEnv: Record<string, string> = {};
      
      if (tokens) {
        authEnv.SNOW_OAUTH_TOKENS = JSON.stringify(tokens);
        authEnv.SNOW_INSTANCE = tokens.instance;
        authEnv.SNOW_CLIENT_ID = tokens.clientId;
        authEnv.SNOW_CLIENT_SECRET = tokens.clientSecret;
        
        if (tokens.accessToken) {
          authEnv.SNOW_ACCESS_TOKEN = tokens.accessToken;
        }
        if (tokens.refreshToken) {
          authEnv.SNOW_REFRESH_TOKEN = tokens.refreshToken;
        }
      }
      
      // Start the process
      const childProcess = spawn('node', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...authEnv,
          SNOW_MCP_ON_DEMAND: 'true' // Flag to indicate on-demand mode
        }
      });
      
      // Handle process events
      childProcess.on('error', (error) => {
        logger.error(`${serverName} error:`, error);
        server.status = 'stopped';
      });
      
      childProcess.on('exit', (code) => {
        logger.info(`${serverName} exited with code ${code}`);
        server.status = 'stopped';
        server.process = undefined;
      });
      
      // Log output for debugging
      childProcess.stdout?.on('data', (data) => {
        logger.debug(`${serverName} stdout:`, data.toString());
      });
      
      childProcess.stderr?.on('data', (data) => {
        logger.debug(`${serverName} stderr:`, data.toString());
      });
      
      server.process = childProcess;
      server.status = 'running';
      server.startTime = Date.now();
      
      logger.info(`✅ ${serverName} started (PID: ${childProcess.pid})`);
      
      return childProcess;
      
    } catch (error) {
      server.status = 'stopped';
      throw error;
    }
  }
  
  /**
   * Wait for a server to finish starting
   */
  private async waitForServer(serverName: string, timeout = 30000): Promise<ChildProcess> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const server = this.servers.get(serverName);
      
      if (server?.status === 'running' && server.process) {
        return server.process;
      }
      
      if (server?.status === 'stopped') {
        throw new Error(`Server ${serverName} failed to start`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout waiting for ${serverName} to start`);
  }
  
  /**
   * Stop a specific server
   */
  async stopServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);

    if (!server || !server.process) {
      return;
    }

    server.status = 'stopping';
    logger.info(`🛑 Stopping ${serverName} (was used ${server.useCount} times)`);

    try {
      // MEMORY FIX: Remove all event listeners to prevent memory leak
      if (server.process) {
        server.process.removeAllListeners('error');
        server.process.removeAllListeners('exit');
        server.process.stdout?.removeAllListeners('data');
        server.process.stderr?.removeAllListeners('data');
      }

      server.process.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (server.process) {
            server.process.kill('SIGKILL');
          }
          resolve(undefined);
        }, 5000);

        server.process?.once('exit', () => {
          clearTimeout(timeout);
          resolve(undefined);
        });
      });

    } catch (error) {
      logger.error(`Error stopping ${serverName}:`, error);
    }

    server.status = 'stopped';
    server.process = undefined;
    server.startTime = undefined;

    // MEMORY FIX: Remove stopped server from registry immediately
    // Server will be re-added to registry when started again via getServer()
    this.servers.delete(serverName);
    logger.debug(`Removed stopped server ${serverName} from registry`);
  }
  
  /**
   * Stop least recently used servers to free resources
   */
  private async stopLeastRecentlyUsed(): Promise<void> {
    const runningServers = Array.from(this.servers.values())
      .filter(s => s.status === 'running')
      .sort((a, b) => a.lastUsed - b.lastUsed);
    
    if (runningServers.length > 0) {
      const oldest = runningServers[0];
      logger.info(`📦 Stopping least recently used server: ${oldest.name}`);
      await this.stopServer(oldest.name);
    }
  }
  
  /**
   * Stop all inactive servers
   */
  private async stopInactiveServers(): Promise<void> {
    const now = Date.now();
    const promises: Promise<void>[] = [];
    
    for (const [name, server] of this.servers) {
      if (server.status === 'running' && 
          now - server.lastUsed > this.inactivityTimeout) {
        
        const inactiveMinutes = Math.round((now - server.lastUsed) / 60000);
        logger.info(`⏰ Stopping ${name} due to inactivity (${inactiveMinutes} minutes)`);
        promises.push(this.stopServer(name));
      }
    }
    
    await Promise.all(promises);
  }
  
  /**
   * Start monitoring for inactive servers
   */
  private startInactivityMonitor(): void {
    // Use timerRegistry for proper cleanup
    timerRegistry.registerInterval(
      'mcp-on-demand-inactivity',
      () => {
        this.stopInactiveServers().catch(error => {
          logger.error('Error during inactivity cleanup:', error);
        });
      },
      60000,
      true // unref - don't block process exit
    );
  }

  /**
   * Stop the inactivity monitor
   */
  stopInactivityMonitor(): void {
    timerRegistry.clearInterval('mcp-on-demand-inactivity');
    // Keep backward compatibility
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  /**
   * Get the script path for a server
   */
  private getScriptPath(serverName: string): string {
    // Map server names to script files
    const serverMap: Record<string, string> = {
      'servicenow-operations': 'servicenow-operations-mcp.js',
      'servicenow-deployment': 'servicenow-deployment-mcp.js',
      'servicenow-machine-learning': 'servicenow-machine-learning-mcp.js',
      'servicenow-update-set': 'servicenow-update-set-mcp.js',
      'servicenow-platform-development': 'servicenow-platform-development-mcp.js',
      'servicenow-integration': 'servicenow-integration-mcp.js',
      'servicenow-automation': 'servicenow-automation-mcp.js',
      'servicenow-security-compliance': 'servicenow-security-compliance-mcp.js',
      'servicenow-reporting-analytics': 'servicenow-reporting-analytics-mcp.js',
      'servicenow-flow-composer': 'servicenow-flow-composer-mcp.js',
      'servicenow-intelligent': 'servicenow-intelligent-mcp.js',
      'servicenow-development-assistant': 'servicenow-development-assistant-mcp.js',
      'servicenow-graph-memory': 'servicenow-graph-memory-mcp.js',
      'snow-flow': 'snow-flow-mcp.js'
    };
    
    const scriptFile = serverMap[serverName];
    if (!scriptFile) {
      throw new Error(`Unknown server: ${serverName}`);
    }
    
    // Check different possible locations
    const possiblePaths = [
      path.join(__dirname, '..', 'mcp', scriptFile),
      path.join(process.cwd(), 'dist', 'mcp', scriptFile),
      path.join('/Users/nielsvanderwerf/.nvm/versions/node/v20.15.0/lib/node_modules/snow-flow/dist/mcp', scriptFile)
    ];
    
    for (const scriptPath of possiblePaths) {
      if (fs.existsSync(scriptPath)) {
        return scriptPath;
      }
    }
    
    throw new Error(`Script not found for ${serverName}: ${scriptFile}`);
  }
  
  /**
   * Get status of all servers
   */
  getStatus(): {
    total: number;
    running: number;
    stopped: number;
    servers: Array<{
      name: string;
      status: string;
      lastUsed: string;
      useCount: number;
      uptime?: string;
    }>;
  } {
    const servers = Array.from(this.servers.values()).map(server => {
      const lastUsedMinutes = Math.round((Date.now() - server.lastUsed) / 60000);
      const uptime = server.startTime ? 
        Math.round((Date.now() - server.startTime) / 60000) + ' minutes' : 
        undefined;
      
      return {
        name: server.name,
        status: server.status,
        lastUsed: `${lastUsedMinutes} minutes ago`,
        useCount: server.useCount,
        uptime
      };
    });
    
    return {
      total: servers.length,
      running: servers.filter(s => s.status === 'running').length,
      stopped: servers.filter(s => s.status === 'stopped').length,
      servers
    };
  }
  
  /**
   * Stop all servers
   */
  async stopAll(): Promise<void> {
    logger.info('🛑 Stopping all MCP servers...');
    
    const promises = Array.from(this.servers.keys()).map(name => 
      this.stopServer(name)
    );
    
    await Promise.all(promises);
    this.stopInactivityMonitor();
  }
}