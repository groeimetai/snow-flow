/**
 * Connection Cleanup Worker (v2.0.0)
 *
 * Periodically removes stale MCP connections that haven't sent a heartbeat
 * within the timeout period. Runs every 60 seconds and removes connections
 * that haven't been seen for 2+ minutes.
 *
 * Features:
 * - Automatic stale connection cleanup
 * - Active seat recalculation
 * - Connection timeout event logging
 * - Graceful shutdown support
 */

import winston from 'winston';
import { LicenseDatabase } from '../database/schema.js';

export interface CleanupWorkerOptions {
  /** Cleanup interval in milliseconds (default: 60 seconds) */
  intervalMs?: number;
  /** Connection timeout in milliseconds (default: 2 minutes) */
  timeoutMs?: number;
  /** Logger instance */
  logger?: winston.Logger;
  /** Database instance */
  db: LicenseDatabase;
}

export class ConnectionCleanupWorker {
  private intervalMs: number;
  private timeoutMs: number;
  private logger: winston.Logger;
  private db: LicenseDatabase;
  private intervalHandle?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(options: CleanupWorkerOptions) {
    this.intervalMs = options.intervalMs || 60 * 1000; // 60 seconds
    this.timeoutMs = options.timeoutMs || 2 * 60 * 1000; // 2 minutes
    this.db = options.db;

    // Use provided logger or create default
    this.logger = options.logger || winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Start the cleanup worker
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Cleanup worker already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('🧹 Connection cleanup worker started', {
      intervalMs: this.intervalMs,
      timeoutMs: this.timeoutMs
    });

    // Run immediately on start
    this.cleanup().catch(error => {
      this.logger.error('Initial cleanup failed:', error);
    });

    // Schedule periodic cleanup
    this.intervalHandle = setInterval(() => {
      this.cleanup().catch(error => {
        this.logger.error('Scheduled cleanup failed:', error);
      });
    }, this.intervalMs);
  }

  /**
   * Stop the cleanup worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }

    this.isRunning = false;
    this.logger.info('🛑 Connection cleanup worker stopped');
  }

  /**
   * Perform cleanup operation
   */
  private async cleanup(): Promise<void> {
    const startTime = Date.now();

    try {
      // Get all stale connections before cleanup (for logging)
      const staleConnections = await this.getStaleConnections();

      // Remove stale connections
      const removedCount = await this.db.cleanupStaleConnections(this.timeoutMs);

      if (removedCount > 0) {
        this.logger.info('🧹 Cleaned up stale connections:', {
          removedCount,
          timeoutMs: this.timeoutMs,
          durationMs: Date.now() - startTime
        });

        // Log timeout events for each removed connection
        await this.logTimeoutEvents(staleConnections);

        // Recalculate active seats for affected customers
        const affectedCustomers = new Set(staleConnections.map(c => c.customerId));

        for (const customerId of affectedCustomers) {
          try {
            await this.db.recalculateActiveSeats(customerId);
            this.logger.debug('Recalculated seats for customer:', { customerId });
          } catch (recalcError) {
            this.logger.error('Failed to recalculate seats:', { customerId, error: recalcError });
          }
        }
      } else {
        // Only log at debug level when nothing was cleaned
        this.logger.debug('✅ No stale connections found');
      }
    } catch (error) {
      this.logger.error('Cleanup operation failed:', error);
      throw error;
    }
  }

  /**
   * Get list of stale connections (for logging before cleanup)
   */
  private async getStaleConnections(): Promise<Array<{
    customerId: number;
    userId: string;
    role: 'developer' | 'stakeholder' | 'admin';
    lastSeen: number;
  }>> {
    const cutoff = Date.now() - this.timeoutMs;

    const [rows] = await this.db.pool.execute(
      `SELECT customer_id, user_id, role, last_seen
       FROM active_connections
       WHERE last_seen < ?`,
      [cutoff]
    );

    return (rows as any[]).map(row => ({
      customerId: row.customer_id,
      userId: row.user_id,
      role: row.role,
      lastSeen: row.last_seen
    }));
  }

  /**
   * Log timeout events for removed connections
   */
  private async logTimeoutEvents(
    connections: Array<{
      customerId: number;
      userId: string;
      role: 'developer' | 'stakeholder' | 'admin';
      lastSeen: number;
    }>
  ): Promise<void> {
    for (const conn of connections) {
      try {
        const timeSinceLastSeen = Math.floor((Date.now() - conn.lastSeen) / 1000);

        await this.db.logConnectionEvent(
          conn.customerId,
          conn.userId,
          conn.role,
          'timeout',
          undefined,
          `No heartbeat for ${timeSinceLastSeen} seconds`
        );
      } catch (logError) {
        this.logger.error('Failed to log timeout event:', {
          connection: conn,
          error: logError
        });
      }
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    intervalMs: number;
    timeoutMs: number;
  } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      timeoutMs: this.timeoutMs
    };
  }

  /**
   * Force immediate cleanup (for testing or manual triggers)
   */
  async forceCleanup(): Promise<number> {
    this.logger.info('🔧 Force cleanup triggered');
    await this.cleanup();

    // Return count of removed connections
    return await this.db.cleanupStaleConnections(this.timeoutMs);
  }
}

/**
 * Factory function to create and start a cleanup worker
 */
export function createCleanupWorker(options: CleanupWorkerOptions): ConnectionCleanupWorker {
  const worker = new ConnectionCleanupWorker(options);
  worker.start();
  return worker;
}
