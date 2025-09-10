/**
 * MCP Process Manager - SAFE VERSION
 * Emergency fix for memory crash issues
 * Implements graceful shutdown and memory-safe cleanup
 */

import { execSync, exec } from 'child_process';
import { Logger } from './logger.js';
import { getMCPSingletonLock } from './mcp-singleton-lock.js';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = new Logger('MCPProcessManager');

export class MCPProcessManager {
  private static instance: MCPProcessManager;
  
  // INCREASED LIMITS TO PREVENT AGGRESSIVE CLEANUP
  private readonly MAX_MCP_SERVERS = parseInt(process.env.SNOW_MAX_MCP_SERVERS || '30'); // Increased from 10
  private readonly MAX_MEMORY_MB = parseInt(process.env.SNOW_MCP_MEMORY_LIMIT || '3000'); // Increased from 1500
  
  // PERMANENTLY DISABLED AUTOMATIC CLEANUP FOR PERSISTENT SERVERS
  private readonly CLEANUP_ENABLED = false; // Permanently disabled - servers should run forever
  private readonly CLEANUP_INTERVAL = Infinity; // Never cleanup
  
  private cleanupTimer?: NodeJS.Timeout;
  private isCleaningUp = false;
  
  private constructor() {
    // Never start cleanup - servers should be persistent
    logger.info('✅ MCP cleanup is PERMANENTLY DISABLED - servers will run forever');
    logger.info('🔄 MCP servers are now persistent and will not auto-shutdown');
  }
  
  static getInstance(): MCPProcessManager {
    if (!MCPProcessManager.instance) {
      MCPProcessManager.instance = new MCPProcessManager();
    }
    return MCPProcessManager.instance;
  }
  
