"use strict";
/**
 * MCP Singleton Lock Utility
 * Prevents duplicate MCP server instances across all start mechanisms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPSingletonLock = void 0;
exports.getMCPSingletonLock = getMCPSingletonLock;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const logger_js_1 = require("./logger.js");
const logger = new logger_js_1.Logger('MCPSingleton');
class MCPSingletonLock {
    constructor() {
        this.acquired = false;
        this.lockDir = (0, path_1.join)((0, os_1.homedir)(), '.claude');
        this.lockFile = (0, path_1.join)(this.lockDir, 'mcp-servers.lock');
    }
    /**
     * Acquire singleton lock to prevent duplicate MCP server instances
     */
    acquire() {
        // Create .claude directory if it doesn't exist
        if (!(0, fs_1.existsSync)(this.lockDir)) {
            (0, fs_1.mkdirSync)(this.lockDir, { recursive: true });
        }
        // Check if lock exists and process is still running
        if ((0, fs_1.existsSync)(this.lockFile)) {
            try {
                const existingPid = parseInt((0, fs_1.readFileSync)(this.lockFile, 'utf8'));
                // Check if process is still running
                try {
                    process.kill(existingPid, 0); // Signal 0 just checks if process exists
                    logger.warn(`MCP servers already running with PID: ${existingPid}`);
                    logger.info('Use "pkill -f mcp" to stop existing servers first');
                    return false;
                }
                catch (e) {
                    // Process not running, remove stale lock
                    logger.info('Removing stale lock file from dead process');
                    (0, fs_1.unlinkSync)(this.lockFile);
                }
            }
            catch (e) {
                // Invalid lock file, remove it
                logger.info('Removing invalid lock file');
                (0, fs_1.unlinkSync)(this.lockFile);
            }
        }
        // Create new lock with current PID
        (0, fs_1.writeFileSync)(this.lockFile, process.pid.toString());
        logger.info(`🔒 MCP singleton lock acquired (PID: ${process.pid})`);
        this.acquired = true;
        // Set up cleanup handlers
        this.setupCleanupHandlers();
        return true;
    }
    /**
     * Release the singleton lock
     */
    release() {
        if (this.acquired && (0, fs_1.existsSync)(this.lockFile)) {
            try {
                (0, fs_1.unlinkSync)(this.lockFile);
                logger.info('🔓 MCP singleton lock released');
                this.acquired = false;
            }
            catch (e) {
                logger.warn('Failed to release lock file:', e);
            }
        }
    }
    /**
     * Release the singleton lock without blocking (for graceful shutdown)
     */
    releaseAsync() {
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
    isAcquired() {
        return this.acquired;
    }
    /**
     * Setup cleanup handlers to release lock on process exit
     */
    setupCleanupHandlers() {
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
    static forceRelease() {
        const lockFile = (0, path_1.join)((0, os_1.homedir)(), '.claude', 'mcp-servers.lock');
        if ((0, fs_1.existsSync)(lockFile)) {
            try {
                (0, fs_1.unlinkSync)(lockFile);
                logger.info('🔓 Forced release of MCP singleton lock');
                return true;
            }
            catch (e) {
                logger.error('Failed to force release lock:', e);
                return false;
            }
        }
        return false; // No lock existed
    }
}
exports.MCPSingletonLock = MCPSingletonLock;
// Global singleton instance
let globalLock = null;
/**
 * Get the global MCP singleton lock instance
 */
function getMCPSingletonLock() {
    if (!globalLock) {
        globalLock = new MCPSingletonLock();
    }
    return globalLock;
}
//# sourceMappingURL=mcp-singleton-lock.js.map