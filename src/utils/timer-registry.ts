/**
 * Timer Registry - Centralized timer management for snow-flow
 * Ensures all intervals/timeouts are properly tracked and cleaned up
 *
 * This module provides automatic cleanup ONLY during graceful shutdown.
 * Timers are NOT cleaned up aggressively during normal operation.
 *
 * @module timer-registry
 */

import { Logger } from './logger.js';

/**
 * Shutdown handler function type
 */
type ShutdownHandler = () => Promise<void> | void;

/**
 * Timer info for tracking
 */
interface TimerInfo {
  id: string;
  type: 'interval' | 'timeout';
  timer: NodeJS.Timeout;
  createdAt: number;
  callback: string; // Function name for debugging
}

/**
 * TimerRegistry - Singleton class for centralized timer management
 *
 * Features:
 * - Automatic cleanup on process exit
 * - Named timers for easy management
 * - Shutdown handlers for graceful cleanup
 * - Statistics and monitoring
 */
export class TimerRegistry {
  private static instance: TimerRegistry;
  private intervals: Map<string, TimerInfo> = new Map();
  private timeouts: Map<string, TimerInfo> = new Map();
  private shutdownHandlers: ShutdownHandler[] = [];
  private logger: Logger;
  private isShuttingDown = false;
  private shutdownHandlersRegistered = false;

  private constructor() {
    this.logger = new Logger('TimerRegistry');
    this.registerGlobalShutdownHandlers();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): TimerRegistry {
    if (!TimerRegistry.instance) {
      TimerRegistry.instance = new TimerRegistry();
    }
    return TimerRegistry.instance;
  }

  /**
   * Register global shutdown handlers (only once)
   */
  private registerGlobalShutdownHandlers(): void {
    if (this.shutdownHandlersRegistered) return;

    const shutdownHandler = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      this.logger.info(`Received ${signal}, cleaning up timers...`);
      await this.cleanup();
    };

    // Use once() to avoid listener accumulation
    process.once('beforeExit', () => shutdownHandler('beforeExit'));
    process.once('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.once('SIGINT', () => shutdownHandler('SIGINT'));

    this.shutdownHandlersRegistered = true;
  }

  /**
   * Register a named interval
   *
   * @param id Unique identifier for the interval
   * @param callback Function to execute
   * @param ms Interval in milliseconds
   * @param unref If true, don't keep the process alive for this timer (default: true)
   * @returns The NodeJS.Timeout object
   */
  registerInterval(
    id: string,
    callback: () => void | Promise<void>,
    ms: number,
    unref = true
  ): NodeJS.Timeout {
    // Clear existing interval with same id
    this.clearInterval(id);

    const wrappedCallback = async () => {
      try {
        await callback();
      } catch (error) {
        this.logger.error(`Interval ${id} error:`, error);
      }
    };

    const timer = setInterval(wrappedCallback, ms);
    if (unref) timer.unref();

    const info: TimerInfo = {
      id,
      type: 'interval',
      timer,
      createdAt: Date.now(),
      callback: callback.name || 'anonymous'
    };

    this.intervals.set(id, info);
    this.logger.debug(`Registered interval: ${id} (${ms}ms)`);

    return timer;
  }

  /**
   * Register a named timeout
   *
   * @param id Unique identifier for the timeout
   * @param callback Function to execute
   * @param ms Delay in milliseconds
   * @returns The NodeJS.Timeout object
   */
  registerTimeout(
    id: string,
    callback: () => void | Promise<void>,
    ms: number
  ): NodeJS.Timeout {
    // Clear existing timeout with same id
    this.clearTimeout(id);

    const wrappedCallback = async () => {
      this.timeouts.delete(id);
      try {
        await callback();
      } catch (error) {
        this.logger.error(`Timeout ${id} error:`, error);
      }
    };

    const timer = setTimeout(wrappedCallback, ms);

    const info: TimerInfo = {
      id,
      type: 'timeout',
      timer,
      createdAt: Date.now(),
      callback: callback.name || 'anonymous'
    };

    this.timeouts.set(id, info);
    this.logger.debug(`Registered timeout: ${id} (${ms}ms)`);

    return timer;
  }

  /**
   * Clear a named interval
   * @param id The interval identifier
   */
  clearInterval(id: string): void {
    const info = this.intervals.get(id);
    if (info) {
      clearInterval(info.timer);
      this.intervals.delete(id);
      this.logger.debug(`Cleared interval: ${id}`);
    }
  }

  /**
   * Clear a named timeout
   * @param id The timeout identifier
   */
  clearTimeout(id: string): void {
    const info = this.timeouts.get(id);
    if (info) {
      clearTimeout(info.timer);
      this.timeouts.delete(id);
      this.logger.debug(`Cleared timeout: ${id}`);
    }
  }

