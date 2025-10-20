"use strict";
/**
 * MCP Process Manager - SAFE VERSION
 * Emergency fix for memory crash issues
 * Implements graceful shutdown and memory-safe cleanup
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpProcessManager = exports.MCPProcessManager = void 0;
const child_process_1 = require("child_process");
const logger_js_1 = require("./logger.js");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const logger = new logger_js_1.Logger('MCPProcessManager');
class MCPProcessManager {
    constructor() {
        // INCREASED LIMITS TO PREVENT AGGRESSIVE CLEANUP
        this.MAX_MCP_SERVERS = parseInt(process.env.SNOW_MAX_MCP_SERVERS || '30'); // Increased from 10
        this.MAX_MEMORY_MB = parseInt(process.env.SNOW_MCP_MEMORY_LIMIT || '3000'); // Increased from 1500
        // PERMANENTLY DISABLED AUTOMATIC CLEANUP FOR PERSISTENT SERVERS
        this.CLEANUP_ENABLED = false; // Permanently disabled - servers should run forever
        this.CLEANUP_INTERVAL = Infinity; // Never cleanup
        this.isCleaningUp = false;
        // Never start cleanup - servers should be persistent
        logger.info('✅ MCP cleanup is PERMANENTLY DISABLED - servers will run forever');
        logger.info('🔄 MCP servers are now persistent and will not auto-shutdown');
    }
    static getInstance() {
        if (!MCPProcessManager.instance) {
            MCPProcessManager.instance = new MCPProcessManager();
        }
        return MCPProcessManager.instance;
    }
    /**
     * Check if we can spawn a new MCP server
     */
    canSpawnServer() {
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
    getSystemStatus() {
        try {
            // More careful process detection
            const psOutput = (0, child_process_1.execSync)('ps aux | grep -E "mcp|servicenow.*mcp" | grep -v grep || true', {
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
            const processes = [];
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
                }
                catch (e) {
                    // Skip malformed lines
                }
            }
            return {
                processCount: processes.length,
                memoryUsageMB: totalMemory,
                processes
            };
        }
        catch (error) {
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
    async gracefulKill(pid, name) {
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
                }
                catch {
                    // Process terminated
                    logger.info(`✅ Gracefully stopped ${name} (PID: ${pid})`);
                    return true;
                }
            }
            // Force kill if still alive
            process.kill(pid, 'SIGKILL');
            logger.warn(`⚠️ Force killed ${name} (PID: ${pid})`);
            return true;
        }
        catch (error) {
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
    async killDuplicates() {
        if (this.isCleaningUp) {
            logger.warn('Cleanup already in progress, skipping...');
            return;
        }
        this.isCleaningUp = true;
        try {
            const status = this.getSystemStatus();
            // Group processes by server type
            const serverGroups = new Map();
            for (const proc of status.processes) {
                const match = proc.name.match(/servicenow-([^-]+)-mcp\.js/);
                if (match) {
                    const serverType = match[1];
                    if (!serverGroups.has(serverType)) {
                        serverGroups.set(serverType, []);
                    }
                    serverGroups.get(serverType).push({
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
        }
        finally {
            this.isCleaningUp = false;
        }
    }
    /**
     * Emergency cleanup - only for critical situations
     */
    async emergencyCleanup() {
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
    async cleanup() {
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
    startPeriodicCleanup() {
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
            }
            catch (error) {
                logger.error('Cleanup failed:', error);
            }
        }, this.CLEANUP_INTERVAL);
        // Don't block process exit
        this.cleanupTimer.unref();
    }
    /**
     * Stop periodic cleanup
     */
    stopPeriodicCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
            logger.info('✅ Periodic cleanup stopped');
        }
    }
    /**
     * Kill all MCP servers - USE WITH CAUTION
     */
    async killAll() {
        logger.warn('🔴 KILLING ALL MCP PROCESSES');
        try {
            // First try graceful shutdown
            await execAsync('pkill -TERM -f mcp');
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Then force kill any remaining
            await execAsync('pkill -KILL -f mcp');
            logger.info('✅ All MCP processes terminated');
        }
        catch (error) {
            // pkill returns non-zero if no processes found
            logger.info('No MCP processes to kill');
        }
    }
    /**
     * Get resource usage summary
     */
    getResourceSummary() {
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
    getHealthStatus() {
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
exports.MCPProcessManager = MCPProcessManager;
// Export singleton instance
exports.mcpProcessManager = MCPProcessManager.getInstance();
//# sourceMappingURL=mcp-process-manager.js.map