  /**
   * Check if we can spawn a new MCP server
   */
  canSpawnServer(): boolean {
    const status = this.getSystemStatus();
    
    // More lenient limits
    if (status.processCount >= this.MAX_MCP_SERVERS) {
      logger.warn(`⚠️ At server limit (${status.processCount}/${this.MAX_MCP_SERVERS}) - consider manual cleanup`);
      // Still allow spawning unless critically high
      if (status.processCount >= this.MAX_MCP_SERVERS * 1.5) {
        return false;
      }
    }
    
    if (status.memoryUsageMB > this.MAX_MEMORY_MB) {
      logger.warn(`⚠️ High memory usage (${status.memoryUsageMB}MB > ${this.MAX_MEMORY_MB}MB)`);
      // Still allow spawning unless critically high
      if (status.memoryUsageMB > this.MAX_MEMORY_MB * 1.5) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get current MCP system status - SAFER VERSION
   */
  getSystemStatus(): {
    processCount: number;
    memoryUsageMB: number;
    processes: Array<{pid: number; memory: number; name: string}>;
  } {
    try {
      // More careful process detection
      const psOutput = execSync('ps aux | grep -E "mcp|servicenow.*mcp" | grep -v grep || true', {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 // 1MB buffer limit
      }).trim();
      
      if (!psOutput) {
        return {
          processCount: 0,
          memoryUsageMB: 0,
          processes: []
        };
      }
      
      const lines = psOutput.split('\n').slice(0, 100); // Limit to 100 processes
      const processes: Array<{pid: number; memory: number; name: string}> = [];
      let totalMemory = 0;
      
      for (const line of lines) {
        try {
          const parts = line.split(/\s+/);
          if (parts.length > 10) {
            const pid = parseInt(parts[1]);
            const memory = Math.round(parseInt(parts[5]) / 1024); // Convert KB to MB
            const name = parts.slice(10).join(' ').substring(0, 100); // Limit name length
            
            if (!isNaN(pid) && !isNaN(memory)) {
              processes.push({ pid, memory, name });
              totalMemory += memory;
            }
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
      
      return {
        processCount: processes.length,
        memoryUsageMB: totalMemory,
        processes
      };
    } catch (error) {
      logger.error('Failed to get system status:', error);
      return {
        processCount: 0,
        memoryUsageMB: 0,
        processes: []
      };
    }
  }
  
  /**
   * Gracefully shutdown a process with timeout
   */
  private async gracefulKill(pid: number, name: string): Promise<boolean> {
    try {
      // First try SIGTERM for graceful shutdown
      process.kill(pid, 'SIGTERM');
      
      // Wait up to 5 seconds for graceful shutdown
      let waited = 0;
      while (waited < 5000) {
        try {
          process.kill(pid, 0); // Check if still alive
          await new Promise(resolve => setTimeout(resolve, 500));
          waited += 500;
        } catch {
          // Process terminated
          logger.info(`✅ Gracefully stopped ${name} (PID: ${pid})`);
          return true;
        }
      }
      
      // Force kill if still alive
      process.kill(pid, 'SIGKILL');
      logger.warn(`⚠️ Force killed ${name} (PID: ${pid})`);
      return true;
      
    } catch (error: any) {
      if (error.code === 'ESRCH') {
        // Process already dead
        return true;
      }
      logger.error(`Failed to kill ${name} (PID: ${pid}):`, error);
      return false;
    }
  }
  
  /**
   * Kill duplicate MCP servers - SAFER VERSION
   */
  async killDuplicates(): Promise<void> {
    if (this.isCleaningUp) {
      logger.warn('Cleanup already in progress, skipping...');
      return;
    }
    
    this.isCleaningUp = true;
    
    try {
      const status = this.getSystemStatus();
      
      // Group processes by server type
      const serverGroups = new Map<string, Array<{pid: number; memory: number}>>();
      
      for (const proc of status.processes) {
        const match = proc.name.match(/servicenow-([^-]+)-mcp\.js/);
        if (match) {
          const serverType = match[1];
          if (!serverGroups.has(serverType)) {
            serverGroups.set(serverType, []);
          }
          serverGroups.get(serverType)!.push({
            pid: proc.pid,
            memory: proc.memory
          });
        }
      }
      
      // Kill duplicates gracefully
      for (const [serverType, procs] of serverGroups) {
        if (procs.length > 2) { // Only clean if more than 2 duplicates
          logger.info(`Found ${procs.length} instances of ${serverType}-mcp`);
          
          // Sort by memory usage (kill highest consumers first)
          procs.sort((a, b) => b.memory - a.memory);
          
          // Keep 2 instances, kill the rest
          for (let i = 2; i < procs.length; i++) {
            await this.gracefulKill(procs[i].pid, `${serverType}-mcp`);
            
            // Wait between kills to avoid memory spike
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    } finally {
      this.isCleaningUp = false;
    }
  }
  
  /**
   * Emergency cleanup - only for critical situations
   */
  async emergencyCleanup(): Promise<void> {
    logger.warn('🚨 EMERGENCY CLEANUP INITIATED');
    
    const status = this.getSystemStatus();
    
    if (status.memoryUsageMB > this.MAX_MEMORY_MB * 2) {
      logger.error(`🔴 CRITICAL: Memory usage ${status.memoryUsageMB}MB - killing highest consumers`);
      
      // Sort by memory usage
      const sorted = status.processes.sort((a, b) => b.memory - a.memory);
      
      // Kill top 3 memory consumers
      for (let i = 0; i < Math.min(3, sorted.length); i++) {
        await this.gracefulKill(sorted[i].pid, sorted[i].name);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between kills
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection');
      }
    }
  }
  
  /**
   * Safe cleanup - only when absolutely necessary
   */
  async cleanup(): Promise<void> {
    if (!this.CLEANUP_ENABLED) {
      logger.info('Cleanup disabled for stability');
      return;
    }
    
    if (this.isCleaningUp) {
      logger.warn('Cleanup already in progress');
      return;
    }
    
    const status = this.getSystemStatus();
    
    // Only cleanup if REALLY necessary
    if (status.processCount > this.MAX_MCP_SERVERS * 1.5) {
      logger.warn(`🧹 Too many MCP servers (${status.processCount}), cleaning duplicates...`);
      await this.killDuplicates();
    }
    
    if (status.memoryUsageMB > this.MAX_MEMORY_MB * 1.5) {
      await this.emergencyCleanup();
    }
  }
  
  /**
   * Start periodic cleanup - MUCH SAFER
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Only run cleanup when critically necessary
    this.cleanupTimer = setInterval(async () => {
      try {
        const status = this.getSystemStatus();
        
        // Only cleanup if CRITICALLY high
        if (status.processCount > this.MAX_MCP_SERVERS * 2 || 
            status.memoryUsageMB > this.MAX_MEMORY_MB * 2) {
          logger.warn('🔄 Critical resource usage detected, running cleanup...');
          await this.cleanup();
        }
      } catch (error) {
        logger.error('Cleanup failed:', error);
      }
    }, this.CLEANUP_INTERVAL);
    
    // Don't block process exit
    this.cleanupTimer.unref();
  }
  
  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      logger.info('✅ Periodic cleanup stopped');
    }
  }
  
  /**
   * Kill all MCP servers - USE WITH CAUTION
   */
  async killAll(): Promise<void> {
    logger.warn('🔴 KILLING ALL MCP PROCESSES');
    
    try {
      // First try graceful shutdown
      await execAsync('pkill -TERM -f mcp');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Then force kill any remaining
      await execAsync('pkill -KILL -f mcp');
      
      logger.info('✅ All MCP processes terminated');
    } catch (error) {
      // pkill returns non-zero if no processes found
      logger.info('No MCP processes to kill');
    }
  }
  
  /**
   * Get resource usage summary
   */
  getResourceSummary(): string {
    const status = this.getSystemStatus();
    
    return `MCP Resources:
  Processes: ${status.processCount}/${this.MAX_MCP_SERVERS} (${Math.round(status.processCount / this.MAX_MCP_SERVERS * 100)}%)
  Memory: ${status.memoryUsageMB}MB/${this.MAX_MEMORY_MB}MB (${Math.round(status.memoryUsageMB / this.MAX_MEMORY_MB * 100)}%)
  Cleanup: ${this.CLEANUP_ENABLED ? 'ENABLED' : 'DISABLED'}
  Status: ${this.getHealthStatus()}`;
  }
  
  /**
   * Get health status
   */
  getHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const status = this.getSystemStatus();
    
    const processPercent = status.processCount / this.MAX_MCP_SERVERS;
    const memoryPercent = status.memoryUsageMB / this.MAX_MEMORY_MB;
    
    if (processPercent > 1.5 || memoryPercent > 1.5) {
      return 'critical';
    }
    
    if (processPercent > 1.0 || memoryPercent > 1.0) {
      return 'warning';
    }
    
    return 'healthy';
  }
}

// Export singleton instance
export const mcpProcessManager = MCPProcessManager.getInstance();