  /**
   * Check if an interval exists
   * @param id The interval identifier
   */
  hasInterval(id: string): boolean {
    return this.intervals.has(id);
  }

  /**
   * Check if a timeout exists
   * @param id The timeout identifier
   */
  hasTimeout(id: string): boolean {
    return this.timeouts.has(id);
  }

  /**
   * Register a shutdown handler
   * Called during cleanup() in reverse order of registration
   *
   * @param handler Async function to call during shutdown
   */
  registerShutdownHandler(handler: ShutdownHandler): void {
    this.shutdownHandlers.push(handler);
    this.logger.debug(`Registered shutdown handler (total: ${this.shutdownHandlers.length})`);
  }

  /**
   * Remove a shutdown handler
   * @param handler The handler to remove
   */
  removeShutdownHandler(handler: ShutdownHandler): void {
    const idx = this.shutdownHandlers.indexOf(handler);
    if (idx > -1) {
      this.shutdownHandlers.splice(idx, 1);
      this.logger.debug(`Removed shutdown handler (total: ${this.shutdownHandlers.length})`);
    }
  }

  /**
   * Cleanup all timers and run shutdown handlers
   */
  async cleanup(): Promise<void> {
    this.logger.info('Starting cleanup...');

    // Clear all intervals
    const intervalCount = this.intervals.size;
    this.intervals.forEach((info) => {
      clearInterval(info.timer);
    });
    this.intervals.clear();

    // Clear all timeouts
    const timeoutCount = this.timeouts.size;
    this.timeouts.forEach((info) => {
      clearTimeout(info.timer);
    });
    this.timeouts.clear();

    // Run shutdown handlers in reverse order (LIFO)
    const handlerCount = this.shutdownHandlers.length;
    const handlers = [...this.shutdownHandlers].reverse();
    this.shutdownHandlers = [];

    for (const handler of handlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.error('Shutdown handler error:', error);
      }
    }

    this.logger.info(`Cleanup complete: ${intervalCount} intervals, ${timeoutCount} timeouts, ${handlerCount} handlers`);
  }

  /**
   * Get statistics about registered timers
   */
  getStats(): {
    intervals: number;
    timeouts: number;
    shutdownHandlers: number;
    intervalIds: string[];
    timeoutIds: string[];
  } {
    return {
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      shutdownHandlers: this.shutdownHandlers.length,
      intervalIds: Array.from(this.intervals.keys()),
      timeoutIds: Array.from(this.timeouts.keys())
    };
  }

  /**
   * Get detailed information about all timers
   */
  getDetailedStats(): {
    intervals: Array<{ id: string; ageMs: number; callback: string }>;
    timeouts: Array<{ id: string; ageMs: number; callback: string }>;
    shutdownHandlerCount: number;
  } {
    const now = Date.now();

    return {
      intervals: Array.from(this.intervals.values()).map(info => ({
        id: info.id,
        ageMs: now - info.createdAt,
        callback: info.callback
      })),
      timeouts: Array.from(this.timeouts.values()).map(info => ({
        id: info.id,
        ageMs: now - info.createdAt,
        callback: info.callback
      })),
      shutdownHandlerCount: this.shutdownHandlers.length
    };
  }

  /**
   * Clear all timers by prefix
   * Useful for cleaning up all timers from a specific component
   *
   * @param prefix The prefix to match (e.g., 'mcp-' clears 'mcp-auth', 'mcp-metrics', etc.)
   */
  clearByPrefix(prefix: string): { intervals: number; timeouts: number } {
    let intervalCount = 0;
    let timeoutCount = 0;

    // Collect keys to clear (can't modify while iterating)
    const intervalsToClear: string[] = [];
    const timeoutsToClear: string[] = [];

    this.intervals.forEach((_, id) => {
      if (id.startsWith(prefix)) {
        intervalsToClear.push(id);
      }
    });

    this.timeouts.forEach((_, id) => {
      if (id.startsWith(prefix)) {
        timeoutsToClear.push(id);
      }
    });

    // Clear collected timers
    intervalsToClear.forEach(id => {
      this.clearInterval(id);
      intervalCount++;
    });

    timeoutsToClear.forEach(id => {
      this.clearTimeout(id);
      timeoutCount++;
    });

    this.logger.debug(`Cleared by prefix '${prefix}': ${intervalCount} intervals, ${timeoutCount} timeouts`);

    return { intervals: intervalCount, timeouts: timeoutCount };
  }
}

/**
 * Singleton instance of TimerRegistry
 * Use this for all timer management in snow-flow
 */
export const timerRegistry = TimerRegistry.getInstance();
