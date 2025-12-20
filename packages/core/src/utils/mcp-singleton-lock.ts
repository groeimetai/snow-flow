/**
 * MCP Singleton Lock Utility
 * Prevents duplicate MCP server instances across all start mechanisms
 */

import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Logger } from './logger.js';

const logger = new Logger('MCPSingleton');

export class MCPSingletonLock {
  private lockDir: string;
  private lockFile: string;
  private acquired = false;

  constructor() {
    this.lockDir = join(homedir(), '.claude');
    this.lockFile = join(this.lockDir, 'mcp-servers.lock');
  }

  /**
   * Acquire singleton lock to prevent duplicate MCP server instances
   */
  acquire(): boolean {
    // Create .claude directory if it doesn't exist
    if (!existsSync(this.lockDir)) {
      mkdirSync(this.lockDir, { recursive: true });
    }
    
    // Check if lock exists and process is still running
    if (existsSync(this.lockFile)) {
      try {
        const existingPid = parseInt(readFileSync(this.lockFile, 'utf8'));
        
        // Check if process is still running
        try {
          process.kill(existingPid, 0); // Signal 0 just checks if process exists
          logger.warn(`MCP servers already running with PID: ${existingPid}`);
          logger.info('Use "pkill -f mcp" to stop existing servers first');
          return false;
        } catch (e) {
          // Process not running, remove stale lock
          logger.info('Removing stale lock file from dead process');
          unlinkSync(this.lockFile);
        }
      } catch (e) {
        // Invalid lock file, remove it
        logger.info('Removing invalid lock file');
        unlinkSync(this.lockFile);
      }
    }
    
    // Create new lock with current PID
    writeFileSync(this.lockFile, process.pid.toString());
    logger.info(`🔒 MCP singleton lock acquired (PID: ${process.pid})`);
    this.acquired = true;
    
    // Set up cleanup handlers
    this.setupCleanupHandlers();
    
    return true;
  }

  /**
   * Release the singleton lock
   */
  release(): void {
    if (this.acquired && existsSync(this.lockFile)) {
      try {
        unlinkSync(this.lockFile);
        logger.info('🔓 MCP singleton lock released');
        this.acquired = false;
      } catch (e) {
        logger.warn('Failed to release lock file:', e);
      }
    }
  }

  /**
   * Release the singleton lock without blocking (for graceful shutdown)
   */
  releaseAsync(): Promise<void> {
    return new Promise((resolve) => {
      // Use setImmediate to avoid blocking
      setImmediate(() => {
        this.release();
        resolve();
      });
    });
  }

  /**
   * Check if lock is currently held by this process
   */
  isAcquired(): boolean {
    return this.acquired;
  }

  /**
   * Setup cleanup handlers to release lock on process exit
   */
  private setupCleanupHandlers(): void {
    const cleanup = () => {
      // Use non-blocking release to prevent hanging during shutdown
      setImmediate(() => {
        this.release();
      });
    };
    
    // Remove existing handlers to prevent duplicate registrations
    process.removeAllListeners('exit');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    
    process.once('exit', cleanup);
    process.once('SIGINT', () => {
      cleanup();
      // Allow graceful exit after cleanup
      setTimeout(() => process.exit(0), 100);
    });
    process.once('SIGTERM', () => {
      cleanup();
      // Allow graceful exit after cleanup
      setTimeout(() => process.exit(0), 100);
    });
    process.once('uncaughtException', (error) => {
      logger.error('Uncaught exception, releasing MCP lock:', error);
      cleanup();
      setTimeout(() => process.exit(1), 100);
    });
    process.once('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection, releasing MCP lock:', reason);
      cleanup();
      setTimeout(() => process.exit(1), 100);
    });
  }

  /**
   * Force release any existing lock (for cleanup scripts)
   */
  static forceRelease(): boolean {
    const lockFile = join(homedir(), '.claude', 'mcp-servers.lock');
    
    if (existsSync(lockFile)) {
      try {
        unlinkSync(lockFile);
        logger.info('🔓 Forced release of MCP singleton lock');
        return true;
      } catch (e) {
        logger.error('Failed to force release lock:', e);
        return false;
      }
    }
    
    return false; // No lock existed
  }
}

// Global singleton instance
let globalLock: MCPSingletonLock | null = null;

/**
 * Get the global MCP singleton lock instance
 */
export function getMCPSingletonLock(): MCPSingletonLock {
  if (!globalLock) {
    globalLock = new MCPSingletonLock();
  }
  return globalLock;
}